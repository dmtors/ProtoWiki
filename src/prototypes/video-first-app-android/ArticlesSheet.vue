<script setup lang="ts">
/** The post's connected articles: open one, save one, or connect another. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  cdxIconAdd,
  cdxIconBookmark,
  cdxIconBookmarkOutline,
} from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import M3BottomSheet from './M3BottomSheet.vue'
import { articlePath } from './routes'
import { saveArticle } from './useSaveArticle'
import type { Post } from '../video-first-app/data'
import { connectArticle, isArticleSaved } from '../video-first-app/store'
import { searchArticles } from '../video-first-app/wikiApi'

const props = defineProps<{ post: Post | null }>()
const open = defineModel<boolean>('open', { default: false })
const router = useRouter()

const adding = ref(false)
const results = ref<{ title: string; description?: string }[]>([])
let debounce: ReturnType<typeof setTimeout> | undefined

watch(open, () => {
  adding.value = false
  results.value = []
})

const title = computed(() => {
  const n = props.post?.articles.length ?? 0
  return n === 1 ? '1 article' : `${n} articles`
})

function openArticle(t: string): void {
  open.value = false
  router.push(articlePath(t))
}

function onQuery(e: Event): void {
  const q = (e.target as HTMLInputElement).value
  clearTimeout(debounce)
  debounce = setTimeout(async () => {
    results.value = q.trim() ? await searchArticles(q).catch(() => []) : []
  }, 200)
}

function add(t: string): void {
  if (props.post) connectArticle(props.post, t)
  adding.value = false
  results.value = []
}
</script>

<template>
  <M3BottomSheet
    v-model:open="open"
    :title="title"
  >
    <md-list>
      <md-list-item
        v-for="article in props.post?.articles ?? []"
        :key="article"
        type="button"
        @click="openArticle(article)"
      >
        <span slot="headline">{{ article }}</span>
        <md-icon-button
          slot="end"
          :aria-label="isArticleSaved(article) ? `Remove ${article} from saved` : `Save ${article}`"
          @click.stop="saveArticle(article)"
        >
          <CodexSvg :icon="isArticleSaved(article) ? cdxIconBookmark : cdxIconBookmarkOutline" />
        </md-icon-button>
      </md-list-item>
      <md-divider />
      <md-list-item
        v-if="!adding"
        type="button"
        @click="adding = true"
      >
        <CodexSvg
          slot="start"
          :icon="cdxIconAdd"
        />
        <span slot="headline">Add to another article</span>
      </md-list-item>
    </md-list>
    <div
      v-if="adding"
      class="vfa-articles__add"
    >
      <md-outlined-text-field
        label="Search articles"
        @input="onQuery"
      />
      <md-list v-if="results.length">
        <md-list-item
          v-for="r in results"
          :key="r.title"
          type="button"
          @click="add(r.title)"
        >
          <span slot="headline">{{ r.title }}</span>
          <span
            v-if="r.description"
            slot="supporting-text"
          >{{ r.description }}</span>
        </md-list-item>
      </md-list>
    </div>
  </M3BottomSheet>
</template>

<style scoped>
.vfa-articles__add {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px 0;
}
</style>
