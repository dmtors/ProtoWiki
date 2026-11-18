<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { CHOICES } from './articles'
import { createOp1Audio, type Op1Audio } from './audio'
import { drawScreen, type Mode } from './screen'
import { articleSignals, articleUrl, BLANK, roughnessOf, SLOTS, soundOf, type Article, type Slot } from './wiki'
import { hold, pulse, type Corner } from './wiki-screen'

definePage({
  meta: {
    category: 'prototype',
    platform: 'web',
  },
})

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

type KnobId = 'blue' | 'green' | 'white' | 'orange'

const knobs = reactive<Record<KnobId, number>>({
  blue: 0.65,
  green: 0.2,
  white: 0.35,
  orange: 0.5,
})
const knobOrder: KnobId[] = ['blue', 'green', 'white', 'orange']

/* ------------------------------------------------------------------ */
/* Articles — each knob picks its slot's article from a list           */
/* ------------------------------------------------------------------ */

// Each encoder turns through a list of articles (articles.ts); the article
// shapes its part of the sound, as in Mondrian. A knob's value (0–1) snaps
// to the list, one notch an article.
const KNOB_SLOT: Record<KnobId, Slot> = { blue: 'waveform', green: 'filter', white: 'envelope', orange: 'effect' }
const notches = (id: KnobId) => CHOICES[KNOB_SLOT[id]].length - 1
const pickOf = (id: KnobId) => Math.round(knobs[id] * notches(id))
const titleOf = (id: KnobId) => CHOICES[KNOB_SLOT[id]][pickOf(id)]
knobOrder.forEach((id) => (knobs[id] = Math.round(knobs[id] * notches(id)) / notches(id)))

const loaded = reactive<Partial<Record<Slot, Article>>>({})
const busy = reactive<Partial<Record<Slot, boolean>>>({})
const litUntil: Partial<Record<Slot, number>> = {}
const pending: Partial<Record<Slot, number>> = {}

/** Loads [id]'s article, after a moment, so turning past titles doesn't fetch them all. */
function loadPick(id: KnobId, wait = 220) {
  const slot = KNOB_SLOT[id]
  clearTimeout(pending[slot])
  busy[slot] = true
  pending[slot] = window.setTimeout(async () => {
    const title = titleOf(id)
    let article: Article | null = null
    try {
      article = await articleSignals(title)
    } catch {
      // Offline, or the API's down: keep the last sound.
    }
    if (titleOf(id) !== title) return // turned on since
    if (article) loaded[slot] = article
    busy[slot] = false
  }, wait)
}

function setPick(id: KnobId, v: number) {
  const n = notches(id)
  const next = Math.round(Math.min(1, Math.max(0, v)) * n) / n
  if (next === knobs[id]) return
  knobs[id] = next
  litUntil[KNOB_SLOT[id]] = performance.now() + 1400
  loadPick(id)
}
const wheelRest: Partial<Record<KnobId, number>> = {}
function wheelPick(e: WheelEvent, id: KnobId) {
  ensureAudio()
  wheelRest[id] = (wheelRest[id] ?? 0) + (e.deltaY || e.deltaX)
  while (Math.abs(wheelRest[id]!) >= 40) {
    const by = wheelRest[id]! > 0 ? -1 : 1
    setPick(id, knobs[id] + by / notches(id))
    wheelRest[id]! -= Math.sign(wheelRest[id]!) * 40
  }
}
function pickKey(e: KeyboardEvent, id: KnobId) {
  const by = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key]
  if (!by) return
  e.preventDefault()
  e.stopPropagation()
  setPick(id, knobs[id] + by / notches(id))
}

const sound = computed(() =>
  soundOf(Object.fromEntries(SLOTS.map((slot) => [slot, loaded[slot] ?? BLANK])) as Record<Slot, typeof BLANK>),
)

function corners(): Record<Slot, Corner> {
  const now = performance.now()
  return Object.fromEntries(
    knobOrder.map((id) => {
      const slot = KNOB_SLOT[id]
      const title = titleOf(id)
      const article = loaded[slot]?.title === title ? loaded[slot]! : null
      return [slot, { title, article, busy: Boolean(busy[slot]), lit: (litUntil[slot] ?? 0) > now }]
    }),
  ) as Record<Slot, Corner>
}

