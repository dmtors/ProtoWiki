/**
 * Module-level state shared by the feed and article routes. The feed is built
 * from real Commons videos: it starts from a few seed articles, then grows from
 * the articles you read, like and save (and the articles they link to).
 */
import { computed, reactive } from 'vue'

import { SEED_ARTICLES, formatAgo, sameTitle, type Post, type PostKind } from './data'
import { fetchArticle, fetchArticleVideos } from './wikiApi'

interface HistoryItem {
  title: string
  verb: 'read' | 'liked' | 'saved'
}

export const state = reactive({
  posts: [] as Post[],
  liked: {} as Record<string, boolean>,
  saved: {} as Record<string, boolean>,
  hidden: {} as Record<string, boolean>,
  flagged: {} as Record<string, boolean>,
  savedArticles: {} as Record<string, boolean>,
  /** Interest weight per article (lower-cased title). */
  interests: {} as Record<string, number>,
  /** Newest first — explains why the feed picked a post. */
  history: [] as HistoryItem[],
  /** Posts in the order the feed has shown them. */
  feedOrder: [] as string[],
  feedIndex: 0,
  /** Articles whose videos have been loaded (lower-cased). */
  loadedArticles: {} as Record<string, boolean>,
  /** A post's position within its article's results — interleaves topics on ties. */
  rank: {} as Record<string, number>,
  feedLoading: false,
  createOpen: false,
  createArticle: undefined as string | undefined,
})

const key = (title: string) => title.replace(/_/g, ' ').toLowerCase()

export function postById(id: string | undefined): Post | undefined {
  return id ? state.posts.find((p) => p.id === id) : undefined
}

export const currentPost = computed(() => postById(state.feedOrder[state.feedIndex]))

function addInterest(title: string, weight: number): void {
  state.interests[key(title)] = Math.max(0, (state.interests[key(title)] ?? 0) + weight)
}

function remember(title: string, verb: HistoryItem['verb']): void {
  state.history = [{ title, verb }, ...state.history.filter((h) => !sameTitle(h.title, title))]
}

function score(post: Post): number {
  return post.articles.reduce((sum, a) => sum + (state.interests[key(a)] ?? 0), 0)
}

// — Loading real videos —

/** Add an article's Commons videos as posts (merging files already in the feed). */
export async function loadArticleVideos(title: string): Promise<Post[]> {
  const videos = await fetchArticleVideos(title).catch(() => [])
  state.loadedArticles[key(title)] = true
  return videos.map((v, i) => {
    const id = `commons:${v.file}`
    state.rank[id] = Math.min(state.rank[id] ?? i, i)
    const existing = postById(id)
    if (existing) {
      connectArticle(existing, title)
      return existing
    }
    const post: Post = {
      id,
      kind: 'video',
      author: v.author,
      caption: v.caption,
      media: v.poster,
      video: v.video,
      thumb: v.poster,
      credit: `${v.file.replace(/^File:/, '')}, Wikimedia Commons`,
      duration: v.duration,
      articles: [title],
      likes: 0,
      comments: [],
      ago: formatAgo(v.timestamp),
    }
    state.posts.push(post)
    return post
  })
}

function unseen(): Post[] {
  const seen = new Set(state.feedOrder)
  return state.posts.filter((p) => !seen.has(p.id) && !state.hidden[p.id])
}

/**
 * Keep a few unseen posts queued. Loads, in order: articles from your history,
 * seed articles, then articles linked from your history (so the feed keeps
 * finding related topics).
 */
export async function ensureFeed(minimum = 3): Promise<void> {
  if (state.feedLoading || unseen().length >= minimum) return
  state.feedLoading = true
  try {
    // First run: load every seed article at once so the feed opens varied.
    if (!state.posts.length && !state.history.length) {
      await Promise.all(SEED_ARTICLES.map((title) => loadArticleVideos(title)))
    }
    const candidates = [...state.history.map((h) => h.title), ...SEED_ARTICLES]
    for (const title of candidates) {
      if (unseen().length >= minimum) break
      if (!state.loadedArticles[key(title)]) await loadArticleVideos(title)
    }
    for (const h of state.history.length
      ? state.history
      : SEED_ARTICLES.map((title) => ({ title }))) {
      if (unseen().length >= minimum) break
      const links = (await fetchArticle(h.title).catch(() => null))?.links ?? []
      for (const link of links.filter((l) => !l.missing).slice(0, 12)) {
        if (unseen().length >= minimum) break
        if (!state.loadedArticles[key(link.title)]) await loadArticleVideos(link.title)
      }
    }
    if (!state.feedOrder.length && state.posts.length) state.feedOrder.push(pickNext())
  } finally {
    state.feedLoading = false
  }
}

