/**
 * Live Wikipedia / Commons reads for the article tabs and the create flow.
 * Responses are memoised per title so tab switches don't refetch.
 */
import { wikimediaApiFetchHeaders } from '@/config'

const WIKI = 'https://en.wikipedia.org'
const COMMONS = 'https://commons.wikimedia.org'

export interface ArticleImage {
  file: string
  thumb: string
  caption?: string
}

export interface ArticlePlace {
  title: string
  /** The title as the article links it (before redirects), e.g. to find it in the text. */
  linkTitle: string
  lat: number
  lon: number
  description?: string
}

export interface ArticleLink {
  /** Target title (spaces, not underscores). */
  title: string
  label: string
  /** Red link — the article doesn't exist yet. */
  missing: boolean
}

export interface InfoRow {
  label: string
  /** Sanitised inline HTML (text, emphasis, `a[data-title]`, line breaks). */
  html: string
}

export interface ParsedArticle {
  title: string
  infoImage?: string
  /** Logos, seals and diagrams render small; photographs render large. */
  infoImageKind?: 'logo' | 'photo'
  info: InfoRow[]
  /** Sanitised text-only body: paragraphs, lists and section headings. */
  bodyHtml: string
  /** Intro paragraphs as plain text, for the editor. */
  introText: string
  links: ArticleLink[]
}

const cache = new Map<string, Promise<unknown>>()

function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    const promise = load().catch((err) => {
      cache.delete(key)
      throw err
    })
    cache.set(key, promise)
  }
  return cache.get(key) as Promise<T>
}

async function getJson<T>(url: string, purpose: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: wikimediaApiFetchHeaders(purpose), signal })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function actionUrl(host: string, params: Record<string, string>): string {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })
  return `${host}/w/api.php?${query}`
}

const restTitle = (title: string) => encodeURIComponent(title.replace(/ /g, '_'))

// — Article HTML → text-only pieces —

const SKIP =
  'style, script, sup, .mw-ref, .reference, .mw-empty-elt, link, meta, [style*="display:none"], [style*="display: none"]'

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

