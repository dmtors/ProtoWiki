import { wikimediaApiFetchHeaders } from '@/config'

/** Width requested for the full-width (large) embed image. */
const LARGE_IMAGE_WIDTH = 960

export interface EmbedSummary {
  extract: string
  thumbnailUrl: string | null
  /** Wider rendition for the large embed — a scaled thumb, or the original when it's already small. */
  largeImageUrl: string | null
  /** The lead image's file page, for its credit: Commons, or a local wiki for non-free files. */
  imageFile: { host: string; title: string } | null
}

/**
 * File page for an upload.wikimedia.org original, e.g.
 * `…/wikipedia/commons/2/2a/Lspn_comet_halley.jpg` → commons.wikimedia.org, `File:Lspn comet halley.jpg`;
 * `…/wikipedia/en/…` → en.wikipedia.org (local, usually non-free files).
 */
function imageFileFromUrl(src: string): EmbedSummary['imageFile'] {
  try {
    const url = new URL(src)
    const match = url.pathname.match(/^\/wikipedia\/([^/]+)\/(?:[0-9a-f]\/[0-9a-f]{2}\/)([^/]+)$/)
    if (!match) return null
    const [, project, file] = match
    const host = project === 'commons' ? 'commons.wikimedia.org' : `${project}.wikipedia.org`
    return { host, title: `File:${decodeURIComponent(file).replace(/_/g, ' ')}` }
  } catch {
    return null
  }
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
  if (!response.ok) return { extract: '', thumbnailUrl: null, largeImageUrl: null, imageFile: null }

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
    imageFile: original?.source ? imageFileFromUrl(original.source) : null,
  }
}
