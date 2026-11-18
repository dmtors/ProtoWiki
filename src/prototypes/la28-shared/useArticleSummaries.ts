import { onBeforeUnmount, onMounted, reactive } from 'vue'

import { wikimediaApiFetchHeaders } from '@/config'

export interface ArticleSummary {
  title: string
  displayTitle: string
  description: string
  extract: string
  thumbnailUrl: string | null
  /** Attribution API (beta) trust signals; null when unavailable. */
  lastUpdated: string | null
  /** Page views over the last month. */
  pageViews: number | null
}

/** `trust_and_relevance` from the Attribution API (beta). Nulls on any failure. */
async function fetchTrustSignals(
  title: string,
): Promise<{ lastUpdated: string | null; pageViews: number | null }> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'))
    const response = await fetch(
      `https://en.wikipedia.org/w/rest.php/attribution/v0-beta/pages/${encoded}/signals?expand=trust_and_relevance`,
      { headers: wikimediaApiFetchHeaders('la28-attribution') },
    )
    if (!response.ok) return { lastUpdated: null, pageViews: null }
    const data = (await response.json()) as {
      trust_and_relevance?: { last_updated?: unknown; page_views?: unknown }
    }
    const trust = data.trust_and_relevance
    return {
      lastUpdated: typeof trust?.last_updated === 'string' ? trust.last_updated : null,
      pageViews: typeof trust?.page_views === 'number' ? trust.page_views : null,
    }
  } catch {
    return { lastUpdated: null, pageViews: null }
  }
}

/** "Updated 3 hours ago" from an ISO timestamp. */
export function formatUpdated(iso: string): string {
  const diffMinutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (Number.isNaN(diffMinutes)) return ''
  if (diffMinutes < 1) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`
  const hours = Math.round(diffMinutes / 60)
  if (hours < 48) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `Updated ${days} days ago`
  return `Updated ${new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

/** "41K views this month" */
export function formatViews(count: number): string {
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  return `${compact.format(count)} views this month`
}

const cache = new Map<string, Promise<ArticleSummary | null>>()

/** REST `page/summary` for one enwiki title. Cached for the session; null on failure. */
export function fetchArticleSummary(title: string): Promise<ArticleSummary | null> {
  const cached = cache.get(title)
  if (cached) return cached

  const request = (async () => {
    try {
      const encoded = encodeURIComponent(title.replace(/ /g, '_'))
      const [response, trust] = await Promise.all([
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
          headers: wikimediaApiFetchHeaders('la28-summary'),
        }),
        fetchTrustSignals(title),
      ])
      if (!response.ok) return null
      const data = (await response.json()) as {
        title?: string
        displaytitle?: string
        description?: string
        extract?: string
        thumbnail?: { source?: string }
      }
      return {
        title: data.title ?? title,
        displayTitle: (data.displaytitle ?? data.title ?? title).replace(/<[^>]+>/g, ''),
        description: data.description ?? '',
        extract: data.extract?.trim() ?? '',
        thumbnailUrl: data.thumbnail?.source ?? null,
        ...trust,
      }
    } catch {
      return null
    }
  })()

  cache.set(title, request)
  return request
}

/**
 * Reactive map of title → summary, filled in as each request lands.
 * Missing keys mean "still loading"; `null` means the fetch failed.
 */
export function useArticleSummaries(titles: () => string[]) {
  const summaries = reactive<Record<string, ArticleSummary | null>>({})
  let alive = true

  onMounted(() => {
    for (const title of titles()) {
      void fetchArticleSummary(title).then((summary) => {
        if (alive) summaries[title] = summary
      })
    }
  })

  onBeforeUnmount(() => {
    alive = false
  })

  return summaries
}