function linkTarget(a: Element): ArticleLink | null {
  if (!(a.getAttribute('rel') ?? '').includes('mw:WikiLink')) return null
  const match = (a.getAttribute('href') ?? '').match(/^\.\/([^#?]+)/)
  if (!match) return null
  const title = decodeURIComponent(match[1]).replace(/_/g, ' ')
  if (title.includes(':')) return null
  return {
    title,
    label: a.textContent?.trim() || title,
    missing: a.classList.contains('new') || (a.getAttribute('href') ?? '').includes('redlink=1'),
  }
}

/** Inline content only: text, emphasis, wiki links, line breaks. Everything else is flattened. */
function inlineHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  if (el.matches(SKIP)) return ''
  const inner = [...el.childNodes].map(inlineHtml).join('')
  const tag = el.tagName.toLowerCase()
  if (tag === 'a') {
    const link = linkTarget(el)
    if (!link) return inner
    const cls = link.missing ? ' class="vf-link--missing"' : ''
    return `<a href="#" data-title="${escapeHtml(link.title)}"${cls}>${inner}</a>`
  }
  if (tag === 'b' || tag === 'strong') return `<b>${inner}</b>`
  if (tag === 'i' || tag === 'em') return `<i>${inner}</i>`
  if (tag === 'br') return '<br>'
  if (tag === 'li') return `${inner}<br>`
  return inner
}

function blockHtml(section: Element, out: string[], intro: string[]): void {
  ;[...section.children].forEach((child) => {
    const tag = child.tagName.toLowerCase()
    if (tag === 'section') {
      blockHtml(child, out, intro)
    } else if (/^h[2-4]$/.test(tag) || child.classList.contains('mw-heading')) {
      const text =
        child.querySelector('h2, h3, h4')?.textContent?.trim() ?? child.textContent?.trim()
      if (text) out.push(`<h3>${escapeHtml(text)}</h3>`)
    } else if (tag === 'p') {
      const html = inlineHtml(child).trim()
      if (!html) return
      out.push(`<p>${html}</p>`)
      if (section.getAttribute('data-mw-section-id') === '0') intro.push(child.textContent ?? '')
    } else if (tag === 'ul' || tag === 'ol') {
      if (child.closest('.navbox, .reflist, .references')) return
      const items = [...child.children]
        .filter((li) => li.tagName === 'LI')
        .map((li) => `<li>${inlineHtml(li).replace(/<br>$/, '')}</li>`)
        .join('')
      if (items) out.push(`<${tag}>${items}</${tag}>`)
    }
  })
}

const LOGO_NAME =
  /logo|wordmark|emblem|seal|coat[_ ]of[_ ]arms|flag[_ ]of|insignia|icon|symbol|signature|map|locator/i

/**
 * The infobox's lead image, and whether it's a logo (or other flat artwork) or a
 * photograph. Photos use the largest srcset candidate so they stay sharp full width.
 */
function infoboxImage(
  img: Element | null | undefined,
): Pick<ParsedArticle, 'infoImage' | 'infoImageKind'> {
  if (!img) return {}
  const resource = decodeURIComponent(img.getAttribute('resource') ?? img.getAttribute('src') ?? '')
  const isLogo =
    LOGO_NAME.test(resource) ||
    /\.svg/i.test(resource) ||
    Boolean(img.closest('.infobox-image')?.classList.contains('logo'))
  const candidates = (img.getAttribute('srcset') ?? '')
    .split(',')
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean)
  const src = isLogo ? img.getAttribute('src')! : (candidates.at(-1) ?? img.getAttribute('src')!)
  return {
    infoImage: new URL(src, 'https://en.wikipedia.org').href,
    infoImageKind: isLogo ? 'logo' : 'photo',
  }
}

const END_MATTER =
  /^(references|notes|citations|sources|external links|further reading|bibliography)$/i

export function fetchArticle(title: string): Promise<ParsedArticle> {
  return memo(`article:${title}`, async () => {
    const res = await fetch(`${WIKI}/api/rest_v1/page/html/${restTitle(title)}`, {
      headers: wikimediaApiFetchHeaders('video-first-app-article'),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    const canonical =
      doc.querySelector('link[rel="dc:isVersionOf"]')?.getAttribute('href')?.split('/wiki/')[1] ??
      ''

    // Infobox → label / value rows.
    const infobox = doc.querySelector('table.infobox')
    const infoImg = infobox?.querySelector('.infobox-image img')
    const info: InfoRow[] = []
    infobox?.querySelectorAll('tr').forEach((tr) => {
      const th = tr.querySelector(':scope > th.infobox-label, :scope > th[scope="row"]')
      const td = tr.querySelector(':scope > td.infobox-data, :scope > td')
      if (!th || !td) return
      const html = inlineHtml(td)
        .replace(/(<br>\s*)+$/, '')
        .trim()
      if (html) info.push({ label: th.textContent!.trim(), html })
    })

    // Drop end matter, navboxes and non-text blocks before collecting text and links.
    doc.querySelectorAll('section').forEach((section) => {
      const heading = section.querySelector(':scope > h2, :scope > div > h2')
      if (heading && END_MATTER.test(heading.textContent?.trim() ?? '')) section.remove()
    })
    doc
      .querySelectorAll(
        '.navbox, .reflist, .references, .hatnote, .metadata, .sistersitebox, table, figure',
      )
      .forEach((el) => el.remove())

    const out: string[] = []
    const intro: string[] = []
    doc.querySelectorAll('body > section').forEach((section) => blockHtml(section, out, intro))

    const links: ArticleLink[] = []
    doc.querySelectorAll('a').forEach((a) => {
      const link = linkTarget(a)
      if (link && !links.some((l) => l.title === link.title)) links.push(link)
    })

    return {
      title: decodeURIComponent(canonical).replace(/_/g, ' ') || title,
      ...infoboxImage(infoImg),
      info,
      bodyHtml: out.join(''),
      introText: intro
        .map((t) => t.replace(/\[\d+\]/g, '').trim())
        .filter(Boolean)
        .join('\n\n'),
      links,
    }
  })
}

/** Images in the article (REST media-list), then related files from a Commons search. */
export function fetchImages(title: string): Promise<ArticleImage[]> {
  return memo(`images:${title}`, async () => {
    const [mediaList, commons] = await Promise.all([
      getJson<{
        items: {
          type: string
          title: string
          caption?: { text: string }
          srcset?: { src: string }[]
        }[]
      }>(`${WIKI}/api/rest_v1/page/media-list/${restTitle(title)}`, 'video-first-app-media').catch(
        () => ({ items: [] }),
      ),
      getJson<{
        query?: { pages: { title: string; index: number; imageinfo?: { thumburl: string }[] }[] }
      }>(
        actionUrl(COMMONS, {
          action: 'query',
          generator: 'search',
          gsrsearch: `${title} filetype:bitmap`,
          gsrnamespace: '6',
          gsrlimit: '20',
          prop: 'imageinfo',
          iiprop: 'url',
          iiurlwidth: '240',
        }),
        'video-first-app-commons',
      ).catch(() => ({ query: undefined })),
    ])

    const images: ArticleImage[] = mediaList.items
      .filter((item) => item.type === 'image' && item.srcset?.length && !/logo/i.test(item.title))
      .map((item) => ({
        file: item.title,
        thumb: `https:${item.srcset![0].src}`,
        caption: item.caption?.text,
      }))

    const seen = new Set(images.map((i) => i.file.replace(/_/g, ' ').replace(/^File:/, '')))
    ;(commons.query?.pages ?? [])
      .sort((a, b) => a.index - b.index)
      .forEach((page) => {
        const name = page.title.replace(/^File:/, '')
        const thumb = page.imageinfo?.[0]?.thumburl
        if (!thumb || seen.has(name)) return
        seen.add(name)
        images.push({ file: page.title, thumb })
      })
    return images
  })
}

export interface ImageDetails {
  /** Screen-sized rendition (960px wide, or the original when smaller). */
  full: string
  /** English Wikipedia articles that use the file. */
  articles: string[]
  author: string
  description: string
  timestamp?: string
}

/** Commons details for article images: a full-screen rendition, author, description, upload time. */
export function fetchImageDetails(files: string[]): Promise<Record<string, ImageDetails>> {
  return memo(`image-details:${files.join('|')}`, async () => {
    const details: Record<string, ImageDetails> = {}
    for (let i = 0; i < files.length; i += 50) {
      const batch = files.slice(i, i + 50)
      const data = await getJson<{
        query?: {
          normalized?: { from: string; to: string }[]
          pages: {
            title: string
            imageinfo?: (MediaInfo & { thumburl?: string })[]
            globalusage?: Usage[]
          }[]
        }
      }>(
        actionUrl(COMMONS, {
          action: 'query',
          titles: batch.join('|'),
          prop: 'imageinfo|globalusage',
          iiprop: 'url|extmetadata|timestamp',
          iiurlwidth: '960',
          iiextmetadatafilter: 'ImageDescription|Artist',
          ...USAGE_PARAMS,
        }),
        'video-first-app-commons',
      )
      const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]))
      batch.forEach((file) => {
        const name = normalized.get(file) ?? file
        const page = data.query?.pages.find((p) => p.title === name)
        const info = page?.imageinfo?.[0]
        const full = info?.thumburl ?? info?.url
        if (!info || !full) return
        const { author, description } = credit(info)
        details[file] = {
          full,
          articles: usageTitles(page?.globalusage),
          author,
          description,
          timestamp: info.timestamp,
        }
      })
    }
    return details
  })
}

