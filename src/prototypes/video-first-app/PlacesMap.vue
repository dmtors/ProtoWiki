<script setup lang="ts">
/**
 * Full-bleed slippy map on Wikimedia Maps tiles: drag to pan, wheel or
 * double-click to zoom, tap a pin to select a place. No map library.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { ArticlePlace } from './wikiApi'

const props = withDefaults(
  defineProps<{
    places: ArticlePlace[]
    selected: string | null
    /** Label the selected pin with a link to its article (off when the page shows its own card). */
    callout?: boolean
  }>(),
  { callout: true },
)
const emit = defineEmits<{ select: [title: string | null]; open: [title: string] }>()

const TILE = 256
const MIN_ZOOM = 1
const MAX_ZOOM = 16

const el = ref<HTMLElement | null>(null)
const width = ref(400)
const height = ref(600)
const zoom = ref(5)
/** Map centre in world pixels at the current zoom. */
const cx = ref(0)
const cy = ref(0)

function project(lat: number, lon: number, z: number): { x: number; y: number } {
  const scale = TILE * 2 ** z
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

function centreOn(lat: number, lon: number, z: number): void {
  const p = project(lat, lon, z)
  zoom.value = z
  cx.value = p.x
  cy.value = p.y
}

/** Fit every place on screen (one place: a regional view around it). */
function fit(): void {
  if (!props.places.length) return centreOn(48, 10, 4)
  const lats = props.places.map((p) => p.lat)
  const lons = props.places.map((p) => p.lon)
  const [minLat, maxLat, minLon, maxLon] = [
    Math.min(...lats),
    Math.max(...lats),
    Math.min(...lons),
    Math.max(...lons),
  ]
  let z = 5
  if (props.places.length > 1) {
    for (z = MAX_ZOOM - 4; z >= MIN_ZOOM; z--) {
      const a = project(maxLat, minLon, z)
      const b = project(minLat, maxLon, z)
      if (b.x - a.x < width.value * 0.8 && b.y - a.y < height.value * 0.6) break
    }
    z = Math.max(MIN_ZOOM, z)
  }
  centreOn((minLat + maxLat) / 2, (minLon + maxLon) / 2, z)
}

const tiles = computed(() => {
  const z = zoom.value
  const n = 2 ** z
  const left = cx.value - width.value / 2
  const top = cy.value - height.value / 2
  const out: { key: string; src: string; x: number; y: number }[] = []
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height.value) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width.value) / TILE); tx++) {
      out.push({
        key: `${z}/${tx}/${ty}`,
        src: `https://maps.wikimedia.org/osm-intl/${z}/${((tx % n) + n) % n}/${ty}.png?lang=en`,
        x: tx * TILE - left,
        y: ty * TILE - top,
      })
    }
  }
  return out
})

const pins = computed(() =>
  props.places.map((place) => {
    const p = project(place.lat, place.lon, zoom.value)
    return { place, x: p.x - cx.value + width.value / 2, y: p.y - cy.value + height.value / 2 }
  }),
)

const selectedPin = computed(() => pins.value.find((p) => p.place.title === props.selected))

function zoomBy(delta: number, anchorX = width.value / 2, anchorY = height.value / 2): void {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))
  if (next === zoom.value) return
  const factor = 2 ** (next - zoom.value)
  const wx = cx.value - width.value / 2 + anchorX
  const wy = cy.value - height.value / 2 + anchorY
  cx.value = wx * factor - anchorX + width.value / 2
  cy.value = wy * factor - anchorY + height.value / 2
  zoom.value = next
}

let drag: { x: number; y: number; cx: number; cy: number; id: number; moved: boolean } | null = null

function onPointerDown(e: PointerEvent): void {
  if ((e.target as HTMLElement).closest('button, a')) return
  drag = { x: e.clientX, y: e.clientY, cx: cx.value, cy: cy.value, id: e.pointerId, moved: false }
  el.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
  cx.value = drag.cx - dx
  cy.value = drag.cy - dy
}

function onPointerUp(): void {
  if (drag && !drag.moved) emit('select', null)
  drag = null
}

