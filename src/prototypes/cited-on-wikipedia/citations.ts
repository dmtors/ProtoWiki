/**
 * Find where a source URL is cited across Wikipedias, then enrich each hit.
 *
 * - Discovery: Action API `list=exturlusage` (prefix match on the external-links
 *   table) on every open Wikipedia from the Meta sitematrix, largest first.
 * - Annual page views: Pageviews REST API, user agent, last 12 full months.
 * - Cited by (`fetchCitedBy` — not shown in the page for now): no API records
 *   who added a link, so we bisect the page history for the first revision
 *   whose wikitext contains the URL (WikiBlame-style).
 * - Anchor: Parsoid HTML → the `cite_note-…` reference that holds the link
 *   (fetched lazily, on hover/focus of the article link).
 *
 * Speed: Wikimedia rate-limits each anonymous browser to roughly 5–8 requests
 * a second across all wikis, so load time ≈ request count ÷ that rate. Hence:
 * no custom headers (they force a CORS preflight per unique URL, doubling
 * traffic), one shared adaptive pacer instead of per-request backoff, and
 * batched history bisection.
 */

/**
 * Largest Wikipedias by size — searched first so most results arrive early,
 * and the fallback set if the sitematrix can't be loaded.
 */
export const PRIORITY_LANGS = [
  'en', 'de', 'fr', 'es', 'ja', 'ru', 'it', 'zh', 'pt', 'pl', 'nl', 'ar',
  'fa', 'sv', 'uk', 'vi', 'id', 'ko', 'he', 'tr', 'cs', 'fi', 'no', 'hu',
]

/** Cap on rows shown (and enriched) per check. */
export const MAX_RESULTS = 200

/** Wikis searched in parallel during discovery — enough to keep the pacer's queue full. */
const SEARCH_CONCURRENCY = 6

/**
 * Attempts per request when Wikimedia answers 429 / 503. Generous on purpose:
 * the pacer slows everyone down between attempts, and giving up drops results.
 */
const MAX_ATTEMPTS = 12

/** Revisions whose wikitext is fetched per request while bisecting history. */
const BISECT_BATCH = 6

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

/**
 * One request schedule shared by every call in this module (AIMD): creep the
 * rate up while requests succeed; on a 429, halve it and pause everyone
 * briefly, so a throttled client stops spending its budget on rejections.
 */
const pacer = {
  rate: 8, // requests per second — Wikimedia allows a short burst above the sustained rate
  min: 1,
  max: 12,
  nextSlot: 0,
  async wait(signal: AbortSignal) {
    const now = performance.now()
    const slot = Math.max(now, this.nextSlot)
    this.nextSlot = slot + 1000 / this.rate
    if (slot > now) await sleep(slot - now, signal)
  },
  succeeded() {
    // Slow climb: at ~5 req/s this regains 1 req/s every ~4 seconds.
    this.rate = Math.min(this.max, this.rate + 0.05)
  },
  lastThrottle: -Infinity,
  throttled() {
    const now = performance.now()
    this.nextSlot = Math.max(this.nextSlot, now + 3000)
    // Several in-flight requests hit the same limit at once — count it as one signal.
    if (now - this.lastThrottle < 1000) return
    this.lastThrottle = now
    this.rate = Math.max(this.min, this.rate * 0.6)
  },
}

/** True while requests are held back after Wikimedia rate-limited us — for status copy. */
export function isRateLimited(): boolean {
  return pacer.nextSlot - performance.now() > 1000
}

/** Paced `fetch` that retries when rate-limited (429) or overloaded (503). */
async function pacedFetch(url: string, signal: AbortSignal): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    await pacer.wait(signal)
    const response = await fetch(url, { signal })
    const limited = response.status === 429 || response.status === 503
    if (!limited) {
      pacer.succeeded()
      return response
    }
    pacer.throttled()
    if (attempt >= MAX_ATTEMPTS) return response
  }
}

export interface Wiki {
  lang: string
  host: string
  /** English language name, e.g. "Belarusian (Taraškievica orthography)". */
  name: string
}

export interface CitedByInfo {
  user: string
  timestamp: string
  revid: number
}

