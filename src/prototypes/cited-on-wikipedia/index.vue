<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  CdxButton,
  CdxField,
  CdxIcon,
  CdxMessage,
  CdxProgressBar,
  CdxSearchInput,
  CdxTable,
} from '@wikimedia/codex'
import { TableRowIdentifier } from '@wikimedia/codex'
import type { TableColumn, TableSort } from '@wikimedia/codex'
import {
  cdxIconChart,
  cdxIconCollapse,
  cdxIconExpand,
  cdxIconLanguage,
  cdxIconLink,
  cdxIconReferences,
} from '@wikimedia/codex-icons'

import PlainWrapper from '@/components/PlainWrapper.vue'

import {
  createLimiter,
  fetchAnnualViews,
  fetchReferenceAnchor,
  fetchWikidataIds,
  fetchWikipedias,
  findCitations,
  isRateLimited,
  MAX_RESULTS,
  parseSourceInput,
  type Citation,
} from './citations'
import { loadCachedCheck, saveCachedCheck } from './resultsCache'
import LanguageFilter, { type LanguageOption } from './LanguageFilter.vue'
import ShareSummaryDialog from './ShareSummaryDialog.vue'
import SummaryBadge from './SummaryBadge.vue'
import type { CitationSummary } from './summary'

definePage({
  meta: {
    title: 'Cited on Wikipedia',
    description: 'Use this tool to check how a reference has been used on Wikipedia.',
    category: 'prototype',
    platform: 'web',
  },
})

const input = ref('')
const inputError = ref<string | null>(null)

type Phase = 'idle' | 'searching' | 'enriching' | 'done' | 'error'
const phase = ref<Phase>('idle')
const errorMessage = ref<string | null>(null)
const rows = ref<Citation[]>([])
const truncated = ref(false)
const enriched = ref(0)
const wikisTotal = ref(0)
const wikisSearched = ref(0)
/** Wikis whose search errored even after retries — their citations may be missing. */
const wikisFailed = ref(0)

let abort: AbortController | null = null

/** Polled while a check runs, so the status can say when Wikimedia is holding us back. */
const rateLimited = ref(false)
const rateLimitTimer = setInterval(() => (rateLimited.value = isRateLimited()), 500)

onBeforeUnmount(() => {
  abort?.abort()
  clearInterval(rateLimitTimer)
})

// `?url=…` (e.g. from a shared badge) pre-fills the field and runs the check.
const route = useRoute()
onMounted(() => {
  const url = route.query.url
  if (typeof url === 'string' && url.trim()) {
    input.value = url
    void check()
  }
})

/** When the shown results came from a previous check (set on cache hit). */
const cachedAt = ref<number | null>(null)

/** Tag rows (all from one wiki) with their Wikidata item, so same-topic articles group. */
async function assignWikidataIds(wikiRows: Citation[], signal: AbortSignal) {
  try {
    const ids = await fetchWikidataIds(wikiRows[0].host, wikiRows.map((r) => r.title), signal)
    for (const row of wikiRows) row.qid = ids.get(row.title) ?? null
  } catch {
    // Ungrouped is still correct — each row just stands alone.
    for (const row of wikiRows) row.qid ??= null
  }
}

/** Load annual views for one row (a reactive proxy). The anchor loads on hover. */
async function enrichRow(row: Citation, signal: AbortSignal) {
  await fetchAnnualViews(row, signal)
    .then((views) => (row.views = views))
    .catch(() => {
      row.views = null
      row.viewsFailed = !signal.aborted
    })
  if (!signal.aborted) enriched.value++
}

/**
 * Resolve the `cite_note-…` anchor on hover/focus, so the link usually targets
 * the reference by the time it's clicked — one page fetch per row the reader
 * actually points at, instead of one per row upfront.
 */
const anchorRequested = new Set<string>()

