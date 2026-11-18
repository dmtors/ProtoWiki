<script setup lang="ts">
/**
 * "Most talked about on Reddit" — a home feed section that surfaces the
 * Reddit conversations getting the most attention around a cultural event,
 * each paired with a preview of the Wikipedia article behind it.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { CdxButton, CdxIcon, CdxThumbnail } from '@wikimedia/codex'
import { cdxIconArrowNext, cdxIconLinkExternal, cdxIconSpeechBubbles } from '@wikimedia/codex-icons'

import FeedSectionHeader from '../template-app-home/FeedSectionHeader.vue'
import {
  EVENT,
  SUBREDDITS,
  TALKED_ABOUT,
  redditPostRoute,
  redditSubredditRoute,
  wikipediaArticleRoute,
  type RedditPost,
} from '../la28-shared/data'
import { useArticleSummaries } from '../la28-shared/useArticleSummaries'

const router = useRouter()

const posts = TALKED_ABOUT.slice(0, 5)
const summaries = useArticleSummaries(() => posts.map((post) => post.article!))

function subredditName(post: RedditPost): string {
  return `r/${SUBREDDITS[post.subreddit]?.name ?? post.subreddit}`
}

function description(post: RedditPost): string {
  return summaries[post.article!]?.description || post.articleDescriptionFallback || ''
}

const activeIndex = ref(0)
const scroller = ref<HTMLElement | null>(null)

function onScroll(): void {
  const el = scroller.value
  const first = el?.firstElementChild as HTMLElement | null
  if (!el || !first) return
  const step = first.offsetWidth + 12
  activeIndex.value = Math.min(posts.length - 1, Math.round(el.scrollLeft / step))
}

function scrollTo(index: number): void {
  const el = scroller.value
  const card = el?.children[index] as HTMLElement | undefined
  if (!el || !card) return
  el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: 'smooth' })
}
</script>

<template>
  <section
    class="la28-talked"
    aria-labelledby="la28-talked-heading"
  >
    <div class="la28-talked__event">
      <span class="la28-talked__event-dot" />
      {{ EVENT.name }} · {{ EVENT.dayLabel }}
    </div>

    <FeedSectionHeader
      id="la28-talked-heading"
      heading="Most talked about on Reddit"
      description="The conversations everyone is having, and the articles behind them."
    />

    <ol
      ref="scroller"
      class="la28-talked__scroller"
      @scroll.passive="onScroll"
    >
      <li
        v-for="(post, index) in posts"
        :key="post.id"
        class="la28-talked__card"
      >
        <!-- The Reddit conversation -->
        <a
          class="la28-talked__thread"
          :href="redditPostRoute(post, 'wikipedia')"
          @click.prevent="router.push(redditPostRoute(post, 'wikipedia'))"
        >
          <span class="la28-talked__thread-meta">
            <span class="la28-talked__rank">{{ index + 1 }}</span>
            <span class="la28-talked__subreddit">{{ subredditName(post) }}</span>
            <span class="la28-talked__dot">·</span>
            <CdxIcon
              :icon="cdxIconSpeechBubbles"
              size="small"
            />
            <span>{{ post.comments }}</span>
          </span>
          <span class="la28-talked__thread-title">“{{ post.title }}”</span>
        </a>

        <!-- The article preview -->
        <a
          class="la28-talked__article"
          :href="wikipediaArticleRoute(post.article!)"
          @click.prevent="router.push(wikipediaArticleRoute(post.article!))"
        >
          <span class="la28-talked__article-head">
            <CdxThumbnail
              v-if="summaries[post.article!] === undefined || summaries[post.article!]?.thumbnailUrl"
              class="la28-talked__thumb"
              :thumbnail="summaries[post.article!]?.thumbnailUrl ? { url: summaries[post.article!]!.thumbnailUrl! } : null"
            />
            <span class="la28-talked__article-text">
              <span class="la28-talked__article-title">
                {{ summaries[post.article!]?.displayTitle ?? post.article }}
              </span>
              <span
                v-if="description(post)"
                class="la28-talked__article-description"
              >{{ description(post) }}</span>
            </span>
          </span>
          <span
            v-if="summaries[post.article!] === undefined"
            class="la28-talked__extract la28-talked__extract--loading"
          />
          <span
            v-else-if="summaries[post.article!]?.extract"
            class="la28-talked__extract"
          >{{ summaries[post.article!]!.extract }}</span>
        </a>

        <div class="la28-talked__actions">
          <CdxButton
            action="progressive"
            weight="primary"
            @click="router.push(wikipediaArticleRoute(post.article!))"
          >
            Read article
          </CdxButton>
          <CdxButton @click="router.push(redditPostRoute(post, 'wikipedia'))">
            Open in Reddit
            <CdxIcon
              :icon="cdxIconLinkExternal"
              size="small"
            />
          </CdxButton>
        </div>
      </li>
    </ol>

    <div
      class="la28-talked__dots"
      aria-hidden="true"
    >
      <button
        v-for="(post, index) in posts"
        :key="post.id"
        type="button"
        tabindex="-1"
        class="la28-talked__page-dot"
        :class="{ 'la28-talked__page-dot--active': index === activeIndex }"
        @click="scrollTo(index)"
      />
    </div>

    <CdxButton
      class="la28-talked__more"
      action="progressive"
      weight="quiet"
      @click="router.push(redditSubredditRoute('olympics', 'wikipedia'))"
    >
      More LA28 conversations on Reddit
      <CdxIcon :icon="cdxIconArrowNext" />
    </CdxButton>
  </section>
</template>

<style scoped>
.la28-talked {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100, 16px);
}

.la28-talked__event {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--spacing-50, 8px);
  margin-bottom: calc(-1 * var(--spacing-50, 8px));
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
  font-weight: var(--font-weight-bold, 700);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.la28-talked__event-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--border-radius-circle, 50%);
  background-color: var(--color-destructive, #bf3c2c);
  animation: la28-pulse 1.6s ease-in-out infinite;
}

@keyframes la28-pulse {
  50% {
    opacity: 0.35;
  }
}

/* Horizontal carousel that bleeds to the screen edges with a peek of the next card. */
.la28-talked__scroller {
  display: flex;
  gap: var(--spacing-75, 12px);
  margin: 0 calc(-1 * var(--spacing-150, 24px));
  padding: 0 var(--spacing-150, 24px);
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--spacing-150, 24px);
  scrollbar-width: none;
}

