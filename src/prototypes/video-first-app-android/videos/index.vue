<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

/**
 * Video viewer: an article's videos (`?title=`) as full-screen posts, opened at
 * `?post=`. The feed's viewer with a back button; swipe up / down through the
 * Video tab in order. The home feed itself has no back button.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AndroidShell from '../AndroidShell.vue'
import PostViewer from '../PostViewer.vue'
import { articlePath } from '../routes'
import { articleVideoPosts, loadArticleVideos } from '../../video-first-app/store'

const route = useRoute()
const router = useRouter()

const title = computed(() => String(route.query.title ?? ''))
const order = ref<string[]>([])
const index = ref(0)
const loading = ref(true)

watch(
  title,
  async (t) => {
    loading.value = true
    await loadArticleVideos(t)
    order.value = articleVideoPosts(t).map((p) => p.id)
    index.value = Math.max(0, order.value.indexOf(String(route.query.post ?? '')))
    loading.value = false
  },
  { immediate: true },
)

// Keep the open video in the URL, so a reload lands on it.
watch(index, (i) => {
  const id = order.value[i]
  if (id) router.replace({ query: { ...route.query, post: id } })
})

function goBack(): void {
  if (window.history.state?.back) router.back()
  else router.push(articlePath(title.value, 'video'))
}
</script>

<template>
  <AndroidShell
    theme="dark"
    :create-article="title"
  >
    <div class="vfa-videos">
      <PostViewer
        v-if="!loading && order.length"
        v-model:index="index"
        :order="order"
        back
        @back="goBack"
      />
      <div
        v-else
        class="vfa-videos__empty"
      >
        <md-circular-progress
          v-if="loading"
          indeterminate
          aria-label="Loading videos"
        />
        <template v-else>
          <p class="md-typescale-body-large">
            No videos for this article.
          </p>
          <md-text-button @click="goBack">
            Back to the article
          </md-text-button>
        </template>
      </div>
    </div>
  </AndroidShell>
</template>

<style scoped>
.vfa-videos {
  height: 100%;
  background-color: var(--md-sys-color-surface);
}

.vfa-videos__empty {
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

.vfa-videos__empty p {
  margin: 0;
}
</style>
