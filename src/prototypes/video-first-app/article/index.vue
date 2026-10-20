<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CdxButton,
  CdxDialog,
  CdxIcon,
  CdxMessage,
  CdxProgressBar,
  useToast,
} from '@wikimedia/codex'
import {
  cdxIconArrowPrevious,
  cdxIconArticle,
  cdxIconBookmark,
  cdxIconBookmarkOutline,
  cdxIconEdit,
  cdxIconImage,
  cdxIconLink,
  cdxIconLinkExternal,
  cdxIconMapPin,
  cdxIconPlay,
  cdxIconTextSummary,
  cdxIconVolumeUp,
} from '@wikimedia/codex-icons'
import type { Icon } from '@wikimedia/codex-icons'

import AudioList from '../AudioList.vue'
import { formatAgo, sameTitle, type AudioRecording } from '../data'
import EditSectionDialog from '../EditSectionDialog.vue'
import PlacesMap from '../PlacesMap.vue'
import PostThumb from '../PostThumb.vue'
import {
  focusPost,
  isArticleSaved,
  loadArticleVideos,
  openCreate,
  recordRead,
  state,
} from '../store'
import { useSaveArticle } from '../useSaveArticle'
import VfShell from '../VfShell.vue'
import {
  fetchArticle,
  fetchArticleAudio,
  fetchImages,
  fetchPlaces,
  type ArticleImage,
  type ArticlePlace,
  type ParsedArticle,
} from '../wikiApi'

type Tab = 'info' | 'read' | 'video' | 'images' | 'audio' | 'places' | 'links'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const saveArticle = useSaveArticle()

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

/** Explicit `?tab=` wins; otherwise Info when the article has an infobox, else Read. */
const tab = computed<Tab>(() => {
  const value = route.query.tab
  if (TABS.some((t) => t.id === value)) return value as Tab
  if (!article.value) return 'info'
  return article.value.info.length || article.value.infoImage ? 'info' : 'read'
})

function setTab(next: Tab): void {
  router.replace({ query: { ...route.query, tab: next } })
}

function goBack(): void {
  if (window.history.state?.back) router.back()
  else router.push('/video-first-app')
}

function openArticle(next: string): void {
  router.push({ query: { title: next } })
}

/** Article links inside rendered text carry `data-title`. */
function onTextClick(e: MouseEvent): void {
  const link = (e.target as HTMLElement).closest<HTMLElement>('[data-title]')
  if (!link) return
  e.preventDefault()
  if (link.classList.contains('vf-link--missing')) {
    toast.show({
      message: `“${link.dataset.title}” doesn’t have an article yet`,
      autoDismiss: true,
    })
    return
  }
  openArticle(link.dataset.title!)
}

// — Article text, info and links (one live fetch) —

const article = ref<ParsedArticle | null>(null)
const articleState = ref<'loading' | 'ready' | 'error'>('loading')
/** Body after any local edit. */
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

// — Connected posts and recordings —

const videoPosts = computed(() =>
  state.posts.filter(
    (p) => !state.hidden[p.id] && p.articles.some((a) => sameTitle(a, title.value)),
  ),
)
const videosState = ref<'idle' | 'loading'>('idle')

async function loadVideos(): Promise<void> {
  videosState.value = 'loading'
  await loadArticleVideos(title.value)
  videosState.value = 'idle'
}

const recordings = ref<AudioRecording[]>([])
const audioState = ref<'idle' | 'loading' | 'error'>('idle')
const audioLoadedFor = ref('')

async function loadAudio(): Promise<void> {
  audioState.value = 'loading'
  try {
    const audio = await fetchArticleAudio(title.value)
    recordings.value = audio.map((a) => ({
      id: a.file,
      author: a.author,
      title: a.title,
      src: a.src,
      duration: a.duration,
      ago: formatAgo(a.timestamp),
    }))
    audioLoadedFor.value = title.value
    audioState.value = 'idle'
  } catch {
    audioState.value = 'error'
  }
}

function openPost(id: string): void {
  focusPost(id)
  router.push('/video-first-app')
}

// — Images —

const images = ref<ArticleImage[]>([])
const imagesState = ref<'idle' | 'loading' | 'error'>('idle')
const viewer = ref<ArticleImage | null>(null)
const viewerOpen = computed({
  get: () => viewer.value !== null,
  set: (open: boolean) => {
    if (!open) viewer.value = null
  },
})

async function loadImages(): Promise<void> {
  imagesState.value = 'loading'
  try {
    images.value = await fetchImages(title.value)
    imagesState.value = 'idle'
  } catch {
    imagesState.value = 'error'
  }
}

