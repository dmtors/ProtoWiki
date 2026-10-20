<script setup lang="ts">
/**
 * Vertical full-screen pager. Swipe up for the next post (picked from your
 * interests), down to go back. Mouse drag, wheel / trackpad and arrow keys work
 * too. `locked` freezes it (comments open).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import PostCard from './PostCard.vue'
import { nextPost, peekNextId, postById, previousPost, state } from './store'

const props = defineProps<{ paused: boolean; muted: boolean; locked: boolean }>()
const emit = defineEmits<{ tap: []; moved: []; openComments: []; openMore: [] }>()

const root = ref<HTMLElement | null>(null)
const dragY = ref(0)
const dragging = ref(false)

const rows = computed(() => {
  const list: { index: number; id: string; offset: number }[] = []
  if (state.feedIndex > 0) {
    list.push({ index: state.feedIndex - 1, id: state.feedOrder[state.feedIndex - 1], offset: -1 })
  }
  list.push({ index: state.feedIndex, id: state.feedOrder[state.feedIndex], offset: 0 })
  if (!props.locked) {
    list.push({ index: state.feedIndex + 1, id: peekNextId(), offset: 1 })
  }
  return list
    .map((row) => ({ ...row, post: postById(row.id)! }))
    .filter((row) => row.post && (!props.locked || row.offset === 0))
})

function move(delta: number): void {
  if (props.locked) return
  if (delta > 0) nextPost()
  else if (state.feedIndex > 0) previousPost()
  else return
  emit('moved')
}

// — Pointer drag —

let startY = 0
let startT = 0
let moved = false
let pointerId: number | null = null

const IGNORE = 'button, a, input, textarea, .vf-post__caption'

function onPointerDown(e: PointerEvent): void {
  if (props.locked || e.button !== 0 || (e.target as HTMLElement).closest(IGNORE)) return
  pointerId = e.pointerId
  startY = e.clientY
  startT = performance.now()
  moved = false
  dragging.value = true
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || e.pointerId !== pointerId) return
  const dy = e.clientY - startY
  if (!moved) {
    if (Math.abs(dy) < 8) return
    moved = true
    root.value?.setPointerCapture(e.pointerId)
  }
  // Rubber-band at the top of the feed.
  dragY.value = dy > 0 && state.feedIndex === 0 ? dy / 4 : dy
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging.value || e.pointerId !== pointerId) return
  dragging.value = false
  pointerId = null
  if (!moved) {
    emit('tap')
    return
  }
  const d = e.clientY - startY
  const dt = Math.max(1, performance.now() - startT)
  if (Math.abs(d) > (root.value?.clientHeight ?? 700) * 0.15 || Math.abs(d) / dt > 0.4) {
    move(d < 0 ? 1 : -1)
  }
  dragY.value = 0
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
  window.addEventListener('keydown', onKey)
  root.value?.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  root.value?.removeEventListener('wheel', onWheel)
})
</script>

<template>
  <div
    ref="root"
    class="vf-pager"
    :class="{ 'vf-pager--dragging': dragging }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-for="row in rows"
      :key="row.index"
      class="vf-pager__row"
      :inert="row.offset !== 0"
      :style="{ transform: `translateY(calc(${row.offset * 100}% + ${dragY}px))` }"
    >
      <PostCard
        :post="row.post"
        :active="row.offset === 0"
        :paused="props.paused"
        :muted="props.muted"
        :comments-open="props.locked"
        @open-comments="emit('openComments')"
        @open-more="emit('openMore')"
      />
    </div>
  </div>
</template>

<style scoped>
.vf-pager {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  background-color: var(--background-color-base);
}

.vf-pager__row {
  position: absolute;
  inset: 0;
  transition: transform var(--transition-duration-medium) var(--transition-timing-function-system);
  will-change: transform;
}

.vf-pager--dragging .vf-pager__row {
  transition: none;
}
</style>
