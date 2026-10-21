<script setup lang="ts">
definePage({
  meta: {
    // title + description: ask the author, or omit
    category: 'prototype',
    platform: 'app',
  },
})

import { onMounted } from 'vue'

import AndroidShell from './AndroidShell.vue'
import PostViewer from './PostViewer.vue'
import { currentPost, ensureFeed, state } from '../video-first-app/store'

onMounted(() => ensureFeed())
</script>

<template>
  <AndroidShell
    theme="dark"
    :create-article="currentPost?.articles[0]"
  >
    <div class="vfa-feed">
      <div
        v-if="!currentPost"
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

      <PostViewer v-else />
    </div>
  </AndroidShell>
</template>

<style scoped>
.vfa-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-surface);
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
</style>
