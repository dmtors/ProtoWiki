<script setup lang="ts">
definePage({
  meta: {
    // title + description: ask the author, or omit
    category: 'prototype',
    platform: 'app',
  },
})

import { computed, onMounted, ref, watch } from 'vue'
import { CdxButton, CdxIcon, CdxProgressBar } from '@wikimedia/codex'
import { cdxIconVolumeOff, cdxIconVolumeUp } from '@wikimedia/codex-icons'

import ArticlesSheet from './ArticlesSheet.vue'
import CommentsPanel from './CommentsPanel.vue'
import FeedPager from './FeedPager.vue'
import FlagDialog from './FlagDialog.vue'
import MoreSheet from './MoreSheet.vue'
import { currentPost, ensureFeed, postReason, state } from './store'
import VfShell from './VfShell.vue'
import { globalTheme } from '@/theme'

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
  <VfShell
    theme="dark"
    overlay-header
    :create-article="post?.articles[0]"
  >
    <template #header>
      <div
        class="vf-feed-header"
        :class="{ 'vf-feed-header--bare': commentsOpen }"
      >
        <button
          v-if="post && !commentsOpen"
          type="button"
          class="vf-feed-header__topic"
          :aria-label="`${post.articles.length} connected articles`"
          @click="articlesOpen = true"
        >
          <span class="vf-feed-header__title">
            {{ post.articles[0] }}
            <span
              v-if="post.articles.length > 1"
              class="vf-feed-header__more"
            >+{{ post.articles.length - 1 }}</span>
          </span>
          <span class="vf-feed-header__reason">{{ reason }}</span>
        </button>
        <CdxButton
          class="vf-feed-header__mute"
          weight="quiet"
          :aria-label="muted ? 'Unmute' : 'Mute'"
          @click="muted = !muted"
        >
          <CdxIcon :icon="muted ? cdxIconVolumeOff : cdxIconVolumeUp" />
        </CdxButton>
      </div>
    </template>

    <div
      class="vf-feed"
      :class="{ 'vf-feed--comments': commentsOpen }"
    >
      <div
        v-if="!post"
        class="vf-feed__empty"
      >
        <template v-if="state.feedLoading">
          <CdxProgressBar
            inline
            aria-label="Finding videos"
          />
          <p>Finding videos on Wikimedia Commons…</p>
        </template>
        <p v-else>
          No videos yet. Save or read an article to fill your feed.
        </p>
      </div>
      <div
        v-else
        class="vf-feed__video"
      >
        <FeedPager
          :paused="paused"
          :muted="muted"
          :locked="commentsOpen"
          @tap="paused = !paused"
          @open-comments="commentsOpen = true"
          @open-more="moreOpen = true"
        />
      </div>
      <div
        v-if="commentsOpen && post"
        class="vf-feed__comments"
        :data-theme="globalTheme"
      >
        <CommentsPanel
          :post="post"
          @close="commentsOpen = false"
        />
      </div>
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
  </VfShell>
</template>

<style scoped>
.vf-feed-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-50);
  padding: var(--spacing-100) var(--spacing-50) var(--spacing-150) var(--spacing-100);
  background: linear-gradient(to bottom, var(--background-color-backdrop-dark), transparent);
  color: var(--color-base);
}

.vf-feed-header--bare {
  background: none;
}

.vf-feed-header__topic {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.vf-feed-header__topic:focus-visible {
  outline: var(--border-width-thick) solid var(--border-color-progressive--focus);
}

.vf-feed-header__title {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-xx-large);
  line-height: var(--line-height-xx-large);
}

.vf-feed-header__more {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
}

.vf-feed-header__reason {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.vf-feed-header__mute {
  flex-shrink: 0;
  margin-inline-start: auto;
}

.vf-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.vf-feed__video {
  flex: 1 1 100%;
  min-height: 0;
  transition: flex-basis var(--transition-duration-medium) var(--transition-timing-function-system);
}

.vf-feed--comments .vf-feed__video {
  flex: 0 0 39%;
}

.vf-feed__empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-75);
  height: 100%;
  padding-inline: var(--spacing-200);
  color: var(--color-subtle);
  text-align: center;
}

.vf-feed__empty p {
  margin: 0;
}

.vf-feed__comments {
  flex: 1;
  min-height: 0;
}
</style>
