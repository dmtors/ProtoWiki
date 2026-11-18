/**
 * Shared fixture data for the LA28 Wikipedia × Reddit prototypes
 * (`la28-wikipedia-app` and `la28-reddit-app`).
 *
 * Wikipedia articles are real (summaries are fetched live). Reddit
 * communities, posts, usernames, comments and counts are invented for the
 * prototype — LA28 hasn't happened yet.
 *
 * This folder has no `index.vue`, so it is not a route.
 */

export const EVENT = {
  name: 'LA28 Olympics',
  shortName: 'LA28',
  /** Story-world "today" for the prototype. */
  dayLabel: 'Day 6',
}

export interface Subreddit {
  id: string
  /** Display name without the `r/` prefix. */
  name: string
  members: string
  online: string
  /** Accent used for the community icon and banner. */
  color: string
  description: string
}

export const SUBREDDITS: Record<string, Subreddit> = {
  olympics: {
    id: 'olympics',
    name: 'olympics',
    members: '4.1M',
    online: '38K',
    color: '#0081c8',
    description: 'Everything about the Olympic Games. LA28 megathreads pinned daily.',
  },
  cricket: {
    id: 'cricket',
    name: 'Cricket',
    members: '2.6M',
    online: '61K',
    color: '#1d7a46',
    description: 'News, discussion and highlights from the world of cricket.',
  },
  trackandfield: {
    id: 'trackandfield',
    name: 'trackandfield',
    members: '512K',
    online: '9.4K',
    color: '#c2410c',
    description: 'Sprints, distance, jumps, throws. All things athletics.',
  },
  nfl: {
    id: 'nfl',
    name: 'nfl',
    members: '12M',
    online: '44K',
    color: '#013369',
    description: 'The place to discuss all NFL related things.',
  },
  swimming: {
    id: 'swimming',
    name: 'Swimming',
    members: '380K',
    online: '3.1K',
    color: '#0e7490',
    description: 'For swimmers of every level and fans of the sport.',
  },
}

export interface Comment {
  author: string
  age: string
  score: string
  body: string
  replies?: Comment[]
}

export interface RedditPost {
  id: string
  subreddit: string
  author: string
  age: string
  title: string
  body?: string
  flair?: string
  upvotes: string
  comments: string
  /** Wikipedia article this post is about — drives the embedded preview. */
  article?: string
  /** Short description to use when the article has none on Wikidata. */
  articleDescriptionFallback?: string
  /** Rank in the "Most talked about" widget; omit to keep it out. */
  talkRank?: number
  pinned?: boolean
  topComments?: Comment[]
}