/** Places mentioned in the article: its body links that resolve to pages with coordinates. */
export function fetchPlaces(title: string): Promise<ArticlePlace[]> {
  return memo(`places:${title}`, async () => {
    const { links } = await fetchArticle(title)
    const list = links.filter((l) => !l.missing).map((l) => l.title)
    const places: ArticlePlace[] = []
    for (let i = 0; i < list.length; i += 50) {
      const data = await getJson<{
        query?: {
          normalized?: { from: string; to: string }[]
          redirects?: { from: string; to: string }[]
          pages: {
            title: string
            description?: string
            coordinates?: { lat: number; lon: number }[]
          }[]
        }
      }>(
        actionUrl(WIKI, {
          action: 'query',
          redirects: '1',
          titles: list.slice(i, i + 50).join('|'),
          prop: 'coordinates|description',
          coprimary: 'primary',
        }),
        'video-first-app-places',
      )
      // Page title → the first link in this batch that leads to it.
      const linkedAs = new Map<string, string>()
      list.slice(i, i + 50).forEach((link) => {
        let to = link
        to = data.query?.normalized?.find((n) => n.from === to)?.to ?? to
        to = data.query?.redirects?.find((r) => r.from === to)?.to ?? to
        if (!linkedAs.has(to)) linkedAs.set(to, link)
      })
      data.query?.pages.forEach((page) => {
        const coord = page.coordinates?.[0]
        if (coord && !places.some((p) => p.title === page.title)) {
          places.push({
            title: page.title,
            linkTitle: linkedAs.get(page.title) ?? page.title,
            lat: coord.lat,
            lon: coord.lon,
            description: page.description,
          })
        }
      })
    }
    // Article order: the first place mentioned comes first.
    const order = (t: string) => list.findIndex((l) => l === t)
    return places.sort((a, b) => {
      const ia = order(a.linkTitle)
      const ib = order(b.linkTitle)
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
    })
  })
}

