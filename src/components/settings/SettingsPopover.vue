<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { CdxPopover } from '@wikimedia/codex'

const props = defineProps<{
  /** When set, reopen after `sessionStorage` was written before a navigation. */
  restoreOpenKey?: string
}>()

const open = ref(false)
const anchor = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

onMounted(() => {
  if (!props.restoreOpenKey) return
  try {
    if (sessionStorage.getItem(props.restoreOpenKey) === '1') {
      sessionStorage.removeItem(props.restoreOpenKey)
      open.value = true
    }
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <div class="settings-popover">
    <span ref="anchor" class="settings-popover__trigger">
      <slot :open="open" :toggle="toggle" />
    </span>
    <CdxPopover
      v-model:open="open"
      :anchor="anchor"
      placement="bottom-end"
      use-bottom-sheet="responsive"
      class="settings-popover__overlay"
    >
      <div @click.stop>
        <slot name="panel" />
      </div>
    </CdxPopover>
  </div>
</template>

<style scoped>
.settings-popover {
  display: inline-flex;
  flex-shrink: 0;
}

.settings-popover__trigger {
  display: inline-flex;
}
</style>

<!-- Teleported popover: allow the select menu to extend past the scrollable body. -->
<style>
.settings-popover__overlay.cdx-popover:not(.cdx-popover--bottom-sheet) {
  max-width: min(var(--size-2400), calc(100vw - var(--spacing-200)));
}

.settings-popover__overlay .cdx-popover__body {
  overflow: visible;
}
</style>
