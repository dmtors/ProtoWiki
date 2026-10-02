<script setup lang="ts">
/**
 * Embeddable article card — title, trust signals (Attribution API), lead
 * extract, image, and source footer. Rendered both as the in-dialog preview
 * and as the standalone page the iframe embed points at (`./embed/`).
 *
 * Sizes: `small` (40px thumbnail beside title + source, no extract, link joins
 * the signals row), `medium` (thumbnail at the end), `large` (full-width image
 * above the footer).
 */
import { computed, onScopeDispose, ref, toRef, watch } from 'vue'
import { CdxIcon, CdxInfoChip, CdxProgressBar } from '@wikimedia/codex'
import {
  cdxIconCalendar,
  cdxIconChart,
  cdxIconLogoWikipedia,
  cdxIconQuotes,
  cdxIconReference,
  cdxIconUserAvatar,
} from '@wikimedia/codex-icons'

import { formatCompactCount, sourceLabel } from '@/components/attribution/formatAttribution'
import { fetchAttributionSignals } from '@/components/attribution/fetchAttributionSignals'
import { useAttributionSignals } from '@/components/attribution/useAttributionSignals'

import { DEFAULT_EMBED_OPTIONS, type EmbedLink, type EmbedSignal, type EmbedSize } from './embedOptions'
import { fetchSourceCount } from './fetchSourceCount'
import { fetchSummary, type EmbedSummary } from './fetchSummary'

const props = withDefaults(
  defineProps<{
    /** Wiki page title. */
    title: string
    /** Wiki hostname, e.g. `en.wikipedia.org`. */
    host: string
    size?: EmbedSize
    signals?: EmbedSignal[]
    link?: EmbedLink
  }>(),
  {
    size: DEFAULT_EMBED_OPTIONS.size,
    signals: () => DEFAULT_EMBED_OPTIONS.signals,
    link: DEFAULT_EMBED_OPTIONS.link,
  },
)

// `host` isn't reactive inside useAttributionSignals — callers key this component by host.
const { signals: attribution, loading, error } = useAttributionSignals(toRef(props, 'title'), {
  host: props.host,
})

const summary = ref<EmbedSummary | null>(null)
let summaryAbort: AbortController | null = null

watch(
  () => props.title,
  async (title) => {
    summaryAbort?.abort()
    summary.value = null
    if (!title) return
    summaryAbort = new AbortController()
    try {
      summary.value = await fetchSummary(title, props.host, { signal: summaryAbort.signal })
    } catch {
      // Aborted or network failure — card renders without extract/image.
    }
  },
  { immediate: true },
)

/** Only fetched once "sources" is switched on. */
const sourceCount = ref<number | null>(null)
let sourcesAbort: AbortController | null = null

watch(
  () => [props.title, props.signals.includes('sources')] as const,
  async ([title, wanted]) => {
    if (!wanted || !title || sourceCount.value !== null) return
    sourcesAbort?.abort()
    sourcesAbort = new AbortController()
    try {
      sourceCount.value = await fetchSourceCount(title, props.host, { signal: sourcesAbort.signal })
    } catch {
      // Aborted or network failure — signal is omitted.
    }
  },
  { immediate: true },
)

/**
 * Large size only: the lead image's credit and license, from the Attribution
 * API on its file page (Commons, or the local wiki for non-free files).
 */
const imageCredit = ref<{ credit: string | null; license: string } | null>(null)

/** Plain text, no links: "Author, License, via Wikimedia Commons". */
const imageCreditText = computed(() => {
  if (!imageCredit.value) return ''
  const via = summary.value?.imageFile?.host === 'commons.wikimedia.org' ? 'via Wikimedia Commons' : 'via Wikipedia'
  return [imageCredit.value.credit, imageCredit.value.license, via].filter(Boolean).join(', ')
})
let imageCreditAbort: AbortController | null = null