function prefetchAnchor(row: Citation) {
  if (typeof row.anchor === 'string' || anchorRequested.has(row.key)) return
  anchorRequested.add(row.key) // The plain article link works while this loads.
  fetchReferenceAnchor(row, new AbortController().signal)
    .then((anchor) => (row.anchor = anchor))
    .catch(() => anchorRequested.delete(row.key))
}

async function check(options: { refresh?: boolean } = {}) {
  const source = parseSourceInput(input.value)
  if (!source) {
    inputError.value = 'Enter a valid URL, for example https://www.nature.com/articles/nature14539'
    return
  }
  inputError.value = null
  checkedSource.value = input.value.trim()

  abort?.abort()
  abort = new AbortController()
  const { signal } = abort

  rows.value = []
  truncated.value = false
  enriched.value = 0
  wikisSearched.value = 0
  wikisFailed.value = 0
  wikisTotal.value = 0
  errorMessage.value = null
  cachedAt.value = null
  expanded.value = new Set()
  languageFilter.value = []

  const cacheKey = `${source.domainOnly ? 'domain:' : ''}${source.normalized}`
  const cached = options.refresh ? null : loadCachedCheck(cacheKey)
  if (cached) {
    rows.value = cached.rows
    truncated.value = cached.truncated
    wikisTotal.value = cached.wikisTotal
    wikisSearched.value = cached.wikisTotal
    enriched.value = cached.rows.length
    cachedAt.value = cached.savedAt
    phase.value = 'done'
    return
  }

  phase.value = 'searching'

  try {
    const wikis = await fetchWikipedias()
    if (signal.aborted) return
    wikisTotal.value = wikis.length

    // Rows start enriching as soon as they're found, while other wikis are still being searched.
    const enrich = createLimiter(3)
    const enriching: Promise<void>[] = []

    await findCitations(
      wikis,
      source,
      signal,
      (hits) => {
        const room = Math.max(MAX_RESULTS - rows.value.length, 0)
        if (hits.length > room) truncated.value = true
        const added = hits.slice(0, room)
        if (!added.length) return
        rows.value.push(...added)
        // Reactive proxies, so background updates re-render their row.
        const proxies = rows.value.slice(-added.length)
        // One wiki's hits per call — one request for all their Wikidata IDs.
        enriching.push(assignWikidataIds(proxies, signal))
        for (const row of proxies) {
          enriching.push(enrich(() => enrichRow(row, signal)))
        }
      },
      (ok) => {
        wikisSearched.value++
        if (!ok) wikisFailed.value++
      },
    )
    if (signal.aborted) return

    phase.value = 'enriching'
    await Promise.all(enriching)
    if (signal.aborted) return
    phase.value = 'done'

    // Only cache complete, error-free checks — a partial result would stick for a day.
    const clean = !wikisFailed.value && rows.value.every((r) => !r.viewsFailed)
    if (clean) {
      saveCachedCheck(cacheKey, { wikisTotal: wikisTotal.value, truncated: truncated.value, rows: rows.value })
    }
  } catch (err) {
    if (signal.aborted) return
    errorMessage.value = err instanceof Error ? err.message : String(err)
    phase.value = 'error'
  }
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

function articleHref(row: Citation): string {
  const base = `https://${row.host}/wiki/${encodeURIComponent(row.title.replace(/ /g, '_'))}`
  return row.anchor ? `${base}#${row.anchor}` : base
}

/**
 * Fixed widths (any `width` switches CdxTable to `table-layout: fixed`), so
 * expanding a group never reflows the columns. Language fits "Vietnamese + 1 more"
 * on one line; views fits its header (with sort icon) on one line; Article
 * takes the rest.
 */
const columns: TableColumn[] = [
  { id: 'article', label: 'Article', allowSort: true },
  { id: 'language', label: 'Language', allowSort: true, width: '11rem' },
  { id: 'views', label: 'Annual views', textAlign: 'number', allowSort: true, width: '9.5rem' },
]

/** Most-visited first by default. CdxTable only emits the sort state; the data is sorted here. */
const sort = ref<TableSort>({ views: 'desc' })

/** Single-column sort: keep only the column whose order just changed. */
function onSort(next: TableSort) {
  const changed = Object.keys(next).find((column) => next[column] !== sort.value[column])
  sort.value = changed ? { [changed]: next[changed] } : next
}

/**
 * Same-topic articles in different languages, grouped by Wikidata item. The
 * most-visited language leads; rows without an item (or still loading one)
 * stand alone.
 */
interface TopicGroup {
  key: string
  rows: Citation[]
}

const byVisitsDesc = (a: Citation, b: Citation) =>
  (typeof b.views === 'number' ? b.views : -1) - (typeof a.views === 'number' ? a.views : -1)

/** Language codes to include; empty = all (the default). Filters the table only. */
const languageFilter = ref<string[]>([])

/** Languages present in the results, most-cited first — the filter's options. */
const languageOptions = computed<LanguageOption[]>(() => {
  const byLang = new Map<string, LanguageOption>()
  for (const row of rows.value) {
    const option = byLang.get(row.lang)
    if (option) option.citations++
    else byLang.set(row.lang, { value: row.lang, label: row.language, citations: 1 })
  }
  return [...byLang.values()].sort((a, b) => b.citations - a.citations || a.label.localeCompare(b.label))
})

/** Rows the table shows — filtered before grouping, so groups hold only included languages. */
const visibleRows = computed(() => {
  if (!languageFilter.value.length) return rows.value
  const include = new Set(languageFilter.value)
  return rows.value.filter((row) => include.has(row.lang))
})

const filterNote = computed(() => {
  if (!languageFilter.value.length) return null
  const shown = visibleRows.value.length
  const languages = languageFilter.value.length
  return `Showing ${shown} of ${rows.value.length} citations, in ${languages} of ${languageOptions.value.length} languages.`
})

const groups = computed<TopicGroup[]>(() => {
  const byKey = new Map<string, Citation[]>()
  for (const row of visibleRows.value) {
    const key = row.qid ?? row.key
    const members = byKey.get(key)
    if (members) members.push(row)
    else byKey.set(key, [row])
  }
  return [...byKey].map(([key, members]) => ({ key, rows: [...members].sort(byVisitsDesc) }))
})

/** Topic groups currently showing their other languages. */
const expanded = ref(new Set<string>())

function toggleGroup(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

/**
 * Views for a whole group: the sum across its languages. `undefined`
 * while any are still loading (so the total never shows half-counted); `null`
 * when none are available.
 */
function groupViews(group: TopicGroup): number | null | undefined {
  if (group.rows.some((row) => row.views === undefined)) return undefined
  const known = group.rows.filter((row) => typeof row.views === 'number')
  return known.length ? known.reduce((sum, row) => sum + (row.views as number), 0) : null
}

type TableRow = {
  [TableRowIdentifier]: string
  article: string
  language: string
  /** Shown value: the group total on a collapsed group's row, else this language's own. */
  views: number | null | undefined
  /** Sort key: always the group total, so expanding a group never moves it. */
  groupViews: number | null | undefined
  row: Citation
  groupKey: string
  /** `main` = the group's lead language; `child` = another language, shown when expanded. */
  kind: 'main' | 'child'
  /** Other languages in the group (main rows only) — drives the toggle. */
  others: number
  /** Main row standing in for its whole group (it has other languages, and they're hidden). */
  representsGroup: boolean
}

const toTableRow = (row: Citation, group: TopicGroup, kind: TableRow['kind']): TableRow => {
  const others = kind === 'main' ? group.rows.length - 1 : 0
  const representsGroup = others > 0 && !expanded.value.has(group.key)
  const total = groupViews(group)
  return {
    // Stable identity, so rows keep their DOM (and hover/focus) as the order changes.
    [TableRowIdentifier]: row.key,
    article: row.title,
    language: row.language,
    views: representsGroup ? total : row.views,
    groupViews: total,
    row,
    groupKey: group.key,
    kind,
    others,
    representsGroup,
  }
}

/** Comparable value per column; `null` (loading / unavailable) always sorts last. */
function sortValue(item: TableRow, column: string): string | number | null {
  if (column === 'article') return item.article
  if (column === 'language') return item.language
  if (column === 'views') return item.groupViews ?? null
  return null
}

/** Groups sort by their lead row; an expanded group's other languages follow it, most-visited first. */
const tableData = computed(() => {
  const mains = groups.value.map((group) => ({ group, item: toTableRow(group.rows[0], group, 'main') }))

  const [column, order] = Object.entries(sort.value)[0] ?? []
  if (column && order && order !== 'none') {
    const direction = order === 'asc' ? 1 : -1
    mains.sort((a, b) => {
      const x = sortValue(a.item, column)
      const y = sortValue(b.item, column)
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
      const result = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
      return result * direction
    })
  }

  return mains.flatMap(({ group, item }) =>
    expanded.value.has(group.key)
      ? [item, ...group.rows.slice(1).map((row) => toTableRow(row, group, 'child'))]
      : [item],
  )
})

const wikiCount = computed(() => new Set(rows.value.map((row) => row.lang)).size)

/** Rough, rounded totals: 12,609 → "13K", 291,344 → "290K", 1,234,567 → "1.2M". */
const roughNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 2 })

