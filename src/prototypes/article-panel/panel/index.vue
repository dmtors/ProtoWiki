<script setup lang="ts">
/**
 * The preview the loader (`public/embeds/article-panel.js`) shows in an iframe
 * on someone else's site. `?title=Halley's_Comet&lang=en&layout=popover|sheet`
 *
 * Talks to the loader with postMessage (`source: 'wikipedia-article-panel'`):
 * - `ready` + `height` once content is laid out, and `height` whenever it changes
 * - `close` from the close button or Escape
 */
definePage({
  meta: {
    hidden: true,
  },
})

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CdxButton, CdxIcon, CdxMessage } from '@wikimedia/codex'
import {
  cdxIconChart,
  cdxIconClose,
  cdxIconLinkExternal,
  cdxIconLogoWikipedia,
  cdxIconReferences,
} from '@wikimedia/codex-icons'

import { formatCompactCount } from '@/components/attribution/formatAttribution'

import { fetchPreview, type ArticlePreview } from '../fetchPreview'

const route = useRoute()
const title = computed(() => String(route.query.title ?? ''))
const lang = computed(() => String(route.query.lang ?? 'en').replace(/[^a-z-]/gi, '') || 'en')
const host = computed(() => `${lang.value}.wikipedia.org`)
const layout = computed(() => (route.query.layout === 'sheet' ? 'sheet' : 'popover'))

const preview = ref<ArticlePreview | null>(null)
const error = ref<string | null>(null)
let abort: AbortController | null = null

watch(
  [title, host],
  async () => {
    abort?.abort()
    abort = new AbortController()
    preview.value = null
    error.value = null
    if (!title.value) {
      error.value = 'No article given'
      return
    }
    try {
      preview.value = await fetchPreview(title.value, host.value, abort.signal)
    } catch (err) {
      if (!abort.signal.aborted) error.value = err instanceof Error ? err.message : String(err)
    }
  },
  { immediate: true },
)

const signals = computed(() => {
  const p = preview.value
  if (!p) return []
  const items: { key: string; icon: string; label: string }[] = []
  // Attribution API page_views covers the last 30 days — label the window.
  if (p.views !== null) items.push({ key: 'views', icon: cdxIconChart, label: `${formatCompactCount(p.views)} views last month` })
  if (p.references !== null) {
    items.push({
      key: 'references',
      icon: cdxIconReferences,
      label: `${formatCompactCount(p.references)} reference${p.references === 1 ? '' : 's'}`,
    })
  }
  return items
})

const fallbackLink = computed(() => `https://${host.value}/wiki/${encodeURIComponent(title.value.replace(/ /g, '_'))}`)

/* ---- Messaging with the loader on the host page ---- */

const root = ref<HTMLElement | null>(null)

function post(message: Record<string, unknown>) {
  // No sensitive data — any parent may listen; the loader checks our origin.
  window.parent?.postMessage({ source: 'wikipedia-article-panel', ...message }, '*')
}

const close = () => post({ type: 'close' })

let resizeObserver: ResizeObserver | null = null
const settled = computed(() => Boolean(preview.value || error.value))

function reportHeight() {
  if (!root.value || !settled.value) return
  post({ type: 'height', ready: true, height: Math.ceil(root.value.getBoundingClientRect().height) })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  // Transparent page: the loader's iframe provides the frame, shadow and corners.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  document.body.style.margin = '0'
  resizeObserver = new ResizeObserver(reportHeight)
  if (root.value) resizeObserver.observe(root.value)
  window.addEventListener('keydown', onKeydown)
})

watch(settled, () => requestAnimationFrame(reportHeight))