export const POSTS: RedditPost[] = [
  {
    id: 'cricket-returns',
    subreddit: 'cricket',
    author: 'cover_drive_99',
    age: '2h',
    flair: 'LA28',
    title: 'Cricket is back at the Olympics for the first time since 1900. Who else is up at 4am watching?',
    body: 'Never thought I would see an Olympic cricket match in my lifetime. The crowd is massive and half of it seems to have flown in from Mumbai.',
    upvotes: '21.3K',
    comments: '4.8K',
    article: 'Cricket at the 2028 Summer Olympics',
    talkRank: 1,
    topComments: [
      {
        author: 'silly_mid_off',
        age: '2h',
        score: '3.1K',
        body: 'The last time this happened it was a two-day match between Great Britain and France. T20 is a slightly different vibe.',
        replies: [
          {
            author: 'leg_glance',
            age: '1h',
            score: '1.2K',
            body: 'Just read the Wikipedia page on that 1900 match. Only two teams entered. Wild.',
          },
        ],
      },
      {
        author: 'night_watchman',
        age: '1h',
        score: '842',
        body: 'Alarm set for every group match. My manager has been warned.',
      },
    ],
  },
  {
    id: 'coliseum-third',
    subreddit: 'olympics',
    author: 'figueroa_and_exposition',
    age: '4h',
    flair: 'Venues',
    title: 'The Coliseum is hosting its third Olympics. 1932, 1984, and now 2028. What a building.',
    body: 'Walked past it this morning and there were people taking photos of the peristyle like it was the Eiffel Tower. Is any other stadium even close to this?',
    upvotes: '18.4K',
    comments: '1.2K',
    article: 'Los Angeles Memorial Coliseum',
    talkRank: 2,
    topComments: [
      {
        author: 'olympic_flame_fan',
        age: '3h',
        score: '2.4K',
        body: 'First stadium ever to host three Summer Olympics. The torch above the peristyle being lit again is going to get me.',
      },
      {
        author: 'usc_lurker',
        age: '3h',
        score: '611',
        body: 'Fun fact: it was built as a memorial to World War I veterans.',
      },
    ],
  },
  {
    id: 'lyles-home-games',
    subreddit: 'trackandfield',
    author: 'hundred_metre_hopeful',
    age: '5h',
    flair: 'Sprints',
    title: 'Noah Lyles at a home Olympics is the most Noah Lyles thing imaginable. Predictions for the 100m?',
    upvotes: '12.9K',
    comments: '3.4K',
    article: 'Noah Lyles',
    talkRank: 3,
    topComments: [
      {
        author: 'block_start',
        age: '4h',
        score: '1.9K',
        body: 'The pre-race showmanship alone is worth the ticket price.',
      },
      {
        author: 'photo_finish_cam',
        age: '4h',
        score: '1.1K',
        body: 'Home crowd is going to be deafening. I think the 200m is the one to watch though.',
      },
    ],
  },
  {
    id: 'flag-football-roster',
    subreddit: 'nfl',
    author: 'two_hand_touch',
    age: '6h',
    flair: 'Olympics',
    title: 'Flag football makes its Olympic debut this week. Which NFL players do you think actually make the roster?',
    upvotes: '9.8K',
    comments: '2.1K',
    article: 'Flag football at the 2028 Summer Olympics',
    articleDescriptionFallback: 'New Olympic sport at LA28',
    talkRank: 4,
    topComments: [
      {
        author: 'redzone_regular',
        age: '5h',
        score: '1.4K',
        body: 'Five on five, no contact. Speed matters more than size, so expect a lot of receivers and DBs.',
      },
    ],
  },
  {
    id: 'ledecky-fifth',
    subreddit: 'swimming',
    author: 'lane_four_life',
    age: '8h',
    flair: 'Appreciation',
    title: 'Katie Ledecky at her fifth Olympics. Appreciation thread.',
    body: 'London, Rio, Tokyo, Paris, and now LA. Whatever happens in the 800 free, we are watching one of the greatest to ever do it.',
    upvotes: '8.1K',
    comments: '640',
    article: 'Katie Ledecky',
    talkRank: 5,
    topComments: [
      {
        author: 'flip_turn_freddie',
        age: '7h',
        score: '902',
        body: 'Her 800 free consistency over 16 years is honestly hard to comprehend.',
      },
    ],
  },
  {
    id: 'gout-gout-next',
    subreddit: 'olympics',
    author: 'brisbane_bound',
    age: '9h',
    flair: 'Athletics',
    title: 'Gout Gout at 20 is already being compared to Bolt. Is the hype fair?',
    upvotes: '6.4K',
    comments: '980',
    article: 'Gout Gout',
    talkRank: 6,
    topComments: [
      {
        author: 'wind_legal',
        age: '8h',
        score: '744',
        body: 'Let him run. The comparisons are a lot of pressure for someone this young.',
      },
    ],
  },

  // Community posts without a Wikipedia embed — keep the feeds feeling real.
  {
    id: 'olympics-daily-thread',
    subreddit: 'olympics',
    author: 'AutoModerator',
    age: '11h',
    pinned: true,
    flair: 'Megathread',
    title: 'LA28 Day 6 daily discussion thread',
    body: 'Schedule, results and live chat for today. Please keep spoilers in this thread.',
    upvotes: '2.2K',
    comments: '14K',
  },
  {
    id: 'olympics-pin-trading',
    subreddit: 'olympics',
    author: 'pin_collector_la',
    age: '3h',
    flair: 'Fan zone',
    title: 'Pin trading at Venice Beach got intense today. Show me your best LA28 pins',
    upvotes: '3.7K',
    comments: '412',
  },
  {
    id: 'cricket-match-thread',
    subreddit: 'cricket',
    author: 'AutoModerator',
    age: '6h',
    pinned: true,
    flair: 'Match thread',
    title: 'Match thread: Olympic T20, men’s group stage',
    upvotes: '1.9K',
    comments: '9.2K',
  },
  {
    id: 'tf-heat-sheets',
    subreddit: 'trackandfield',
    author: 'split_timer',
    age: '7h',
    title: 'Heat sheets for tomorrow’s session are out. Some brutal draws in the 400m',
    upvotes: '2.8K',
    comments: '356',
  },
  {
    id: 'nfl-sunday-gripe',
    subreddit: 'nfl',
    author: 'preseason_pessimist',
    age: '3h',
    title: 'Training camp is open and somehow I care more about Olympic flag football',
    upvotes: '4.4K',
    comments: '701',
  },
  {
    id: 'swim-pool-tour',
    subreddit: 'swimming',
    author: 'chlorine_hair',
    age: '5h',
    title: 'Got a look at the temporary Olympic pool. The scale is unreal',
    upvotes: '1.6K',
    comments: '138',
  },
]

/** Posts that feed the Wikipedia app's "Most talked about on Reddit" widget, in rank order. */
export const TALKED_ABOUT = POSTS.filter((post) => post.talkRank !== undefined).sort(
  (a, b) => (a.talkRank ?? 0) - (b.talkRank ?? 0),
)

export function postsForSubreddit(subreddit: string): RedditPost[] {
  const posts = POSTS.filter((post) => post.subreddit === subreddit)
  return [...posts.filter((p) => p.pinned), ...posts.filter((p) => !p.pinned)]
}

export function findPost(id: string): RedditPost | undefined {
  return POSTS.find((post) => post.id === id)
}

// Routes between the two prototypes.

export const WIKIPEDIA_APP_ROUTE = '/la28-wikipedia-app'
export const REDDIT_APP_ROUTE = '/la28-reddit-app'

export function wikipediaArticleRoute(title: string): string {
  return `/template-app-article?article=${encodeURIComponent(title)}&lang=en`
}

/** `from` marks a hand-off from another app, so the Reddit screen can offer a way back. */
export function redditPostRoute(post: RedditPost, from?: 'wikipedia'): string {
  const base = `${REDDIT_APP_ROUTE}?r=${post.subreddit}&post=${post.id}`
  return from ? `${base}&from=${from}` : base
}

export function redditSubredditRoute(subreddit: string, from?: 'wikipedia'): string {
  const base = `${REDDIT_APP_ROUTE}?r=${subreddit}`
  return from ? `${base}&from=${from}` : base
}
