// Articles as sound, as in Mondrian (github.com/dmtors/mondrian): each slot
// reads one trust signal from the Wikimedia Attribution API (beta).
//
// - Waveform: contributors. A few writers → a pure sine … a crowd → sawtooth.
// - Filter: references. None → muffled (250 Hz) … 400+ → bright (7 kHz).
// - Envelope: page views, last 30 days. Few → a short pluck … many → a long ring.
// - Effect: the last edit. Today → a wide fast vibrato … a year ago → steady;
//   trending → a shimmer.

export type Slot = 'waveform' | 'filter' | 'envelope' | 'effect'
export const SLOTS: Slot[] = ['waveform', 'filter', 'envelope', 'effect']

export type Article = {
  title: string
  contributors: number
  references: number
  pageViews: number
  daysSinceUpdate: number | null
  trending: boolean
  link: string
}

export type Sound = {
  waveform: OscillatorType
  cutoffHz: number
  decaySec: number
  vibratoCents: number
  vibratoHz: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const freshness = (days: number | null) => (days === null ? 0 : 1 - clamp(Math.log10(days + 1) / Math.log10(366), 0, 1))

export const SoundMap = {
  waveform(contributors: number): OscillatorType {
    if (contributors >= 1500) return 'sawtooth'
    if (contributors >= 400) return 'square'
    if (contributors >= 100) return 'triangle'
    return 'sine'
  },
  cutoff(references: number) {
    const t = clamp(Math.log10(references + 1) / Math.log10(401), 0, 1)
    return 250 * (7000 / 250) ** t
  },
  decay(pageViews: number) {
    const t = clamp((Math.log10(pageViews + 1) - 2) / 4, 0, 1)
    return 0.12 + t * 2.08
  },
  vibratoDepth(days: number | null, trending: boolean) {
    return Math.max(freshness(days) * 45, trending ? 30 : 0)
  },
  vibratoRate(days: number | null, trending: boolean) {
    return trending ? 7.5 : 4 + freshness(days) * 3
  },
}

/** Until an article loads, its slot sounds like one with nothing yet. */
export const BLANK: Omit<Article, 'title' | 'link'> = {
  contributors: 0,
  references: 0,
  pageViews: 0,
  daysSinceUpdate: null,
  trending: false,
}

export function soundOf(a: Record<Slot, Omit<Article, 'title' | 'link'>>): Sound {
  return {
    waveform: SoundMap.waveform(a.waveform.contributors),
    cutoffHz: SoundMap.cutoff(a.filter.references),
    decaySec: SoundMap.decay(a.envelope.pageViews),
    vibratoCents: SoundMap.vibratoDepth(a.effect.daysSinceUpdate, a.effect.trending),
    vibratoHz: SoundMap.vibratoRate(a.effect.daysSinceUpdate, a.effect.trending),
  }
}

/**
 * How rough a sound is, 0 … 1: mostly its waveform (a sine is smooth, a saw
 * buzzes), then how bright its filter leaves it, then how much it wobbles.
 */
export function roughnessOf(sound: Sound) {
  const wave = { sine: 0, triangle: 0.25, square: 0.8, sawtooth: 1 }[sound.waveform as string] ?? 0.5
  const bright = clamp(Math.log(sound.cutoffHz / 250) / Math.log(7000 / 250), 0, 1)
  const wobble = clamp(sound.vibratoCents / 45, 0, 1)
  return clamp(0.55 * wave + 0.3 * bright + 0.15 * wobble, 0, 1)
}

const API = 'https://en.wikipedia.org/w/api.php'
const SIGNALS = 'https://en.wikipedia.org/w/rest.php/attribution/v0-beta/pages'
const HEADERS = { 'Api-User-Agent': 'ProtoWiki-OP1/0.1 (prototype)' }
const cache = new Map<string, Article | null>()

export const articleUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`

/**
 * An article's signals: one request to settle the title (following
 * redirects), one for the Attribution API's trust signals. Null when there's
 * no such article or it has no signals.
 */
export async function articleSignals(title: string): Promise<Article | null> {
  if (cache.has(title)) return cache.get(title)!
  const url = new URL(API)
  Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', redirects: '1', titles: title }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  )
  const page = (await (await fetch(url, { headers: HEADERS })).json()).query?.pages?.[0]
  if (!page || page.missing || page.invalid) return null
  const response = await fetch(`${SIGNALS}/${encodeURIComponent(page.title.replace(/ /g, '_'))}/signals?expand=trust_and_relevance`, { headers: HEADERS })
  if (!response.ok) return null
  const signals = await response.json()
  const trust = signals.trust_and_relevance || {}
  const top = trust.trending?.top || {}
  const updated = trust.last_updated ? Date.parse(trust.last_updated) : NaN
  const article: Article = {
    title,
    contributors: trust.contributor_counts?.total_unique ?? 0,
    references: trust.reference_count ?? 0,
    pageViews: trust.page_views ?? 0,
    daysSinceUpdate: Number.isNaN(updated) ? null : Math.max(0, (Date.now() - updated) / 86400e3),
    trending: Boolean(top.read || top.edited || top.read_and_edited),
    link: signals.essential?.link || articleUrl(page.title), // keeps the API's wprov, so the visit is credited
  }
  cache.set(title, article)
  return article
}
