// Draws the OP-1-style OLED screen (320×160) for each mode. Synth mode
// shows the four articles round the Wikipedia globe (wiki-screen.ts).

import type { Slot } from './wiki'
import { drawWikiScreen, type Corner } from './wiki-screen'

export type Mode = 'synth' | 'drum' | 'tape' | 'mixer'

export type ScreenState = {
  mode: Mode
  knobs: { blue: number; green: number; white: number; orange: number }
  octave: number
  playing: boolean
  metronome: boolean
  lastNote: number | null
  activeCount: number
  lastHit: { index: number; at: number }
  time: number
  wave: Float32Array | null
  levels: number[] | null
  beat: number
  wiki: Record<Slot, Corner>
}

const W = 320
const H = 160
const C = {
  blue: '#3d8bff',
  green: '#2fd27f',
  white: '#f2f2f2',
  orange: '#ff7a2c',
  red: '#ff3b30',
  grey: '#5b5e66',
  dim: '#2a2c31',
}
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const WAVE_NAMES = ['SINE', 'TRI', 'SAW', 'SQR']

function font(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `600 ${size}px ui-monospace, "SF Mono", Menlo, monospace`
  ctx.textBaseline = 'alphabetic'
}

function header(ctx: CanvasRenderingContext2D, s: ScreenState) {
  font(ctx, 9)
  ctx.fillStyle = C.grey
  ctx.textAlign = 'left'
  ctx.fillText(s.mode.toUpperCase(), 10, 14)

  // Octave pips
  ctx.textAlign = 'right'
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = i === s.octave ? C.white : C.dim
    ctx.fillRect(W - 58 + (i + 2) * 7, 8, 4, 4)
  }

  // Transport
  ctx.fillStyle = s.playing ? C.green : C.grey
  if (s.playing) {
    ctx.beginPath()
    ctx.moveTo(W - 16, 6)
    ctx.lineTo(W - 9, 10)
    ctx.lineTo(W - 16, 14)
    ctx.fill()
  } else {
    ctx.fillRect(W - 16, 6, 7, 7)
  }
  if (s.metronome) {
    ctx.fillStyle = s.playing && s.beat % 2 === 0 ? C.orange : C.grey
    ctx.beginPath()
    ctx.moveTo(W - 72, 13)
    ctx.lineTo(W - 68, 5)
    ctx.lineTo(W - 64, 13)
    ctx.fill()
  }
}

function dial(ctx: CanvasRenderingContext2D, x: number, y: number, v: number, color: string, label: string) {
  const r = 9
  const a0 = Math.PI * 0.75
  const a1 = a0 + Math.PI * 1.5 * v
  ctx.lineWidth = 3
  ctx.strokeStyle = C.dim
  ctx.beginPath()
  ctx.arc(x, y, r, a0, a0 + Math.PI * 1.5)
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, a0, a1)
  ctx.stroke()
  font(ctx, 7)
  ctx.fillStyle = C.grey
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 14, y + 3)
}

function hasSignal(buf: Float32Array | null) {
  if (!buf) return false
  for (let i = 0; i < buf.length; i += 8) if (Math.abs(buf[i]) > 0.004) return true
  return false
}

function idealWave(type: number, phase: number) {
  const p = phase - Math.floor(phase)
  switch (type) {
    case 0:
      return Math.sin(p * Math.PI * 2)
    case 1:
      return 1 - 4 * Math.abs(p - 0.5)
    case 2:
      return 2 * p - 1
    default:
      return p < 0.5 ? 1 : -1
  }
}

/* ------------------------------------------------------------------ */

