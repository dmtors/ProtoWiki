<script setup lang="ts">
/**
 * One full-screen post: the frame (a still with a slow zoom standing in for
 * video), author + caption, and the like / comments / more rail. With comments
 * open the frame shrinks into a letterboxed strip at the top.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CdxButton, CdxIcon } from '@wikimedia/codex'
import {
  cdxIconHeart,
  cdxIconHeartOutline,
  cdxIconPause,
  cdxIconPlay,
  cdxIconSpeechBubbles,
  cdxIconVerticalEllipsis,
} from '@wikimedia/codex-icons'

import { formatCount, type Post } from './data'
import { state, toggleLike } from './store'

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

let raf = 0
let started = 0
let pausedAt = 0

/** The playback bar advances over the post's duration and loops. */
function tick(now: number): void {
  if (!started) started = now
  const elapsed = (now - started) / 1000
  progress.value = (elapsed % props.post.duration) / props.post.duration
  raf = requestAnimationFrame(tick)
}

const playing = computed(() => props.active && !props.paused)

/**
 * Tap feedback: `pause` stays up while the video is paused; `play` flashes and
 * fades out when it resumes. `flashKey` restarts the fade on repeated taps.
 */
const indicator = ref<'pause' | 'play' | null>(null)
const flashKey = ref(0)

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
const videoEl = ref<HTMLVideoElement | null>(null)