function commonsPage(file: string): string {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.replace(/ /g, '_'))}`
}

// — Places —

const places = ref<ArticlePlace[]>([])
const placesState = ref<'idle' | 'loading' | 'error'>('idle')
const selectedPlace = ref<string | null>(null)
const map = ref<InstanceType<typeof PlacesMap> | null>(null)

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

function showAllPlaces(): void {
  selectedPlace.value = null
  map.value?.fit()
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
    if (t === 'video') loadVideos()
    if (t === 'audio' && audioLoadedFor.value !== title.value) loadAudio()
  },
  { immediate: true },
)

// — Editing (introduction, local only) —

const editOpen = ref(false)
const editing = computed(() => ({ title: 'Introduction', text: article.value?.introText ?? '' }))

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

function onPublish(text: string): void {
  const firstHeading = bodyHtml.value.indexOf('<h3>')
  const rest = firstHeading === -1 ? '' : bodyHtml.value.slice(firstHeading)
  const intro = text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<p>${escapeHtml(t)}</p>`)
    .join('')
  bodyHtml.value = intro + rest
  if (article.value) article.value = { ...article.value, introText: text }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<template>
  <VfShell :create-article="headerTitle">
    <template #header>
      <div class="vf-article-header">
        <CdxButton
          weight="quiet"
          aria-label="Back"
          @click="goBack"
        >
          <CdxIcon :icon="cdxIconArrowPrevious" />
        </CdxButton>
        <CdxButton
          weight="quiet"
          :aria-label="isArticleSaved(headerTitle) ? 'Remove from saved' : 'Save article'"
          :aria-pressed="isArticleSaved(headerTitle)"
          @click="saveArticle(headerTitle)"
        >
          <CdxIcon :icon="isArticleSaved(headerTitle) ? cdxIconBookmark : cdxIconBookmarkOutline" />
        </CdxButton>
        <h1 class="vf-article-header__title">
          {{ headerTitle }}
        </h1>
        <CdxButton
          weight="quiet"
          aria-label="Edit article"
          :disabled="articleState !== 'ready'"
          @click="editOpen = true"
        >
          <CdxIcon :icon="cdxIconEdit" />
        </CdxButton>
      </div>
    </template>

    <template #float>
      <nav
        class="vf-tabs"
        role="tablist"
        aria-label="Article views"
      >
        <CdxButton
          v-for="t in TABS"
          :key="t.id"
          weight="quiet"
          role="tab"
          class="vf-tabs__tab"
          :class="{ 'vf-tabs__tab--active': tab === t.id }"
          :aria-selected="tab === t.id"
          :aria-label="t.label"
          :title="t.label"
          @click="setTab(t.id)"
        >
          <CdxIcon :icon="t.icon" />
        </CdxButton>
      </nav>
    </template>

    <div
      class="vf-article"
      :class="`vf-article--${tab}`"
      @click="onTextClick"
    >
      <template v-if="tab === 'info' || tab === 'read' || tab === 'links'">
        <CdxProgressBar
          v-if="articleState === 'loading'"
          inline
          aria-label="Loading article"
        />
        <CdxMessage
          v-else-if="articleState === 'error'"
          type="error"
        >
          Couldn’t load this article.
        </CdxMessage>
      </template>

      <!-- Info: the infobox as label / value pairs -->
      <section
        v-if="tab === 'info' && article"
        role="tabpanel"
        aria-label="Info"
      >
        <img
          v-if="article.infoImage"
          class="vf-info__image"
          :class="`vf-info__image--${article.infoImageKind}`"
          :src="article.infoImage"
          alt=""
        >
        <dl
          v-if="article.info.length"
          class="vf-info"
        >
          <div
            v-for="row in article.info"
            :key="row.label"
            class="vf-info__row"
          >
            <dt>{{ row.label }}</dt>
            <!-- eslint-disable-next-line vue/no-v-html -- sanitised in wikiApi.inlineHtml -->
            <dd v-html="row.html" />
          </div>
        </dl>
        <p
          v-else
          class="vf-article__muted"
        >
          This article has no infobox.
        </p>
      </section>

      <!-- Read: text only -->
      <!-- eslint-disable vue/no-v-html -- sanitised in wikiApi.fetchArticle -->
      <section
        v-if="tab === 'read' && article"
        role="tabpanel"
        aria-label="Read"
        class="vf-read"
        v-html="bodyHtml"
      />
      <!-- eslint-enable vue/no-v-html -->

      <!-- Video -->
      <section
        v-if="tab === 'video'"
        role="tabpanel"
        aria-label="Video"
      >
        <CdxProgressBar
          v-if="videosState === 'loading' && !videoPosts.length"
          inline
          aria-label="Loading videos"
        />
        <h2
          v-else
          class="vf-article__count"
        >
          {{ plural(videoPosts.length, 'video', 'videos') }}
        </h2>
        <div
          v-if="videoPosts.length"
          class="vf-article__grid"
        >
          <PostThumb
            v-for="post in videoPosts"
            :key="post.id"
            :post="post"
            @select="openPost(post.id)"
          />
        </div>
        <template v-else-if="videosState !== 'loading'">
          <p class="vf-article__muted">
            Wikimedia Commons has no videos about this article yet.
          </p>
          <CdxButton
            action="progressive"
            @click="openCreate(headerTitle)"
          >
            Make the first video
          </CdxButton>
        </template>
      </section>

      <!-- Images -->
      <section
        v-if="tab === 'images'"
        role="tabpanel"
        aria-label="Images"
      >
        <CdxProgressBar
          v-if="imagesState === 'loading'"
          inline
          aria-label="Loading images"
        />
        <CdxMessage
          v-else-if="imagesState === 'error'"
          type="error"
        >
          Couldn’t load images.
        </CdxMessage>
        <template v-else>
          <h2 class="vf-article__count">
            {{ plural(images.length, 'image', 'images') }}
          </h2>
          <div class="vf-article__grid">
            <button
              v-for="img in images"
              :key="img.file"
              type="button"
              class="vf-article__image"
              :aria-label="img.caption || img.file.replace(/^File:/, '')"
              @click="viewer = img"
            >
              <img
                :src="img.thumb"
                alt=""
                loading="lazy"
              >
            </button>
          </div>
        </template>
      </section>

      <!-- Audio -->
      <section
        v-if="tab === 'audio'"
        role="tabpanel"
        aria-label="Audio"
      >
        <CdxProgressBar
          v-if="audioState === 'loading'"
          inline
          aria-label="Loading audio"
        />
        <CdxMessage
          v-else-if="audioState === 'error'"
          type="error"
        >
          Couldn’t load audio.
        </CdxMessage>
        <template v-else>
          <h2 class="vf-article__count">
            {{ plural(recordings.length, 'audio recording', 'audio recordings') }}
          </h2>
          <AudioList
            v-if="recordings.length"
            :recordings="recordings"
          />
          <template v-else>
            <p class="vf-article__muted">
              Wikimedia Commons has no audio about this article yet.
            </p>
            <CdxButton
              action="progressive"
              @click="openCreate(headerTitle)"
            >
              Record the first one
            </CdxButton>
          </template>
        </template>
      </section>

      <!-- Places -->
      <section
        v-if="tab === 'places'"
        role="tabpanel"
        aria-label="Places"
        class="vf-places"
      >
        <div class="vf-places__header">
          <h2 class="vf-article__count">
            {{ placesState === 'loading' ? 'Places' : plural(places.length, 'place', 'places') }}
          </h2>
          <CdxButton
            weight="quiet"
            class="vf-places__all"
            @click="showAllPlaces"
          >
            Show all
          </CdxButton>
        </div>
        <CdxProgressBar
          v-if="placesState === 'loading'"
          inline
          aria-label="Loading places"
        />
        <CdxMessage
          v-else-if="placesState === 'error'"
          type="error"
        >
          Couldn’t load places.
        </CdxMessage>
        <PlacesMap
          v-else
          ref="map"
          class="vf-places__map"
          :places="places"
          :selected="selectedPlace"
          @select="selectedPlace = $event"
          @open="openArticle"
        />
      </section>

      <!-- Links -->
      <section
        v-if="tab === 'links' && article"
        role="tabpanel"
        aria-label="Links"
      >
        <h2 class="vf-article__count">
          {{ plural(article.links.length, 'link', 'links') }}
        </h2>
        <ul class="vf-links">
          <li
            v-for="link in article.links"
            :key="link.title"
          >
            <a
              href="#"
              :data-title="link.title"
              :class="{ 'vf-link--missing': link.missing }"
            >{{
              link.label
            }}</a>
          </li>
        </ul>
      </section>
    </div>

    <EditSectionDialog
      v-model:open="editOpen"
      :section="editing"
      @publish="onPublish"
    />

    <CdxDialog
      v-model:open="viewerOpen"
      class="video-first-app__sheet"
      :title="viewer?.file.replace(/^File:/, '') ?? ''"
      :use-close-button="true"
    >
      <template v-if="viewer">
        <img
          :src="viewer.thumb"
          :alt="viewer.caption ?? ''"
          class="vf-article__viewer"
        >
        <p
          v-if="viewer.caption"
          class="vf-article__muted"
        >
          {{ viewer.caption }}
        </p>
        <a
          v-if="viewer.file.startsWith('File:')"
          :href="commonsPage(viewer.file)"
          target="_blank"
          rel="noopener"
          class="video-first-app__link"
        >
          View on Wikimedia Commons <CdxIcon
            :icon="cdxIconLinkExternal"
            size="small"
          />
        </a>
      </template>
    </CdxDialog>
  </VfShell>
