<script setup lang="ts">
/**
 * Vertical full-screen pager. Swipe up for the next post (picked from your
 * interests), down to go back. Mouse drag, wheel / trackpad and arrow keys work
 * too. `locked` freezes it (comments open). Given an `order`, it pages through
 * that fixed list instead (`v-model:index`), stopping at both ends.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AndroidPost from './AndroidPost.vue'
import { nextPost, peekNextId, postById, previousPost, state } from '../video-first-app/store'

const props = defineProps<{
  paused: boolean
  muted: boolean
  locked: boolean
  fit?: boolean
  /** Fixed list of post ids to page through instead of the feed. */
  order?: string[]
  /** Photos only (no playback): passed on to each post. */
  gallery?: boolean
  /** The viewer has a back button: posts make room for it. */
  back?: boolean
}>()
/** Position in `order` (only used with `order`). */
const listIndex = defineModel<number>('index', { default: 0 })
const emit = defineEmits<{
  tap: []
  moved: []
  openComments: []
  openMore: []
  openArticles: []
  aspect: [postId: string, ratio: number]
}>()

const root = ref<HTMLElement | null>(null)
const dragY = ref(0)
const dragging = ref(false)
/** Pager size in px — rows report their live offset to posts in px. */
const height = ref(800)
const width = ref(400)
let resizeObserver: ResizeObserver | null = null

// The feed, or the fixed `order`, behind one interface.
const index = computed(() => (props.order ? listIndex.value : state.feedIndex))
const idAt = (i: number) => (props.order ? props.order[i] : state.feedOrder[i])
const nextId = () => (props.order ? props.order[listIndex.value + 1] : peekNextId())
const atEnd = computed(() => Boolean(props.order) && listIndex.value >= props.order!.length - 1)

const rows = computed(() => {
  const list: { index: number; id: string; offset: number }[] = []
  if (index.value > 0) {
    list.push({ index: index.value - 1, id: idAt(index.value - 1), offset: -1 })
  }
  list.push({ index: index.value, id: idAt(index.value), offset: 0 })
  if (!props.locked) {
    list.push({ index: index.value + 1, id: nextId(), offset: 1 })
  }
  return list
    .map((row) => ({ ...row, post: postById(row.id)! }))
    .filter((row) => row.post && (!props.locked || row.offset === 0))
})

// — Snap animation —
//
// Driven frame by frame (not CSS transitions) so each post's text opacity is
// always computed from where its video actually is — CSS would ease opacity on
// its own curve and briefly show both posts' text at once.

let anim = 0

/** Ease the feed offset to `target` px, then run `done`. Duration scales with distance. */
function animateTo(target: number, done?: () => void): void {
  cancelAnimationFrame(anim)
  // Hidden pages don't run animation frames; finish immediately instead of freezing.
  if (document.visibilityState === 'hidden') {
    dragY.value = target
    done?.()
    return
  }
  const from = dragY.value
  const distance = Math.abs(target - from) / (height.value || 1)
  const duration = Math.max(120, Math.min(320, distance * 400))
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    const eased = 1 - (1 - t) ** 3 // decelerate, like M3 emphasized-decelerate
    dragY.value = from + (target - from) * eased
    if (t < 1) anim = requestAnimationFrame(step)
    else done?.()
  }
  anim = requestAnimationFrame(step)
}

/**
 * Slide to the next (1) or previous (-1) post. The rows re-key when the offset
 * reaches a full screen, so the hand-off is seamless.
 */
function move(delta: number): void {
  if (props.locked) return
  if ((delta < 0 && index.value === 0) || (delta > 0 && atEnd.value)) {
    animateTo(0)
    return
  }
  animateTo(delta > 0 ? -height.value : height.value, () => {
    if (props.order) listIndex.value += delta
    else if (delta > 0) nextPost()
    else previousPost()
    dragY.value = 0
    emit('moved')
  })
}

// — Pointer drag —
//
// Vertical drags move between posts. A mostly-horizontal drag that starts in
// the middle band of the screen scrubs the current video instead.

let startX = 0
let startY = 0
let startT = 0
let moved = false
let axis: 'x' | 'y' | null = null
let inScrubBand = false
let pointerId: number | null = null

const IGNORE = 'button, a, input, textarea, md-icon-button, md-assist-chip, .vfa-post__caption'