const credits = computed(() =>
  knobOrder.map((id) => {
    const slot = KNOB_SLOT[id]
    const title = titleOf(id)
    return { id, slot, title, href: loaded[slot]?.title === title ? loaded[slot]!.link : articleUrl(title) }
  }),
)
const volume = ref(0.8)

const mode = ref<Mode>('synth')
const octave = ref(0)
const playing = ref(false)
const metronome = ref(false)
const pressed = reactive(new Set<string>())
const activeNotes = reactive(new Set<number>())
const lastNote = ref<number | null>(null)
const lastHit = ref({ index: -1, at: 0 })

let audio: Op1Audio | null = null
function ensureAudio() {
  if (!audio) audio = createOp1Audio()
  audio.resume()
  syncAudio()
  return audio
}
function syncAudio() {
  if (!audio) return
  audio.setParams({
    wave: knobs.blue,
    envelope: knobs.green,
    cutoff: knobs.white,
    level: knobs.orange,
    volume: volume.value,
  })
}

/* ------------------------------------------------------------------ */
/* Layout — a 17 × 6 grid of square cells                             */
/* ------------------------------------------------------------------ */

type FnKey = { id: string; label: string; col: number; row: number }

const fnKeys: FnKey[] = [
  { id: 'help', label: 'Help', col: 3, row: 2 },
  { id: 'metronome', label: 'Tempo', col: 4, row: 2 },
  { id: 'mic', label: 'Microphone', col: 17, row: 1 },
  { id: 'album', label: 'Album', col: 17, row: 2 },

  { id: 'synth', label: 'Synth', col: 1, row: 3 },
  { id: 'drum', label: 'Drum', col: 2, row: 3 },
  { id: 'tape', label: 'Tape', col: 3, row: 3 },
  { id: 'mixer', label: 'Mixer', col: 4, row: 3 },
  { id: 't1', label: '1', col: 5, row: 3 },
  { id: 't2', label: '2', col: 6, row: 3 },
  { id: 't3', label: '3', col: 7, row: 3 },
  { id: 't4', label: '4', col: 8, row: 3 },
  { id: 'in', label: 'In', col: 9, row: 3 },
  { id: 'out', label: 'Out', col: 10, row: 3 },
  { id: 'loop', label: 'Loop', col: 11, row: 3 },
  { id: 'break', label: 'Break', col: 12, row: 3 },
  { id: 'reverse', label: 'Reverse', col: 13, row: 3 },
  { id: 'chop', label: 'Chop', col: 14, row: 3 },
  { id: 'm1', label: 'M1', col: 15, row: 3 },
  { id: 'm2', label: 'M2', col: 16, row: 3 },
  { id: 'seq', label: 'Sequencer', col: 17, row: 3 },

  { id: 'lift', label: 'Lift', col: 1, row: 4 },
  { id: 'drop', label: 'Drop', col: 2, row: 4 },
  { id: 'split', label: 'Split', col: 3, row: 4 },

  { id: 'rec', label: 'Record', col: 1, row: 5 },
  { id: 'play', label: 'Play', col: 2, row: 5 },
  { id: 'stop', label: 'Stop', col: 3, row: 5 },

  { id: 'octdown', label: 'Back (octave down)', col: 1, row: 6 },
  { id: 'octup', label: 'Forward (octave up)', col: 2, row: 6 },
  { id: 'shift', label: 'Shift', col: 3, row: 6 },
]

// Keyboard runs F → E across 14 white keys, like the real OP-1.
// Semitone offsets from the lowest F.
const WHITE_SEMIS = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23]
const whiteKeys = WHITE_SEMIS.map((semi, i) => ({ id: `w${i}`, semi, col: 4 + i }))

// Black keys sit on the boundary after these white keys (F G A · C D · F G A · C D).
const BLACK_AFTER = [0, 1, 2, 4, 5, 7, 8, 9, 11, 12]
const blackKeys = BLACK_AFTER.map((after, i) => {
  const pos = after + 1 // boundary, in white-key units
  const prev = i === 0 ? 0 : (BLACK_AFTER[i - 1] + 1 + pos) / 2
  const next = i === BLACK_AFTER.length - 1 ? 14 : (pos + BLACK_AFTER[i + 1] + 1) / 2
  return { id: `b${i}`, semi: WHITE_SEMIS[after] + 1, pos, start: prev, end: next }
})