.la28-talked__scroller::-webkit-scrollbar {
  display: none;
}

.la28-talked__card {
  display: flex;
  flex: 0 0 86%;
  flex-direction: column;
  gap: var(--spacing-75, 12px);
  margin: 0;
  padding: var(--spacing-100, 16px);
  scroll-snap-align: start;
  border: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  border-radius: var(--border-radius-medium, 4px);
  background-color: var(--background-color-base, #fff);
}

/* Reddit thread */

.la28-talked__thread {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50, 8px);
  color: inherit;
  text-decoration: none;
}

.la28-talked__thread-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
}

.la28-talked__thread-meta .cdx-icon {
  color: var(--color-subtle, #54595d);
}

.la28-talked__rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  margin-inline-end: var(--spacing-25, 4px);
  border: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  border-radius: var(--border-radius-base, 2px);
  color: var(--color-base, #202122);
  font-size: var(--font-size-x-small, 0.75rem);
  font-weight: var(--font-weight-bold, 700);
}

.la28-talked__subreddit {
  color: var(--color-base, #202122);
  font-weight: var(--font-weight-bold, 700);
}

.la28-talked__thread-title {
  display: -webkit-box;
  min-height: calc(2 * 1.4em);
  overflow: hidden;
  color: var(--color-base, #202122);
  font-size: var(--font-size-medium, 1rem);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Article preview */

.la28-talked__article {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50, 8px);
  padding: var(--spacing-75, 12px);
  border-radius: 12px;
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
  color: inherit;
  text-decoration: none;
}

.la28-talked__article-head {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-75, 12px);
}

.la28-talked__thumb {
  flex-shrink: 0;
}

.la28-talked__thumb :deep(.cdx-thumbnail__image),
.la28-talked__thumb :deep(.cdx-thumbnail__placeholder) {
  width: 3.5rem;
  height: 3.5rem;
  border: 0;
  border-radius: 8px;
}

.la28-talked__article-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-12, 2px);
  min-width: 0;
}

.la28-talked__article-title {
  color: var(--color-base, #202122);
  font-family: var(--font-family-serif, 'Linux Libertine', Georgia, serif);
  font-size: var(--font-size-x-large, 1.25rem);
  line-height: 1.25;
}

.la28-talked__article-description {
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 0.875rem);
  line-height: 1.35;
}

.la28-talked__extract {
  display: -webkit-box;
  min-height: calc(3 * 1.5em);
  overflow: hidden;
  color: var(--color-base, #202122);
  font-size: var(--font-size-small, 0.875rem);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.la28-talked__extract--loading {
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-disabled-subtle, #eaecf0);
}

.la28-talked__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-50, 8px);
  margin-top: auto;
}

.la28-talked__actions .cdx-button {
  flex: 1 1 auto;
  border-radius: 999px;
}

/* Page dots */

.la28-talked__dots {
  display: flex;
  justify-content: center;
  gap: var(--spacing-50, 8px);
  margin-top: calc(-1 * var(--spacing-25, 4px));
}

.la28-talked__page-dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: var(--border-radius-circle, 50%);
  background-color: var(--border-color-subtle, #c8ccd1);
  cursor: pointer;
}

.la28-talked__page-dot--active {
  background-color: var(--color-progressive, #36c);
}

.la28-talked__more {
  width: 100%;
  justify-content: flex-start;
  margin-top: calc(-1 * var(--spacing-50, 8px));
}
</style>
