/**
 * Shared types and formatting for the video-first app. All media is real:
 * feed posts are Wikimedia Commons videos connected to Wikipedia articles,
 * and the Audio tab plays Commons audio files.
 */

export type PostKind = 'video' | 'photo' | 'audio'

export interface Comment {
  id: string
  author: string
  /** Plain text; `[[Title|label]]` becomes a link to that article. */
  text: string
  ago: string
  replies: number
}

export interface Post {
  id: string
  kind: PostKind
  /** Commons uploader / author (or "you" for your own posts). */
  author: string
  caption: string
  /** Full-screen frame (the poster when `video` is set). */
  media: string
  /** Playable video (Commons transcode); without it the frame shows a slow zoom. */
  video?: string
  /** Where the media comes from, shown on the post. */
  credit?: string
  /** An article image opened from its Images tab: viewer only, never queued in the feed. */
  viewerOnly?: boolean
  /** Grid thumbnail (article Video tab, Saved). */
  thumb: string
  /** Seconds — drives the playback bar for stills. */
  duration: number
  /** Connected Wikipedia articles (English titles); the first is the headline. */
  articles: string[]
  /** Likes from this session (no fake counts). */
  likes: number
  comments: Comment[]
  ago: string
}

export interface AudioRecording {
  id: string
  author: string
  title: string
  src: string
  duration: number
  ago: string
}

/** Articles the feed starts from before you've read, liked or saved anything. */
export const SEED_ARTICLES = [
  'Synthesizer',
  'Field recording',
  'Mount Vesuvius',
  'Drum machine',
  'Aurora',
  'Western honey bee',
]

export function sameTitle(a: string, b: string): boolean {
  return a.replace(/_/g, ' ').toLowerCase() === b.replace(/_/g, ' ').toLowerCase()
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/** `00:16` style, as the audio rows show it. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Compact age from an ISO timestamp: `5h`, `14d`, `3mo`, or `12/2025` once it's over a year. */
export function formatAgo(iso: string | undefined): string {
  if (!iso) return ''
  const then = new Date(iso)
  const seconds = (Date.now() - then.getTime()) / 1000
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)}d`
  if (seconds < 86400 * 365) return `${Math.round(seconds / (86400 * 30))}mo`
  return `${then.getMonth() + 1}/${then.getFullYear()}`
}