export function fetchLeadImage(title: string): Promise<string | undefined> {
  return memo(`lead:${title}`, async () => {
    const data = await getJson<{ thumbnail?: { source: string } }>(
      `${WIKI}/api/rest_v1/page/summary/${restTitle(title)}`,
      'video-first-app-summary',
    )
    return data.thumbnail?.source
  })
}

/** Article typeahead for search and for connecting posts to articles. */
export async function searchArticles(
  query: string,
  signal?: AbortSignal,
): Promise<{ title: string; description?: string; thumb?: string }[]> {
  if (!query.trim()) return []
  const data = await getJson<{
    query?: {
      pages: {
        title: string
        index: number
        description?: string
        thumbnail?: { source: string }
      }[]
    }
  }>(
    actionUrl(WIKI, {
      action: 'query',
      generator: 'prefixsearch',
      gpssearch: query,
      gpslimit: '8',
      prop: 'description|pageimages',
      piprop: 'thumbnail',
      pithumbsize: '80',
    }),
    'video-first-app-search',
    signal,
  )
  return (data.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ title: p.title, description: p.description, thumb: p.thumbnail?.source }))
}

export interface ArticleVideo {
  file: string
  /** Playable WebM transcode. */
  video: string
  poster: string
  duration: number
  author: string
  caption: string
  /** Upload time (ISO). */
  timestamp?: string
  /** English Wikipedia articles that use the file. */
  articles: string[]
}

export interface ArticleAudio {
  file: string
  src: string
  duration: number
  author: string
  title: string
  timestamp?: string
}

function stripHtml(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}

