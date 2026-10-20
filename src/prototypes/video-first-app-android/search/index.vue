<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cdxIconArrowPrevious, cdxIconArticle, cdxIconClose } from '@wikimedia/codex-icons'

import AndroidShell from '../AndroidShell.vue'
import CodexSvg from '../CodexSvg.vue'
import { BASE, articlePath } from '../routes'
import { state } from '../../video-first-app/store'
import { searchArticles } from '../../video-first-app/wikiApi'

const router = useRouter()
const query = ref('')
const results = ref<{ title: string; description?: string; thumb?: string }[]>([])
const field = ref<HTMLInputElement | null>(null)

let debounce: ReturnType<typeof setTimeout> | undefined
let abort: AbortController | null = null

function onInput(e: Event): void {
  query.value = (e.target as HTMLInputElement).value
  clearTimeout(debounce)
  abort?.abort()
  if (!query.value.trim()) {
    results.value = []
    return
  }
  debounce = setTimeout(async () => {
    abort = new AbortController()
    try {
      results.value = await searchArticles(query.value, abort.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') results.value = []
    }
  }, 200)
}

function clear(): void {
  query.value = ''
  results.value = []
  field.value?.focus()
}

onMounted(() => field.value?.focus())
</script>

<template>
  <AndroidShell>
    <template #header>
      <!-- M3 search view: full-width search bar, results below. -->
      <div class="vfa-search">
        <md-icon-button
          aria-label="Back"
          @click="router.push(BASE)"
        >
          <CodexSvg :icon="cdxIconArrowPrevious" />
        </md-icon-button>
        <input
          ref="field"
          class="vfa-search__input md-typescale-body-large"
          type="search"
          placeholder="Search Wikipedia"
          aria-label="Search Wikipedia"
          :value="query"
          @input="onInput"
        >
        <md-icon-button
          v-if="query"
          aria-label="Clear"
          @click="clear"
        >
          <CodexSvg :icon="cdxIconClose" />
        </md-icon-button>
      </div>
      <md-divider />
    </template>

    <md-list
      v-if="results.length"
      class="vfa-results"
    >
      <md-list-item
        v-for="r in results"
        :key="r.title"
        type="button"
        @click="router.push(articlePath(r.title))"
      >
        <img
          v-if="r.thumb"
          slot="start"
          class="vfa-results__thumb"
          :src="r.thumb"
          alt=""
        >
        <span
          v-else
          slot="start"
          class="vfa-results__thumb vfa-results__thumb--empty"
        >
          <CodexSvg :icon="cdxIconArticle" />
        </span>
        <span slot="headline">{{ r.title }}</span>
        <span
          v-if="r.description"
          slot="supporting-text"
        >{{ r.description }}</span>
      </md-list-item>
    </md-list>

    <md-list
      v-else-if="!query && state.history.length"
      class="vfa-results"
    >
      <div class="md-typescale-title-small vfa-results__label">
        Recent
      </div>
      <md-list-item
        v-for="h in state.history"
        :key="h.title"
        type="button"
        @click="router.push(articlePath(h.title))"
      >
        <CodexSvg
          slot="start"
          :icon="cdxIconArticle"
        />
        <span slot="headline">{{ h.title }}</span>
      </md-list-item>
    </md-list>
  </AndroidShell>
</template>

<style scoped>
.vfa-search {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 72px;
  padding: 0 4px;
}

.vfa-search__input {
  flex: 1;
  min-width: 0;
  height: 56px;
  padding: 0 16px;
  border: 0;
  border-radius: 28px;
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  font-family: var(--md-ref-typeface-plain);
  outline: none;
}

.vfa-search__input::-webkit-search-cancel-button {
  display: none;
}

.vfa-search__input::placeholder {
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-results {
  --md-list-container-color: transparent;
}

.vfa-results__label {
  padding: 16px 16px 8px;
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-results__thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--vfa-shape-small);
}

.vfa-results__thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface-variant);
}
</style>
