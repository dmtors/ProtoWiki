<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { cdxIconArticle, cdxIconBookmark } from '@wikimedia/codex-icons'

import AndroidShell from '../AndroidShell.vue'
import CodexSvg from '../CodexSvg.vue'
import { BASE, articlePath } from '../routes'
import { saveArticle } from '../useSaveArticle'
import { focusPost, state } from '../../video-first-app/store'

const router = useRouter()

const articles = computed(() =>
  Object.entries(state.savedArticles)
    .filter(([, on]) => on)
    .map(([title]) => title),
)
const posts = computed(() => state.posts.filter((p) => state.saved[p.id]))

function openPost(id: string): void {
  focusPost(id)
  router.push(BASE)
}
</script>

<template>
  <AndroidShell>
    <template #header>
      <header class="vfa-appbar">
        <h1 class="md-typescale-title-large">
          Saved
        </h1>
      </header>
    </template>

    <section>
      <h2 class="vfa-label md-typescale-title-small">
        Articles
      </h2>
      <md-list
        v-if="articles.length"
        class="vfa-list"
      >
        <md-list-item
          v-for="title in articles"
          :key="title"
          type="button"
          @click="router.push(articlePath(title))"
        >
          <CodexSvg
            slot="start"
            :icon="cdxIconArticle"
          />
          <span slot="headline">{{ title }}</span>
          <md-icon-button
            slot="end"
            :aria-label="`Remove ${title} from saved`"
            @click.stop="saveArticle(title)"
          >
            <CodexSvg :icon="cdxIconBookmark" />
          </md-icon-button>
        </md-list-item>
      </md-list>
      <p
        v-else
        class="vfa-empty md-typescale-body-medium"
      >
        Save an article with the bookmark on its page. Its videos join your feed.
      </p>

      <h2 class="vfa-label md-typescale-title-small">
        Posts
      </h2>
      <div
        v-if="posts.length"
        class="vfa-grid"
      >
        <button
          v-for="post in posts"
          :key="post.id"
          type="button"
          class="vfa-tile"
          :aria-label="`Video by ${post.author}`"
          @click="openPost(post.id)"
        >
          <md-ripple />
          <img
            :src="post.thumb"
            alt=""
          >
        </button>
      </div>
      <p
        v-else
        class="vfa-empty md-typescale-body-medium"
      >
        Posts you save from More options show up here.
      </p>
    </section>
  </AndroidShell>
</template>

<style scoped>
.vfa-appbar {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--vfa-top-bar);
  padding: var(--vfa-top-inset) var(--vfa-gutter) 0;
}

.vfa-appbar h1 {
  margin: 0;
}

.vfa-label {
  margin: 0;
  padding: 16px var(--vfa-gutter) 8px;
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-list {
  --md-list-container-color: transparent;
}

.vfa-empty {
  margin: 0;
  padding: 0 var(--vfa-gutter) 8px;
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 0 var(--vfa-gutter) 96px;
}

.vfa-tile {
  position: relative;
  aspect-ratio: 9 / 16;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--vfa-shape-medium);
  background-color: var(--md-sys-color-surface-container-highest);
  cursor: pointer;
}

.vfa-tile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
