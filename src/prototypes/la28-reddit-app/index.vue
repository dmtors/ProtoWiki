<script setup lang="ts">
definePage({
  meta: {
    // title + description: ask the author, or omit
    category: 'prototype',
    platform: 'app',
  },
})

/**
 * Reddit app (faux) — a subreddit feed and post page where posts about an
 * LA28 topic carry a small Wikipedia preview that hands off to the
 * Wikipedia app. `?r=<subreddit>` picks the community, `?post=<id>` opens a
 * post, `?from=wikipedia` shows a way back to the Wikipedia app.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CdxIcon } from '@wikimedia/codex'
import {
  cdxIconAdd,
  cdxIconArrowDown,
  cdxIconArrowPrevious,
  cdxIconArrowUp,
  cdxIconBell,
  cdxIconEllipsis,
  cdxIconExpand,
  cdxIconHome,
  cdxIconPrevious,
  cdxIconPushPin,
  cdxIconSearch,
  cdxIconShareAndroid,
  cdxIconShareIOS,
  cdxIconSpeechBubble,
  cdxIconSpeechBubbles,
  cdxIconUserGroup,
} from '@wikimedia/codex-icons'

import MobileWrapper from '@/components/MobileWrapper.vue'
import { useIsIos } from '@/composables/useAppPlatform'

import {
  POSTS,
  SUBREDDITS,
  findPost,
  postsForSubreddit,
  redditPostRoute,
  redditSubredditRoute,
  wikipediaArticleRoute,
  type RedditPost,
} from '../la28-shared/data'
import { useArticleSummaries } from '../la28-shared/useArticleSummaries'
import CommentThread from './CommentThread.vue'
import WikipediaEmbed from './WikipediaEmbed.vue'
import WikipediaSheet from './WikipediaSheet.vue'

const route = useRoute()
const router = useRouter()
const isIos = useIsIos()

function queryString(key: string): string | undefined {
  const value = route.query[key]
  return typeof value === 'string' && value.length ? value : undefined
}

const subredditId = computed(() => {
  const id = queryString('r')
  return id && SUBREDDITS[id] ? id : 'olympics'
})
const subreddit = computed(() => SUBREDDITS[subredditId.value])
const post = computed(() => {
  const id = queryString('post')
  return id ? findPost(id) : undefined
})
const fromWikipedia = computed(() => queryString('from') === 'wikipedia')
const feed = computed(() => postsForSubreddit(subredditId.value))

const summaries = useArticleSummaries(() =>
  POSTS.filter((p) => p.article).map((p) => p.article!),
)

const shareIcon = computed(() => (isIos.value ? cdxIconShareIOS : cdxIconShareAndroid))
const backIcon = computed(() => (isIos.value ? cdxIconPrevious : cdxIconArrowPrevious))

// Scroll to top when moving between feed and post.
const mainRef = ref<HTMLElement | null>(null)
watch(
  () => route.fullPath,
  () => mainRef.value?.scrollTo({ top: 0 }),
)

function openPost(p: RedditPost): void {
  router.push(redditPostRoute(p))
}

function goBack(): void {
  if (post.value && !fromWikipedia.value) {
    router.push(redditSubredditRoute(subredditId.value))
  } else {
    router.back()
  }
}

const showBack = computed(() => Boolean(post.value) || fromWikipedia.value)

// Votes (local only)
const votes = reactive<Record<string, 1 | -1 | 0>>({})
function vote(id: string, dir: 1 | -1): void {
  votes[id] = votes[id] === dir ? 0 : dir
}

// Wikipedia preview sheet
const sheetPost = ref<RedditPost | null>(null)
function openSheet(p: RedditPost): void {
  sheetPost.value = p
}
function openInWikipedia(p: RedditPost): void {
  sheetPost.value = null
  router.push(wikipediaArticleRoute(p.article!))
}

const joined = ref(false)

const NAV = [
  { id: 'home', label: 'Home', icon: cdxIconHome },
  { id: 'communities', label: 'Communities', icon: cdxIconUserGroup },
  { id: 'create', label: 'Create', icon: cdxIconAdd },
  { id: 'chat', label: 'Chat', icon: cdxIconSpeechBubbles },
  { id: 'inbox', label: 'Inbox', icon: cdxIconBell },
]
</script>

<template>
  <MobileWrapper>
    <div
      class="rd"
      :style="{ '--rd-accent': subreddit.color }"
    >
      <!-- iOS-style "back to app" breadcrumb after a hand-off from Wikipedia -->
      <button
        v-if="fromWikipedia && isIos"
        type="button"
        class="rd__breadcrumb"
        @click="router.back()"
      >
        <CdxIcon
          :icon="cdxIconPrevious"
          size="x-small"
        />
        Wikipedia
      </button>

      <header class="rd__top">
        <button
          v-if="showBack"
          type="button"
          class="rd__icon-btn"
          aria-label="Back"
          @click="goBack"
        >
          <CdxIcon :icon="backIcon" />
        </button>
        <span
          v-else
          class="rd__logo"
        >
          <span class="rd__wordmark">reddit</span>
        </span>

        <span
          v-if="post"
          class="rd__top-title"
        >
          <span
            class="rd__sub-icon rd__sub-icon--small"
            aria-hidden="true"
          >r/</span>
          r/{{ subreddit.name }}
        </span>
        <span
          v-else
          class="rd__top-spacer"
        />

        <button
          type="button"
          class="rd__icon-btn"
          aria-label="Search"
        >
          <CdxIcon :icon="cdxIconSearch" />
        </button>
        <button
          type="button"
          class="rd__icon-btn"
          aria-label="More"
        >
          <CdxIcon :icon="cdxIconEllipsis" />
        </button>
        <span
          class="rd__me"
          aria-label="Your profile"
        />
      </header>

      <main
        ref="mainRef"
        class="rd__main"
      >
        <!-- ───────────── Post page ───────────── -->
        <article
          v-if="post"
          class="rd-post-page"
        >
          <div class="rd-post__meta">
            <span
              class="rd__sub-icon"
              aria-hidden="true"
            >r/</span>
            <span class="rd-post__meta-lines">
              <strong>r/{{ subreddit.name }}</strong>
              <span>u/{{ post.author }} · {{ post.age }}</span>
            </span>
          </div>
          <span
            v-if="post.flair"
            class="rd-flair"
          >{{ post.flair }}</span>
          <h1 class="rd-post-page__title">
            {{ post.title }}
          </h1>
          <p
            v-if="post.body"
            class="rd-post-page__body"
          >
            {{ post.body }}
          </p>

          <WikipediaEmbed
            v-if="post.article"
            variant="full"
            :title="post.article"
            :summary="summaries[post.article]"
            :fallback-description="post.articleDescriptionFallback"
            @preview="openSheet(post)"
            @read="openInWikipedia(post)"
          />

          <div class="rd-actions">
            <span
              class="rd-pill rd-vote"
              :class="{
                'rd-vote--up': votes[post.id] === 1,
                'rd-vote--down': votes[post.id] === -1,
              }"
            >
              <button
                type="button"
                aria-label="Upvote"
                @click="vote(post.id, 1)"
              ><CdxIcon
                :icon="cdxIconArrowUp"
                size="small"
              /></button>
              {{ post.upvotes }}
              <button
                type="button"
                aria-label="Downvote"
                @click="vote(post.id, -1)"
              ><CdxIcon
                :icon="cdxIconArrowDown"
                size="small"
              /></button>
            </span>
            <span class="rd-pill">
              <CdxIcon
                :icon="cdxIconSpeechBubble"
                size="small"
              />
              {{ post.comments }}
            </span>
            <span class="rd-pill">
              <CdxIcon
                :icon="shareIcon"
                size="small"
              />
              Share
            </span>
          </div>

          <div class="rd-comments">
            <div class="rd-comments__sort">
              Sort by: <strong>Best</strong>
              <CdxIcon
                :icon="cdxIconExpand"
                size="x-small"
              />
            </div>
            <div class="rd-comments__add">
              Join the conversation
            </div>
            <CommentThread
              v-for="(comment, index) in post.topComments ?? []"
              :key="index"
              :comment="comment"
            />
          </div>
        </article>

        <!-- ───────────── Subreddit feed ───────────── -->
        <template v-else>
          <section class="rd-community">
            <div class="rd-community__banner" />
            <div class="rd-community__row">
              <span
                class="rd__sub-icon rd__sub-icon--large"
                aria-hidden="true"
              >r/</span>
              <span class="rd-community__name">
                <strong>r/{{ subreddit.name }}</strong>
                <small>{{ subreddit.members }} members · <span class="rd-community__online" /> {{ subreddit.online }} online</small>
              </span>
              <button
                type="button"
                class="rd-join"
                :class="{ 'rd-join--joined': joined }"
                @click="joined = !joined"
              >
                {{ joined ? 'Joined' : 'Join' }}
              </button>
            </div>
            <p class="rd-community__description">
              {{ subreddit.description }}
            </p>
          </section>

          <div class="rd-sort">
            Hot
            <CdxIcon
              :icon="cdxIconExpand"
              size="x-small"
            />
          </div>

          <article
            v-for="p in feed"
            :key="p.id"
            class="rd-post"
            role="link"
            tabindex="0"
            @click="openPost(p)"
            @keydown.enter="openPost(p)"
          >
            <div class="rd-post__meta rd-post__meta--feed">
              <span>u/{{ p.author }} · {{ p.age }}</span>
              <CdxIcon
                v-if="p.pinned"
                class="rd-post__pin"
                :icon="cdxIconPushPin"
                size="x-small"
              />
            </div>
            <span
              v-if="p.flair"
              class="rd-flair"
            >{{ p.flair }}</span>
            <h2 class="rd-post__title">
              {{ p.title }}
            </h2>
            <p
              v-if="p.body"
              class="rd-post__body"
            >
              {{ p.body }}
            </p>

            <WikipediaEmbed
              v-if="p.article"
              :title="p.article"
              :summary="summaries[p.article]"
              :fallback-description="p.articleDescriptionFallback"
              @preview="openSheet(p)"
            />

            <div
              class="rd-actions"
              @click.stop
            >
              <span
                class="rd-pill rd-vote"
                :class="{
                  'rd-vote--up': votes[p.id] === 1,
                  'rd-vote--down': votes[p.id] === -1,
                }"
              >
                <button
                  type="button"
                  aria-label="Upvote"
                  @click="vote(p.id, 1)"
                ><CdxIcon
                  :icon="cdxIconArrowUp"
                  size="small"
                /></button>
                {{ p.upvotes }}
                <button
                  type="button"
                  aria-label="Downvote"
                  @click="vote(p.id, -1)"
                ><CdxIcon
                  :icon="cdxIconArrowDown"
                  size="small"
                /></button>
              </span>
              <button
                type="button"
                class="rd-pill"
                @click="openPost(p)"
              >
                <CdxIcon
                  :icon="cdxIconSpeechBubble"
                  size="small"
                />
                {{ p.comments }}
              </button>
              <span class="rd-pill">
                <CdxIcon
                  :icon="shareIcon"
                  size="small"
                />
                Share
              </span>
            </div>
          </article>
        </template>
      </main>

      <nav class="rd__nav">
        <button
          v-for="item in NAV"
          :key="item.id"
          type="button"
          class="rd__nav-item"
          :class="{ 'rd__nav-item--active': item.id === 'home' }"
        >
          <CdxIcon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <WikipediaSheet
        :open="sheetPost !== null"
        :title="sheetPost?.article ?? ''"
        :summary="sheetPost?.article ? summaries[sheetPost.article] : undefined"
        :fallback-description="sheetPost?.articleDescriptionFallback"
        @close="sheetPost = null"
        @open-app="sheetPost && openInWikipedia(sheetPost)"
      />
    </div>
  </MobileWrapper>
</template>

<style scoped>
.rd {
  --rd-orange: #ff4500;
  --rd-blue: #0a449b;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--background-color-base, #fff);
  color: var(--color-base, #202122);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
}

button {
  font: inherit;
  color: inherit;
}

.rd .cdx-icon {
  color: currentColor;
}

/* Breadcrumb + top bar */

