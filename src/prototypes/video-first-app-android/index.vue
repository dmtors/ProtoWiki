<script setup lang="ts">
definePage({
  meta: {
    // title + description: ask the author, or omit
    category: 'prototype',
    platform: 'app',
  },
})

import { computed, onMounted, ref, watch } from 'vue'
import { cdxIconVolumeOff, cdxIconVolumeUp } from '@wikimedia/codex-icons'

import AndroidPager from './AndroidPager.vue'
import AndroidShell from './AndroidShell.vue'
import ArticlesSheet from './ArticlesSheet.vue'
import CodexSvg from './CodexSvg.vue'
import CommentsPanel from './CommentsPanel.vue'
import FlagDialog from './FlagDialog.vue'
import MoreSheet from './MoreSheet.vue'
import { currentPost, ensureFeed, postReason, state } from '../video-first-app/store'

const muted = ref(true)
const paused = ref(false)
const commentsOpen = ref(false)
const articlesOpen = ref(false)
const moreOpen = ref(false)
const flagOpen = ref(false)

const post = computed(() => currentPost.value ?? null)
const reason = computed(() => (post.value ? postReason(post.value) : ''))

watch(
  () => state.feedIndex,
  () => {
    paused.value = false
    commentsOpen.value = false
  },
)

onMounted(() => ensureFeed())
</script>

<template>
  <AndroidShell
    theme="dark"
    :create-article="post?.articles[0]"
  >
    <div
      class="vfa-feed"
      :class="{ 'vfa-feed--comments': commentsOpen }"
    >
      <div
        v-if="!post"
        class="vfa-feed__empty"
      >
        <template v-if="state.feedLoading">
          <md-circular-progress
            indeterminate
            aria-label="Finding videos"
          />
          <p class="md-typescale-body-large">
            Finding videos on Wikimedia Commons…
          </p>
        </template>
        <p
          v-else
          class="md-typescale-body-large"
        >
          No videos yet. Save or read an article to fill your feed.
        </p>
      </div>

      <template v-else>
        <div class="vfa-feed__video">
          <AndroidPager
            :paused="paused"
            :muted="muted"
            :locked="commentsOpen"
            @tap="paused = !paused"
            @open-comments="commentsOpen = true"
            @open-more="moreOpen = true"
          />

          <header class="vfa-feed__header">
            <button
              v-if="!commentsOpen"
              type="button"
              class="vfa-feed__topic"
              :aria-label="`${post.articles.length} connected articles`"
              @click="articlesOpen = true"
            >
              <md-ripple />
              <md-focus-ring inward />
              <span class="vfa-feed__title">
                <span class="md-typescale-title-large vfa-serif">{{ post.articles[0] }}</span>
                <span
                  v-if="post.articles.length > 1"
                  class="vfa-feed__more md-typescale-label-medium"
                >
                  +{{ post.articles.length - 1 }}
                </span>
              </span>
              <span class="md-typescale-body-small vfa-feed__reason">{{ reason }}</span>
            </button>
            <md-icon-button
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
      </template>
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
  </AndroidShell>
</template>

<style scoped>
.vfa-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-surface);
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
  padding: 8px 4px 24px 8px;
  background: linear-gradient(to bottom, var(--md-sys-color-scrim), transparent);
  pointer-events: none;
}

.vfa-feed--comments .vfa-feed__header {
  background: none;
}

.vfa-feed__header > * {
  pointer-events: auto;
}

.vfa-feed__topic {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--vfa-shape-medium);
  background: none;
  color: var(--vfa-on-media);
  text-align: start;
  cursor: pointer;
  --md-focus-ring-shape: 12px;
}

.vfa-feed__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vfa-feed__more {
  padding: 2px 8px;
  border-radius: var(--vfa-shape-small);
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.vfa-feed__reason {
  color: var(--vfa-on-media);
}

.vfa-feed__mute {
  margin-inline-start: auto;
  --md-icon-button-icon-color: var(--vfa-on-media);
  --md-icon-button-hover-icon-color: var(--vfa-on-media);
  --md-icon-button-focus-icon-color: var(--vfa-on-media);
  --md-icon-button-pressed-icon-color: var(--vfa-on-media);
}

.vfa-feed__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  padding-inline: 32px;
  color: var(--md-sys-color-on-surface-variant);
  text-align: center;
}

.vfa-feed__empty p {
  margin: 0;
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