let wheelLock = 0
function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const now = performance.now()
  if (now < wheelLock || Math.abs(e.deltaY) < 4) return
  wheelLock = now + 250
  const rect = el.value!.getBoundingClientRect()
  zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top)
}

function onDblClick(e: MouseEvent): void {
  const rect = el.value!.getBoundingClientRect()
  zoomBy(1, e.clientX - rect.left, e.clientY - rect.top)
}

let observer: ResizeObserver | null = null

onMounted(() => {
  const node = el.value!
  width.value = node.clientWidth
  height.value = node.clientHeight
  focusFirst()
  observer = new ResizeObserver(() => {
    width.value = node.clientWidth
    height.value = node.clientHeight
  })
  observer.observe(node)
  node.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  el.value?.removeEventListener('wheel', onWheel)
})

/** Start on the first place mentioned (usually the subject's home), like the design. */
function focusFirst(): void {
  const first = props.places[0]
  if (first) centreOn(first.lat, first.lon, 5)
  else fit()
}

watch(() => props.places, focusFirst)

defineExpose({ fit })
</script>

<template>
  <div
    ref="el"
    class="vf-map"
    role="application"
    aria-label="Map of places mentioned in the article. Drag to pan, scroll or double-click to zoom."
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="onDblClick"
  >
    <img
      v-for="tile in tiles"
      :key="tile.key"
      class="vf-map__tile"
      :src="tile.src"
      alt=""
      draggable="false"
      :style="{ transform: `translate(${tile.x}px, ${tile.y}px)` }"
    >
    <button
      v-for="pin in pins"
      :key="pin.place.title"
      type="button"
      class="vf-map__pin"
      :class="{ 'vf-map__pin--selected': pin.place.title === props.selected }"
      :style="{ transform: `translate(${pin.x}px, ${pin.y}px)` }"
      :aria-label="pin.place.title"
      :aria-pressed="pin.place.title === props.selected"
      @click="emit('select', pin.place.title)"
    />
    <a
      v-if="selectedPin && props.callout"
      href="#"
      class="vf-map__callout"
      :style="{ transform: `translate(${selectedPin.x}px, ${selectedPin.y}px)` }"
      @click.prevent="emit('open', selectedPin.place.title)"
    >
      {{ selectedPin.place.title }}
    </a>
    <p class="vf-map__credit">
      Wikimedia Maps · © OpenStreetMap contributors
    </p>
  </div>
</template>

<style scoped>
.vf-map {
  position: relative;
  height: 100%;
  overflow: hidden;
  background-color: var(--background-color-interactive-subtle);
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.vf-map__tile {
  position: absolute;
  top: 0;
  left: 0;
  width: 256px;
  height: 256px;
  pointer-events: none;
}

/* Tiles are light-only artwork; dim them in dark mode. */
[data-theme='dark'] .vf-map__tile {
  filter: brightness(0.75) contrast(1.1);
}

.vf-map__pin {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: var(--size-150);
  height: var(--size-150);
  margin: calc(-1 * var(--size-75)) 0 0 calc(-1 * var(--size-75));
  padding: 0;
  border: var(--border-width-thick) var(--border-style-base) var(--border-color-emphasized);
  border-radius: var(--border-radius-circle);
  background-color: var(--background-color-progressive);
  cursor: pointer;
}

.vf-map__pin--selected {
  z-index: 1;
  background-color: var(--background-color-progressive--active);
}

.vf-map__pin:focus-visible {
  outline: var(--border-width-thick) solid var(--border-color-progressive--focus);
  outline-offset: var(--border-width-base);
}

.vf-map__callout {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  margin-top: calc(-1 * (var(--size-150) + var(--size-200)));
  padding: var(--spacing-25) var(--spacing-75);
  border-radius: var(--border-radius-pill);
  background-color: var(--background-color-base);
  color: var(--color-link);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  text-decoration: none;
  translate: -50% 0;
}

.vf-map__credit {
  position: absolute;
  top: 0;
  right: 0;
  margin: 0;
  padding: 0 var(--spacing-25);
  background-color: var(--background-color-base);
  color: var(--color-subtle);
  font-size: var(--font-size-x-small);
  line-height: var(--line-height-x-small);
  opacity: var(--opacity-medium);
}
</style>