/** Live scrub offset as a fraction of the screen width (null when not scrubbing). */
const scrub = ref<number | null>(null)

function onPointerDown(e: PointerEvent): void {
  if (props.locked || e.button !== 0 || (e.target as HTMLElement).closest(IGNORE)) return
  pointerId = e.pointerId
  // Catch a snap mid-flight: continue from where the feed currently is.
  cancelAnimationFrame(anim)
  startX = e.clientX
  startY = e.clientY - dragY.value
  startT = performance.now()
  moved = false
  axis = null
  const top = root.value?.getBoundingClientRect().top ?? 0
  const y = (e.clientY - top) / (height.value || 1)
  inScrubBand = !props.gallery && y > 0.2 && y < 0.8 && Math.abs(dragY.value) < 1
  dragging.value = true
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || e.pointerId !== pointerId) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (!moved) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
    moved = true
    axis = inScrubBand && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    root.value?.setPointerCapture(e.pointerId)
  }
  if (axis === 'x') {
    scrub.value = dx / (width.value || 1)
    return
  }
  // Rubber-band at the top of the feed (and the end of a fixed list).
  const edge = (dy > 0 && index.value === 0) || (dy < 0 && atEnd.value)
  dragY.value = edge ? dy / 4 : dy
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging.value || e.pointerId !== pointerId) return
  dragging.value = false
  pointerId = null
  if (!moved) {
    emit('tap')
    return
  }
  if (axis === 'x') {
    scrub.value = null
    return
  }
  const d = e.clientY - startY
  const dt = Math.max(1, performance.now() - startT)
  if (Math.abs(d) > height.value * 0.15 || Math.abs(d) / dt > 0.4) {
    move(d < 0 ? 1 : -1)
  } else {
    animateTo(0)
  }
}

// — Wheel / trackpad and keys —

let wheelLock = 0

function onWheel(e: WheelEvent): void {
  if (props.locked) return
  e.preventDefault()
  const now = performance.now()
  if (now < wheelLock || Math.abs(e.deltaY) < 30) return
  move(e.deltaY > 0 ? 1 : -1)
  wheelLock = now + 700
}

function onKey(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  if (target.closest('input, textarea, [role="dialog"]') || state.createOpen) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    move(e.key === 'ArrowDown' ? 1 : -1)
  }
}

onMounted(() => {
  if (root.value) {
    height.value = root.value.clientHeight
    width.value = root.value.clientWidth
    resizeObserver = new ResizeObserver(() => {
      if (!root.value) return
      height.value = root.value.clientHeight
      width.value = root.value.clientWidth
    })
    resizeObserver.observe(root.value)
  }
  window.addEventListener('keydown', onKey)
  root.value?.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(anim)
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKey)
  root.value?.removeEventListener('wheel', onWheel)
})
</script>

<template>
  <div
    ref="root"
    class="vfa-pager"
    :class="{ 'vfa-pager--dragging': dragging }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-for="row in rows"
      :key="row.index"
      class="vfa-pager__row"
      :inert="row.offset !== 0"
      :style="{ top: `${row.offset * height + dragY}px` }"
    >
      <AndroidPost
        :post="row.post"
        :active="row.offset === 0"
        :paused="props.paused"
        :muted="props.muted"
        :comments-open="props.locked"
        :shift="row.offset * height + dragY"
        :height="height"
        :fit="props.fit"
        :scrub="row.offset === 0 ? scrub : null"
        :gallery="props.gallery"
        :back="props.back"
        @open-comments="emit('openComments')"
        @open-more="emit('openMore')"
        @open-articles="emit('openArticles')"
        @aspect="(ratio: number) => emit('aspect', row.post.id, ratio)"
      />
    </div>
  </div>
</template>

<style scoped>
.vfa-pager {
  position: relative;
  /* Keep the posts' text layers (z-index 1) inside the pager, below the feed's mute button. */
  isolation: isolate;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  background-color: var(--md-sys-color-surface);
}

/*
 * Rows move with `top`, not `transform`: a transform would make each row its
 * own stacking context, and the next post's video would paint over the
 * outgoing post's text. With `top`, every post's text layer (z-index 1) sits
 * above every video while they crossfade.
 */
.vfa-pager__row {
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
