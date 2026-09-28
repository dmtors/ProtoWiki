import { wikimediaApiFetchHeaders } from '@/config'

/** Width requested for the full-width (large) embed image. */
const LARGE_IMAGE_WIDTH = 960

export interface EmbedSummary {
  extract: string
  thumbnailUrl: string | null
  /** Wider rendition for the large embed — a scaled thumb, or the original when it's already small. */
  largeImageUrl: string | null
}

/** Lead extract + images from REST page/summary on the given wiki host. */
export async function fetchSummary(
  title: string,
  host: string,
  options: { signal?: AbortSignal } = {},
): Promise<EmbedSummary> {
  const encodedTitle = encodeURIComponent(title.trim().replace(/ /g, '_'))
  const response = await fetch(`https://${host}/api/rest_v1/page/summary/${encodedTitle}`, {
    signal: options.signal,
    headers: wikimediaApiFetchHeaders('article-embed-summary'),
  })
  if (!response.ok) return { extract: '', thumbnailUrl: null, largeImageUrl: null }

  const data = (await response.json()) as {
    extract?: string
    thumbnail?: { source?: string }
    originalimage?: { source?: string; width?: number }
  }

  const thumbnailUrl = data.thumbnail?.source ?? null
  const original = data.originalimage
  let largeImageUrl = thumbnailUrl
  if (original?.source && (original.width ?? 0) <= LARGE_IMAGE_WIDTH) {
    largeImageUrl = original.source
  } else if (thumbnailUrl && /\/\d+px-/.test(thumbnailUrl)) {
    largeImageUrl = thumbnailUrl.replace(/\/\d+px-/, `/${LARGE_IMAGE_WIDTH}px-`)
  }

  return {
    extract: typeof data.extract === 'string' ? data.extract.trim() : '',
    thumbnailUrl,
    largeImageUrl,
  }
}