function drawSynth(ctx: CanvasRenderingContext2D, s: ScreenState) {
  const waveType = Math.min(3, Math.floor(s.knobs.blue * 4))
  const cy = 62
  const amp = 26

  // Waveform
  ctx.lineWidth = 2
  ctx.strokeStyle = C.white
  ctx.beginPath()
  if (hasSignal(s.wave)) {
    const buf = s.wave!
    let start = 0
    for (let i = 1; i < buf.length / 2; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) {
        start = i
        break
      }
    }
    const span = 420
    let peak = 0.0001
    for (let i = 0; i < span; i++) peak = Math.max(peak, Math.abs(buf[start + i] ?? 0))
    for (let i = 0; i < span; i++) {
      const x = 20 + (i / span) * 200
      const y = cy - ((buf[start + i] ?? 0) / peak) * amp
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
  } else {
    for (let i = 0; i <= 200; i++) {
      const x = 20 + i
      const y = cy - idealWave(waveType, i / 66 + s.time * 0.25) * amp * 0.7
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // Filter curve on the right
  const fx = 236
  const cutoffX = fx + 12 + s.knobs.white * 58
  ctx.lineWidth = 1.5
  ctx.strokeStyle = C.white
  ctx.globalAlpha = 0.5
  ctx.strokeRect(fx, 30, 76, 64)
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(fx + 2, 52)
  ctx.lineTo(cutoffX - 8, 52)
  ctx.quadraticCurveTo(cutoffX, 40, cutoffX + 4, 58)
  ctx.lineTo(Math.min(fx + 74, cutoffX + 14), 92)
  ctx.stroke()

  // ADSR envelope
  const env = s.knobs.green
  const ex = 20
  const ey = 118
  const atk = 6 + env * 50
  const rel = 10 + env * 70
  ctx.strokeStyle = C.green
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex + atk, ey - 22)
  ctx.lineTo(ex + atk + 20, ey - 14)
  ctx.lineTo(ex + 200 - rel, ey - 14)
  ctx.lineTo(ex + 200, ey)
  ctx.stroke()
  ctx.fillStyle = C.green
  ;[
    [ex + atk, ey - 22],
    [ex + atk + 20, ey - 14],
    [ex + 200 - rel, ey - 14],
  ].forEach(([x, y]) => ctx.fillRect(x - 2, y - 2, 4, 4))

  // Note readout
  font(ctx, 22)
  ctx.textAlign = 'right'
  ctx.fillStyle = s.activeCount ? C.orange : C.dim
  const name = s.lastNote == null ? '--' : `${NOTE_NAMES[s.lastNote % 12]}${Math.floor(s.lastNote / 12) - 1}`
  ctx.fillText(name, W - 10, 124)

  // Parameter dials
  dial(ctx, 24, 144, s.knobs.blue, C.blue, WAVE_NAMES[waveType])
  dial(ctx, 98, 144, s.knobs.green, C.green, 'ENV')
  dial(ctx, 172, 144, s.knobs.white, C.white, 'FILT')
  dial(ctx, 246, 144, s.knobs.orange, C.orange, 'LVL')
}

function drawDrum(ctx: CanvasRenderingContext2D, s: ScreenState) {
  const since = (performance.now() - s.lastHit.at) / 1000
  const hit = Math.max(0, 1 - since * 4)
  const colors = [C.blue, C.green, C.white, C.orange, C.red, C.blue]

  // Drum shell
  const cx = 92
  const cy = 72 + hit * 4
  const rx = 52 + hit * 6
  ctx.lineWidth = 2
  ctx.strokeStyle = C.white
  ctx.beginPath()
  ctx.ellipse(cx, cy - 18, rx, 14, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - rx, cy - 18)
  ctx.lineTo(cx - rx, cy + 22)
  ctx.ellipse(cx, cy + 22, rx, 14, 0, Math.PI, 0, true)
  ctx.lineTo(cx + rx, cy - 18)
  ctx.stroke()
  // lugs
  for (let i = 0; i < 6; i++) {
    const x = cx - rx + 10 + i * ((rx * 2 - 20) / 5)
    ctx.fillStyle = colors[i]
    ctx.fillRect(x - 2, cy - 2, 4, 12)
  }
  // ripple
  if (hit > 0) {
    ctx.strokeStyle = colors[s.lastHit.index % 6]
    ctx.globalAlpha = hit
    ctx.beginPath()
    ctx.ellipse(cx, cy - 18, rx * (1 - hit) * 0.9 + 4, 14 * (1 - hit) * 0.9 + 1, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Pad grid
  const names = ['KICK', 'SNR', 'HAT', 'CLAP', 'TOM', 'OPEN']
  for (let i = 0; i < 12; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = 178 + col * 34
    const y = 30 + row * 34
    const lit = s.lastHit.index === i && hit > 0
    ctx.fillStyle = lit ? colors[i % 6] : C.dim
    ctx.fillRect(x, y, 28, 28)
    if (!lit) {
      ctx.fillStyle = colors[i % 6]
      ctx.fillRect(x + 4, y + 22, 6, 2)
    }
  }
  font(ctx, 10)
  ctx.textAlign = 'left'
  ctx.fillStyle = hit > 0 ? C.white : C.grey
  ctx.fillText(s.lastHit.index >= 0 ? names[s.lastHit.index % 6] : 'HIT A KEY', 40, 146)
}

const CLIPS: [number, number, number, string][] = [
  // track, start, length, color
  [0, 0.02, 0.18, C.blue],
  [0, 0.3, 0.12, C.blue],
  [0, 0.62, 0.3, C.blue],
  [1, 0.1, 0.22, C.green],
  [1, 0.46, 0.18, C.green],
  [2, 0.0, 0.42, C.white],
  [2, 0.56, 0.14, C.white],
  [3, 0.2, 0.12, C.orange],
  [3, 0.38, 0.12, C.orange],
  [3, 0.72, 0.2, C.orange],
]

let tapePos = 0
let lastTapeT = 0
function drawTape(ctx: CanvasRenderingContext2D, s: ScreenState) {
  const dt = Math.min(0.1, s.time - lastTapeT)
  lastTapeT = s.time
  if (s.playing) tapePos = (tapePos + dt * 0.06) % 1

  // Reels
  const rot = tapePos * Math.PI * 2 * 14
  ;[
    [70, 52, 30 - tapePos * 10],
    [250, 52, 20 + tapePos * 10],
  ].forEach(([x, y, r], idx) => {
    ctx.fillStyle = C.dim
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = C.white
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 3; i++) {
      const a = rot * (idx ? 1.2 : 1) + (i * Math.PI * 2) / 3
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3)
      ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9)
      ctx.stroke()
    }
  })
  // Tape path
  ctx.strokeStyle = C.grey
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(70, 82 - tapePos * 10)
  ctx.lineTo(160, 88)
  ctx.lineTo(250, 72 + tapePos * 10)
  ctx.stroke()
  ctx.fillStyle = C.red
  ctx.fillRect(156, 84, 8, 6)

  // Tracks
  const top = 100
  const lane = 12
  const x0 = 10
  const width = W - 20
  for (let t = 0; t < 4; t++) {
    ctx.fillStyle = C.dim
    ctx.fillRect(x0, top + t * lane, width, lane - 3)
  }
  CLIPS.forEach(([t, st, len, col]) => {
    let x = ((st - tapePos + 1) % 1) * width
    const w = len * width
    ctx.fillStyle = col
    ctx.fillRect(x0 + x, top + t * lane, Math.min(w, width - x), lane - 3)
    if (x + w > width) ctx.fillRect(x0, top + t * lane, x + w - width, lane - 3)
  })
  // Playhead
  ctx.fillStyle = C.red
  ctx.fillRect(x0 + width * 0.25, top - 4, 2, lane * 4 + 2)
}