export interface Citation {
  key: string
  lang: string
  /** English language name of the wiki. */
  language: string
  host: string
  title: string
  /** URL as stored in the wiki's external-links table. */
  url: string
  /** `undefined` while loading; `null` when unavailable. */
  views?: number | null
  citedBy?: CitedByInfo | null
  anchor?: string | null
  /** Wikidata item (e.g. "Q11660") — shared by the same topic across languages. `null` if none. */
  qid?: string | null
  /** Lookup errored (after retries) — distinct from a genuine "no data". */
  viewsFailed?: boolean
  citedByFailed?: boolean
}

export interface SourceQuery {
  /** `host/path?query` without protocol or fragment, as typed. */
  target: string
  /** Normalised form used to filter exact matches. */
  normalized: string
  /** Bare domain entered → match every URL on that domain. */
  domainOnly: boolean
  /** `exturlusage` queries to run (with and without `www.`). */
  queries: string[]
  /** `*.domain` — every link on the domain and its subdomains, in one query. */
  domainWildcard: string
}

/** Lowercased host without `www.`, path without trailing slash, query kept, fragment dropped. */
export function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/\//, '')}`)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = decodeURI(url.pathname).replace(/\/+$/, '')
    return `${host}${path}${url.search}`
  } catch {
    return null
  }
}

export function parseSourceInput(input: string): SourceQuery | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (!url.hostname.includes('.')) return null

  const bareHost = url.hostname.toLowerCase().replace(/^www\./, '')
  const rest = `${url.pathname === '/' ? '' : url.pathname}${url.search}`
  const normalized = normalizeUrl(url.href)
  if (!normalized) return null

  return {
    target: `${url.hostname}${rest}`,
    normalized,
    domainOnly: !rest,
    queries: [`${bareHost}${rest}`, `www.${bareHost}${rest}`],
    domainWildcard: `*.${bareHost}`,
  }
}

async function actionApi(host: string, params: Record<string, string>, signal: AbortSignal) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })
  for (let attempt = 1; ; attempt++) {
    const response = await pacedFetch(`https://${host}/w/api.php?${qs}`, signal)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    // The Action API can also report its own rate limit as a 200 with an error body.
    if (data.error?.code === 'ratelimited' && attempt < MAX_ATTEMPTS) {
      pacer.throttled()
      continue
    }
    if (data.error) throw new Error(data.error.info ?? data.error.code)
    return data
  }
}

