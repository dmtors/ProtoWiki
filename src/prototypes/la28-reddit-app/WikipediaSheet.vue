<script setup lang="ts">
/**
 * Bottom sheet shown inside the Reddit app when someone taps a Wikipedia
 * embed: a quick read of the article lead, then a hand-off to the Wikipedia app.
 */
import { computed } from 'vue'
import { CdxButton, CdxIcon } from '@wikimedia/codex'
import { cdxIconClose, cdxIconLinkExternal, cdxIconLogoWikipedia } from '@wikimedia/codex-icons'

import type { ArticleSummary } from '../la28-shared/useArticleSummaries'
import ArticleSignals from './ArticleSignals.vue'

const props = defineProps<{
  open: boolean
  title: string
  summary: ArticleSummary | null | undefined
  fallbackDescription?: string
}>()

const emit = defineEmits<{ close: []; openApp: [] }>()

const displayTitle = computed(() => props.summary?.displayTitle ?? props.title)
const description = computed(() => props.summary?.description || props.fallbackDescription)
const webUrl = computed(
  () => `https://en.wikipedia.org/wiki/${encodeURIComponent(props.title.replace(/ /g, '_'))}`,
)
</script>

<template>
  <Transition name="wp-sheet">
    <div
      v-if="open"
      class="wp-sheet"
      @click.self="emit('close')"
    >
      <div
        class="wp-sheet__panel"
        role="dialog"
        aria-modal="true"
        :aria-label="`${displayTitle} on Wikipedia`"
      >
        <div class="wp-sheet__handle" />
        <div class="wp-sheet__top">
          <span class="wp-sheet__source">
            <CdxIcon :icon="cdxIconLogoWikipedia" />
            <span>
              <strong>Wikipedia</strong>
              <small>The free encyclopedia</small>
            </span>
          </span>
          <CdxButton
            weight="quiet"
            aria-label="Close"
            @click="emit('close')"
          >
            <CdxIcon :icon="cdxIconClose" />
          </CdxButton>
        </div>

        <div class="wp-sheet__scroll">
          <img
            v-if="summary?.thumbnailUrl"
            class="wp-sheet__image"
            :src="summary.thumbnailUrl"
            alt=""
          >
          <h2 class="wp-sheet__title">
            {{ displayTitle }}
          </h2>
          <p
            v-if="description"
            class="wp-sheet__description"
          >
            {{ description }}
          </p>
          <ArticleSignals
            class="wp-sheet__signals"
            :summary="summary"
          />
          <hr class="wp-sheet__rule">
          <p class="wp-sheet__extract">
            {{ summary?.extract || 'Loading…' }}
          </p>
        </div>

        <div class="wp-sheet__actions">
          <CdxButton
            action="progressive"
            weight="primary"
            size="large"
            @click="emit('openApp')"
          >
            Continue reading in Wikipedia
          </CdxButton>
          <a
            class="wp-sheet__web"
            :href="webUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open wikipedia.org
            <CdxIcon
              :icon="cdxIconLinkExternal"
              size="small"
            />
          </a>
          <small class="wp-sheet__license">
            Text from Wikipedia, available under CC BY-SA 4.0.
          </small>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.wp-sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background-color: rgba(0, 0, 0, 0.45);
}

.wp-sheet__panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 88%;
  border-radius: 16px 16px 0 0;
  background-color: var(--background-color-base, #fff);
  color: var(--color-base, #202122);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
}

.wp-sheet__handle {
  align-self: center;
  width: 36px;
  height: 4px;
  margin-top: var(--spacing-50, 8px);
  border-radius: 2px;
  background-color: var(--border-color-base, #a2a9b1);
}

.wp-sheet__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-50, 8px) var(--spacing-100, 16px) 0 var(--spacing-150, 24px);
}

.wp-sheet__source {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
}

.wp-sheet__source > span {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.wp-sheet__source strong {
  font-family: var(--font-family-serif, 'Linux Libertine', Georgia, serif);
  font-weight: var(--font-weight-normal, 400);
  font-size: var(--font-size-medium, 1rem);
}

.wp-sheet__source small {
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
}

.wp-sheet__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-100, 16px) var(--spacing-150, 24px) 0;
}

.wp-sheet__image {
  display: block;
  width: 100%;
  max-height: 200px;
  margin-bottom: var(--spacing-100, 16px);
  border-radius: var(--border-radius-medium, 4px);
  object-fit: cover;
}

.wp-sheet__title {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: inherit;
  font-size: var(--font-size-x-large, 1.25rem);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.3;
}

.wp-sheet__description {
  margin: var(--spacing-25, 4px) 0 0;
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
  line-height: 1.35;
}

.wp-sheet__signals {
  margin-top: var(--spacing-75, 12px);
}

.wp-sheet__rule {
  width: 60px;
  margin: var(--spacing-100, 16px) 0;
  border: 0;
  border-top: 2px solid var(--border-color-subtle, #c8ccd1);
}

.wp-sheet__extract {
  margin: 0;
  font-size: var(--font-size-medium, 1rem);
  line-height: 1.6;
}

.wp-sheet__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-75, 12px);
  padding: var(--spacing-100, 16px) var(--spacing-150, 24px) var(--spacing-150, 24px);
  border-top: var(--border-width-base, 1px) solid var(--border-color-muted, #dadde3);
  margin-top: var(--spacing-100, 16px);
}

.wp-sheet__actions .cdx-button {
  max-width: none;
  border-radius: 999px;
}

.wp-sheet__top .cdx-button {
  border-radius: 50%;
}

.wp-sheet__web {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-25, 4px);
  color: var(--color-progressive, #36c);
  font-weight: var(--font-weight-bold, 700);
  text-decoration: none;
}

.wp-sheet__web .cdx-icon {
  color: currentColor;
}

.wp-sheet__license {
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
  text-align: center;
}

.wp-sheet-enter-active,
.wp-sheet-leave-active {
  transition: background-color 0.2s ease;
}

.wp-sheet-enter-active .wp-sheet__panel,
.wp-sheet-leave-active .wp-sheet__panel {
  transition: transform 0.25s ease;
}

.wp-sheet-enter-from,
.wp-sheet-leave-to {
  background-color: rgba(0, 0, 0, 0);
}

.wp-sheet-enter-from .wp-sheet__panel,
.wp-sheet-leave-to .wp-sheet__panel {
  transform: translateY(100%);
}
</style>