// Position helpers for the black-key row, accounting for the grid gaps.
const unitX = (k: number) => `calc(${k} * (100% + var(--gap)) / 14)`
const segStyle = (b: { start: number; end: number }) => ({
  left: unitX(b.start),
  width: `calc(${b.end - b.start} * (100% + var(--gap)) / 14 - var(--gap))`,
})
const dotStyle = (b: { pos: number }) => ({
  left: `calc(${b.pos} * (100% + var(--gap)) / 14 - var(--gap) / 2)`,
})

// Computer keyboard → semitone offset from the lowest key (F).
const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, r: 5, f: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 18,
}

/* ------------------------------------------------------------------ */
/* Key handling                                                       */
/* ------------------------------------------------------------------ */

const baseMidi = computed(() => 53 + octave.value * 12) // F3

// Synth notes still sounding, by the key holding them: each one's release.
const held = new Map<string, () => void>()

function noteOn(semi: number, keyId: string) {
  const a = ensureAudio()
  pressed.add(keyId)
  const midi = baseMidi.value + semi
  if (mode.value === 'drum') {
    a.drum(semi)
    lastHit.value = { index: semi % 12, at: performance.now() }
  } else if (mode.value === 'synth') {
    // The articles' sound: a pluck that rings while the key is held and
    // decays once it's let go; the screen moves with it.
    const previous = held.get(keyId)
    if (previous) previous()
    else hold(true)
    held.set(keyId, a.pluck(midi, sound.value))
    pulse(sound.value.decaySec, roughnessOf(sound.value))
  } else {
    a.noteOn(midi)
  }
  activeNotes.add(midi)
  lastNote.value = midi
}
// Dragging across the keyboard: once a key is pressed, every key the
// pointer slides onto plays, until the button or finger lifts.
const sliding = ref(false)
function keyDown(e: PointerEvent, semi: number, keyId: string) {
  // Touch captures the pointer to the first key; let go so the next keys hear it too.
  const el = e.currentTarget as Element
  if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
  sliding.value = true
  noteOn(semi, keyId)
}
function keyEnter(semi: number, keyId: string) {
  if (sliding.value && !pressed.has(keyId)) noteOn(semi, keyId)
}
function stopSliding() {
  sliding.value = false
}

function noteOff(semi: number, keyId: string) {
  if (!pressed.has(keyId)) return
  pressed.delete(keyId)
  const midi = baseMidi.value + semi
  const release = held.get(keyId)
  if (release) {
    release()
    held.delete(keyId)
    hold(false)
  }
  audio?.noteOff(midi)
  activeNotes.delete(midi)
}

function fnDown(id: string) {
  ensureAudio()
  pressed.add(id)
  switch (id) {
    case 'synth':
    case 'drum':
    case 'tape':
    case 'mixer':
      mode.value = id
      break
    case 'octdown':
      octave.value = Math.max(-2, octave.value - 1)
      break
    case 'octup':
      octave.value = Math.min(2, octave.value + 1)
      break
    case 'play':
      playing.value = !playing.value
      break
    case 'stop':
      playing.value = false
      break
    case 'metronome':
      metronome.value = !metronome.value
      break
  }
  audio?.setTransport(playing.value, metronome.value)
}
function fnUp(id: string) {
  pressed.delete(id)
}

const visualKeys = reactive(new Set<string>())
function highlightFromSemi(semi: number, on: boolean) {
  const key = [...whiteKeys, ...blackKeys].find((k) => k.semi === semi)
  if (!key) return
  if (on) visualKeys.add(key.id)
  else visualKeys.delete(key.id)
}
const isDown = (id: string) => pressed.has(id) || visualKeys.has(id)