/** Sum of the views loaded so far — grows while rows are still loading. */
const totalVisits = computed(() =>
  rows.value.reduce((sum, row) => sum + (typeof row.views === 'number' ? row.views : 0), 0),
)

const plural = (label: string | number, count: number, noun: string) => `${label} ${noun}${count === 1 ? '' : 's'}`

/**
 * Stats beside the "Cited on Wikipedia" badge, above the table. Languages =
 * distinct wikis; views once any have loaded.
 */
const summaryStats = computed(() => {
  const citations = rows.value.length
  const languages = wikiCount.value
  const stats = [
    { key: 'citations', icon: cdxIconReferences, label: plural(citations.toLocaleString('en'), citations, 'citation') },
  ]
  stats.push({ key: 'languages', icon: cdxIconLanguage, label: plural(languages, languages, 'language') })
  if (rows.value.some((row) => typeof row.views === 'number')) {
    const views = totalVisits.value
    stats.push({ key: 'views', icon: cdxIconChart, label: plural(roughNumber.format(views), views, 'annual view') })
  }
  return stats
})

const busy = computed(() => phase.value === 'searching' || phase.value === 'enriching')

const shareOpen = ref(false)

/** Source URL of the results on screen — set when a check starts. */
const checkedSource = ref('')

/** What the Share summary badge reports — the same numbers as the summary row. */
const summary = computed<CitationSummary | null>(() => {
  if (!rows.value.length) return null
  const hasVisits = rows.value.some((row) => typeof row.views === 'number')
  return {
    source: checkedSource.value,
    citations: rows.value.length,
    languages: wikiCount.value,
    visits: hasVisits ? totalVisits.value : null,
  }
})