</template>

<style scoped>
.vf-article-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-12);
  padding: var(--spacing-75) var(--spacing-50) var(--spacing-25);
}

.vf-article-header__title {
  flex: 1;
  min-width: 0;
  margin: 0 0 0 var(--spacing-25);
  overflow: hidden;
  font-family: var(--font-family-serif);
  font-size: var(--font-size-xx-large);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-xx-large);
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* — Floating tab pill — */

.vf-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-12) var(--spacing-100);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-emphasized);
  border-radius: var(--border-radius-pill);
  background-color: var(--background-color-base);
}

/* Selected view: the icon turns progressive (no fill), per the design. */
.vf-tabs__tab--active.cdx-button {
  color: var(--color-progressive);
}

/* — Panels — */

.vf-article {
  /* Room for the floating tab pill. */
  padding: var(--spacing-100) var(--spacing-100) calc(var(--size-400) + var(--spacing-200));
}

.vf-article__count {
  margin: 0 0 var(--spacing-100);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
}

.vf-article__muted {
  margin: 0;
  color: var(--color-subtle);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.vf-article__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-100);
}

/* 8px rounded thumbnails for videos and images. */
.vf-article__grid :deep(.vf-post-thumb),
.vf-article__image {
  overflow: hidden;
  border-radius: calc(var(--border-radius-base) * 2);
}

