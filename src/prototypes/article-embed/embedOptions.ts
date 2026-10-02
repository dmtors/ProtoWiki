/** Customisation options for the embed card — shared by the dialog form, the card, and the embed route. */

export type EmbedSize = 'small' | 'medium' | 'large'

export type EmbedSignal = 'reads' | 'references' | 'updated' | 'contributors' | 'sources'

export type EmbedLink = 'donate' | 'reading-list' | 'none'

export interface EmbedOptions {
  size: EmbedSize
  /** Optional trust signals, rendered in `EMBED_SIGNALS` order. */
  signals: EmbedSignal[]
  link: EmbedLink
}

export const EMBED_SIZES: { value: EmbedSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

export const EMBED_SIGNALS: { value: EmbedSignal; label: string }[] = [
  { value: 'reads', label: 'Views' },
  { value: 'references', label: 'References' },
  { value: 'updated', label: 'Last updated' },
  { value: 'contributors', label: 'Contributors' },
  { value: 'sources', label: 'Sources' },
]

export const EMBED_LINKS: { value: EmbedLink; label: string }[] = [
  { value: 'donate', label: 'Donate to Wikipedia' },
  { value: 'reading-list', label: 'Save to reading list' },
  { value: 'none', label: 'None' },
]

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = {
  size: 'medium',
  signals: ['reads', 'references'],
  link: 'reading-list',
}

/** Approximate iframe height per size (the frame can't size itself cross-origin). */
export const EMBED_FRAME_HEIGHT: Record<EmbedSize, number> = {
  small: 160,
  medium: 230,
  large: 650,
}

/** Serialise options into embed-route query params. */
export function embedOptionsToQuery(options: EmbedOptions): Record<string, string> {
  return {
    size: options.size,
    signals: options.signals.join(','),
    link: options.link,
  }
}

/** Parse embed-route query params, falling back to defaults for anything missing or invalid. */
export function embedOptionsFromQuery(query: Record<string, unknown>): EmbedOptions {
  const size = EMBED_SIZES.find((s) => s.value === query.size)?.value ?? DEFAULT_EMBED_OPTIONS.size
  const link = EMBED_LINKS.find((l) => l.value === query.link)?.value ?? DEFAULT_EMBED_OPTIONS.link
  const requested = typeof query.signals === 'string' ? query.signals.split(',') : null
  const signals = requested
    ? EMBED_SIGNALS.map((s) => s.value).filter((v) => requested.includes(v))
    : DEFAULT_EMBED_OPTIONS.signals
  return { size, signals, link }
}
