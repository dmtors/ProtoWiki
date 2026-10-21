<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

/**
 * Image viewer: an article's images (`?title=`) as full-screen posts, opened at
 * `?file=`. Same pager, details and actions as the video feed; swipe up / down
 * through the Images tab in order. Photos stay still and have no mute.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AndroidShell from '../AndroidShell.vue'
import PostViewer from '../PostViewer.vue'
import { articlePath } from '../routes'
import { loadArticleImages } from '../../video-first-app/store'

const route = useRoute()
const router = useRouter()

const title = computed(() => String(route.query.title ?? ''))
const order = ref<string[]>([])
const index = ref(0)
const state = ref<'loading' | 'idle' | 'error'>('loading')

/** Post ids are `image:<file name>`, matched loosely against `?file=`. */
const fileKey = (file: string) => file.replace(/_/g, ' ').replace(/^File:/, '')

watch(
  title,
  async (t) => {
    state.value = 'loading'
    try {
      const posts = await loadArticleImages(t)
      order.value = posts.map((p) => p.id)
      const start = order.value.indexOf(`image:${fileKey(String(route.query.file ?? ''))}`)
      index.value = Math.max(0, start)
      state.value = 'idle'
    } catch {
      state.value = 'error'
    }
  },
  { immediate: true },
)

// Keep the open image in the URL, so a reload lands on it.
watch(index, (i) => {
  const id = order.value[i]
  if (id) router.replace({ query: { ...route.query, file: id.replace(/^image:/, '') } })
})

function goBack(): void {
  if (window.history.state?.back) router.back()
  else router.push(articlePath(title.value, 'images'))
}
</script>

<template>
  <AndroidShell
    theme="dark"
    :create-article="title"
  >
    <div class="vfa-images">
      <PostViewer
        v-if="state === 'idle' && order.length"
        v-model:index="index"
        :order="order"
        gallery
        back
        @back="goBack"
      />
      <div
        v-else
        class="vfa-images__empty"
      >
        <md-circular-progress
          v-if="state === 'loading'"
          indeterminate
          aria-label="Loading images"
        />
        <template v-else>
          <p class="md-typescale-body-large">
            {{ state === 'error' ? 'Couldn’t load the images.' : 'No images for this article.' }}
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
.vfa-images {
  height: 100%;
  background-color: var(--md-sys-color-surface);
}

.vfa-images__empty {
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

.vfa-images__empty p {
  margin: 0;
}
</style>