const smoothLevels = [0, 0, 0, 0]
function drawMixer(ctx: CanvasRenderingContext2D, s: ScreenState) {
  const lv = s.levels ?? [0, 0]
  const live = [lv[0], lv[1], s.playing ? 0.35 + 0.2 * Math.sin(s.time * 7) : 0, Math.max(lv[0], lv[1])]
  const cols = [C.blue, C.green, C.white, C.orange]
  const vals = [s.knobs.blue, s.knobs.green, s.knobs.white, s.knobs.orange]
  const labels = ['SYN', 'DRM', 'TPE', 'MST']
  for (let i = 0; i < 4; i++) {
    smoothLevels[i] = Math.max(live[i], smoothLevels[i] * 0.9)
    const x = 30 + i * 72
    const top = 26
    const h = 96
    // meter
    ctx.fillStyle = C.dim
    ctx.fillRect(x, top, 10, h)
    const mh = smoothLevels[i] * h
    ctx.fillStyle = cols[i]
    ctx.fillRect(x, top + h - mh, 10, mh)
    // fader track
    ctx.fillStyle = C.grey
    ctx.fillRect(x + 26, top, 2, h)
    const fy = top + h - vals[i] * h
    ctx.fillStyle = cols[i]
    ctx.fillRect(x + 18, fy - 4, 18, 8)
    font(ctx, 8)
    ctx.textAlign = 'left'
    ctx.fillStyle = C.grey
    ctx.fillText(labels[i], x, 142)
  }
}

export function drawScreen(ctx: CanvasRenderingContext2D, s: ScreenState) {
  if (s.mode === 'synth') {
    drawWikiScreen(ctx, s.wiki)
    return
  }
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  header(ctx, s)
  if (s.mode === 'synth') drawSynth(ctx, s)
  else if (s.mode === 'drum') drawDrum(ctx, s)
  else if (s.mode === 'tape') drawTape(ctx, s)
  else drawMixer(ctx, s)
}