const statusText = computed(() => {
  if (rateLimited.value) return 'Wikipedia is limiting how fast this page can search. Waiting to continue…'
  const details = rows.value.length ? ` · Loaded details for ${enriched.value} of ${rows.value.length}` : ''
  if (phase.value === 'searching') {
    if (!wikisTotal.value) return 'Loading the list of Wikipedias…'
    return `Searched ${wikisSearched.value} of ${wikisTotal.value} Wikipedias${details}…`
  }
  if (phase.value === 'enriching') return `Loading details (${enriched.value} of ${rows.value.length})…`
  return ''
})
</script>

<template>
  <PlainWrapper heading="Cited on Wikipedia">
    <p>Use this tool to check how a reference has been used on Wikipedia.</p>

    <CdxField :status="inputError ? 'error' : 'default'" :messages="{ error: inputError ?? '' }">
      <template #label>Insert source URL</template>
      <CdxSearchInput
        v-model="input"
        :start-icon="cdxIconLink"
        use-button
        button-label="Check"
        placeholder="https://www.example.com/article"
        @submit-click="check()"
      />
    </CdxField>

    <div v-if="busy" class="cited__status" role="status">
      <CdxProgressBar inline :aria-label="statusText" />
      <small>{{ statusText }}</small>
    </div>

    <CdxMessage v-if="phase === 'error'" type="error" :allow-user-dismiss="false" class="cited__message">
      Couldn't complete the check: {{ errorMessage }}
    </CdxMessage>

    <CdxMessage
      v-else-if="phase !== 'searching' && phase !== 'idle' && !rows.length"
      :allow-user-dismiss="false"
      class="cited__message"
    >
      This URL isn't cited in any article across {{ wikisTotal }} Wikipedias.
    </CdxMessage>

    <template v-if="rows.length">
      <div v-if="summary" class="cited__summary">
        <SummaryBadge :summary="summary" size="compact" :show-count="false" />
        <ul class="cited__summary-stats">
          <li v-for="stat in summaryStats" :key="stat.key" class="cited__summary-stat">
            <CdxIcon :icon="stat.icon" size="small" />
            {{ stat.label }}
          </li>
        </ul>
      </div>

      <p v-if="filterNote" class="cited__filter-note">
        <small>{{ filterNote }}</small>
        <CdxButton weight="quiet" action="progressive" size="small" @click="languageFilter = []">
          Show all languages
        </CdxButton>
      </p>

      <CdxTable
        :sort="sort"
        @update:sort="onSort"
        class="cited__table"
        caption="Citations"
        :columns="columns"
        :data="tableData"
      >
        <template #header>
          <div class="cited__table-actions">
            <LanguageFilter v-model="languageFilter" :options="languageOptions" />
            <CdxButton action="progressive" weight="primary" :disabled="busy" @click="shareOpen = true">
              Share summary
            </CdxButton>
          </div>
        </template>

        <template #item-article="{ row }">
          <div class="cited__article" :class="`cited__article--${row.kind}`">
            <CdxButton
              v-if="row.others"
              weight="quiet"
              size="small"
              class="cited__toggle"
              :aria-expanded="expanded.has(row.groupKey)"
              :aria-label="`${expanded.has(row.groupKey) ? 'Hide' : 'Show'} ${row.others} other language${row.others === 1 ? '' : 's'}`"
              @click="toggleGroup(row.groupKey)"
            >
              <CdxIcon :icon="expanded.has(row.groupKey) ? cdxIconCollapse : cdxIconExpand" size="small" />
            </CdxButton>
            <a
              :href="articleHref(row.row)"
              target="_blank"
              rel="noopener"
              @pointerenter="prefetchAnchor(row.row)"
              @focus="prefetchAnchor(row.row)"
            >
              {{ row.article }}
            </a>
          </div>
        </template>

        <template #item-language="{ row }">
          {{ row.language }}
          <!-- Collapsed: the row stands for the whole group. Expanded: just this language. -->
          <span v-if="row.representsGroup" class="cited__pending">+ {{ row.others }} more</span>
        </template>

        <template #item-views="{ row }">
          <span v-if="row.views === undefined" class="cited__pending">Loading…</span>
          <span v-else-if="!row.representsGroup && row.row.viewsFailed" class="cited__pending">Couldn't load</span>
          <span v-else-if="row.views === null" class="cited__pending">—</span>
          <template v-else>{{ row.views.toLocaleString('en') }}</template>
        </template>
      </CdxTable>

      <p v-if="truncated" class="cited__note">
        <small>Showing the first {{ MAX_RESULTS }} articles.</small>
      </p>

      <p v-if="cachedAt" class="cited__note cited__cached">
        <small>Saved results from {{ timeFormat.format(new Date(cachedAt)) }}.</small>
        <CdxButton weight="quiet" action="progressive" size="small" @click="check({ refresh: true })">
          Check again
        </CdxButton>
      </p>
    </template>

    <CdxMessage
      v-if="!busy && wikisFailed"
      type="warning"
      :allow-user-dismiss="false"
      class="cited__message"
    >
      {{ wikisFailed }} of {{ wikisTotal }} Wikipedias couldn't be searched, so some citations may be
      missing. Try checking again in a minute.
    </CdxMessage>

    <ShareSummaryDialog v-if="summary" v-model:open="shareOpen" :summary="summary" />
  </PlainWrapper>
