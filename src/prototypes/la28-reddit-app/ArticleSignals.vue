<script setup lang="ts">
/** Attribution trust signals for a Wikipedia article: last updated + monthly views. */
import { computed } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconClock, cdxIconEye } from '@wikimedia/codex-icons'

import { formatUpdated, formatViews, type ArticleSummary } from '../la28-shared/useArticleSummaries'

const props = defineProps<{ summary: ArticleSummary | null | undefined }>()

const updated = computed(() =>
  props.summary?.lastUpdated ? formatUpdated(props.summary.lastUpdated) : '',
)
const views = computed(() =>
  typeof props.summary?.pageViews === 'number' ? formatViews(props.summary.pageViews) : '',
)
</script>

<template>
  <span
    v-if="updated || views"
    class="article-signals"
  >
    <span
      v-if="updated"
      class="article-signals__item"
    >
      <CdxIcon
        :icon="cdxIconClock"
        size="x-small"
      />
      {{ updated }}
    </span>
    <span
      v-if="views"
      class="article-signals__item"
    >
      <CdxIcon
        :icon="cdxIconEye"
        size="x-small"
      />
      {{ views }}
    </span>
  </span>
</template>

<style scoped>
.article-signals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-25, 4px) var(--spacing-75, 12px);
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
  line-height: 1.35;
}

.article-signals__item {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
}

.article-signals__item .cdx-icon {
  color: currentColor;
}
</style>
