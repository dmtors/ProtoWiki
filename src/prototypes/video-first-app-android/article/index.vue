<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  cdxIconArrowPrevious,
  cdxIconArticleSearch,
  cdxIconArticle,
  cdxIconBookmark,
  cdxIconBookmarkOutline,
  cdxIconImage,
  cdxIconLink,
  cdxIconMapPin,
  cdxIconPlay,
  cdxIconTextSummary,
  cdxIconVolumeUp,
} from '@wikimedia/codex-icons'
import type { Icon } from '@wikimedia/codex-icons'

import AndroidShell from '../AndroidShell.vue'
import AudioList from '../AudioList.vue'
import CodexSvg from '../CodexSvg.vue'
import M3FloatingToolbar from '../M3FloatingToolbar.vue'
import { BASE, articlePath } from '../routes'
import { showSnackbar } from '../snackbar'
import { saveArticle } from '../useSaveArticle'
import PlacesMap from '../../video-first-app/PlacesMap.vue'
import { formatAgo, type AudioRecording } from '../../video-first-app/data'
import {
  articleVideoPosts,
  isArticleSaved,
  loadArticleVideos,
  openCreate,
  recordRead,
} from '../../video-first-app/store'
import {
  fetchArticle,
  fetchArticleAudio,
  fetchImages,
  fetchPageThumbs,
  fetchPlaces,
  type ArticleImage,
  type ArticlePlace,
  type ParsedArticle,
} from '../../video-first-app/wikiApi'

type Tab = 'info' | 'read' | 'video' | 'images' | 'audio' | 'places' | 'links'

const route = useRoute()
const router = useRouter()

const title = computed(() => {
  const value = route.query.title
  return typeof value === 'string' && value.trim() ? value : 'Teenage Engineering'
})

const TABS: { id: Tab; label: string; icon: Icon }[] = [
  { id: 'info', label: 'Info', icon: cdxIconTextSummary },
  { id: 'read', label: 'Read', icon: cdxIconArticle },
  { id: 'video', label: 'Video', icon: cdxIconPlay },
  { id: 'images', label: 'Images', icon: cdxIconImage },
  { id: 'audio', label: 'Audio', icon: cdxIconVolumeUp },
  { id: 'places', label: 'Places', icon: cdxIconMapPin },
  { id: 'links', label: 'Links', icon: cdxIconLink },
]

// — Article (text, infobox, links) —

const article = ref<ParsedArticle | null>(null)
const articleState = ref<'loading' | 'ready' | 'error'>('loading')
const bodyHtml = ref('')

async function loadArticle(): Promise<void> {
  articleState.value = 'loading'
  try {
    article.value = await fetchArticle(title.value)
    bodyHtml.value = article.value.bodyHtml
    articleState.value = 'ready'
  } catch {
    articleState.value = 'error'
  }
}

const headerTitle = computed(() => article.value?.title ?? title.value)

/** Whether the article has an infobox (null while it loads). */
const hasInfo = computed<boolean | null>(() =>
  article.value ? Boolean(article.value.info.length || article.value.infoImage) : null,
)

/** Info only appears in the toolbar for articles with an infobox (kept while loading). */
const visibleTabs = computed(() => TABS.filter((t) => t.id !== 'info' || hasInfo.value !== false))

/** Explicit `?tab=` wins (unless it's Info and there's none); otherwise Info when there's an infobox, else Read. */
const tab = computed<Tab>(() => {
  const value = route.query.tab
  if (visibleTabs.value.some((t) => t.id === value)) return value as Tab
  return hasInfo.value === false ? 'read' : 'info'
})

/** Two-way binding for the floating toolbar; writing it records the tab in the URL. */
const selectedTab = computed({
  get: () => tab.value as string,
  set: (next: string) => {
    if (next !== tab.value) router.replace({ query: { ...route.query, tab: next } })
  },
})

/*
 * Swiping left / right steps through the toolbar's tabs (Android's tab swipe).
 * Vertical scrolling stays native (`touch-action: pan-y`); a drag counts once
 * it's mostly horizontal and long enough. The map and anything that scrolls
 * sideways (wide tables) keep their own horizontal drags.
 */
const SWIPE_DISTANCE = 56
const swipeDirection = ref<'next' | 'previous'>('next')
let swipeStart: { x: number; y: number; id: number } | null = null
let suppressClick = false