</template>

<style scoped>
.cited__status {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25);
  margin-top: var(--spacing-100);
  color: var(--color-subtle);
}

.cited__message,
.cited__table {
  margin-top: var(--spacing-150);
}

/* Badge, then stats styled like the shareable badge's signals; wraps on narrow screens. */
.cited__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50) var(--spacing-100);
  margin-top: var(--spacing-150);
}

/*
 * Smaller pill than the shareable Compact badge: Figure caption text (all four
 * tokens) to match the stats beside it, and the "W" at the stats' small icon size.
 */
.cited__summary :deep(.summary-badge__label) {
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
}

.cited__summary :deep(.summary-badge--compact .summary-badge__mark) {
  /* CdxIcon's default (medium) size also sets an 18px minimum. */
  min-width: 0;
  min-height: 0;
  width: var(--font-size-medium);
  height: var(--font-size-medium);
}

.cited__summary-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50) var(--spacing-100);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Figure caption text style — all four tokens. */
.cited__summary-stat {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
  color: var(--color-base);
  white-space: nowrap;
}

/* Keep "Share summary" top right: the caption wraps beside it instead of pushing it below. */
.cited__table :deep(.cdx-table__header) {
  flex-wrap: nowrap;
  align-items: flex-start;
}

.cited__table :deep(.cdx-table__header__caption) {
  flex: 1;
  min-width: 0;
}

