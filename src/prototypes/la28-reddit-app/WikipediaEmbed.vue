<script setup lang="ts">
/**
 * Small Wikipedia preview embedded in a Reddit post. `compact` sits in the
 * feed; `full` sits on the post page and adds the lead extract and a CTA.
 */
import { computed } from 'vue'
import { CdxButton, CdxIcon, CdxThumbnail } from '@wikimedia/codex'
import { cdxIconLogoWikipedia } from '@wikimedia/codex-icons'

import type { ArticleSummary } from '../la28-shared/useArticleSummaries'
import ArticleSignals from './ArticleSignals.vue'

const props = withDefaults(
  defineProps<{
    title: string
    summary: ArticleSummary | null | undefined
    fallbackDescription?: string
    variant?: 'compact' | 'full'
  }>(),
  { fallbackDescription: '', variant: 'compact' },
)

const emit = defineEmits<{ preview: []; read: [] }>()

const loading = computed(() => props.summary === undefined)
const displayTitle = computed(() => props.summary?.displayTitle ?? props.title)
const description = computed(() => props.summary?.description || props.fallbackDescription)
</script>

<template>
  <div
    class="wp-embed"
    :class="`wp-embed--${variant}`"
  >
    <button
      type="button"
      class="wp-embed__main"
      :aria-label="`Preview ${displayTitle} on Wikipedia`"
      @click.stop="emit('preview')"
    >
      <span class="wp-embed__source">
        <CdxIcon
          :icon="cdxIconLogoWikipedia"
          size="small"
        />
        Wikipedia
      </span>
      <span class="wp-embed__body">
        <span class="wp-embed__text">
          <span class="wp-embed__title">{{ displayTitle }}</span>
          <span
            v-if="description"
            class="wp-embed__description"
          >{{ description }}</span>
          <span
            v-else-if="loading"
            class="wp-embed__skeleton"
          />
        </span>
        <CdxThumbnail
          v-if="summary === undefined || summary?.thumbnailUrl"
          class="wp-embed__thumb"
          :thumbnail="summary?.thumbnailUrl ? { url: summary.thumbnailUrl } : null"
        />
      </span>
      <ArticleSignals :summary="summary" />
      <span
        v-if="variant === 'full' && summary?.extract"
        class="wp-embed__extract"
      >{{ summary.extract }}</span>
    </button>
    <div
      v-if="variant === 'full'"
      class="wp-embed__footer"
    >
      <CdxButton
        class="wp-embed__cta"
        @click.stop="emit('read')"
      >
        <CdxIcon :icon="cdxIconLogoWikipedia" />
        Read on Wikipedia
      </CdxButton>
    </div>
  </div>
</template>

<style scoped>
.wp-embed {
  border: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  border-radius: 12px;
  background-color: var(--background-color-base, #fff);
  overflow: hidden;
}

.wp-embed__main {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50, 8px);
  width: 100%;
  padding: var(--spacing-75, 12px);
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.wp-embed__main:active {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.wp-embed__source {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
  font-weight: var(--font-weight-bold, 700);
}

.wp-embed__source .cdx-icon {
  color: var(--color-base, #202122);
}

.wp-embed__body {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-75, 12px);
}

.wp-embed__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--spacing-12, 2px);
  min-width: 0;
}

.wp-embed__title {
  color: var(--color-base, #202122);
  font-size: var(--font-size-medium, 1rem);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.3;
}

.wp-embed__description {
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
  line-height: 1.35;
}

.wp-embed__skeleton {
  width: 60%;
  height: 0.875rem;
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-disabled-subtle, #eaecf0);
}

.wp-embed__thumb {
  flex-shrink: 0;
}

.wp-embed__thumb :deep(.cdx-thumbnail__image),
.wp-embed__thumb :deep(.cdx-thumbnail__placeholder) {
  width: 3.5rem;
  height: 3.5rem;
  border: 0;
  border-radius: 10px;
}

.wp-embed__extract {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-base, #202122);
  font-size: var(--font-size-small, 0.875rem);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.wp-embed__footer {
  padding: 0 var(--spacing-75, 12px) var(--spacing-75, 12px);
}

.wp-embed__cta.cdx-button {
  width: 100%;
  max-width: none;
  border-color: var(--border-color-base, #a2a9b1);
  border-radius: 999px;
  background-color: transparent;
  color: var(--color-base, #202122);
}

.wp-embed__cta.cdx-button:hover {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}
</style>
