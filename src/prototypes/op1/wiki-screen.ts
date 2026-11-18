// The synth screen, with articles: 320 × 160 pixels, drawn a pixel at a
// time and scaled up without smoothing, so everything on it is 8-bit. In the middle, the
// Wikipedia globe, a puzzle sphere with its top piece missing; in the four
// corners, the four articles' addresses, /wiki/Title, each in its knob's
// colour with what it does to the sound beneath (or above) it.
//
// When a note sounds, each title bends into its slot's shape, the same
// shapes Mondrian's pedals draw: the waveform's wave,
// the filter's curve falling past the cutoff, the envelope's strike and
// decay, the effect's wobble. The wave and the wobble slide along, leaving
// fading echoes behind them, and the globe's puzzle pieces spring apart
// sideways: a hair for a smooth sound, nearly to the screen's edges for a
// rough one. All of it settles back as the note fades.

import { SoundMap, type Article, type Slot } from './wiki'
import { textPixels, textWidth, GLYPH_H } from './font'
import { GLOBE_W, PIECES } from './logo'

export const W = 320;
export const H = 160;
const MARGIN = 6;
const BEND = 12; // how far a title's pixels move, at most, as a note strikes
const SINK = 0.55; // while it bends, a title also moves this much of BEND toward the middle, to stay on the screen
const ECHOES = [8, 4]; // frames back, for the fading copies behind each bending title

/** The knobs' colours on the screen, by slot: blue, green, white and orange. */
export const INK = {
  waveform: [80, 150, 255],
  filter: [40, 214, 120],
  envelope: [236, 236, 236],
  effect: [255, 128, 32],
};
const dim = ([r, g, b], k = 0.5): [number, number, number] => [r * k, g * k, b * k];

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const WAVES = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  triangle: (p) => 1 - 4 * Math.abs((((p + 0.25) % 1) + 1) % 1 - 0.5),
  square: (p) => (((p % 1) + 1) % 1 < 0.5 ? 0.85 : -0.85),
  sawtooth: (p) => 1 - 2 * (((p % 1) + 1) % 1),
};

const WAVELENGTH = 44; // pixels a waveform's cycle spans, whatever the title's length

/**
 * A slot's shape across a title: f(u, x) for u from 0 (its first letter) to
 * 1 (its last), x the same in pixels; −1 to 1, up positive, for [article];
 * [phase] slides it along. The filter and the envelope stretch to the title;
 * the wave and the wobble keep their own wavelength, so a short title shows
 * a cycle or so rather than a crush of them.
 */
function shapeOf(slot, a, phase) {
  switch (slot) {
    case 'waveform': {
      const wave = WAVES[SoundMap.waveform(a.contributors)];
      return (u, x) => wave(x / WAVELENGTH - phase);
    }
    case 'filter': {
      const at = Math.log(SoundMap.cutoff(a.references) / 250) / Math.log(7000 / 250);
      const knee = 0.12 + at * 0.76 + 0.03 * Math.sin(2 * Math.PI * phase);
      return (u) => (u < knee ? 0.6 : clamp(0.6 - (2.2 * (u - knee)) / (1 - knee + 0.25), -1, 1));
    }
    case 'envelope': {
      const length = clamp(SoundMap.decay(a.pageViews) / 2.3, 0.05, 1);
      return (u) => (u < 0.06 ? -1 + (2 * u) / 0.06 : -1 + 2 * Math.exp(-((u - 0.06) / length) * 4.6));
    }
    case 'effect': {
      const depth = SoundMap.vibratoDepth(a.daysSinceUpdate, a.trending);
      const rate = SoundMap.vibratoRate(a.daysSinceUpdate, a.trending);
      const amp = Math.max(0.15, depth / 45);
      // 4 Hz is a slow swell about 50 pixels long; 7.5 Hz ripples twice as tight.
      return (u, x) => amp * Math.sin(2 * Math.PI * ((x * rate) / 200 - phase));
    }
  }
  return () => 0;
}