/** Returns a scheduler that runs queued tasks with at most `limit` in flight. */
export function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    if (active >= limit) return
    const start = queue.shift()
    if (!start) return
    active++
    start()
  }
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      })
      next()
    })
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length && !signal.aborted) {
      const item = items[next++]
      try {
        await fn(item)
      } catch {
        // One failed item shouldn't stop the rest.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

let wikiListCache: Promise<Wiki[]> | null = null

/** Every open Wikipedia, `PRIORITY_LANGS` first. Cached for the session. */
export function fetchWikipedias(): Promise<Wiki[]> {
  wikiListCache ??= (async () => {
    const data = await actionApi(
      'meta.wikimedia.org',
      { action: 'sitematrix', smtype: 'language', smlangprop: 'code|localname|site', smsiteprop: 'url|code' },
      new AbortController().signal,
    )
    type Site = { code: string; url: string; closed?: boolean; private?: boolean }
    type Language = { code: string; localname: string; site?: Site[] }
    const languages = Object.entries(data.sitematrix ?? {})
      .filter(([key]) => key !== 'count')
      .map(([, value]) => value as Language)

    const wikis: Wiki[] = []
    for (const language of languages) {
      const site = language.site?.find((s) => s.code === 'wiki' && !s.closed && !s.private)
      if (site) wikis.push({ lang: language.code, host: new URL(site.url).host, name: language.localname })
    }
    const rank = (lang: string) => {
      const i = PRIORITY_LANGS.indexOf(lang)
      return i === -1 ? PRIORITY_LANGS.length : i
    }
    return wikis.sort((a, b) => rank(a.lang) - rank(b.lang))
  })().catch(() => {
    wikiListCache = null // Retry on the next check.
    const names = new Intl.DisplayNames(['en'], { type: 'language' })
    return PRIORITY_LANGS.map((lang) => ({
      lang,
      host: `${lang}.wikipedia.org`,
      name: names.of(lang) ?? lang,
    }))
  })
  return wikiListCache
}

type UsageHit = { title: string; url: string }

async function extUrlUsage(host: string, query: string, signal: AbortSignal) {
  const data = await actionApi(
    host,
    { action: 'query', list: 'exturlusage', euquery: query, eunamespace: '0', eulimit: 'max' },
    signal,
  )
  return { hits: (data.query?.exturlusage ?? []) as UsageHit[], complete: !data.continue }
}

/**
 * Articles (namespace 0) on one wiki that link to the source.
 *
 * Exact URLs need two prefix queries (with and without `www.`). On smaller
 * wikis we first try one `*.domain` query — every link to the domain — and
 * filter locally; only if that pages (too many links to the domain) do we fall
 * back to the two exact queries. Most wikis then cost one request, not two.
 */
async function searchWiki(wiki: Wiki, source: SourceQuery, signal: AbortSignal): Promise<Citation[]> {
  const { lang, host, name } = wiki
  const byTitle = new Map<string, Citation>()
  const add = (hits: UsageHit[]) => {
    for (const hit of hits) {
      // exturlusage is a prefix match — keep exact URLs unless a bare domain was entered.
      if (!source.domainOnly && normalizeUrl(hit.url) !== source.normalized) continue
      if (!byTitle.has(hit.title)) {
        byTitle.set(hit.title, { key: `${lang}:${hit.title}`, lang, language: name, host, title: hit.title, url: hit.url })
      }
    }
  }

  if (!source.domainOnly && !PRIORITY_LANGS.includes(lang)) {
    const { hits, complete } = await extUrlUsage(host, source.domainWildcard, signal)
    if (complete) {
      add(hits)
      return [...byTitle.values()]
    }
  }

  for (const query of source.queries) add((await extUrlUsage(host, query, signal)).hits)
  return [...byTitle.values()]
}

/**
 * Search `wikis` in order; calls `onFound` as each wiki's hits arrive and
 * `onSearched` after every wiki for progress (`ok: false` when it errored).
 */
export async function findCitations(
  wikis: Wiki[],
  source: SourceQuery,
  signal: AbortSignal,
  onFound: (hits: Citation[]) => void,
  onSearched: (ok: boolean) => void,
): Promise<void> {
  await runPool(
    wikis,
    SEARCH_CONCURRENCY,
    async (wiki) => {
      let ok = false
      try {
        const hits = await searchWiki(wiki, source, signal)
        ok = true
        if (!signal.aborted && hits.length) onFound(hits)
      } finally {
        if (!signal.aborted) onSearched(ok)
      }
    },
    signal,
  )
}

/**
 * Wikidata item IDs for articles on one wiki (`pageprops.wikibase_item`), 50
 * titles per request. Articles in different languages about the same topic
 * share an item, which is how the table groups them.
 */
export async function fetchWikidataIds(
  host: string,
  titles: string[],
  signal: AbortSignal,
): Promise<Map<string, string | null>> {
  const ids = new Map<string, string | null>()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const data = await actionApi(
      host,
      { action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', titles: batch.join('|') },
      signal,
    )
    // Map normalised titles back to what we asked for.
    const requested = new Map<string, string>(batch.map((t) => [t, t]))
    for (const n of (data.query?.normalized ?? []) as { from: string; to: string }[]) requested.set(n.to, n.from)
    for (const page of (data.query?.pages ?? []) as { title: string; pageprops?: { wikibase_item?: string } }[]) {
      ids.set(requested.get(page.title) ?? page.title, page.pageprops?.wikibase_item ?? null)
    }
  }
  return ids
}

function pageviewsRange(): { start: string; end: string } {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)) // last day of previous month
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth() + 1, 1))
  const fmt = (d: Date) => `${d.toISOString().slice(0, 10).replace(/-/g, '')}00`
  return { start: fmt(start), end: fmt(end) }
}

