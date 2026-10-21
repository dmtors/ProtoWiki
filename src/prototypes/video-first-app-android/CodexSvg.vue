<script setup lang="ts">
/**
 * A Codex icon as a bare SVG (20px by default, Codex's native size), for Material Web slots (`md-icon-button`,
 * `md-fab`, list items) that expect an icon element rather than a Codex `CdxIcon`.
 */
import { computed } from 'vue'
import { resolveIcon, type Icon } from '@wikimedia/codex-icons'

const props = withDefaults(defineProps<{ icon: Icon; size?: number }>(), { size: 20 })

const markup = computed(() => {
  const simple = resolveIcon(props.icon, 'en', 'ltr')
  return typeof simple === 'string' ? simple : `<path d="${simple.path}"/>`
})
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- Codex icon markup from @wikimedia/codex-icons -->
  <svg
    class="vfa-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    :width="props.size"
    :height="props.size"
    fill="currentColor"
    aria-hidden="true"
    v-html="markup"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<style scoped>
.vfa-icon {
  display: block;
  flex-shrink: 0;
}
</style>
