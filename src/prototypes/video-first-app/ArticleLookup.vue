<script setup lang="ts">
/** Live Wikipedia article picker (CdxLookup + prefix search). */
import { ref } from 'vue'
import { CdxLookup } from '@wikimedia/codex'
import type { MenuItemData } from '@wikimedia/codex'

import { searchArticles } from './wikiApi'

defineProps<{ placeholder?: string }>()
const emit = defineEmits<{ select: [title: string] }>()

const selected = ref<string | null>(null)
const inputValue = ref('')
const items = ref<MenuItemData[]>([])

let abort: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined

function onInput(value: string): void {
  clearTimeout(timer)
  abort?.abort()
  if (!value.trim()) {
    items.value = []
    return
  }
  timer = setTimeout(async () => {
    abort = new AbortController()
    try {
      const results = await searchArticles(value, abort.signal)
      items.value = results.map((r) => ({
        value: r.title,
        label: r.title,
        description: r.description,
        thumbnail: r.thumb ? { url: r.thumb } : null,
      }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') items.value = []
    }
  }, 200)
}

function onSelect(value: string | null): void {
  if (!value) return
  emit('select', value)
  selected.value = null
  inputValue.value = ''
  items.value = []
}
</script>

<template>
  <CdxLookup
    v-model:selected="selected"
    v-model:input-value="inputValue"
    :menu-items="items"
    :menu-config="{ showThumbnail: true, visibleItemLimit: 5 }"
    :placeholder="placeholder"
    @input="onInput"
    @update:selected="onSelect"
  />
</template>