/** What a slot's article does, in a few words: "sawtooth · 2,104 editors". */
export function captionOf(slot, a) {
  const n = (x) => Math.round(x).toLocaleString('en');
  switch (slot) {
    case 'waveform':
      return `${SoundMap.waveform(a.contributors)} · ${n(a.contributors)} editors`;
    case 'filter': {
      const hz = SoundMap.cutoff(a.references);
      return `${hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${n(hz)}Hz`} · ${n(a.references)} refs`;
    }
    case 'envelope':
      return `${SoundMap.decay(a.pageViews).toFixed(2)}s · ${a.pageViews >= 10000 ? `${n(a.pageViews / 1000)}k` : n(a.pageViews)} views`;
    case 'effect': {
      const depth = SoundMap.vibratoDepth(a.daysSinceUpdate, a.trending);
      const when = a.trending ? 'trending' : a.daysSinceUpdate === null ? 'never' : a.daysSinceUpdate < 1 ? 'today' : `${n(a.daysSinceUpdate)}d ago`;
      return `${n(depth)}c ${SoundMap.vibratoRate(a.daysSinceUpdate, a.trending).toFixed(1)}Hz · ${when}`;
    }
  }
  return '';
}

export type Corner = { title: string; article: Article | null; busy: boolean; lit: boolean }

// How the screen moves: one shared motion, nudged by every note (pulse).
const stillPlease = matchMedia('(prefers-reduced-motion: reduce)')
const motion = {
  phase: 0,
  energy: 0,
  fade: 0.3,
  last: 0,
  rough: 0.5, // the last note's roughness, 0 smooth … 1 rough
  spread: 0, // how far apart the globe's pieces are, 0 … 1, following energy
  history: [] as { phase: number; energy: number }[],
}

/**
 * A note just sounded, ringing for about [ringSec], [rough] from 0 (a pure,
 * dull tone) to 1 (a bright, buzzy one): the titles bend and the globe's
 * pieces spring apart, then settle.
 */
export function pulse(ringSec: number, rough = 0.5) {
  if (stillPlease.matches) return
  motion.energy = 1
  motion.fade = Math.max(0.15, ringSec / 4)
  motion.rough = clamp(rough, 0, 1)
}

/** A key went down (true) or up (false): while any is held, the motion rings on instead of settling. */
let held = 0
export function hold(down: boolean) {
  held = Math.max(0, held + (down ? 1 : -1))
}
const HELD_ENERGY = 0.7 // how much of a strike's motion a held note keeps

function advance(now: number) {
  const dt = Math.min(0.1, (now - (motion.last || now)) / 1000)
  motion.last = now
  motion.phase = (motion.phase + dt * 2.6 * Math.max(0.25, motion.energy)) % 1
  motion.energy *= Math.exp(-dt / motion.fade)
  if (held && !stillPlease.matches) motion.energy = Math.max(motion.energy, HELD_ENERGY)
  if (motion.energy < 0.02) motion.energy = 0
  // The pieces fly apart fast (about 50 ms) and drift back with the note.
  motion.spread = motion.energy > motion.spread ? motion.spread + (motion.energy - motion.spread) * (1 - Math.exp(-dt / 0.05)) : motion.energy
  motion.history.push({ phase: motion.phase, energy: motion.energy })
  if (motion.history.length > 16) motion.history.shift()
}

/**
 * How far each piece of the globe sits from home, across only: pieces left of
 * centre go left, right go right, the outer ones furthest, so the globe opens
 * out in a row without touching the titles above and below. Each piece also
 * shivers in and out a little, faster the rougher the sound.
 */
// How far out each piece's own pixels reach, left or right of centre, and the furthest piece's centre.
const EXTENT = PIECES.map(({ pixels }) => Math.max(...pixels.map(([x]) => Math.abs(x))))
const FURTHEST = Math.max(...PIECES.map(({ cx }) => Math.abs(cx)))

function pieceOffsets(now: number) {
  const edge = W / 2 - 3 // a piece's outer edge never goes past this
  const reach = 3 + (edge - GLOBE_W / 2) * 1.25 * motion.rough ** 1.3
  const t = now / 1000
  const shiver = 5 + motion.rough * 10 // Hz
  return PIECES.map(({ cx, seed }, i) => {
    if (!motion.spread) return 0
    const dir = Math.abs(cx) < 1.5 ? (seed < 0.5 ? -1 : 1) : Math.sign(cx)
    const weight = 0.2 + 0.8 * Math.min(1, Math.abs(cx) / FURTHEST) ** 0.9 + (seed - 0.5) * 0.2
    const wobble = 0.82 + 0.18 * Math.sin(2 * Math.PI * (shiver * t + seed))
    const dx = reach * weight * motion.spread * wobble
    return Math.round(dir * Math.max(0, Math.min(dx, edge - EXTENT[i])))
  })
}

/** Draws the screen on [ctx] (W × H), one frame: [corners] by slot (article null until it loads). */
export function drawWikiScreen(ctx: CanvasRenderingContext2D, corners: Record<Slot, Corner>, now = performance.now()) {
  advance(now)
  const image = ctx.createImageData(W, H);
  const px = image.data;
  const put = (x, y, [r, g, b]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };
  // Black glass.
  for (let i = 3; i < px.length; i += 4) px[i] = 255;

  const offsets = pieceOffsets(now);
  PIECES.forEach(({ pixels }, i) => pixels.forEach(([x, y, g]) => put(W / 2 + x + offsets[i], H / 2 + y, [g, g, g])));

  const place = {
    waveform: { right: false, top: true },
    filter: { right: true, top: true },
    envelope: { right: false, top: false },
    effect: { right: true, top: false },
  };
  Object.entries(corners).forEach(([slot, { title, article, busy, lit }]) => {
    const { right, top } = place[slot];
    const text = `/wiki/${title.replace(/ /g, '_')}`;
    const width = textWidth(text);
    const x0 = right ? W - MARGIN - width : MARGIN;
    const titleY = top ? MARGIN + 4 : H - MARGIN - GLYPH_H - 2;
    const captionY = top ? titleY + GLYPH_H + 6 : titleY - GLYPH_H - 6;
    const ink = INK[slot];
    const toward = top ? 1 : -1; // down for the top titles, up for the bottom ones
    // Where a title's pixel at [x] sits, up or down, at a moment of the motion.
    const bender = (phase: number, energy: number) => {
      const shape = article && energy ? shapeOf(slot, article, phase) : null;
      const base = Math.round(BEND * SINK * energy) * toward;
      return (x: number) => base - (shape ? Math.round(shape(width ? clamp(x, 0, width) / width : 0, x) * BEND * energy) : 0);
    };
    const pixels = textPixels(text);
    // Echoes first, dimmer the older, so the title drags a trail as it moves.
    ECHOES.forEach((back, k) => {
      const then = motion.history[motion.history.length - 1 - back];
      if (!then || then.energy < 0.05 || !article) return;
      const bend = bender(then.phase, then.energy);
      const shade = dim(ink, 0.1 + 0.1 * k);
      pixels.forEach(([x, y]) => put(x0 + x, titleY + y + bend(x), shade));
    });
    const bend = bender(motion.phase, motion.energy);
    // The caption rides the same wave, so the two never collide.
    const caption = busy || !article ? '…' : captionOf(slot, article);
    const cw = textWidth(caption);
    const cx0 = right ? W - MARGIN - cw : MARGIN;
    textPixels(caption).forEach(([x, y]) => put(cx0 + x, captionY + y + bend(cx0 + x - x0), dim(ink, lit ? 1 : 0.62)));
    pixels.forEach(([x, y]) => put(x0 + x, titleY + y + bend(x), ink));
  });
  ctx.putImageData(image, 0, 0);
}
