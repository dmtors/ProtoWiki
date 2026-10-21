<script setup lang="ts">
/**
 * One full-screen post, M3 style: real Commons video (or a still with a slow
 * zoom), author + caption, an icon-button rail and an M3 linear progress bar.
 * With comments open the video letterboxes into the strip above them.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  cdxIconHeart,
  cdxIconHeartOutline,
  cdxIconPause,
  cdxIconPlay,
  cdxIconSpeechBubbles,
  cdxIconVerticalEllipsis,
} from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import { formatClock, formatCount, type Post } from '../video-first-app/data'
import { postReason, state, toggleLike } from '../video-first-app/store'

const props = defineProps<{
  post: Post
  active: boolean
  paused: boolean
  muted: boolean
  commentsOpen: boolean
  /** This row's live vertical offset from the screen, in px (0 = on screen). */
  shift?: number
  /** Pager height in px. */
  height?: number
  /** Show the whole frame of wide videos (letterboxed) instead of filling the screen. */
  fit?: boolean
  /** Live scrub offset as a fraction of the screen width; null when not scrubbing. */
  scrub?: number | null
  /** A photo in the image viewer: held still, no playback bar. */
  gallery?: boolean
  /** The viewer's back button takes the top-left corner; the title moves over. */
  back?: boolean
}>()
const emit = defineEmits<{
  openComments: []
  openMore: []
  openArticles: []
  /** The media's natural width ÷ height, once known. */
  aspect: [ratio: number]
}>()

// — Fill vs fit —
//
// The frame always renders "contain" (whole frame visible); "fill" is a
// scale-up to exactly the cover size. Switching animates the scale, so the
// zoom is smooth instead of a jump between object-fit modes.

const mediaEl = ref<HTMLElement | null>(null)
const mediaAspect = ref<number | null>(null)
const boxAspect = ref(9 / 20)
let mediaObserver: ResizeObserver | null = null

function setAspect(width: number, height: number): void {
  if (!width || !height) return
  mediaAspect.value = width / height
  emit('aspect', mediaAspect.value)
}

/** Wider than the screen, so filling crops the sides: the case the zoom toggle is for. */
const isWide = computed(
  () => mediaAspect.value !== null && mediaAspect.value > boxAspect.value * 1.15,
)

/** Scale that turns "contain" into "cover" for this frame in this box. */
const coverScale = computed(() => {
  if (mediaAspect.value === null) return 1
  return Math.max(boxAspect.value / mediaAspect.value, mediaAspect.value / boxAspect.value)
})

const zoomStyle = computed(() => ({
  transform: `scale(${props.commentsOpen || (props.fit && isWide.value) ? 1 : coverScale.value})`,
}))

onMounted(() => {
  const el = mediaEl.value
  if (!el) return
  const measure = () => {
    if (el.clientWidth && el.clientHeight) boxAspect.value = el.clientWidth / el.clientHeight
  }
  measure()
  mediaObserver = new ResizeObserver(measure)
  mediaObserver.observe(el)
})

/**
 * The text layer doesn't travel with the video: it cancels the row's offset
 * and fades with distance instead. Fully gone by half a screen away, so the
 * outgoing text clears before the incoming text appears — tied to the swipe.
 */
const overlayStyle = computed(() => {
  const shift = props.shift ?? 0
  const height = props.height || 1
  return {
    transform: `translateY(${-shift}px)`,
    opacity: Math.max(0, Math.min(1, 1 - (2 * Math.abs(shift)) / height)),
  }
})

const reason = computed(() => postReason(props.post))

const liked = computed(() => Boolean(state.liked[props.post.id]))
const progress = ref(0)
const expanded = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const playing = computed(() => props.active && !props.paused)

/** Tap feedback: `pause` stays while paused; `play` flashes on resume. */
const indicator = ref<'pause' | 'play' | null>(null)
const flashKey = ref(0)

let raf = 0
let started = 0
let pausedAt = 0

function tick(now: number): void {
  if (!started) started = now
  progress.value = (((now - started) / 1000) % props.post.duration) / props.post.duration
  raf = requestAnimationFrame(tick)
}

