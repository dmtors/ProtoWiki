<script setup lang="ts">
/**
 * "Cited on Wikipedia" badge. Compact = pill with an optional "15x"; detailed =
 * card with the Wikipedia "W" mark, title, and wrapping stats (one row when wide,
 * stacked when narrow).
 *
 * `data-paint` marks what `renderSummaryImage` draws, so the PNG matches this layout.
 */
import { computed } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconLogoWikipedia } from '@wikimedia/codex-icons'

import { compactCount, summaryStats, type CitationSummary, type SummarySize } from './summary'

const props = withDefaults(
  defineProps<{
    summary: CitationSummary
    size: SummarySize
    /** Makes the whole badge a link (embeds link back to the full check). */
    href?: string
    /** Compact only: append the "15x" citation count. Off = the plain "Cited on Wikipedia" pill. */
    showCount?: boolean
  }>(),
  { href: undefined, showCount: true },
)

const count = computed(() => (props.showCount ? compactCount(props.summary) : ''))
const stats = computed(() => summaryStats(props.summary))
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    class="summary-badge"
    :class="`summary-badge--${size}`"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener' : undefined"
    data-paint="box"
  >
    <CdxIcon class="summary-badge__mark" :icon="cdxIconLogoWikipedia" data-paint="icon" />

    <template v-if="size === 'compact'">
      <span class="summary-badge__label" data-paint="text">Cited on Wikipedia</span>
      <span v-if="count" class="summary-badge__label" data-paint="text">{{ count }}</span>
    </template>

    <div v-else class="summary-badge__body">
      <span class="summary-badge__title" data-paint="text">Cited on Wikipedia</span>
      <ul class="summary-badge__stats">
        <li v-for="stat in stats" :key="stat.key" class="summary-badge__stat">
          <CdxIcon :icon="stat.icon" size="small" data-paint="icon" />
          <span data-paint="text">{{ stat.label }}</span>
        </li>
      </ul>
    </div>
  </component>
</template>

<style scoped>
.summary-badge {
  box-sizing: border-box;
  color: var(--color-base);
  text-decoration: none;
  font-family: var(--font-family-base);
}

a.summary-badge:hover .summary-badge__title,
a.summary-badge:hover .summary-badge__label:first-of-type {
  text-decoration: underline;
}

a.summary-badge:focus-visible {
  outline: var(--border-width-thick, 2px) solid var(--border-color-progressive--focus, #36c);
  outline-offset: 2px;
}

/* Body text style — all four tokens. */
.summary-badge__label {
  font-family: var(--font-family-base);
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-medium);
}

/* Figure caption text style — all four tokens (as the article embed's signals). */
.summary-badge__stat {
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
}

/* Compact: pill. */
.summary-badge--compact {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-35, 6px);
  padding: var(--spacing-25) var(--spacing-75) var(--spacing-25) var(--spacing-50);
  border-radius: var(--border-radius-pill);
  background-color: var(--background-color-neutral);
  white-space: nowrap;
}

.summary-badge--compact .summary-badge__mark {
  width: 20px;
  height: 20px;
}

/* Detailed: card. */
.summary-badge--detailed {
  /* Codex has no 4px radius token — override the base radius, as in the article embed. */
  --border-radius-base: 4px;

  /* Sizes to its own width (e.g. the iframe), not the page's. */
  container-type: inline-size;

  display: flex;
  align-items: flex-start;
  gap: var(--spacing-75);
  width: 100%;
  padding: var(--spacing-75);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-base);
}

/* The "W" scales with its CdxIcon box — the SVG fills 100% of it. */
.summary-badge--detailed .summary-badge__mark {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}

.summary-badge__mark {
  color: var(--color-base);
}

/*
 * Narrow cards: a smaller mark leaves the stats room to fit on their own lines.
 * Measured against the card's content box (inside its padding and border).
 */
@container (max-width: 220px) {
  .summary-badge--detailed .summary-badge__mark {
    width: 32px;
    height: 32px;
  }
}

.summary-badge__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50);
  min-width: 0;
}

/* Bold body text style — all four tokens. */
.summary-badge__title {
  font-family: var(--font-family-base);
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-medium);
}

/* Wraps from one row, to two, to one stat per line as the card narrows. */
.summary-badge__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-50) var(--spacing-100);
  margin: 0;
  padding: 0;
  list-style: none;
}

.summary-badge__stat {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
  margin: 0;
  white-space: nowrap;
}

.summary-badge__stat .cdx-icon {
  color: var(--color-base);
}</style>