/** Next post: the best match for your interests you haven't seen yet (then the least recent). */
function pickNext(): string {
  const pool = unseen()
  if (pool.length) {
    // Ties: each topic's best video first, round-robin across topics.
    return [...pool].sort(
      (a, b) => score(b) - score(a) || (state.rank[a.id] ?? 0) - (state.rank[b.id] ?? 0),
    )[0].id
  }
  const visible = state.posts.filter((p) => !state.hidden[p.id] && p.id !== currentPost.value?.id)
  const lastSeen = (id: string) => state.feedOrder.lastIndexOf(id)
  return [...visible].sort((a, b) => lastSeen(a.id) - lastSeen(b.id))[0]?.id ?? ''
}

export function peekNextId(): string {
  return state.feedOrder[state.feedIndex + 1] ?? pickNext()
}

export function nextPost(): void {
  const next = peekNextId()
  if (!next) return
  if (state.feedIndex === state.feedOrder.length - 1) state.feedOrder.push(next)
  state.feedIndex++
  ensureFeed()
}

export function previousPost(): void {
  if (state.feedIndex > 0) state.feedIndex--
}

/** "Because you saved Mount Vesuvius" — the most recent history item behind a post. */
export function postReason(post: Post): string {
  const match = state.history.find((h) => post.articles.some((a) => sameTitle(a, h.title)))
  return match ? `Because you ${match.verb} ${match.title}` : 'Popular on Wikipedia'
}

// — Actions —

export function toggleLike(post: Post): void {
  const liked = !state.liked[post.id]
  state.liked[post.id] = liked
  post.likes += liked ? 1 : -1
  post.articles.forEach((a) => addInterest(a, liked ? 1 : -1))
  if (liked) remember(post.articles[0], 'liked')
}

/** Opening an article counts as reading it, and queues its videos for the feed. */
export function recordRead(title: string): void {
  addInterest(title, 1)
  remember(title, 'read')
  if (!state.loadedArticles[key(title)]) loadArticleVideos(title)
}

export function isArticleSaved(title: string): boolean {
  return Object.entries(state.savedArticles).some(([t, on]) => on && sameTitle(t, title))
}

/**
 * Save or unsave an article. Saving pulls its videos into the feed and ranks
 * them up next. Resolves to the number of videos about it that are still unseen.
 */
export async function toggleArticleSaved(title: string): Promise<number> {
  const k = Object.keys(state.savedArticles).find((t) => sameTitle(t, title)) ?? title
  const saved = !state.savedArticles[k]
  state.savedArticles[k] = saved
  if (!saved) {
    addInterest(k, -5)
    return 0
  }
  remember(k, 'saved')
  addInterest(k, 5)
  const posts = await loadArticleVideos(k)
  const seen = new Set(state.feedOrder)
  return posts.filter((p) => !seen.has(p.id)).length
}

export function toggleSave(post: Post): boolean {
  state.saved[post.id] = !state.saved[post.id]
  return state.saved[post.id]
}

export function flagPost(post: Post): void {
  state.flagged[post.id] = true
}

/** "Show me less like this": hide the post, turn its articles down, move on. */
export function showLess(post: Post): void {
  state.hidden[post.id] = true
  post.articles.forEach((a) => addInterest(a, -2))
  if (currentPost.value?.id === post.id) {
    state.feedOrder.splice(state.feedIndex, 1)
    if (state.feedIndex >= state.feedOrder.length) {
      const next = pickNext()
      if (next) state.feedOrder.push(next)
      else state.feedIndex = Math.max(0, state.feedOrder.length - 1)
    }
    ensureFeed()
  }
}

export function addComment(post: Post, text: string): void {
  post.comments.push({ id: `c-${Date.now()}`, author: 'you', text, ago: 'now', replies: 0 })
}

export function connectArticle(post: Post, title: string): void {
  if (!post.articles.some((a) => sameTitle(a, title))) post.articles.push(title)
}

/** Bring a post on screen in the feed (e.g. tapped from an article's Video tab). */
export function focusPost(postId: string): void {
  const index = state.feedOrder.indexOf(postId)
  if (index !== -1) {
    state.feedIndex = index
    return
  }
  state.feedOrder.splice(state.feedOrder.length ? state.feedIndex + 1 : 0, 0, postId)
  state.feedIndex = state.feedOrder.indexOf(postId)
}

export function openCreate(article?: string): void {
  state.createArticle = article
  state.createOpen = true
}

export function publishPost(input: {
  kind: PostKind
  caption: string
  articles: string[]
  media: string
}): Post {
  const post: Post = {
    id: `mine-${Date.now()}`,
    kind: input.kind,
    author: 'you',
    caption: input.caption,
    media: input.media,
    thumb: input.media,
    duration: input.kind === 'photo' ? 8 : 15,
    articles: input.articles,
    likes: 0,
    comments: [],
    ago: 'now',
  }
  state.posts.push(post)
  focusPost(post.id)
  return post
}
