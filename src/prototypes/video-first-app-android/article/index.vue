<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  cdxIconArrowPrevious,
  cdxIconArticle,
  cdxIconBookmark,
  cdxIconBookmarkOutline,
  cdxIconEdit,
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
import { formatAgo, sameTitle, type AudioRecording } from '../../video-first-app/data'
import {
  focusPost,
  isArticleSaved,
  loadArticleVideos,
  openCreate,
  recordRead,
  state,
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

/** Explicit `?tab=` wins; otherwise Info when there's an infobox, else Read. */
const tab = computed<Tab>(() => {
  const value = route.query.tab
  if (TABS.some((t) => t.id === value)) return value as Tab
  if (!article.value) return 'info'
  return article.value.info.length || article.value.infoImage ? 'info' : 'read'
})

/** Two-way binding for the floating toolbar; writing it records the tab in the URL. */
const selectedTab = computed({
  get: () => tab.value as string,
  set: (next: string) => {
    if (next !== tab.value) router.replace({ query: { ...route.query, tab: next } })
  },
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

const videoPosts = computed(() =>
  state.posts.filter(
    (p) => !state.hidden[p.id] && p.articles.some((a) => sameTitle(a, title.value)),
  ),
)
const videosLoading = ref(false)

async function loadVideos(): Promise<void> {
  videosLoading.value = true
  await loadArticleVideos(title.value)
  videosLoading.value = false
}

function openPost(id: string): void {
  focusPost(id)
  router.push(BASE)
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

// — Images —

const images = ref<ArticleImage[]>([])
const imagesState = ref<'idle' | 'loading' | 'error'>('idle')
const viewer = ref<ArticleImage | null>(null)

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
    if (t === 'video') loadVideos()
    if (t === 'audio' && audioFor.value !== title.value) loadAudio()
    if (t === 'links') loadLinkThumbs()
  },
  { immediate: true },
)

// — Editing the introduction (local only) —

const editOpen = ref(false)
const editText = ref('')

function startEdit(): void {
  editText.value = article.value?.introText ?? ''
  editOpen.value = true
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

function publishEdit(): void {
  const firstHeading = bodyHtml.value.indexOf('<h3>')
  const rest = firstHeading === -1 ? '' : bodyHtml.value.slice(firstHeading)
  bodyHtml.value =
    editText.value
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<p>${escapeHtml(t)}</p>`)
      .join('') + rest
  if (article.value) article.value = { ...article.value, introText: editText.value }
  editOpen.value = false
  showSnackbar('Edit published (sample only, not saved to Wikipedia)')
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<template>
  <AndroidShell :create-article="headerTitle">
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
        <md-icon-button
          aria-label="Edit article"
          :disabled="articleState !== 'ready'"
          @click="startEdit"
        >
          <CodexSvg :icon="cdxIconEdit" />
        </md-icon-button>
      </header>
    </template>

    <template #toolbar>
      <M3FloatingToolbar
        v-model="selectedTab"
        :items="TABS"
        label="Article views"
      />
    </template>

    <div
      class="vfa-article"
      :class="`vfa-article--${tab}`"
      @click="onTextClick"
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
            @click="viewer = img"
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
        <PlacesMap
          v-if="placesState === 'idle'"
          ref="map"
          class="vfa-places__map"
          :places="places"
          :selected="selectedPlace"
          @select="selectedPlace = $event"
          @open="(t: string) => router.push(articlePath(t))"
        />
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

    <!-- Edit the introduction -->
    <md-dialog
      :open="editOpen"
      class="vfa-edit"
      @closed="editOpen = false"
    >
      <div slot="headline">
        Edit introduction
      </div>
      <div
        slot="content"
        class="vfa-edit__content"
      >
        <md-outlined-text-field
          type="textarea"
          rows="10"
          label="Introduction"
          :value="editText"
          @input="editText = ($event.target as HTMLTextAreaElement).value"
        />
        <p class="md-typescale-body-small vfa-muted">
          Posts connected to this article stay linked to it after your edit.
        </p>
      </div>
      <div slot="actions">
        <md-text-button @click="editOpen = false">
          Cancel
        </md-text-button>
        <md-text-button
          :disabled="editText === (article?.introText ?? '')"
          @click="publishEdit"
        >
          Publish
        </md-text-button>
      </div>
    </md-dialog>

    <!-- Image viewer -->
    <md-dialog
      :open="viewer !== null"
      @closed="viewer = null"
    >
      <div slot="headline">
        {{ viewer?.file.replace(/^File:/, '') }}
      </div>
      <div slot="content">
        <img
          v-if="viewer"
          class="vfa-viewer"
          :src="viewer.thumb"
          :alt="viewer.caption ?? ''"
        >
        <p
          v-if="viewer?.caption"
          class="md-typescale-body-medium"
        >
          {{ viewer.caption }}
        </p>
      </div>
      <div slot="actions">
        <md-text-button
          v-if="viewer?.file.startsWith('File:')"
          :href="`https://commons.wikimedia.org/wiki/${encodeURIComponent(viewer.file.replace(/ /g, '_'))}`"
          target="_blank"
        >
          View on Commons
        </md-text-button>
        <md-text-button @click="viewer = null">
          Close
        </md-text-button>
      </div>
    </md-dialog>
  </AndroidShell>
</template>

<style scoped>
/* M3 small top app bar: 64dp, title-large, icon actions. */
.vfa-appbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  padding: 0 4px;
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
  /* Room for the floating toolbar over the last row. */
  padding-bottom: 96px;
  box-sizing: border-box;
}

.vfa-article__loading {
  position: absolute;
  inset: 0 0 auto;
}

.vfa-pad {
  padding: 16px;
}

.vfa-pad-x {
  padding-inline: 16px;
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
  padding: 8px 8px 8px 16px;
}

.vfa-places__header .vfa-count {
  margin: 0;
}

.vfa-places__map {
  flex: 1;
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

/* Dialogs */

.vfa-edit__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vfa-edit__content md-outlined-text-field {
  width: 100%;
}

.vfa-viewer {
  display: block;
  width: 100%;
  border-radius: var(--vfa-shape-medium);
}
</style>
