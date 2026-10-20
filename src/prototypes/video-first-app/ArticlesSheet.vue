<script setup lang="ts">
/** The post's connected articles: open one, save one, or connect another. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CdxButton, CdxDialog, CdxIcon } from '@wikimedia/codex'
import { cdxIconAdd, cdxIconBookmark, cdxIconBookmarkOutline } from '@wikimedia/codex-icons'

import ArticleLookup from './ArticleLookup.vue'
import type { Post } from './data'
import { connectArticle, isArticleSaved } from './store'
import { useSaveArticle } from './useSaveArticle'

const props = defineProps<{ post: Post | null }>()
const open = defineModel<boolean>('open', { default: false })
const router = useRouter()
const saveArticle = useSaveArticle()

const adding = ref(false)
watch(open, () => {
  adding.value = false
})

const title = computed(() => {
  const n = props.post?.articles.length ?? 0
  return n === 1 ? '1 article' : `${n} articles`
})

function openArticle(title: string): void {
  open.value = false
  router.push({ path: '/video-first-app/article', query: { title } })
}

function add(title: string): void {
  if (props.post) connectArticle(props.post, title)
  adding.value = false
}
</script>

<template>
  <CdxDialog
    v-model:open="open"
    class="video-first-app__sheet"
    :title="title"
    :use-close-button="true"
  >
    <ul class="video-first-app__rows">
      <li
        v-for="article in props.post?.articles ?? []"
        :key="article"
        class="vf-articles__row"
      >
        <a
          href="#"
          class="video-first-app__link"
          @click.prevent="openArticle(article)"
        >{{
          article
        }}</a>
        <CdxButton
          weight="quiet"
          :aria-label="isArticleSaved(article) ? `Remove ${article} from saved` : `Save ${article}`"
          :aria-pressed="isArticleSaved(article)"
          @click="saveArticle(article)"
        >
          <CdxIcon :icon="isArticleSaved(article) ? cdxIconBookmark : cdxIconBookmarkOutline" />
        </CdxButton>
      </li>
      <li class="vf-articles__row">
        <ArticleLookup
          v-if="adding"
          class="vf-articles__lookup"
          placeholder="Search articles"
          @select="add"
        />
        <template v-else>
          <a
            href="#"
            class="video-first-app__link vf-articles__add"
            @click.prevent="adding = true"
          >Add to another article</a>
          <CdxButton
            weight="quiet"
            aria-label="Add to another article"
            @click="adding = true"
          >
            <CdxIcon :icon="cdxIconAdd" />
          </CdxButton>
        </template>
      </li>
    </ul>
  </CdxDialog>
</template>

<style scoped>
.vf-articles__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--size-250);
}

.vf-articles__row :deep(.video-first-app__link) {
  font-weight: var(--font-weight-bold);
}

.vf-articles__row :deep(.vf-articles__add) {
  font-weight: var(--font-weight-normal);
}

.vf-articles__lookup {
  flex: 1;
}
</style>