onBeforeUnmount(() => {
  abort?.abort()
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <article ref="root" class="panel" :class="`panel--${layout}`" :lang="lang">
    <CdxMessage v-if="error" type="error" :allow-user-dismiss="false" class="panel__error">
      Couldn't load this preview.
      <a :href="fallbackLink" target="_blank" rel="noopener">Open the article on Wikipedia</a>
    </CdxMessage>

    <template v-else-if="preview">
      <!-- Mobile sheet: full-bleed image with the source chip and close button over it. -->
      <div v-if="layout === 'sheet'" class="panel__media" :class="{ 'panel__media--empty': !preview.heroUrl }">
        <img v-if="preview.heroUrl" class="panel__hero" :src="preview.heroUrl" alt="" />
        <span class="panel__source panel__source--overlay">
          <CdxIcon :icon="cdxIconLogoWikipedia" size="small" />
          Wikipedia
        </span>
        <CdxButton class="panel__close" aria-label="Close" @click="close">
          <CdxIcon :icon="cdxIconClose" />
        </CdxButton>
      </div>

      <div class="panel__content">
        <div class="panel__main">
          <h2 class="panel__title">
            <a :href="preview.link" target="_blank" rel="noopener">{{ preview.title }}</a>
          </h2>

          <div class="panel__signals">
            <span v-if="layout === 'popover'" class="panel__source">
              <CdxIcon :icon="cdxIconLogoWikipedia" size="small" />
              Wikipedia
            </span>
            <span v-for="signal in signals" :key="signal.key" class="panel__signal">
              <CdxIcon :icon="signal.icon" size="small" />
              {{ signal.label }}
            </span>
          </div>

          <p v-if="preview.extract" class="panel__extract">{{ preview.extract }}</p>

          <a class="panel__read-more" :href="preview.link" target="_blank" rel="noopener">
            Learn more on Wikipedia
            <CdxIcon :icon="cdxIconLinkExternal" size="small" />
          </a>
        </div>

        <img
          v-if="layout === 'popover' && preview.thumbnailUrl"
          class="panel__thumbnail"
          :src="preview.thumbnailUrl"
          alt=""
        />
      </div>
    </template>
  </article>
</template>

<style scoped>
.panel {
  /* Codex has no 4px radius token — override the base radius (as in the article embed). */
  --border-radius-base: 4px;

  box-sizing: border-box;
  color: var(--color-base);
  background-color: var(--background-color-base);
  font-family: var(--font-family-base);
}

/* Desktop popover: the loader's iframe supplies the corners and shadow; this is the border. */
.panel--popover {
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}

.panel__content {
  display: flex;
  gap: var(--spacing-100);
  padding: var(--spacing-100);
}

.panel__main {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50);
  flex: 1;
  min-width: 0;
}

/* Heading 4 text style — all four tokens. */
.panel__title {
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
}

.panel__title a {
  color: var(--color-progressive);
  text-decoration: none;
}

.panel__title a:hover {
  text-decoration: underline;
}

.panel__signals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-50) var(--spacing-100);
}

/* Figure caption text style — all four tokens. */
.panel__signal,
.panel__source {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
  color: var(--color-base);
}

.panel__signal .cdx-icon,
.panel__source .cdx-icon {
  color: var(--color-base);
}

/* "Wikipedia" source chip: a neutral pill (desktop). */
.panel__source {
  padding: var(--spacing-12) var(--spacing-75) var(--spacing-12) var(--spacing-50);
  border-radius: var(--border-radius-pill);
  background-color: var(--background-color-neutral);
}

.panel__extract {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.panel__read-more {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25);
  align-self: flex-start;
  color: var(--color-progressive);
  text-decoration: none;
}

.panel__read-more:hover {
  text-decoration: underline;
}

.panel__read-more .cdx-icon {
  color: var(--color-progressive);
}

.panel__thumbnail {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--border-radius-base);
}

/* ---- Mobile bottom sheet ---- */

.panel--sheet {
  /* Sheet corners are rounder than cards — no Codex token, so override the base radius. */
  --border-radius-base: 8px;

  border-radius: var(--border-radius-base) var(--border-radius-base) 0 0;
  overflow: hidden;
}

.panel__media {
  position: relative;
}

/* No image: chip and close button sit in a plain top row instead. */
.panel__media--empty {
  min-height: calc(var(--spacing-100) * 2 + 32px);
}

.panel__hero {
  display: block;
  width: 100%;
  aspect-ratio: 5 / 3;
  object-fit: cover;
}

/* Over the image: a white pill with a subtle border, as in the design. */
.panel__source--overlay {
  position: absolute;
  top: var(--spacing-100);
  left: var(--spacing-100);
  padding-block: var(--spacing-25);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  background-color: var(--background-color-base);
}

/* Codex button, made round to sit over the image. */
.panel__close {
  position: absolute;
  top: var(--spacing-100);
  right: var(--spacing-100);
  border-radius: var(--border-radius-circle);
}

.panel--sheet .panel__content {
  /* Room for the home indicator / safe area on phones. */
  padding-bottom: calc(var(--spacing-150) + env(safe-area-inset-bottom, 0px));
}

.panel__error {
  margin: var(--spacing-100);
}
</style>
