/** Shareable "Cited on Wikipedia" summary — shared by the badge, dialog, embed route, and image export. */
import { cdxIconChart, cdxIconLanguage, cdxIconReferences } from '@wikimedia/codex-icons'
import type { Icon } from '@wikimedia/codex-icons'

export type SummarySize = 'compact' | 'detailed'

export const SUMMARY_SIZES: { value: SummarySize; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'detailed', label: 'Detailed' },
]

export interface CitationSummary {
  /** Source URL the check was run for. */
  source: string
  citations: number
  languages: number
  /** Total annual page views, or `null` when unknown. */
  visits: number | null
}

/** Rough, rounded totals: 12,609 → "13K", 1,234,567 → "1.2M". */
const roughNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 2 })

const plural = (count: string | number, n: number, noun: string) => `${count} ${noun}${n === 1 ? '' : 's'}`

/** Compact badge suffix: "15x" — omitted when there's a single citation. */
export function compactCount(summary: CitationSummary): string {
  return summary.citations > 1 ? `${summary.citations.toLocaleString('en')}x` : ''
}

/**
 * Detailed badge stats. Citations always; languages only when more than one;
 * page views once known — so the badge only states what adds information.
 */
export function summaryStats(summary: CitationSummary): { key: string; icon: Icon; label: string }[] {
  const stats = [
    {
      key: 'citations',
      icon: cdxIconReferences,
      label: plural(summary.citations.toLocaleString('en'), summary.citations, 'citation'),
    },
  ]
  if (summary.languages > 1) {
    stats.push({ key: 'languages', icon: cdxIconLanguage, label: plural(summary.languages, summary.languages, 'language') })
  }
  if (typeof summary.visits === 'number') {
    stats.push({ key: 'visits', icon: cdxIconChart, label: plural(roughNumber.format(summary.visits), summary.visits, 'page view') })
  }
  return stats
}

/** Query params for the embed route — the numbers travel in the URL, so embeds load instantly. */
export function summaryToQuery(summary: CitationSummary, size: SummarySize): Record<string, string> {
  const query: Record<string, string> = {
    size,
    url: summary.source,
    citations: String(summary.citations),
    languages: String(summary.languages),
  }
  if (typeof summary.visits === 'number') query.visits = String(summary.visits)
  return query
}

export function summaryFromQuery(query: Record<string, unknown>): { summary: CitationSummary; size: SummarySize } {
  const int = (value: unknown) => {
    const n = Number.parseInt(String(value ?? ''), 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return {
    size: query.size === 'compact' ? 'compact' : 'detailed',
    summary: {
      source: typeof query.url === 'string' ? query.url : '',
      citations: int(query.citations) ?? 0,
      languages: int(query.languages) ?? 0,
      visits: int(query.visits),
    },
  }
}