.rd__breadcrumb {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 12px 0;
  border: 0;
  background: none;
  color: var(--color-progressive, #36c);
  font-size: 0.75rem;
  cursor: pointer;
}

.rd__top {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-color-muted, #dadde3);
}

.rd__logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.rd__wordmark {
  color: var(--rd-orange);
  font-size: 1.375rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.rd__top-title {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-weight: 700;
}

.rd__top-spacer {
  flex: 1 1 auto;
}

.rd__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.rd__icon-btn:hover {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.rd__me {
  width: 30px;
  height: 30px;
  margin-inline-start: 4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb000, var(--rd-orange));
}

.rd__sub-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--rd-accent);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 800;
}

.rd__sub-icon--small {
  width: 24px;
  height: 24px;
  font-size: 0.625rem;
}

.rd__sub-icon--large {
  width: 56px;
  height: 56px;
  margin-top: -20px;
  border: 3px solid var(--background-color-base, #fff);
  font-size: 1.125rem;
}

/* Main */

.rd__main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* Community header */

.rd-community__banner {
  height: 64px;
  background:
    radial-gradient(circle at 20% 120%, rgba(255, 255, 255, 0.25) 0 30%, transparent 31%),
    linear-gradient(120deg, var(--rd-accent), color-mix(in srgb, var(--rd-accent) 55%, #000));
}

.rd-community__row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 0 16px;
}

.rd-community__name {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  padding-top: 8px;
}

.rd-community__name strong {
  font-size: 1.125rem;
}

.rd-community__name small {
  color: var(--color-subtle, #54595d);
  font-size: 0.75rem;
}

.rd-community__online {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #46d160;
}

.rd-community__description {
  margin: 10px 16px 12px;
  color: var(--color-subtle, #54595d);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.rd-join {
  padding: 6px 16px;
  border: 0;
  border-radius: 999px;
  background-color: var(--rd-blue);
  color: #fff !important;
  font-weight: 700;
  cursor: pointer;
}

.rd-join--joined {
  border: 1px solid var(--border-color-base, #a2a9b1);
  background: none;
  color: var(--color-base, #202122) !important;
}

.rd-sort {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-block: 1px solid var(--border-color-muted, #dadde3);
  color: var(--color-subtle, #54595d);
  font-size: 0.8125rem;
  font-weight: 700;
}

/* Feed posts */

.rd-post {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 6px solid var(--background-color-neutral-subtle, #f8f9fa);
  cursor: pointer;
}

.rd-post__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-subtle, #54595d);
  font-size: 0.75rem;
}

.rd-post__meta-lines {
  display: flex;
  flex-direction: column;
}

.rd-post__meta-lines strong {
  color: var(--color-base, #202122);
  font-size: 0.8125rem;
}

.rd-post__pin {
  color: #46a758 !important;
}

.rd-flair {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--rd-accent) 14%, transparent);
  color: var(--color-base, #202122);
  font-size: 0.6875rem;
  font-weight: 700;
}

.rd-post__title {
  margin: 0;
  font-family: inherit;
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  border: 0;
  padding: 0;
}

.rd-post__body {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-subtle, #54595d);
  font-size: 0.875rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

/* Action pills */

.rd-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rd-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}

.rd-vote {
  gap: 4px;
  padding: 0 4px;
}

.rd-vote button {
  display: inline-flex;
  padding: 4px;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.rd-vote--up {
  background-color: var(--rd-orange);
  color: #fff;
}

.rd-vote--down {
  background-color: #6a5cff;
  color: #fff;
}

/* Post page */

.rd-post-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 24px;
}

.rd-post-page__title {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
}

.rd-post-page__body {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.rd-comments {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color-muted, #dadde3);
}

.rd-comments__sort {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-subtle, #54595d);
  font-size: 0.8125rem;
}

.rd-comments__add {
  padding: 10px 16px;
  border-radius: 999px;
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
  color: var(--color-subtle, #54595d);
  font-size: 0.875rem;
}

/* Bottom nav */

.rd__nav {
  display: flex;
  justify-content: space-around;
  padding: 6px 4px 10px;
  border-top: 1px solid var(--border-color-muted, #dadde3);
  background-color: var(--background-color-base, #fff);
}

.rd__nav-item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--color-subtle, #54595d);
  font-size: 0.6875rem;
  cursor: pointer;
}

.rd__nav-item--active {
  color: var(--color-base, #202122);
  font-weight: 700;
}
</style>
