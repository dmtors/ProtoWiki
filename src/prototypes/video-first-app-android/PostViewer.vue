<script setup lang="ts">
/**
 * Full-screen post viewer: the vertical pager with its header (zoom, mute),
 * comments split view and post sheets. The feed uses it on the feed; the
 * article viewers use it on an article's images or videos (`order` + `back`,
 * plus `gallery` for images).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  cdxIconArrowPrevious,
  cdxIconExitFullscreen,
  cdxIconFullscreen,
  cdxIconVolumeOff,
  cdxIconVolumeUp,
} from '@wikimedia/codex-icons'

import AndroidPager from './AndroidPager.vue'
import ArticlesSheet from './ArticlesSheet.vue'
import CodexSvg from './CodexSvg.vue'
import CommentsPanel from './CommentsPanel.vue'
import FlagDialog from './FlagDialog.vue'
import MoreSheet from './MoreSheet.vue'
import { currentPost, postById, state } from '../video-first-app/store'

const props = defineProps<{
  /** Page through these post ids instead of the feed (see AndroidPager). */
  order?: string[]
  /** Photos: no mute or playback. */
  gallery?: boolean
  /** Opened from somewhere (an article): a back button leads the header. */
  back?: boolean
}>()
const emit = defineEmits<{ back: [] }>()
/** Position in `order`. */
const index = defineModel<number>('index', { default: 0 })

const muted = ref(true)
/**
 * Show wide media whole (letterboxed) instead of filling the screen. Carries
 * across posts. Photos start whole; videos start filling the screen.
 */
const fit = ref(Boolean(props.gallery))
/** Each post's natural width ÷ height, reported as its media loads. */
const aspects = ref<Record<string, number>>({})
const videoBox = ref<HTMLElement | null>(null)
const boxAspect = ref(9 / 20)
let boxObserver: ResizeObserver | null = null

const noun = computed(() => (props.gallery ? 'image' : 'video'))

/** The zoom toggle only appears when the current media is wider than the screen. */
const canZoom = computed(() => {
  const ratio = post.value ? aspects.value[post.value.id] : undefined
  return ratio !== undefined && ratio > boxAspect.value * 1.15
})

function observeBox(el: HTMLElement | null): void {
  boxObserver?.disconnect()
  if (!el) return
  const measure = () => {
    if (el.clientWidth && el.clientHeight) boxAspect.value = el.clientWidth / el.clientHeight
  }
  measure()
  boxObserver = new ResizeObserver(measure)
  boxObserver.observe(el)
}
const paused = ref(false)
const commentsOpen = ref(false)
const articlesOpen = ref(false)
const moreOpen = ref(false)
const flagOpen = ref(false)

const post = computed(() =>
  props.order ? (postById(props.order[index.value]) ?? null) : (currentPost.value ?? null),
)

/** Photos don't play, so a tap doesn't pause. */
function onTap(): void {
  if (!props.gallery) paused.value = !paused.value
}

watch(
  () => (props.order ? index.value : state.feedIndex),
  () => {
    paused.value = false
    commentsOpen.value = false
  },
)

watch(videoBox, (el) => {
  // Measure the full-screen box, not the shrunken one while comments are open.
  if (!commentsOpen.value) observeBox(el)
})

onBeforeUnmount(() => boxObserver?.disconnect())
</script>

<template>
  <div
    class="vfa-feed__body"
    :class="{ 'vfa-feed--comments': commentsOpen }"
  >
    <div
      ref="videoBox"
      class="vfa-feed__video"
    >
      <AndroidPager
        v-model:index="index"
        :order="props.order"
        :gallery="props.gallery"
        :back="props.back"
        :paused="paused"
        :muted="muted"
        :locked="commentsOpen"
        :fit="fit"
        @tap="onTap"
        @open-comments="commentsOpen = true"
        @open-more="moreOpen = true"
        @open-articles="articlesOpen = true"
        @aspect="(id: string, ratio: number) => (aspects[id] = ratio)"
      />

      <header class="vfa-feed__header">
        <md-icon-button
          v-if="props.back && !commentsOpen"
          class="vfa-feed__back"
          aria-label="Back"
          @click="emit('back')"
        >
          <CodexSvg :icon="cdxIconArrowPrevious" />
        </md-icon-button>
        <md-icon-button
          v-if="canZoom && !commentsOpen"
          class="vfa-feed__zoom"
          :aria-label="fit ? 'Fill the screen' : `Show the whole ${noun}`"
          :title="fit ? 'Fill the screen' : `Show the whole ${noun}`"
          @click="fit = !fit"
        >
          <CodexSvg :icon="fit ? cdxIconFullscreen : cdxIconExitFullscreen" />
        </md-icon-button>
        <md-icon-button
          v-if="!props.gallery"
          class="vfa-feed__mute"
          :aria-label="muted ? 'Unmute' : 'Mute'"
          @click="muted = !muted"
        >
          <CodexSvg :icon="muted ? cdxIconVolumeOff : cdxIconVolumeUp" />
        </md-icon-button>
      </header>
    </div>

    <Transition name="vfa-comments">
      <div
        v-if="commentsOpen"
        class="vfa-feed__comments"
      >
        <CommentsPanel
          :post="post"
          @close="commentsOpen = false"
        />
      </div>
    </Transition>
  </div>

  <ArticlesSheet
    v-model:open="articlesOpen"
    :post="post"
  />
  <MoreSheet
    v-model:open="moreOpen"
    :post="post"
    @flag="flagOpen = true"
  />
  <FlagDialog
    v-model:open="flagOpen"
    :post="post"
  />
</template>

<style scoped>
.vfa-feed__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.vfa-feed__video {
  position: relative;
  flex: 1 1 100%;
  min-height: 0;
  transition: flex-basis 400ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-feed--comments .vfa-feed__video {
  flex: 0 0 40%;
}

.vfa-feed__comments {
  flex: 1;
  min-height: 0;
}

.vfa-feed__header {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: calc(var(--vfa-top-inset) + var(--vfa-bar-height) / 2 - 20px) calc(10% - 20px) 0 16px;
  pointer-events: none;
}

.vfa-feed__header > * {
  pointer-events: auto;
}

/* Every header icon is white over the media. */
.vfa-feed__header md-icon-button {
  --md-icon-button-icon-color: var(--vfa-on-media);
  --md-icon-button-hover-icon-color: var(--vfa-on-media);
  --md-icon-button-focus-icon-color: var(--vfa-on-media);
  --md-icon-button-pressed-icon-color: var(--vfa-on-media);
}

/* The back button's icon sits on the gutter, like every top bar's. */
.vfa-feed__back {
  margin-inline-start: calc(var(--vfa-icon-edge) - 16px);
}

.vfa-feed__zoom {
  margin-inline-start: auto;
}

/* Mute stays rightmost (centred under the nav's "You"); zoom sits just left of it. */
.vfa-feed__zoom + .vfa-feed__mute {
  margin-inline-start: 0;
}

.vfa-feed__mute {
  margin-inline-start: auto;
}

.vfa-comments-enter-active {
  transition: transform 400ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-comments-leave-active {
  transition: transform 200ms var(--vfa-ease-emphasized-accelerate);
}

.vfa-comments-enter-from,
.vfa-comments-leave-to {
  transform: translateY(100%);
}
</style>