function scrollsSideways(target: EventTarget | null): boolean {
  for (
    let el = target as HTMLElement | null;
    el && !el.classList?.contains('vfa-article');
    el = el.parentElement
  ) {
    if (el.classList?.contains('vfa-places__map')) return true
    const overflow = getComputedStyle(el).overflowX
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth)
      return true
  }
  return false
}

function onSwipeStart(e: PointerEvent): void {
  if (!e.isPrimary || e.button !== 0 || scrollsSideways(e.target)) return
  swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId }
}

function onSwipeEnd(e: PointerEvent): void {
  if (!swipeStart || e.pointerId !== swipeStart.id) return
  const dx = e.clientX - swipeStart.x
  const dy = e.clientY - swipeStart.y
  swipeStart = null
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
  const tabs = visibleTabs.value
  const index = tabs.findIndex((t) => t.id === tab.value)
  const next = tabs[index + (dx < 0 ? 1 : -1)]
  if (!next) return
  // A mouse drag ends in a click; don't let it open a link.
  suppressClick = true
  setTimeout(() => (suppressClick = false), 0)
  selectedTab.value = next.id
}

function onSwipeCancel(): void {
  swipeStart = null
}

function onSwipeClick(e: MouseEvent): void {
  if (!suppressClick) return
  e.preventDefault()
  e.stopPropagation()
}

/** Toolbar taps slide in from the side of the tab they move toward, like a swipe would. */
watch(tab, (next, previous) => {
  const ids = visibleTabs.value.map((t) => t.id)
  swipeDirection.value = ids.indexOf(next) >= ids.indexOf(previous) ? 'next' : 'previous'
})

function goBack(): void {
  if (window.history.state?.back) router.back()
  else router.push(BASE)
}

/** Article links inside rendered text carry `data-title`. */
function onTextClick(e: MouseEvent): void {
  const link = (e.target as HTMLElement).closest<HTMLElement>('[data-title]')
  if (!link) return
  e.preventDefault()
  if (link.classList.contains('vf-link--missing')) {
    showSnackbar(`“${link.dataset.title}” doesn’t have an article yet`)
    return
  }
  router.push(articlePath(link.dataset.title!))
}

// — Videos and audio (real Commons media) —

const videoPosts = computed(() => articleVideoPosts(title.value))
const videosLoading = ref(false)

async function loadVideos(): Promise<void> {
  videosLoading.value = true
  await loadArticleVideos(title.value)
  videosLoading.value = false
}

/** Open a video full-screen among the article's other videos, with a way back. */
function openPost(id: string): void {
  router.push({ path: `${BASE}/videos`, query: { title: title.value, post: id } })
}

const recordings = ref<AudioRecording[]>([])
const audioState = ref<'idle' | 'loading' | 'error'>('idle')
const audioFor = ref('')

async function loadAudio(): Promise<void> {
  audioState.value = 'loading'
  try {
    recordings.value = (await fetchArticleAudio(title.value)).map((a) => ({
      id: a.file,
      author: a.author,
      title: a.title,
      src: a.src,
      duration: a.duration,
      ago: formatAgo(a.timestamp),
    }))
    audioFor.value = title.value
    audioState.value = 'idle'
  } catch {
    audioState.value = 'error'
  }
}

// — Link thumbnails (each linked article's page image) —

const linkThumbs = ref<Record<string, string | null>>({})

async function loadLinkThumbs(): Promise<void> {
  const parsed = article.value ?? (await fetchArticle(title.value).catch(() => null))
  if (!parsed) return
  const titles = parsed.links.filter((l) => !l.missing).map((l) => l.title)
  linkThumbs.value = { ...linkThumbs.value, ...(await fetchPageThumbs(titles)) }
}

// — Show a link in context —
//
// From the Links tab: jump to where the link first appears (the Read text, or
// the infobox if that's the only place), scroll it into view and flash it.