function fileCaption(file: string): string {
  return file
    .replace(/^File:/, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_/g, ' ')
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Where a Commons file is used: articles on English Wikipedia only (no user, talk or other pages). */
type Usage = { title: string }

const USAGE_PARAMS = { gusite: 'enwiki', gunamespace: '0', gulimit: '500' }

function usageTitles(usage: Usage[] | undefined): string[] {
  return (usage ?? [])
    .map((u) => u.title.replace(/_/g, ' '))
    .filter((t, i, all) => all.indexOf(t) === i)
}

type MediaInfo = {
  url?: string
  thumburl?: string
  duration?: number
  timestamp?: string
  mime?: string
  derivatives?: { type: string; height?: number; src: string }[]
  extmetadata?: Record<string, { value: string }>
}

/**
 * Commons files about an article: files used in the article (REST media-list)
 * first, then a quoted Commons search, with their videoinfo (transcodes, poster,
 * duration, author, description, upload time).
 */
async function articleMedia(
  title: string,
  kind: 'video' | 'audio',
): Promise<{ file: string; info: MediaInfo; articles: string[] }[]> {
  const [mediaList, search] = await Promise.all([
    getJson<{ items: { type: string; title: string }[] }>(
      `${WIKI}/api/rest_v1/page/media-list/${restTitle(title)}`,
      'video-first-app-media',
    ).catch(() => ({ items: [] })),
    getJson<{ query?: { search: { title: string }[] } }>(
      actionUrl(COMMONS, {
        action: 'query',
        list: 'search',
        srsearch: `"${title}" filetype:${kind}`,
        srnamespace: '6',
        srlimit: '10',
      }),
      `video-first-app-commons-${kind}`,
    ).catch(() => ({ query: undefined })),
  ])
  const files = [
    ...mediaList.items.filter((i) => i.type === kind).map((i) => i.title.replace(/_/g, ' ')),
    ...(search.query?.search ?? []).map((hit) => hit.title),
  ]
    .filter((f, i, all) => all.indexOf(f) === i)
    .slice(0, 12)
  if (!files.length) return []

  const data = await getJson<{
    query?: {
      normalized?: { from: string; to: string }[]
      pages: { title: string; videoinfo?: MediaInfo[]; globalusage?: Usage[] }[]
    }
  }>(
    actionUrl(COMMONS, {
      action: 'query',
      titles: files.join('|'),
      prop: 'videoinfo|globalusage',
      viprop: 'url|size|mime|derivatives|extmetadata|timestamp',
      viurlwidth: '720',
      viextmetadatafilter: 'ImageDescription|Artist',
      ...USAGE_PARAMS,
    }),
    `video-first-app-commons-${kind}`,
  )
  const pages = data.query?.pages ?? []
  return files
    .map((file) => {
      const page = pages.find((p) => p.title === file)
      return { file, info: page?.videoinfo?.[0], articles: usageTitles(page?.globalusage) }
    })
    .filter((m): m is { file: string; info: MediaInfo; articles: string[] } => Boolean(m.info))
}

function credit(info: MediaInfo): { author: string; description: string } {
  const meta = info.extmetadata ?? {}
  return {
    author: clip(stripHtml(meta.Artist?.value ?? '') || 'Wikimedia Commons', 28),
    description: stripHtml(meta.ImageDescription?.value ?? ''),
  }
}

/** Real Commons videos about an article, for feed posts and the Video tab. */
export function fetchArticleVideos(title: string): Promise<ArticleVideo[]> {
  return memo(`videos:${title}`, async () => {
    const media = await articleMedia(title, 'video')
    const videos: ArticleVideo[] = []
    media.forEach(({ file, info, articles }) => {
      const webm = (info.derivatives ?? [])
        .filter((d) => d.type.startsWith('video/webm') && (d.height ?? 0) <= 720)
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0]
      // Skip stills-only or very long files (lectures, full newsreels).
      if (!info.thumburl || !webm || !info.duration || info.duration < 3 || info.duration > 600)
        return
      const { author, description } = credit(info)
      videos.push({
        file,
        video: webm.src,
        poster: info.thumburl,
        duration: info.duration,
        author,
        caption: clip(description || fileCaption(file), 160),
        timestamp: info.timestamp,
        articles,
      })
    })
    return videos.slice(0, 6)
  })
}

/** Real Commons audio about an article (recordings, pronunciations, music). */
export function fetchArticleAudio(title: string): Promise<ArticleAudio[]> {
  return memo(`audio:${title}`, async () => {
    const media = await articleMedia(title, 'audio')
    return media
      .flatMap(({ file, info }): ArticleAudio[] => {
        const mp3 = (info.derivatives ?? []).find((d) => d.type.startsWith('audio/mpeg'))
        const src = mp3?.src ?? info.url
        if (!src || !info.duration) return []
        return [
          {
            file,
            src,
            duration: info.duration,
            author: credit(info).author,
            title: fileCaption(file),
            timestamp: info.timestamp,
          },
        ]
      })
      .slice(0, 8)
  })
}

const thumbCache = new Map<string, string | null>()

/**
 * Lead (page) images for many articles at once, 50 titles per Action API call.
 * Resolves to title → thumbnail URL (null when the article has none). Redirects
 * are followed and reported under the title that was asked for.
 */
export async function fetchPageThumbs(titles: string[]): Promise<Record<string, string | null>> {
  const missing = titles.filter((t) => !thumbCache.has(t))
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50)
    const data = await getJson<{
      query?: {
        normalized?: { from: string; to: string }[]
        redirects?: { from: string; to: string }[]
        pages: { title: string; thumbnail?: { source: string } }[]
      }
    }>(
      actionUrl(WIKI, {
        action: 'query',
        redirects: '1',
        titles: batch.join('|'),
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: '112',
        pilimit: '50',
      }),
      'video-first-app-thumbs',
    ).catch(() => ({ query: undefined }))
    const q = data.query
    const resolve = (title: string) => {
      let t = q?.normalized?.find((n) => n.from === title)?.to ?? title
      t = q?.redirects?.find((r) => r.from === t)?.to ?? t
      return t
    }
    batch.forEach((title) => {
      const page = q?.pages.find((p) => p.title === resolve(title))
      thumbCache.set(title, page?.thumbnail?.source ?? null)
    })
  }
  return Object.fromEntries(titles.map((t) => [t, thumbCache.get(t) ?? null]))
}
