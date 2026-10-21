<script setup lang="ts">
/**
 * M3 (Expressive) floating toolbar used as a tab switcher: a full-round,
 * elevated surface-container pill with M3 Expressive extra-small (32dp) icon
 * buttons, compact enough for seven views; the selected one is filled brand blue. Material Web has no toolbar, so this follows the M3 spec on
 * Codex tokens. Behaves as a tablist (arrow keys move between views).
 */
import { ref } from 'vue'
import type { Icon } from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'

const props = defineProps<{
  items: { id: string; label: string; icon: Icon }[]
  label: string
}>()
const selected = defineModel<string>({ required: true })

const buttons = ref<HTMLButtonElement[]>([])

function onKey(e: KeyboardEvent, index: number): void {
  const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!delta) return
  e.preventDefault()
  const next = (index + delta + props.items.length) % props.items.length
  selected.value = props.items[next].id
  buttons.value[next]?.focus()
}
</script>

<template>
  <div
    class="vfa-toolbar"
    role="tablist"
    :aria-label="props.label"
  >
    <md-elevation />
    <button
      v-for="(item, i) in props.items"
      :key="item.id"
      ref="buttons"
      type="button"
      role="tab"
      class="vfa-toolbar__item"
      :class="{ 'vfa-toolbar__item--selected': selected === item.id }"
      :aria-selected="selected === item.id"
      :aria-label="item.label"
      :title="item.label"
      :tabindex="selected === item.id ? 0 : -1"
      @click="selected = item.id"
      @keydown="onKey($event, i)"
    >
      <md-ripple />
      <md-focus-ring />
      <CodexSvg :icon="item.icon" />
    </button>
  </div>
</template>

<style scoped>
.vfa-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  box-sizing: border-box;
  padding: 0 8px;
  border-radius: 24px;
  background-color: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  --md-elevation-level: 3;
}

.vfa-toolbar__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* XS icon button: 32dp container around the 20dp icon. */
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 16px;
  background: none;
  color: inherit;
  cursor: pointer;
  transition:
    background-color 200ms var(--vfa-ease-standard),
    color 200ms var(--vfa-ease-standard);
  --md-focus-ring-shape: 16px;
}

.vfa-toolbar__item:focus-visible {
  outline: none;
}

.vfa-toolbar__item--selected {
  background-color: var(--vfa-brand-blue);
  color: var(--vfa-on-brand-blue);
  --md-ripple-hover-color: var(--vfa-on-brand-blue);
  --md-ripple-pressed-color: var(--vfa-on-brand-blue);
}
</style>
