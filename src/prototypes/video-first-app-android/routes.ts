/** Route base for the Android prototype's screens. */
export const BASE = '/video-first-app-android'

export function articlePath(
  title: string,
  tab?: string,
): { path: string; query: Record<string, string> } {
  return { path: `${BASE}/article`, query: tab ? { title, tab } : { title } }
}
