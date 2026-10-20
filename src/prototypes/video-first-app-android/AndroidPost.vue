<script setup lang="ts">
/**
 * One full-screen post, M3 style: real Commons video (or a still with a slow
 * zoom), author + caption, an icon-button rail and an M3 linear progress bar.
 * With comments open the video letterboxes into the strip above them.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  cdxIconHeart,
  cdxIconHeartOutline,
  cdxIconPause,
  cdxIconPlay,
  cdxIconSpeechBubbles,
  cdxIconVerticalEllipsis,
} from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import { formatCount, type Post } from '../video-first-app/data'
import { state, toggleLike } from '../video-first-app/store'

const props = defineProps<{
  post: Post
  active: boolean
  paused: boolean
  muted: boolean
  commentsOpen: boolean
}>()
const emit = defineEmits<{ openComments: []; openMore: [] }>()

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
  if (video?.duration) progress.value = video.currentTime / video.duration
}

function onVideoReady(): void {
  if (playing.value) videoEl.value?.play().catch(() => {})
}

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <article
    class="vfa-post"
    :class="{ 'vfa-post--playing': playing, 'vfa-post--comments': props.commentsOpen }"
    :aria-label="`Video by ${props.post.author}`"
  >
    <div class="vfa-post__media">
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
      />
      <img
        v-else
        class="vfa-post__frame vfa-post__frame--still"
        :src="props.post.media"
        :alt="props.post.caption"
        draggable="false"
      >
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

    <template v-if="!props.commentsOpen">
      <div class="vfa-post__scrim" />

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
          <span class="md-typescale-label-medium">{{
            props.post.likes ? formatCount(props.post.likes) : 'Like'
          }}</span>
        </div>
        <div class="vfa-post__action">
          <md-icon-button
            aria-label="Comments"
            @click="emit('openComments')"
          >
            <CodexSvg :icon="cdxIconSpeechBubbles" />
          </md-icon-button>
          <span class="md-typescale-label-medium">{{
            props.post.comments.length ? formatCount(props.post.comments.length) : 'Comment'
          }}</span>
        </div>
        <md-icon-button
          aria-label="More options"
          @click="emit('openMore')"
        >
          <CodexSvg :icon="cdxIconVerticalEllipsis" />
        </md-icon-button>
      </div>

      <md-linear-progress
        class="vfa-post__progress"
        :value="progress"
        aria-label="Playback progress"
      />
    </template>
  </article>
</template>

<style scoped>
.vfa-post {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--md-sys-color-surface);
  color: var(--vfa-on-media);
  user-select: none;
}

.vfa-post__media {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.vfa-post__frame {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.vfa-post__scrim {
  position: absolute;
  inset: 50% 0 0 0;
  background: linear-gradient(to top, var(--md-sys-color-scrim), transparent);
  pointer-events: none;
}

.vfa-post__info {
  position: absolute;
  right: 80px;
  bottom: 20px;
  left: 16px;
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

.vfa-post__rail {
  position: absolute;
  right: 12px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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
</style>