watch(
  playing,
  (isPlaying) => {
    cancelAnimationFrame(raf)
    // Real clips drive their own progress through timeupdate.
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

function onTimeUpdate(): void {
  const video = videoEl.value
  if (video?.duration) progress.value = video.currentTime / video.duration
}

function onVideoReady(): void {
  if (playing.value) videoEl.value?.play().catch(() => {})
}

watch(
  () => props.active,
  (isActive) => {
    if (!isActive) {
      started = 0
      pausedAt = 0
      progress.value = 0
      expanded.value = false
      indicator.value = null
      if (videoEl.value) videoEl.value.currentTime = 0
    }
  },
)

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <article
    class="vf-post"
    :class="{ 'vf-post--playing': playing, 'vf-post--comments': props.commentsOpen }"
    :aria-label="`Video by ${props.post.author}`"
  >
    <div class="vf-post__media">
      <video
        v-if="props.post.video"
        ref="videoEl"
        class="vf-post__frame vf-post__frame--video"
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
        class="vf-post__frame"
        :src="props.post.media"
        :alt="props.post.caption"
        draggable="false"
      >
    </div>

    <div
      v-if="props.active && indicator && !props.commentsOpen"
      :key="`${indicator}-${flashKey}`"
      class="vf-post__paused"
      :class="{ 'vf-post__paused--flash': indicator === 'play' }"
      aria-hidden="true"
      @animationend="indicator = null"
    >
      <span class="vf-post__indicator">
        <CdxIcon
          :icon="indicator === 'pause' ? cdxIconPause : cdxIconPlay"
          size="medium"
        />
      </span>
    </div>

    <template v-if="!props.commentsOpen">
      <div class="vf-post__scrim" />

      <div class="vf-post__info">
        <p class="vf-post__byline">
          <b>{{ props.post.author }}</b> {{ props.post.ago }}
        </p>
        <p
          v-if="props.post.caption"
          class="vf-post__caption"
          :class="{ 'vf-post__caption--expanded': expanded }"
          @click="expanded = !expanded"
        >
          {{ props.post.caption }}
        </p>
        <p
          v-if="props.post.credit"
          class="vf-post__credit"
        >
          {{ props.post.credit }}
        </p>
      </div>

      <div class="vf-post__rail">
        <div class="vf-post__action">
          <CdxButton
            weight="quiet"
            size="large"
            :aria-label="liked ? 'Unlike' : 'Like'"
            :aria-pressed="liked"
            @click="toggleLike(props.post)"
          >
            <CdxIcon :icon="liked ? cdxIconHeart : cdxIconHeartOutline" />
          </CdxButton>
          <span
            v-if="props.post.likes"
            class="vf-post__count"
          >{{
            formatCount(props.post.likes)
          }}</span>
        </div>
        <div class="vf-post__action">
          <CdxButton
            weight="quiet"
            size="large"
            aria-label="Comments"
            @click="emit('openComments')"
          >
            <CdxIcon :icon="cdxIconSpeechBubbles" />
          </CdxButton>
          <span
            v-if="props.post.comments.length"
            class="vf-post__count"
          >{{
            formatCount(props.post.comments.length)
          }}</span>
        </div>
        <div class="vf-post__action">
          <CdxButton
            weight="quiet"
            size="large"
            aria-label="More options"
            @click="emit('openMore')"
          >
            <CdxIcon :icon="cdxIconVerticalEllipsis" />
          </CdxButton>
        </div>
      </div>

      <div
        class="vf-post__progress"
        aria-hidden="true"
      >
        <span :style="{ transform: `scaleX(${progress})` }" />
      </div>
    </template>
  </article>
</template>

<style scoped>
.vf-post {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--background-color-base);
  color: var(--color-base);
  user-select: none;
}

.vf-post__media {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.vf-post--comments .vf-post__media {
  position: relative;
  height: 100%;
}

.vf-post__frame {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Starts slightly zoomed so the frames' rounded corners stay off-screen. */
  transform: scale(1.06);
  transform-origin: 50% 55%;
  animation: vf-zoom 20s ease-in-out infinite alternate;
  animation-play-state: paused;
}

.vf-post--playing .vf-post__frame {
  animation-play-state: running;
}

/* Comments open: the frame letterboxes into the strip above the comments. */
.vf-post--comments .vf-post__frame {
  object-fit: contain;
  transform: none;
  animation: none;
}

@keyframes vf-zoom {
  to {
    transform: scale(1.18);
  }
}

.vf-post__paused {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.vf-post__paused--flash {
  animation: vf-flash 0.6s ease-out forwards;
}

@keyframes vf-flash {
  from {
    opacity: var(--opacity-base);
    transform: scale(1);
  }
  to {
    opacity: var(--opacity-transparent);
    transform: scale(1.3);
  }
}

/* Circle on our own wrapper: Codex sizes the icon box itself. */
.vf-post__indicator {
  display: flex;
  padding: var(--spacing-100);
  border-radius: var(--border-radius-circle);
  background-color: var(--background-color-backdrop-dark);
  color: var(--color-base);
}

.vf-post__scrim {
  position: absolute;
  inset: 55% 0 0 0;
  background: linear-gradient(to top, var(--background-color-backdrop-dark), transparent);
  pointer-events: none;
}

.vf-post__info {
  position: absolute;
  inset: auto calc(var(--size-300) + var(--spacing-50)) var(--spacing-150) var(--spacing-100);
}

.vf-post__byline,
.vf-post__caption {
  margin: 0;
  font-size: var(--font-size-medium);
  line-height: var(--line-height-medium);
}

.vf-post__byline b {
  margin-inline-end: var(--spacing-25);
}

.vf-post__caption {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  cursor: pointer;
}

.vf-post__credit {
  margin: var(--spacing-25) 0 0;
  overflow: hidden;
  color: var(--color-subtle);
  font-size: var(--font-size-x-small);
  line-height: var(--line-height-x-small);
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Real clips play as-is: no zoom. */
.vf-post__frame--video {
  transform: none;
  animation: none;
}

.vf-post__caption--expanded {
  -webkit-line-clamp: unset;
}

.vf-post__rail {
  position: absolute;
  inset: auto 0 var(--spacing-100) auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-50);
  width: var(--size-300);
}

.vf-post__action {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vf-post__count {
  margin-top: calc(-1 * var(--spacing-50));
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-small);
}

.vf-post__progress {
  position: absolute;
  inset: auto 0 0 0;
  height: var(--size-25);
}

.vf-post__progress span {
  display: block;
  height: 100%;
  background-color: var(--color-base);
  transform-origin: left center;
}
</style>