watch(
  playing,
  (isPlaying) => {
    cancelAnimationFrame(raf)
    if (props.post.video) {
      if (isPlaying) videoEl.value?.play().catch(() => {})
      else videoEl.value?.pause()
      return
    }
    if (isPlaying) {
      if (pausedAt) started = performance.now() - pausedAt
      raf = requestAnimationFrame(tick)
    } else if (started) {
      pausedAt = performance.now() - started
    }
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => props.paused,
  (isPaused, wasPaused) => {
    if (!props.active) return
    if (isPaused) indicator.value = 'pause'
    else if (wasPaused && indicator.value === 'pause') {
      indicator.value = 'play'
      flashKey.value++
    }
  },
)

watch(
  () => props.active,
  (isActive) => {
    if (isActive) return
    started = 0
    pausedAt = 0
    progress.value = 0
    expanded.value = false
    indicator.value = null
    if (videoEl.value) videoEl.value.currentTime = 0
  },
)

function onTimeUpdate(): void {
  const video = videoEl.value
  if (video?.duration && !scrubbing.value) progress.value = video.currentTime / video.duration
}

// — Scrubbing —
//
// A sideways drag (see the pager) seeks the video: the full screen width covers
// the whole clip. Playback holds on the frame while scrubbing and resumes after.

const scrubbing = computed(
  () => props.scrub !== null && props.scrub !== undefined && Boolean(props.post.video),
)
const scrubTime = ref(0)
let scrubFrom = 0

watch(
  () => props.scrub,
  (offset, previous) => {
    const video = videoEl.value
    if (!video || !video.duration) return
    const starting =
      (previous === null || previous === undefined) && offset !== null && offset !== undefined
    if (starting) {
      scrubFrom = video.currentTime
      video.pause()
    }
    if (offset === null || offset === undefined) {
      if (playing.value) video.play().catch(() => {})
      return
    }
    const target = Math.min(video.duration - 0.05, Math.max(0, scrubFrom + offset * video.duration))
    scrubTime.value = target
    progress.value = target / video.duration
    // fastSeek (Safari, Firefox) jumps to the nearest keyframe for snappier scrubbing.
    const seeker = video as unknown as { fastSeek?: (time: number) => void }
    if (typeof seeker.fastSeek === 'function') seeker.fastSeek(target)
    else video.currentTime = target
  },
)

const scrubLabel = computed(() => {
  const duration = videoEl.value?.duration || props.post.duration
  return `${formatClock(scrubTime.value)} / ${formatClock(duration)}`
})

function onVideoReady(): void {
  if (playing.value) videoEl.value?.play().catch(() => {})
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  mediaObserver?.disconnect()
})
</script>