function onKeyDown(e: KeyboardEvent) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k in KEYMAP) {
    noteOn(KEYMAP[k], `kb-${k}`)
    highlightFromSemi(KEYMAP[k], true)
  } else if (k === 'z') fnDown('octdown')
  else if (k === 'x') fnDown('octup')
  else if (k === ' ') {
    e.preventDefault()
    fnDown('play')
  } else if (k === '1') fnDown('synth')
  else if (k === '2') fnDown('drum')
  else if (k === '3') fnDown('tape')
  else if (k === '4') fnDown('mixer')
}
function onKeyUp(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (k in KEYMAP) {
    noteOff(KEYMAP[k], `kb-${k}`)
    highlightFromSemi(KEYMAP[k], false)
  } else if (k === 'z') fnUp('octdown')
  else if (k === 'x') fnUp('octup')
  else if (k === ' ') fnUp('play')
  else if (['1', '2', '3', '4'].includes(k))
    fnUp(['synth', 'drum', 'tape', 'mixer'][Number(k) - 1])
}

/* ------------------------------------------------------------------ */
/* Knobs                                                              */
/* ------------------------------------------------------------------ */

const knobAngle = (v: number) => -150 + v * 300

function startKnobDrag(e: PointerEvent, set: (v: number) => void, get: () => number) {
  ensureAudio()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const startY = e.clientY
  const startV = get()
  const move = (ev: PointerEvent) => {
    set(Math.min(1, Math.max(0, startV + (startY - ev.clientY) / 180)))
    syncAudio()
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}
function wheelKnob(e: WheelEvent, set: (v: number) => void, get: () => number) {
  set(Math.min(1, Math.max(0, get() - e.deltaY / 1200)))
  syncAudio()
}
function knobKey(e: KeyboardEvent, set: (v: number) => void, get: () => number) {
  const step = e.shiftKey ? 0.1 : 0.02
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(Math.min(1, get() + step))
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(Math.max(0, get() - step))
  else return
  e.preventDefault()
  e.stopPropagation()
  syncAudio()
}

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
const startedAt = performance.now()
function frame() {
  const ctx = canvas.value?.getContext('2d')
  if (ctx) {
    drawScreen(ctx, {
      mode: mode.value,
      knobs,
      octave: octave.value,
      playing: playing.value,
      metronome: metronome.value,
      lastNote: lastNote.value,
      activeCount: activeNotes.size,
      lastHit: lastHit.value,
      time: (performance.now() - startedAt) / 1000,
      wave: audio?.waveform() ?? null,
      levels: audio?.levels() ?? null,
      beat: audio?.beat() ?? 0,
      wiki: corners(),
    })
  }
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointerup', stopSliding)
  window.addEventListener('pointercancel', stopSliding)
  raf = requestAnimationFrame(frame)
  knobOrder.forEach((id, i) => loadPick(id, i * 120)) // a little apart, to be gentle with the API
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerup', stopSliding)
  window.removeEventListener('pointercancel', stopSliding)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  cancelAnimationFrame(raf)
  audio?.dispose()
})
</script>