watch(
  () => [props.size === 'large', summary.value?.imageFile] as const,
  async ([large, file]) => {
    if (!large || !file || imageCredit.value) return
    imageCreditAbort?.abort()
    imageCreditAbort = new AbortController()
    try {
      const { essential } = await fetchAttributionSignals(file.title, {
        host: file.host,
        signal: imageCreditAbort.signal,
      })
      imageCredit.value = {
        credit: essential.credit ?? null,
        // "pd" / "PDM" read better spelled out, as Commons' own attribution text does.
        license: essential.license.title === 'pd' ? 'Public domain' : (essential.license.short ?? essential.license.title),
      }
    } catch {
      // Aborted, or no attribution for the file — the caption is omitted.
    }
  },
  { immediate: true },
)

onScopeDispose(() => {
  summaryAbort?.abort()
  sourcesAbort?.abort()
  imageCreditAbort?.abort()
})

const trust = computed(() => attribution.value?.trust_and_relevance)
const mostRead = computed(() => Boolean(trust.value?.trending?.top?.read))

/** "30 minutes ago", "5 hours ago", "1 day ago", "2 weeks ago"; a month or older: "09/2025". */
function timeAgo(iso: string): string | null {
  const date = new Date(iso)
  const then = date.getTime()
  if (Number.isNaN(then)) return null
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return ago(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ago(hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return ago(days, 'day')
  if (days < 30) return ago(Math.floor(days / 7), 'week')
  // A month or older: the month itself, "09/2025" (UTC, as page histories are).
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
}

function countLabel(count: number | null | undefined, noun: string): string | null {
  if (typeof count !== 'number') return null
  return `${formatCompactCount(count)} ${noun}${count === 1 ? '' : 's'}`
}

const SIGNAL_ICONS: Record<EmbedSignal, string> = {
  reads: cdxIconChart,
  references: cdxIconReference,
  updated: cdxIconCalendar,
  contributors: cdxIconUserAvatar,
  sources: cdxIconQuotes,
}

/** Enabled signals that have data, in the order the author picked them. */
const signalItems = computed(() => {
  const labels: Record<EmbedSignal, string | null> = {
    // Attribution API `page_views` covers the last 30 days — label the window.
    reads:
      typeof trust.value?.page_views === 'number'
        ? `${formatCompactCount(trust.value.page_views)} views last month`
        : null,
    references: countLabel(trust.value?.reference_count, 'reference'),
    updated: trust.value?.last_updated ? timeAgo(trust.value.last_updated) : null,
    contributors: countLabel(trust.value?.contributor_counts, 'contributor'),
    sources: countLabel(sourceCount.value, 'source'),
  }
  return props.signals
    .filter((key) => labels[key])
    .map((key) => ({ key, icon: SIGNAL_ICONS[key], label: labels[key] as string }))
})

const cta = computed(() => {
  const essential = attribution.value?.essential
  if (!essential) return null
  if (props.link === 'donate') {
    const donate = attribution.value?.calls_to_action?.donation_ctas?.default
    return donate
      ? { href: donate.url, label: donate.link_text }
      : { href: 'https://donate.wikimedia.org/', label: 'Donate to Wikipedia' }
  }
  // Placeholder — not wired to reading lists yet.
  if (props.link === 'reading-list') return { href: essential.link, label: 'Save to reading list' }
  return null
})

const source = computed(() => (attribution.value ? sourceLabel(attribution.value) : 'Wikipedia'))
const isSmall = computed(() => props.size === 'small')
const showSignalsRow = computed(
  () => mostRead.value || signalItems.value.length > 0 || (isSmall.value && cta.value),
)
</script>

<template>
  <article class="embed-card" :class="`embed-card--${props.size}`">
    <CdxProgressBar v-if="loading" inline aria-label="Loading article" />

    <p v-else-if="error" class="embed-card__error" role="alert">{{ error }}</p>

    <template v-else-if="attribution">
      <div class="embed-card__main">
        <div class="embed-card__header">
          <img
            v-if="isSmall && summary?.thumbnailUrl"
            class="embed-card__thumbnail"
            :src="summary.thumbnailUrl"
            alt=""
          />
          <div class="embed-card__heading">
            <h4 class="embed-card__title">
              <a :href="attribution.essential.link" target="_blank" rel="noopener">
                {{ attribution.essential.title }}
              </a>
            </h4>
            <span v-if="isSmall" class="embed-card__source">
              <CdxIcon :icon="cdxIconLogoWikipedia" />
              <small>{{ source }}</small>
            </span>
          </div>
        </div>

        <div v-if="showSignalsRow" class="embed-card__signals">
          <CdxInfoChip v-if="mostRead">Most read</CdxInfoChip>
          <span v-for="item in signalItems" :key="item.key" class="embed-card__signal">
            <CdxIcon :icon="item.icon" size="small" />
            {{ item.label }}
          </span>
          <a v-if="isSmall && cta" class="embed-card__cta" :href="cta.href" target="_blank" rel="noopener">
            {{ cta.label }}
          </a>
        </div>

        <p v-if="!isSmall && summary?.extract" class="embed-card__extract">{{ summary.extract }}</p>

        <figure v-if="props.size === 'large' && summary?.largeImageUrl" class="embed-card__figure">
          <img class="embed-card__image" :src="summary.largeImageUrl" alt="" />
          <!-- "Author, License, via Wikimedia Commons" — Commons' own attribution format. -->
          <figcaption v-if="imageCredit" class="embed-card__credit">{{ imageCreditText }}</figcaption>
        </figure>

        <footer v-if="!isSmall" class="embed-card__footer">
          <span class="embed-card__source">
            <CdxIcon :icon="cdxIconLogoWikipedia" />
            <small>{{ source }}</small>
          </span>
          <a v-if="cta" class="embed-card__cta" :href="cta.href" target="_blank" rel="noopener">
            {{ cta.label }}
          </a>
        </footer>
      </div>

      <img
        v-if="props.size === 'medium' && summary?.thumbnailUrl"
        class="embed-card__thumbnail"
        :src="summary.thumbnailUrl"
        alt=""
      />
    </template>
  </article>
</template>

<style scoped>
.embed-card {
  /* Codex has no 4px radius token — override the base radius for the card and its images. */
  --border-radius-base: 4px;

  display: flex;
  gap: var(--spacing-100);
  padding: var(--spacing-50) var(--spacing-75) var(--spacing-75);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-base);
  color: var(--color-base);
}

.embed-card__main {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50);
  flex: 1;
  min-width: 0;
}

