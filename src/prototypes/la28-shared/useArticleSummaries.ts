import { onBeforeUnmount, onMounted, reactive } from 'vue'

import { wikimediaApiFetchHeaders } from '@/config'

export interface ArticleSummary {
  title: string
  displayTitle: string
  description: string
  extract: string
  thumbnailUrl: string | null
}

const cache = new Map<string, Promise<ArticleSummary | null>>()

/** REST `page/summary` for one enwiki title. Cached for the session; null on failure. */
export function fetchArticleSummary(title: string): Promise<ArticleSummary | null> {
  const cached = cache.get(title)
  if (cached) return cached

  const request = (async () => {
    try {
      const encoded = encodeURIComponent(title.replace(/ /g, '_'))
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
        headers: wikimediaApiFetchHeaders('la28-summary'),
      })
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