<template>
  <div class="op1-page">
    <div class="op1-frame">
      <div class="op1">
        <div class="op1__panel">
          <!-- Speaker -->
          <div class="op1__cell" style="grid-area: 1 / 1 / 3 / 3" aria-hidden="true" />

          <!-- Volume -->
          <div class="op1__cell op1__cell--volume" style="grid-area: 1 / 3 / 2 / 5">
            <button
              class="op1__volume"
              type="button"
              role="slider"
              aria-label="Volume"
              :aria-valuenow="Math.round(volume * 100)"
              aria-valuemin="0"
              aria-valuemax="100"
              :style="{ transform: `rotate(${knobAngle(volume)}deg)` }"
              @pointerdown="startKnobDrag($event, (v) => (volume = v), () => volume)"
              @wheel.prevent="wheelKnob($event, (v) => (volume = v), () => volume)"
              @keydown="knobKey($event, (v) => (volume = v), () => volume)"
            >
              <span class="op1__volume-dot" />
            </button>
          </div>

          <!-- Display -->
          <div class="op1__display" style="grid-area: 1 / 5 / 3 / 9">
            <canvas ref="canvas" :class="['op1__canvas', { 'op1__canvas--pixels': mode === 'synth' }]" width="320" height="160" />
          </div>

          <!-- Encoders -->
          <div
            v-for="(id, i) in knobOrder"
            :key="id"
            class="op1__cell op1__cell--knob"
            :style="{ gridArea: `1 / ${9 + i * 2} / 3 / ${11 + i * 2}` }"
          >
            <button
              type="button"
              role="slider"
              :aria-label="`${id} encoder: ${KNOB_SLOT[id]} article`"
              :aria-valuenow="pickOf(id) + 1"
              :aria-valuetext="titleOf(id)"
              aria-valuemin="1"
              :aria-valuemax="notches(id) + 1"
              :class="['op1__knob', `op1__knob--${id}`]"
              @pointerdown="startKnobDrag($event, (v) => setPick(id, v), () => knobs[id])"
              @wheel.prevent="wheelPick($event, id)"
              @keydown="pickKey($event, id)"
            >
              <span class="op1__knob-cap" :style="{ transform: `rotate(${knobAngle(knobs[id])}deg)` }">
                <span class="op1__knob-slot" />
              </span>
            </button>
          </div>

          <!-- Function keys -->
          <button
            v-for="k in fnKeys"
            :key="k.id"
            type="button"
            :title="k.label"
            :aria-label="k.label"
            :aria-pressed="k.id === mode || (k.id === 'play' && playing) || (k.id === 'metronome' && metronome) || undefined"
            :class="['op1__cell op1__key', { 'is-down': isDown(k.id) }]"
            :style="{ gridArea: `${k.row} / ${k.col}` }"
            @pointerdown.prevent="fnDown(k.id)"
            @pointerup="fnUp(k.id)"
            @pointerleave="fnUp(k.id)"
            @pointercancel="fnUp(k.id)"
          >
            <span class="op1__button" />
          </button>

          <!-- Black keys -->
          <div class="op1__blacks" style="grid-area: 4 / 4 / 5 / 18">
            <div v-for="b in blackKeys" :key="`seg-${b.id}`" class="op1__cell op1__seg" :style="segStyle(b)" />
            <button
              v-for="b in blackKeys"
              :key="b.id"
              type="button"
              :aria-label="`Note ${b.semi}`"
              :class="['op1__black', { 'is-down': isDown(b.id) }]"
              :style="dotStyle(b)"
              @pointerdown.prevent="keyDown($event, b.semi, b.id)"
              @pointerenter="keyEnter(b.semi, b.id)"
              @pointerup="noteOff(b.semi, b.id)"
              @pointerleave="noteOff(b.semi, b.id)"
              @pointercancel="noteOff(b.semi, b.id)"
            />
          </div>

          <!-- White keys -->
          <button
            v-for="w in whiteKeys"
            :key="w.id"
            type="button"
            :aria-label="`Note ${w.semi}`"
            :class="['op1__cell op1__key op1__key--white', { 'is-down': isDown(w.id) }]"
            :style="{ gridArea: `5 / ${w.col} / 7 / ${w.col + 1}` }"
            @pointerdown.prevent="keyDown($event, w.semi, w.id)"
              @pointerenter="keyEnter(w.semi, w.id)"
            @pointerup="noteOff(w.semi, w.id)"
            @pointerleave="noteOff(w.semi, w.id)"
            @pointercancel="noteOff(w.semi, w.id)"
          >
            <span class="op1__pill" />
          </button>
        </div>

        <!-- Side strip -->
        <div class="op1__side" aria-hidden="true">
          <div class="op1__dots"><span v-for="n in 5" :key="n" /></div>
          <div class="op1__brand">OP-1</div>
        </div>
      </div>

      <p class="op1-hint">
        Play with <kbd>A</kbd>–<kbd>'</kbd> · octave <kbd>Z</kbd>/<kbd>X</kbd> · modes
        <kbd>1</kbd>–<kbd>4</kbd> · <kbd>Space</kbd> play · drag or scroll the knobs
      </p>
      <ul class="op1-credits" aria-live="polite">
        <li v-for="c in credits" :key="c.id">
          <span :class="['op1-credits__dot', `op1__knob--${c.id}`]" />
          <span class="op1-credits__slot">{{ c.slot }}</span>
          <a :href="c.href" target="_blank" rel="noopener">/wiki/{{ c.title.replace(/ /g, '_') }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.op1-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 48px 16px;
  box-sizing: border-box;
  background: var(--background-color-neutral-subtle, #f8f9fa);
}

.op1-frame {
  width: min(1200px, 100%);
  container-type: inline-size;
}

/* One key unit drives every size, so the device keeps its proportions. */
.op1 {
  --u: calc(100cqw / 18.85);
  --gap: calc(var(--u) * 0.055);
  --body: #e9e9ed;
  --cell: #e1e1e6;
  --button: #e7e7eb;
  --ink: #1a1a1c;

  display: flex;
  padding: calc(var(--u) * 0.3) 0 calc(var(--u) * 0.3) calc(var(--u) * 0.3);
  border-radius: calc(var(--u) * 0.36);
  background: var(--body);
  box-shadow:
    inset 0 0 0 calc(var(--u) * 0.025) #d3d3d8,
    inset 0 calc(var(--u) * 0.03) 0 rgba(255, 255, 255, 0.9),
    0 calc(var(--u) * 0.3) calc(var(--u) * 0.7) rgba(0, 0, 0, 0.12);
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.op1__panel {
  flex: none;
  width: calc(var(--u) * 17);
  display: grid;
  grid-template-columns: repeat(17, 1fr);
  grid-template-rows: repeat(6, calc((var(--u) * 17 - var(--gap) * 18) / 17));
  gap: var(--gap);
  padding: var(--gap);
  box-sizing: border-box;
  border-radius: calc(var(--u) * 0.07);
  background: var(--ink);
}

.op1__cell {
  position: relative;
  min-width: 0;
  background: var(--cell);
  border-radius: calc(var(--u) * 0.035);
}

/* ---------------- Buttons ---------------- */

.op1__key {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.op1__button,
.op1__pill {
  display: block;
  background: linear-gradient(180deg, #ececf0, var(--button));
  box-shadow:
    0 calc(var(--u) * 0.035) calc(var(--u) * 0.06) rgba(0, 0, 0, 0.16),
    0 calc(var(--u) * 0.008) calc(var(--u) * 0.015) rgba(0, 0, 0, 0.12),
    inset 0 calc(var(--u) * 0.012) 0 rgba(255, 255, 255, 0.85);
  transition: box-shadow 60ms ease, transform 60ms ease;
}
.op1__button {
  width: 68%;
  aspect-ratio: 1;
  border-radius: 50%;
}
.op1__pill {
  width: 66%;
  height: 86%;
  border-radius: calc(var(--u) * 0.5);
}
.op1__key.is-down .op1__button,
.op1__key.is-down .op1__pill {
  transform: scale(0.97);
  background: linear-gradient(180deg, #dcdce1, #e4e4e8);
  box-shadow:
    inset 0 calc(var(--u) * 0.02) calc(var(--u) * 0.05) rgba(0, 0, 0, 0.14),
    0 0 0 rgba(0, 0, 0, 0);
}

/* ---------------- Volume ---------------- */

.op1__cell--volume {
  display: flex;
  align-items: center;
  padding-left: calc(var(--u) * 0.15);
}
.op1__volume {
  position: relative;
  width: calc(var(--u) * 0.66);
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: ns-resize;
  background: radial-gradient(circle at 45% 35%, #ffffff, #f4f4f6 70%);
  box-shadow:
    0 calc(var(--u) * 0.03) calc(var(--u) * 0.07) rgba(0, 0, 0, 0.18),
    inset 0 calc(var(--u) * -0.015) calc(var(--u) * 0.03) rgba(0, 0, 0, 0.06);
}
.op1__volume-dot {
  position: absolute;
  left: 50%;
  bottom: 14%;
  width: 11%;
  aspect-ratio: 1;
  translate: -50% 0;
  border-radius: 50%;
  background: #d4d4d9;
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.15);
}

/* ---------------- Display ---------------- */

.op1__display {
  display: grid;
  place-items: center;
  padding: calc(var(--u) * 0.12) calc(var(--u) * 0.1);
  margin: calc(var(--gap) * -1) 0;
  background: #000;
}
.op1__canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
/* The synth screen is 8-bit: scale its pixels up without smoothing. Only
   where the screen has more device pixels than the canvas (2× displays):
   shrunk without smoothing, whole rows of pixels would drop out. */
@media (min-resolution: 2dppx) {
  .op1__canvas--pixels {
    image-rendering: pixelated;
  }
}

/* ---------------- Knobs ---------------- */

.op1__cell--knob {
  display: grid;
  place-items: center;
}
.op1__knob {
  position: relative;
  width: 60%;
  aspect-ratio: 1;
  padding: 0;
  border: calc(var(--u) * 0.03) solid #55555c;
  border-radius: 50%;
  cursor: ns-resize;
  background: var(--cell);
  box-shadow:
    0 calc(var(--u) * 0.02) calc(var(--u) * 0.05) rgba(0, 0, 0, 0.12),
    inset 0 calc(var(--u) * 0.02) calc(var(--u) * 0.05) rgba(0, 0, 0, 0.08);
}
.op1__knob-cap {
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 30%, var(--hi), var(--knob) 65%);
  box-shadow:
    0 calc(var(--u) * 0.035) calc(var(--u) * 0.06) rgba(0, 0, 0, 0.22),
    inset 0 calc(var(--u) * -0.02) calc(var(--u) * 0.04) rgba(0, 0, 0, 0.1);
  transition: transform 40ms linear;
}
.op1__knob-slot {
  position: absolute;
  left: 50%;
  top: 14%;
  width: 18%;
  height: 72%;
  translate: -50% 0;
  border-radius: 99px;
  background: var(--slot);
  box-shadow: inset 0 calc(var(--u) * 0.01) calc(var(--u) * 0.02) rgba(0, 0, 0, 0.15);
}
.op1__knob--blue { --knob: #3fa6ef; --hi: #6cc0ff; --slot: #2d8fd8; }
.op1__knob--green { --knob: #10c070; --hi: #3fe095; --slot: #0aa65f; }
.op1__knob--white { --knob: #f3f3f5; --hi: #ffffff; --slot: #e1e1e5; }
.op1__knob--orange { --knob: #ff6a1f; --hi: #ff8c4a; --slot: #ec5a12; }

/* ---------------- Black keys ---------------- */

.op1__blacks {
  position: relative;
}
.op1__seg {
  position: absolute;
  top: 0;
  bottom: 0;
}
.op1__black {
  position: absolute;
  top: 50%;
  width: calc(var(--u) * 0.6);
  aspect-ratio: 1;
  translate: -50% -50%;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  background: radial-gradient(circle at 45% 35%, #2a2a2d, #0c0c0d 70%);
  box-shadow:
    0 calc(var(--u) * 0.04) calc(var(--u) * 0.07) rgba(0, 0, 0, 0.3),
    inset 0 calc(var(--u) * 0.012) 0 rgba(255, 255, 255, 0.08);
  transition: transform 60ms ease, box-shadow 60ms ease;
  -webkit-tap-highlight-color: transparent;
}
.op1__black.is-down {
  transform: scale(0.95);
  box-shadow: 0 calc(var(--u) * 0.01) calc(var(--u) * 0.02) rgba(0, 0, 0, 0.3);
}

/* ---------------- Side strip ---------------- */

.op1__side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--u) * 2.05) 0 calc(var(--u) * 0.5);
}
.op1__dots {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.12);
}
.op1__dots span {
  width: calc(var(--u) * 0.065);
  aspect-ratio: 1;
  border-radius: 50%;
  background: #3a3a3e;
}
.op1__brand {
  writing-mode: vertical-rl;
  rotate: 180deg;
  font: 400 calc(var(--u) * 0.36) / 1 'Helvetica Neue', Helvetica, Arial, sans-serif;
  letter-spacing: 0.02em;
  color: #a6a6ae;
}

.op1__key:focus-visible,
.op1__black:focus-visible,
.op1__knob:focus-visible,
.op1__volume:focus-visible {
  outline: 2px solid #3fa6ef;
  outline-offset: -2px;
}

.op1-hint {
  margin: 40px 0 0;
  text-align: center;
  color: var(--color-subtle, #54595d);
  font-size: 14px;
  line-height: 1.6;
}
.op1-credits {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 24px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.op1-credits li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.op1-credits__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--knob);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.op1-credits__slot {
  color: var(--color-subtle, #54595d);
  text-transform: capitalize;
}
.op1-credits a {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  color: var(--color-progressive, #36c);
}
.op1-hint kbd {
  display: inline-block;
  min-width: 1.4em;
  padding: 0 0.35em;
  border-radius: 4px;
  border: 1px solid var(--border-color-base, #a2a9b1);
  background: var(--background-color-base, #fff);
  font: 12px/1.5 ui-monospace, Menlo, monospace;
}
</style>