.embed-card__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-100);
}

.embed-card__heading {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Bold body text style. */
.embed-card__title {
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-medium);
}

/* Codex "Figure caption" text style — all four tokens. */
.embed-card__cta {
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
}

.embed-card__title a {
  color: var(--color-progressive);
  text-decoration: none;
}

.embed-card__title a:hover {
  text-decoration: underline;
}

.embed-card__signals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50) var(--spacing-100);
}

/* Codex "Figure caption" text style — all four tokens. */
.embed-card__signal {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
  color: var(--color-subtle);
}

.embed-card__signal .cdx-icon {
  color: var(--color-subtle);
}

.embed-card__extract {
  margin: 0;
  color: var(--color-subtle);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.embed-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50) var(--spacing-100);
}

.embed-card__source {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
}

.embed-card__thumbnail {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--border-radius-base);
}

.embed-card--medium .embed-card__thumbnail {
  margin-top: var(--spacing-25);
}

.embed-card--small .embed-card__header {
  gap: var(--spacing-75);
}

.embed-card--small .embed-card__thumbnail {
  width: 40px;
  height: 40px;
}

.embed-card__figure {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25);
  margin: 0;
}

.embed-card__image {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--border-radius-base);
}

/* Figure caption text style — all four tokens — in the subtle colour. */
.embed-card__credit {
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
  color: var(--color-subtle);
}

.embed-card__error {
  margin: 0;
  color: var(--color-error);
}
</style>