<template>
  <article
    class="vfa-post"
    :class="{
      'vfa-post--playing': playing,
      'vfa-post--comments': props.commentsOpen,
      'vfa-post--gallery': props.gallery,
      'vfa-post--back': props.back,
    }"
    :aria-label="`${props.gallery ? 'Image' : 'Video'} by ${props.post.author}`"
  >
    <div
      ref="mediaEl"
      class="vfa-post__media"
    >
      <div
        class="vfa-post__zoom"
        :class="{ 'vfa-post__zoom--measured': mediaAspect !== null }"
        :style="zoomStyle"
      >
        <video
          v-if="props.post.video"
          ref="videoEl"
          class="vfa-post__frame"
          :src="props.post.video"
          :poster="props.post.media"
          :muted="props.muted"
          loop
          playsinline
          preload="metadata"
          @timeupdate="onTimeUpdate"
          @loadeddata="onVideoReady"
          @loadedmetadata="
            setAspect(
              ($event.target as HTMLVideoElement).videoWidth,
              ($event.target as HTMLVideoElement).videoHeight,
            )
          "
        />
        <img
          v-else
          class="vfa-post__frame vfa-post__frame--still"
          :src="props.post.media"
          :alt="props.post.caption"
          draggable="false"
          @load="
            setAspect(
              ($event.target as HTMLImageElement).naturalWidth,
              ($event.target as HTMLImageElement).naturalHeight,
            )
          "
        >
      </div>
    </div>

    <div
      v-if="props.active && indicator && !props.commentsOpen"
      :key="`${indicator}-${flashKey}`"
      class="vfa-post__indicator"
      :class="{ 'vfa-post__indicator--flash': indicator === 'play' }"
      aria-hidden="true"
      @animationend="indicator = null"
    >
      <span class="vfa-post__indicator-disc">
        <CodexSvg
          :icon="indicator === 'pause' ? cdxIconPause : cdxIconPlay"
          :size="32"
        />
      </span>
    </div>

    <div
      v-if="!props.commentsOpen"
      class="vfa-post__overlay"
      :style="overlayStyle"
    >
      <div class="vfa-post__scrim vfa-post__scrim--top" />
      <div class="vfa-post__scrim" />

      <button
        type="button"
        class="vfa-post__topic"
        :aria-label="`${props.post.articles.length} connected articles`"
        @click="emit('openArticles')"
      >
        <md-ripple />
        <md-focus-ring inward />
        <span class="vfa-post__title">
          <span class="md-typescale-title-large vfa-serif">{{ props.post.articles[0] }}</span>
          <span
            v-if="props.post.articles.length > 1"
            class="vfa-post__more md-typescale-label-medium"
          >
            +{{ props.post.articles.length - 1 }}
          </span>
        </span>
        <span class="md-typescale-body-small">{{ reason }}</span>
      </button>

      <div class="vfa-post__info">
        <p class="vfa-post__byline">
          <span class="md-typescale-title-small">{{ props.post.author }}</span>
          <span class="md-typescale-body-small vfa-post__muted">{{ props.post.ago }}</span>
        </p>
        <p
          v-if="props.post.caption"
          class="vfa-post__caption md-typescale-body-medium"
          :class="{ 'vfa-post__caption--expanded': expanded }"
          @click="expanded = !expanded"
        >
          {{ props.post.caption }}
        </p>
        <p
          v-if="props.post.credit"
          class="vfa-post__credit md-typescale-label-small"
        >
          {{ props.post.credit }}
        </p>
      </div>

      <div class="vfa-post__rail">
        <div class="vfa-post__action">
          <md-icon-button
            :aria-label="liked ? 'Unlike' : 'Like'"
            :aria-pressed="liked"
            :class="{ 'vfa-post__liked': liked }"
            @click="toggleLike(props.post)"
          >
            <CodexSvg :icon="liked ? cdxIconHeart : cdxIconHeartOutline" />
          </md-icon-button>
          <span
            v-if="props.post.likes"
            class="vfa-post__count md-typescale-label-medium"
          >{{
            formatCount(props.post.likes)
          }}</span>
        </div>
        <div class="vfa-post__action">
          <md-icon-button
            aria-label="Comments"
            @click="emit('openComments')"
          >
            <CodexSvg :icon="cdxIconSpeechBubbles" />
          </md-icon-button>
          <span
            v-if="props.post.comments.length"
            class="vfa-post__count md-typescale-label-medium"
          >{{ formatCount(props.post.comments.length) }}</span>
        </div>
        <md-icon-button
          aria-label="More options"
          @click="emit('openMore')"
        >
          <CodexSvg :icon="cdxIconVerticalEllipsis" />
        </md-icon-button>
      </div>

      <div
        v-if="scrubbing"
        class="vfa-post__scrub md-typescale-title-medium"
        aria-live="polite"
      >
        {{ scrubLabel }}
      </div>

      <md-linear-progress
        v-if="!props.gallery"
        class="vfa-post__progress"
        :class="{ 'vfa-post__progress--scrubbing': scrubbing }"
        :value="progress"
        aria-label="Playback progress"
      />
    </div>
  </article>
</template>

<style scoped>
.vfa-post {
  position: relative;
  width: 100%;
  height: 100%;
  /* No clipping here: the text layer reaches beyond the moving frame while it
     crossfades. The media layer clips itself; the pager clips the screen. */
  background-color: var(--md-sys-color-surface);
  color: var(--vfa-on-media);
  user-select: none;
}