.cited__table :deep(.cdx-table__header__content) {
  flex-shrink: 0;
}

/* Heading 4 instead of CdxTable's default Heading 3 caption — all four tokens. */
.cited__table :deep(.cdx-table__header__caption) {
  font-family: var(--font-family-base);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
}

.cited__pending {
  color: var(--color-subtle);
}

/*
 * Every article title starts in the same column: main rows reserve the toggle's
 * width (button or not), and other-language rows start at the same point.
 */
.cited__article {
  --cited-toggle-size: var(--min-size-interactive-pointer--small, 24px);

  display: flex;
  align-items: center;
  gap: var(--spacing-25);
  min-height: var(--cited-toggle-size);
}

.cited__article--main {
  padding-inline-start: calc(var(--cited-toggle-size) + var(--spacing-25));
}

.cited__article--main:has(.cited__toggle) {
  padding-inline-start: 0;
}

/* Other languages line up with their group's lead title, not indented past it. */
.cited__article--child {
  padding-inline-start: calc(var(--cited-toggle-size) + var(--spacing-25));
}

.cited__toggle {
  flex-shrink: 0;
}

.cited__note {
  margin-top: var(--spacing-50);
  color: var(--color-subtle);
}

.cited__table-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-50);
}

.cited__filter-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50);
  margin: var(--spacing-100) 0 0;
  color: var(--color-subtle);
}

/* The note sits right above the table — tighten the table's usual top margin. */
.cited__filter-note + .cited__table {
  margin-top: var(--spacing-50);
}

.cited__cached {
  display: flex;
  align-items: center;
  gap: var(--spacing-50);
}
</style>
