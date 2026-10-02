/**
 * Everything one preview needs, in two requests: REST page/summary (title,
 * extract, images) and the Attribution API (link with provenance, trust signals).
 */
import { fetchAttributionSignals } from '@/components/attribution/fetchAttributionSignals'
import { wikimediaApiFetchHeaders } from '@/config'

/**
 * Width requested for the mobile sheet's full-bleed image. Must be one of the
 * thumbnail steps Wikimedia serves (e.g. 250, 330, 500, 960) — others get HTTP 400.
 * 960 keeps it sharp on high-density phones.
 */
const HERO_WIDTH = 960

export interface ArticlePreview {
  title: string
  extract: string
  /** Small square-ish thumbnail — desktop popover. */
  thumbnailUrl: string | null
  /** Wider rendition — mobile sheet hero. */
  heroUrl: string | null
  /** Canonical article link, carrying the Attribution API's `wprov` provenance tag. */
  link: string
  /** Views over the last 30 days (Attribution API), when known. */
  views: number | null
  references: number | null
}

interface Summary {
  title?: string
  extract?: string
  thumbnail?: { source?: string }
  originalimage?: { source?: string; width?: number }
  content_urls?: { desktop?: { page?: string } }
}

async function fetchSummary(title: string, host: string, signal: AbortSignal): Promise<Summary> {
  const encoded = encodeURIComponent(title.trim().replace(/ /g, '_'))
  const response = await fetch(`https://${host}/api/rest_v1/page/summary/${encoded}`, {
    signal,
    headers: wikimediaApiFetchHeaders('article-panel-summary'),
  })
  if (!response.ok) throw new Error(response.status === 404 ? 'Article not found' : `HTTP ${response.status}`)
  return response.json()
}

function heroImage(summary: Summary): string | null {
  const thumb = summary.thumbnail?.source ?? null
  const original = summary.originalimage
  if (original?.source && (original.width ?? 0) <= HERO_WIDTH) return original.source
  if (thumb && /\/\d+px-/.test(thumb)) return thumb.replace(/\/\d+px-/, `/${HERO_WIDTH}px-`)
  return thumb
}

export async function fetchPreview(title: string, host: string, signal: AbortSignal): Promise<ArticlePreview> {
  const [summary, attribution] = await Promise.all([
    fetchSummary(title, host, signal),
    // Trust signals are a bonus — a failure here shouldn't sink the preview.
    fetchAttributionSignals(title, { host, signal, expand: ['trust_and_relevance'] }).catch(() => null),
  ])
  const trust = attribution?.trust_and_relevance
  return {
    title: summary.title ?? title,
    extract: summary.extract?.trim() ?? '',
    thumbnailUrl: summary.thumbnail?.source ?? null,
    heroUrl: heroImage(summary),
    link:
      attribution?.essential.link ??
      summary.content_urls?.desktop?.page ??
      `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    views: typeof trust?.page_views === 'number' ? trust.page_views : null,
    references: typeof trust?.reference_count === 'number' ? trust.reference_count : null,
  }
}
