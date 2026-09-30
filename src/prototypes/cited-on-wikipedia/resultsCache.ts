import type { Citation } from './citations'

/** Completed checks, keyed by normalised source URL — repeat checks render instantly. */

// v2: rows carry Wikidata IDs for grouping — v1 entries would render ungrouped.
const PREFIX = 'protowiki:cited-on-wikipedia:v2:'
const TTL_MS = 24 * 60 * 60 * 1000

export interface CachedCheck {
  savedAt: number
  wikisTotal: number
  truncated: boolean
  rows: Citation[]
}

const memory = new Map<string, CachedCheck>()

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadCachedCheck(key: string): CachedCheck | null {
  let entry = memory.get(key) ?? null
  if (!entry) {
    try {
      const raw = storage()?.getItem(PREFIX + key)
      entry = raw ? (JSON.parse(raw) as CachedCheck) : null
    } catch {
      entry = null
    }
  }
  if (!entry || Date.now() - entry.savedAt > TTL_MS) return null
  memory.set(key, entry)
  return entry
}

export function saveCachedCheck(key: string, entry: Omit<CachedCheck, 'savedAt'>): void {
  const full: CachedCheck = { ...entry, savedAt: Date.now(), rows: JSON.parse(JSON.stringify(entry.rows)) }
  memory.set(key, full)
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(full))
  } catch {
    // Quota or blocked storage — the in-memory copy still covers this session.
  }
}
