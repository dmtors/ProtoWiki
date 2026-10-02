import { wikimediaApiFetchHeaders } from '@/config'

/** Stop paging after this many requests (500 links each) — plenty for a count. */
const MAX_PAGES = 6

/**
 * Approximate "sources" signal: distinct external hostnames the page links to
 * (Action API `prop=extlinks`). The Attribution API has no sources field, and
 * this includes non-citation links (e.g. authority control), so treat it as a
 * prototype stand-in.
 */
export async function fetchSourceCount(
  title: string,
  host: string,
  options: { signal?: AbortSignal } = {},
): Promise<number | null> {
  const hosts = new Set<string>()
  let cont: Record<string, string> = {}

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extlinks',
      titles: title,
      ellimit: 'max',
      format: 'json',
      formatversion: '2',
      origin: '*',
      ...cont,
    })
    const response = await fetch(`https://${host}/w/api.php?${params}`, {
      signal: options.signal,
      headers: wikimediaApiFetchHeaders('article-embed-sources'),
    })
    if (!response.ok) return null

    const data = (await response.json()) as {
      query?: { pages?: { extlinks?: { url: string }[] }[] }
      continue?: Record<string, string>
    }
    for (const link of data.query?.pages?.[0]?.extlinks ?? []) {
      try {
        hosts.add(new URL(link.url, 'https://example.invalid').hostname.replace(/^www\./, ''))
      } catch {
        // Unparseable URL — skip.
      }
    }
    if (!data.continue) break
    cont = data.continue
  }

  // Protocol-relative / odd links resolve to the placeholder base — don't count it.
  hosts.delete('example.invalid')
  return hosts.size
}