/** User pageviews over the last 12 full months. */
export async function fetchAnnualViews(citation: Citation, signal: AbortSignal): Promise<number | null> {
  const { start, end } = pageviewsRange()
  const article = encodeURIComponent(citation.title.replace(/ /g, '_'))
  // No custom headers here either: wikimedia.org answers the CORS preflight with HTTP 405.
  const response = await pacedFetch(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${citation.host.replace(/\.org$/, '')}/all-access/user/${article}/monthly/${start}/${end}`,
    signal,
  )
  if (response.status === 404) return 0 // No recorded views in the window.
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as { items?: { views: number }[] }
  return (data.items ?? []).reduce((sum, item) => sum + item.views, 0)
}

/** Strings to look for in wikitext — stored URL and its decoded form, protocol-less. */
function wikitextNeedles(url: string): string[] {
  const bare = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/\//, '')
  const needles = new Set([bare])
  try {
    needles.add(decodeURI(bare))
  } catch {
    // Malformed escape — raw form only.
  }
  return [...needles]
}

/**
 * Which of `revids` contain the URL, in one request. Revisions whose content
 * didn't come back (hidden, or cut by the API's result-size cap) are omitted.
 */
async function revisionsContaining(
  host: string,
  revids: number[],
  needles: string[],
  signal: AbortSignal,
): Promise<Map<number, boolean>> {
  const data = await actionApi(
    host,
    { action: 'query', prop: 'revisions', revids: revids.join('|'), rvprop: 'ids|content', rvslots: 'main' },
    signal,
  )
  const result = new Map<number, boolean>()
  for (const page of data.query?.pages ?? []) {
    for (const revision of page.revisions ?? []) {
      const content: unknown = revision.slots?.main?.content
      if (typeof content !== 'string') continue
      result.set(revision.revid, needles.some((needle) => content.includes(needle)))
    }
  }
  return result
}

/** Up to `count` indices spread evenly over the open-closed range (lo, hi]. */
function probeIndices(lo: number, hi: number, count: number): number[] {
  const span = hi - lo
  if (span <= count) return Array.from({ length: span }, (_, i) => lo + 1 + i)
  const indices = new Set<number>()
  for (let i = 1; i <= count; i++) indices.add(lo + Math.round((span * i) / count))
  return [...indices]
}

/**
 * First revision whose wikitext contains the URL. Assumes the link stayed once
 * added (the search finds *a* boundary if it was removed and re-added). Returns
 * `null` when the URL isn't literally in the wikitext (e.g. built by a template).
 *
 * K-ary search: each request fetches `BISECT_BATCH` revisions' wikitext, so a
 * 1,000-revision history takes ~4 requests instead of ~10.
 */
export async function fetchCitedBy(citation: Citation, signal: AbortSignal): Promise<CitedByInfo | null> {
  const revisions: CitedByInfo[] = []
  let cont: Record<string, string> = {}
  for (let page = 0; page < 40; page++) {
    const data = await actionApi(
      citation.host,
      {
        action: 'query',
        prop: 'revisions',
        titles: citation.title,
        rvprop: 'ids|timestamp|user',
        rvlimit: 'max',
        rvdir: 'newer',
        ...cont,
      },
      signal,
    )
    revisions.push(...(data.query?.pages?.[0]?.revisions ?? []))
    if (!data.continue) break
    cont = data.continue
  }
  if (!revisions.length) return null

  const needles = wikitextNeedles(citation.url)
  // Invariant: revisions[lo] lacks the URL (-1 = before the first revision); revisions[hi] has it.
  let lo = -1
  let hi = revisions.length - 1
  let firstRound = true

  while (hi - lo > 1 || firstRound) {
    // Probes are ascending, and the last one is always `hi` — the latest revision on round one.
    const probes = probeIndices(lo, hi, BISECT_BATCH)
    const results = await revisionsContaining(
      citation.host,
      probes.map((i) => revisions[i].revid),
      needles,
      signal,
    )
    const has = (i: number) => results.get(revisions[i].revid)

    if (firstRound && has(hi) !== true) return null // Not (literally) in the current article.
    firstRound = false

    const nextHi = probes.find((i) => has(i) === true) ?? hi
    const misses = probes.filter((i) => i < nextHi && has(i) === false)
    const nextLo = misses.length ? misses[misses.length - 1] : lo
    // Every probe in range came back without content — stop at the best bound so far.
    if (nextHi === hi && nextLo === lo) break
    lo = nextLo
    hi = nextHi
  }
  const { user, timestamp, revid } = revisions[hi]
  return { user: user ?? 'Unknown user', timestamp, revid }
}

/** `id` of the reference list item (`cite_note-…`) that contains the link, if any. */
export async function fetchReferenceAnchor(citation: Citation, signal: AbortSignal): Promise<string | null> {
  const title = encodeURIComponent(citation.title.replace(/ /g, '_'))
  const response = await pacedFetch(`https://${citation.host}/api/rest_v1/page/html/${title}`, signal)
  if (!response.ok) return null
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
  const target = normalizeUrl(citation.url)
  for (const link of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (normalizeUrl(link.getAttribute('href') ?? '') !== target) continue
    const note = link.closest('li[id^="cite_note"]')
    if (note) return note.id
  }
  return null
}