/** Link targets (as stored, HTML-escaped) in a chunk of rendered text. */
function linkTargets(html: string): Set<string> {
  return new Set([...html.matchAll(/data-title="([^"]*)"/g)].map((m) => m[1]))
}

const readTargets = computed(() => linkTargets(bodyHtml.value))
const infoTargets = computed(() =>
  linkTargets((article.value?.info ?? []).map((row) => row.html).join(' ')),
)

/** The view that shows a link (Read text first, else the infobox); null when neither does. */
function whereInArticle(linkTitle: string): Tab | null {
  // Rendered text stores titles HTML-escaped (see wikiApi.inlineHtml).
  const target = escapeHtml(linkTitle)
  if (readTargets.value.has(target)) return 'read'
  return hasInfo.value && infoTargets.value.has(target) ? 'info' : null
}

async function showInArticle(linkTitle: string): Promise<void> {
  const selector = `[data-title="${CSS.escape(linkTitle)}"]`
  const target = whereInArticle(linkTitle)
  if (!target) {
    showSnackbar('That link isn’t in the article text')
    return
  }
  selectedTab.value = target
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  const panel = document.querySelector(target === 'read' ? '.vfa-read' : '.vfa-info')
  const link = panel?.querySelector<HTMLElement>(selector)
  if (!link) return
  // Centre it, so it sits clear of the header above and the toolbar below.
  link.scrollIntoView({ block: 'center', behavior: 'smooth' })
  link.classList.remove('vfa-link--found')
  void link.offsetWidth // restart the highlight if it's shown again
  link.classList.add('vfa-link--found')
  link.addEventListener('animationend', () => link.classList.remove('vfa-link--found'), {
    once: true,
  })
}

// — Images —

const images = ref<ArticleImage[]>([])
const imagesState = ref<'idle' | 'loading' | 'error'>('idle')

/** Open an image full-screen in the post viewer, among the article's other images. */
function openImage(image: ArticleImage): void {
  router.push({ path: `${BASE}/images`, query: { title: title.value, file: image.file } })
}

async function loadImages(): Promise<void> {
  imagesState.value = 'loading'
  try {
    images.value = await fetchImages(title.value)
    imagesState.value = 'idle'
  } catch {
    imagesState.value = 'error'
  }
}

// — Places —

const places = ref<ArticlePlace[]>([])
const placesState = ref<'idle' | 'loading' | 'error'>('idle')
const selectedPlace = ref<string | null>(null)
const map = ref<InstanceType<typeof PlacesMap> | null>(null)

const selectedPlaceInfo = computed(
  () => places.value.find((p) => p.title === selectedPlace.value) ?? null,
)

async function loadPlaces(): Promise<void> {
  placesState.value = 'loading'
  selectedPlace.value = null
  try {
    places.value = await fetchPlaces(title.value)
    placesState.value = 'idle'
  } catch {
    placesState.value = 'error'
  }
}

watch(
  title,
  (t) => {
    images.value = []
    places.value = []
    article.value = null
    loadArticle()
    recordRead(t)
  },
  { immediate: true },
)

watch(
  [tab, title],
  ([t]) => {
    if (t === 'images' && !images.value.length) loadImages()
    if (t === 'places' && !places.value.length) loadPlaces()
    // Places are linked articles: their cards reuse the Links thumbnails.
    if (t === 'places') loadLinkThumbs()
    if (t === 'video') loadVideos()
    if (t === 'audio' && audioFor.value !== title.value) loadAudio()
    if (t === 'links') loadLinkThumbs()
  },
  { immediate: true },
)

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<template>
  <AndroidShell
    :create-article="headerTitle"
    overlay-header
  >
    <template #header>
      <header class="vfa-appbar">
        <md-icon-button
          aria-label="Back"
          @click="goBack"
        >
          <CodexSvg :icon="cdxIconArrowPrevious" />
        </md-icon-button>
        <h1 class="vfa-appbar__title md-typescale-title-large vfa-serif">
          {{ headerTitle }}
        </h1>
        <md-icon-button
          :aria-label="isArticleSaved(headerTitle) ? 'Remove from saved' : 'Save article'"
          :selected="isArticleSaved(headerTitle)"
          @click="saveArticle(headerTitle)"
        >
          <CodexSvg
            :icon="isArticleSaved(headerTitle) ? cdxIconBookmark : cdxIconBookmarkOutline"
          />
        </md-icon-button>
      </header>
    </template>

    <template #toolbar>
      <M3FloatingToolbar
        v-model="selectedTab"
        :items="visibleTabs"
        label="Article views"
      />
    </template>

    <div
      class="vfa-article"
      :class="[`vfa-article--${tab}`, `vfa-article--from-${swipeDirection}`]"
      @click="onTextClick"
      @click.capture="onSwipeClick"
      @pointerdown="onSwipeStart"
      @pointerup="onSwipeEnd"
      @pointercancel="onSwipeCancel"
    >
      <md-linear-progress
        v-if="
          (['info', 'read', 'links'].includes(tab) && articleState === 'loading') ||
            (tab === 'images' && imagesState === 'loading') ||
            (tab === 'audio' && audioState === 'loading') ||
            (tab === 'places' && placesState === 'loading') ||
            (tab === 'video' && videosLoading && !videoPosts.length)
        "
        class="vfa-article__loading"
        indeterminate
        aria-label="Loading"
      />

      <!-- Info -->
      <section
        v-if="tab === 'info' && article"
        class="vfa-pad"
        aria-label="Info"
      >
        <img
          v-if="article.infoImage"
          class="vfa-info__image"
          :class="`vfa-info__image--${article.infoImageKind}`"
          :src="article.infoImage"
          alt=""
        >
        <dl
          v-if="article.info.length"
          class="vfa-info"
        >
          <div
            v-for="row in article.info"
            :key="row.label"
          >
            <dt class="md-typescale-label-large">
              {{ row.label }}
            </dt>
            <!-- eslint-disable vue/no-v-html -- sanitised in wikiApi.fetchArticle -->
            <dd
              class="md-typescale-body-large"
              v-html="row.html"
            />
            <!-- eslint-enable vue/no-v-html -->
          </div>
        </dl>
      </section>

      <!-- Read -->
      <!-- eslint-disable vue/no-v-html -- sanitised in wikiApi.fetchArticle -->
      <section
        v-if="tab === 'read' && article"
        class="vfa-pad vfa-read"
        aria-label="Read"
        v-html="bodyHtml"
      />
      <!-- eslint-enable vue/no-v-html -->

      <!-- Video -->
      <section
        v-if="tab === 'video'"
        class="vfa-pad"
        aria-label="Video"
      >
        <template v-if="videoPosts.length">
          <h2 class="vfa-count md-typescale-title-medium">
            {{ plural(videoPosts.length, 'video', 'videos') }}
          </h2>
          <div class="vfa-grid vfa-grid--tall">
            <button
              v-for="post in videoPosts"
              :key="post.id"
              type="button"
              class="vfa-tile"
              :aria-label="`Video by ${post.author}: ${post.caption}`"
              @click="openPost(post.id)"
            >
              <md-ripple />
              <md-focus-ring />
              <img
                :src="post.thumb"
                alt=""
                loading="lazy"
              >
            </button>
          </div>
        </template>
        <div
          v-else-if="!videosLoading"
          class="vfa-empty"
        >
          <p class="md-typescale-body-large">
            Wikimedia Commons has no videos about this article yet.
          </p>
          <md-filled-tonal-button @click="openCreate(headerTitle)">
            Make the first video
          </md-filled-tonal-button>
        </div>
      </section>

      <!-- Images -->
      <section
        v-if="tab === 'images' && imagesState === 'idle'"
        class="vfa-pad"
        aria-label="Images"
      >
        <h2 class="vfa-count md-typescale-title-medium">
          {{ plural(images.length, 'image', 'images') }}
        </h2>
        <div class="vfa-grid">
          <button
            v-for="img in images"
            :key="img.file"
            type="button"
            class="vfa-tile"
            :aria-label="img.caption || img.file.replace(/^File:/, '')"
            @click="openImage(img)"
          >
            <md-ripple />
            <md-focus-ring />
            <img
              :src="img.thumb"
              alt=""
              loading="lazy"
            >
          </button>
        </div>
      </section>

      <!-- Audio -->
      <section
        v-if="tab === 'audio' && audioState === 'idle'"
        aria-label="Audio"
      >
        <h2 class="vfa-count vfa-pad-x md-typescale-title-medium">
          {{ plural(recordings.length, 'recording', 'recordings') }}
        </h2>
        <AudioList
          v-if="recordings.length"
          :recordings="recordings"
        />
        <div
          v-else
          class="vfa-empty vfa-pad"
        >
          <p class="md-typescale-body-large">
            Wikimedia Commons has no audio about this article yet.
          </p>
          <md-filled-tonal-button @click="openCreate(headerTitle)">
            Record the first one
          </md-filled-tonal-button>
        </div>
      </section>

      <!-- Places -->
      <section
        v-if="tab === 'places'"
        class="vfa-places"
        aria-label="Places"
      >
        <div class="vfa-places__header">
          <h2 class="vfa-count md-typescale-title-medium">
            {{ placesState === 'loading' ? 'Places' : plural(places.length, 'place', 'places') }}
          </h2>
          <md-text-button
            @click="
              () => {
                selectedPlace = null
                map?.fit()
              }
            "
          >
            Show all
          </md-text-button>
        </div>
        <div class="vfa-places__stage">
          <PlacesMap
            v-if="placesState === 'idle'"
            ref="map"
            class="vfa-places__map"
            :places="places"
            :selected="selectedPlace"
            :callout="false"
            @select="selectedPlace = $event"
          />
          <!-- The selected place: open its article, or find it in this one. -->
          <Transition name="vfa-place">
            <md-list
              v-if="selectedPlaceInfo"
              :key="selectedPlaceInfo.title"
              class="vfa-place"
            >
              <md-elevation />
              <md-list-item
                type="button"
                @click="router.push(articlePath(selectedPlaceInfo.title))"
              >
                <img
                  v-if="linkThumbs[selectedPlaceInfo.linkTitle]"
                  slot="start"
                  class="vfa-links__thumb"
                  :src="linkThumbs[selectedPlaceInfo.linkTitle]!"
                  alt=""
                >
                <span
                  v-else
                  slot="start"
                  class="vfa-links__thumb vfa-links__thumb--empty"
                >
                  <CodexSvg :icon="cdxIconImage" />
                </span>
                <span slot="headline">{{ selectedPlaceInfo.title }}</span>
                <span
                  v-if="selectedPlaceInfo.description"
                  slot="supporting-text"
                >{{
                  selectedPlaceInfo.description
                }}</span>
                <md-icon-button
                  v-if="whereInArticle(selectedPlaceInfo.linkTitle)"
                  slot="end"
                  :aria-label="`Show “${selectedPlaceInfo.title}” in the article`"
                  :title="'Show in article'"
                  @click.stop="showInArticle(selectedPlaceInfo.linkTitle)"
                >
                  <CodexSvg :icon="cdxIconArticleSearch" />
                </md-icon-button>
              </md-list-item>
            </md-list>
          </Transition>
        </div>
      </section>

      <!-- Links -->
      <section
        v-if="tab === 'links' && article"
        aria-label="Links"
      >
        <h2 class="vfa-count vfa-pad-x md-typescale-title-medium">
          {{ plural(article.links.length, 'link', 'links') }}
        </h2>
        <md-list class="vfa-links">
          <md-list-item
            v-for="link in article.links"
            :key="link.title"
            type="button"
            :class="{ 'vfa-links__missing': link.missing }"
            @click="
              link.missing
                ? showSnackbar(`“${link.title}” doesn’t have an article yet`)
                : router.push(articlePath(link.title))
            "
          >
            <img
              v-if="linkThumbs[link.title]"
              slot="start"
              class="vfa-links__thumb"
              :src="linkThumbs[link.title]!"
              alt=""
              loading="lazy"
            >
            <span
              v-else
              slot="start"
              class="vfa-links__thumb vfa-links__thumb--empty"
            >
              <CodexSvg :icon="cdxIconImage" />
            </span>
            <span slot="headline">{{ link.label }}</span>
            <md-icon-button
              v-if="whereInArticle(link.title)"
              slot="end"
              :aria-label="`Show “${link.label}” in the article`"
              :title="'Show in article'"
              @click.stop="showInArticle(link.title)"
            >
              <CodexSvg :icon="cdxIconArticleSearch" />
            </md-icon-button>
          </md-list-item>
        </md-list>
      </section>

      <p
        v-if="articleState === 'error' && ['info', 'read', 'links'].includes(tab)"
        class="vfa-pad md-typescale-body-large"
      >
        Couldn’t load this article.
      </p>
    </div>
  </AndroidShell>
</template>

<style scoped>
/* M3 small top app bar: 64dp, title-large, icon actions. */
.vfa-appbar {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: var(--vfa-top-bar);
  padding: var(--vfa-top-inset) var(--vfa-icon-edge) 0;
}

.vfa-appbar__title {
  flex: 1;
  min-width: 0;
  margin: 0 0 0 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.vfa-article {
  position: relative;
  min-height: 100%;
  /* Content starts below the overlay header and scrolls up behind it. */
  padding-top: var(--vfa-top-bar);
  /* Room for the floating toolbar over the last row. */
  padding-bottom: 80px;
  box-sizing: border-box;
  /* Vertical scrolling stays native; horizontal drags switch tabs. */
  touch-action: pan-y;
}

/* Each view slides in from the side it was swiped (or tapped) toward. */
.vfa-article > section {
  animation: vfa-tab-in 220ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-article--from-previous > section {
  animation-name: vfa-tab-in-previous;
}

@keyframes vfa-tab-in {
  from {
    opacity: 0;
    transform: translateX(32px);
  }
}

@keyframes vfa-tab-in-previous {
  from {
    opacity: 0;
    transform: translateX(-32px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vfa-article > section {
    animation: none;
  }
}

.vfa-article__loading {
  position: absolute;
  inset: var(--vfa-top-bar) 0 auto;
}

.vfa-pad {
  padding: 16px var(--vfa-gutter);
}

.vfa-pad-x {
  padding-inline: var(--vfa-gutter);
}

.vfa-count {
  margin: 16px 0 12px;
}

.vfa-pad > .vfa-count:first-child {
  margin-top: 0;
}

.vfa-muted {
  color: var(--md-sys-color-on-surface-variant);
}

/* Info */

.vfa-info__image {
  display: block;
  margin-bottom: 24px;
}

.vfa-info__image--logo {
  max-width: 50%;
  max-height: 48px;
}

.vfa-info__image--photo {
  width: 100%;
  max-height: 32rem;
  object-fit: cover;
  border-radius: var(--vfa-shape-large);
}

.vfa-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
}

.vfa-info dt {
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-info dd {
  margin: 2px 0 0;
}

/* Read */

.vfa-read :deep(p),
.vfa-read :deep(li) {
  margin: 0 0 16px;
  font: var(--md-sys-typescale-body-large-weight, 400) 1rem / 1.5rem var(--md-ref-typeface-plain);
  letter-spacing: 0.03125rem;
}

.vfa-read :deep(li) {
  margin-bottom: 4px;
}

.vfa-read :deep(ul),
.vfa-read :deep(ol) {
  margin: 0 0 16px;
  padding-inline-start: 24px;
}

.vfa-read :deep(h3) {
  margin: 24px 0 8px;
  font: 700 1rem / 1.5rem var(--md-ref-typeface-brand);
  letter-spacing: 0.009375rem;
}

/* Grids: 3 columns, M3 medium (12dp) corners */

.vfa-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.vfa-tile {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--vfa-shape-medium);
  background-color: var(--md-sys-color-surface-container-highest);
  cursor: pointer;
  --md-focus-ring-shape: 12px;
}

.vfa-grid--tall .vfa-tile {
  aspect-ratio: 9 / 16;
}

.vfa-tile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vfa-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.vfa-empty p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}

/* Places: map fills the screen */

.vfa-article--places {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 0;
}

.vfa-places {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.vfa-places__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px var(--vfa-icon-edge) 8px var(--vfa-gutter);
}

.vfa-places__header .vfa-count {
  margin: 0;
}

.vfa-places__stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.vfa-places__map {
  height: 100%;
}

/* Selected-place card: floats over the map, just above the article toolbar. */
.vfa-place {
  position: absolute;
  right: 16px;
  bottom: 80px;
  left: 16px;
  padding: 0;
  border-radius: var(--vfa-shape-large);
  overflow: hidden;
  --md-list-container-color: var(--md-sys-color-surface-container-low);
  --md-elevation-level: 2;
  --md-list-item-leading-space: 16px;
  --md-list-item-supporting-text-color: var(--md-sys-color-on-surface-variant);
}

.vfa-place-enter-active {
  transition:
    transform 300ms var(--vfa-ease-emphasized-decelerate),
    opacity 300ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-place-leave-active {
  transition:
    transform 150ms var(--vfa-ease-emphasized-accelerate),
    opacity 150ms var(--vfa-ease-emphasized-accelerate);
}

.vfa-place-enter-from,
.vfa-place-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

/* Links */

.vfa-links {
  --md-list-container-color: transparent;
  --md-list-item-leading-icon-color: var(--md-sys-color-on-surface-variant);
  --md-list-item-label-text-color: var(--md-sys-color-primary);
}

.vfa-links__thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--vfa-shape-small);
}

/*
 * Compact rows: M3's 40dp leading image makes a one-line item 56dp. A trailing
 * 48dp icon button needs the top / bottom space trimmed to 4dp to fit that.
 */
.vfa-links md-list-item {
  --md-list-item-top-space: 4px;
  --md-list-item-bottom-space: 4px;
}

.vfa-links .vfa-links__thumb {
  width: 40px;
  height: 40px;
}

.vfa-links__thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-links__missing {
  --md-list-item-label-text-color: var(--md-sys-color-error);
}
</style>