.vfa-post__media {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.vfa-post__zoom {
  width: 100%;
  height: 100%;
  transition: transform 350ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-post__frame {
  display: block;
  width: 100%;
  height: 100%;
  /* Until the media's shape is known, fill; afterwards contain + scale (see script). */
  object-fit: cover;
}

.vfa-post__zoom--measured .vfa-post__frame {
  object-fit: contain;
}

.vfa-post__frame--still {
  animation: vfa-zoom 20s ease-in-out infinite alternate;
  animation-play-state: paused;
}

.vfa-post--playing .vfa-post__frame--still {
  animation-play-state: running;
}

@keyframes vfa-zoom {
  to {
    transform: scale(1.18);
  }
}

.vfa-post--gallery .vfa-post__frame--still {
  animation: none;
}

.vfa-post--comments .vfa-post__frame {
  object-fit: contain;
  animation: none;
}

.vfa-post__indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.vfa-post__indicator-disc {
  display: flex;
  padding: 16px;
  border-radius: 50%;
  background-color: var(--md-sys-color-scrim);
  color: var(--vfa-on-media);
}

.vfa-post__indicator--flash {
  animation: vfa-flash 500ms var(--vfa-ease-emphasized-accelerate) forwards;
}

@keyframes vfa-flash {
  to {
    opacity: 0;
    transform: scale(1.3);
  }
}

.vfa-post__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  /* No transition: the pager animates every frame and this follows it exactly. */
}

.vfa-post__overlay :is(button, md-icon-button, md-linear-progress, .vfa-post__caption) {
  pointer-events: auto;
}

.vfa-post__scrim {
  position: absolute;
  inset: 50% 0 0 0;
  background: linear-gradient(to top, var(--md-sys-color-scrim), transparent);
  pointer-events: none;
}

.vfa-post__scrim--top {
  inset: 0 0 auto 0;
  height: 120px;
  background: linear-gradient(to bottom, var(--md-sys-color-scrim), transparent);
}

/* Title + reason; the mute button (owned by the feed) sits at the top-right. */
.vfa-post__topic {
  position: absolute;
  /* Title line centred on the shared first-row line (inset + half the bar). */
  top: calc(var(--vfa-top-inset) + var(--vfa-bar-height) / 2 - 20px);
  right: 56px;
  left: calc(var(--vfa-gutter) - 8px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  max-width: calc(100% - 64px);
  padding: 6px 8px;
  border: 0;
  border-radius: var(--vfa-shape-medium);
  background: none;
  color: var(--vfa-on-media);
  text-align: start;
  cursor: pointer;
  --md-focus-ring-shape: 12px;
}

/* With a back button in the top-left corner, the title follows it. */
.vfa-post--back .vfa-post__topic {
  left: calc(var(--vfa-icon-edge) + 40px);
  max-width: calc(100% - var(--vfa-icon-edge) - 40px - 56px);
}

.vfa-post__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vfa-post__more {
  padding: 2px 8px;
  border-radius: var(--vfa-shape-small);
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.vfa-post__info {
  position: absolute;
  /* Clear of the rail (centred 10% in, 40px wide) plus a 16px gap. */
  right: calc(10% + 36px);
  bottom: var(--vfa-gutter);
  left: var(--vfa-gutter);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vfa-post__byline,
.vfa-post__caption,
.vfa-post__credit {
  margin: 0;
}

.vfa-post__byline {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.vfa-post__muted,
.vfa-post__credit {
  color: var(--vfa-on-media);
}

.vfa-post__caption {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  cursor: pointer;
}

.vfa-post__caption--expanded {
  -webkit-line-clamp: unset;
}

.vfa-post__credit {
  overflow: hidden;
  font-weight: 400;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/*
 * Icon-button column (40px) centred on the nav bar's last item ("You"): five
 * equal items put its centre 10% of the width from the right edge. The mute
 * icon above uses the same line. The last button's icon ends on the gutter at
 * the bottom, level with the caption.
 */
.vfa-post__rail {
  position: absolute;
  right: calc(10% - 20px);
  bottom: calc(var(--vfa-gutter) - 8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 40px;
  --md-icon-button-icon-color: var(--vfa-on-media);
  --md-icon-button-hover-icon-color: var(--vfa-on-media);
  --md-icon-button-focus-icon-color: var(--vfa-on-media);
  --md-icon-button-pressed-icon-color: var(--vfa-on-media);
  --md-icon-button-hover-state-layer-color: var(--vfa-on-media);
  --md-icon-button-pressed-state-layer-color: var(--vfa-on-media);
}

.vfa-post__action {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Counts only appear once there are likes / comments. */
.vfa-post__count {
  margin-top: -4px;
  white-space: nowrap;
}

.vfa-post__liked {
  --md-icon-button-icon-color: var(--md-sys-color-error);
  --md-icon-button-hover-icon-color: var(--md-sys-color-error);
  --md-icon-button-focus-icon-color: var(--md-sys-color-error);
  --md-icon-button-pressed-icon-color: var(--md-sys-color-error);
}

.vfa-post__progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  --md-linear-progress-track-height: 3px;
  --md-linear-progress-active-indicator-height: 3px;
  --md-linear-progress-track-shape: 0;
  --md-linear-progress-active-indicator-color: var(--vfa-brand-blue);
  --md-linear-progress-track-color: transparent;
}

/* While scrubbing: a thicker bar with a visible track, so the position reads clearly. */
.vfa-post__progress--scrubbing {
  --md-linear-progress-track-height: 6px;
  --md-linear-progress-active-indicator-height: 6px;
  --md-linear-progress-track-color: color-mix(in srgb, var(--vfa-on-media) 30%, transparent);
}

/* Time readout while scrubbing, centred above the bar. */
.vfa-post__scrub {
  position: absolute;
  bottom: 120px;
  left: 50%;
  padding: 6px 14px;
  border-radius: 16px;
  background-color: var(--md-sys-color-scrim);
  color: var(--vfa-on-media);
  font-variant-numeric: tabular-nums;
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