.vf-article__image {
  display: block;
  aspect-ratio: 1 / 1;
  padding: 0;
  overflow: hidden;
  border: 0;
  background-color: var(--background-color-interactive-subtle);
  cursor: pointer;
}

.vf-article__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vf-article__image:focus-visible {
  outline: var(--border-width-thick) solid var(--border-color-progressive--focus);
}

.vf-article__viewer {
  display: block;
  width: 100%;
  margin-bottom: var(--spacing-75);
}

/* Info */

.vf-info__image {
  display: block;
  margin-bottom: var(--spacing-150);
}

/* Logos and other flat artwork stay small, like a wordmark. */
.vf-info__image--logo {
  max-width: 50%;
  max-height: var(--size-250);
}

/* Photographs run the full width of the page, matching the thumbnails' corners. */
.vf-info__image--photo {
  width: 100%;
  max-height: var(--size-3200);
  object-fit: cover;
  border-radius: calc(var(--border-radius-base) * 2);
}

.vf-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100);
  margin: 0;
}

.vf-info__row dt {
  font-weight: var(--font-weight-bold);
}

.vf-info__row dd {
  margin: 0;
}

.vf-info__row :is(dt, dd) {
  font-size: var(--font-size-medium);
  line-height: var(--line-height-medium);
}

/* Read: plain text, sans, headings in bold */

.vf-read :deep(p),
.vf-read :deep(li) {
  margin: 0 0 var(--spacing-150);
  font-size: var(--font-size-medium);
  line-height: var(--line-height-medium);
}

.vf-read :deep(li) {
  margin-bottom: var(--spacing-25);
}

.vf-read :deep(ul),
.vf-read :deep(ol) {
  margin: 0 0 var(--spacing-150);
  padding-inline-start: var(--spacing-150);
}

.vf-read :deep(h3) {
  margin: 0;
  font-family: var(--font-family-sans);
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-medium);
}

/* Places: header row, then the map fills the screen behind the tab pill. */

.vf-article--places {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.vf-places {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.vf-places__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-100) var(--spacing-50) var(--spacing-50) var(--spacing-100);
}

.vf-places__header .vf-article__count {
  margin: 0;
}

.vf-places__all.cdx-button {
  font-weight: var(--font-weight-normal);
}

.vf-places__map {
  flex: 1;
}

/* Links */

.vf-links {
  margin: 0;
  padding: 0;
  list-style: none;
}

.vf-links li {
  font-size: var(--font-size-medium);
  line-height: var(--line-height-x-large);
}
</style>
