<script setup lang="ts">
/**
 * Shared app shell for every screen: AppChromeWrapper with the dark bottom bar
 * (primary add button in the middle), the create sheet, and the saved / search /
 * interests sheets the bar opens. Dialogs and toasts teleport into the phone
 * column (themed like the page, not like the dark bar).
 */
import { computed, provide, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CdxButton, CdxDialog, CdxIcon, CdxToastContainer } from '@wikimedia/codex'
import {
  cdxIconAdd,
  cdxIconBookmarkList,
  cdxIconHome,
  cdxIconSearch,
  cdxIconUserAvatar,
} from '@wikimedia/codex-icons'

import AppChromeWrapper from '@/components/app/AppChromeWrapper.vue'
import { globalTheme } from '@/theme'
import type { Theme } from '@/theme'

import ArticleLookup from './ArticleLookup.vue'
import CreateSheet from './CreateSheet.vue'
import PostThumb from './PostThumb.vue'
import { focusPost, openCreate, state } from './store'
import './video-first-app-surface.css'

type Sheet = 'saved' | 'search' | 'you'

const props = withDefaults(
  defineProps<{
    /** Theme for the screen content (the feed is always dark). */
    theme?: Theme
    /** Article to pre-connect when the add button is used on this screen. */
    createArticle?: string
    /** Lay the header over the content (full-screen feed). */
    overlayHeader?: boolean
  }>(),
  { theme: undefined, createArticle: undefined, overlayHeader: false },
)

const router = useRouter()

const layer = ref<HTMLElement | null>(null)
provide('CdxTeleportTarget', layer)

const sheet = ref<Sheet | null>(null)
const sheetOpen = computed({
  get: () => sheet.value !== null,
  set: (open: boolean) => {
    if (!open) sheet.value = null
  },
})

const sheetTitle = computed(
  () => ({ saved: 'Saved', search: 'Search', you: 'Your interests' })[sheet.value ?? 'saved'],
)

const savedPosts = computed(() => state.posts.filter((p) => state.saved[p.id]))
const savedArticles = computed(() =>
  Object.entries(state.savedArticles)
    .filter(([, on]) => on)
    .map(([title]) => title),
)
const interestRows = computed(() =>
  Object.entries(state.interests)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]),
)

function goHome(): void {
  sheet.value = null
  router.push('/video-first-app')
}

function openArticle(title: string): void {
  sheet.value = null
  router.push({ path: '/video-first-app/article', query: { title } })
}

function openSavedPost(id: string): void {
  sheet.value = null
  focusPost(id)
  router.push('/video-first-app')
}
</script>

<template>
  <AppChromeWrapper
    class="video-first-app"
    :class="{ 'video-first-app--overlay-header': props.overlayHeader }"
    :theme="props.theme"
  >
    <template #header>
      <div class="video-first-app__header">
        <slot name="header" />
      </div>
    </template>

    <div class="video-first-app__body">
      <slot />
    </div>

    <template #bottomMenu>
      <div
        v-if="$slots.float"
        class="video-first-app__float"
      >
        <slot name="float" />
      </div>
      <nav
        class="video-first-app__bar"
        data-theme="dark"
        aria-label="Primary"
      >
        <CdxButton
          weight="quiet"
          size="large"
          aria-label="Home"
          @click="goHome"
        >
          <CdxIcon :icon="cdxIconHome" />
        </CdxButton>
        <CdxButton
          weight="quiet"
          size="large"
          aria-label="Saved"
          @click="sheet = 'saved'"
        >
          <CdxIcon :icon="cdxIconBookmarkList" />
        </CdxButton>
        <CdxButton
          class="video-first-app__create"
          data-theme="light"
          action="progressive"
          weight="primary"
          size="large"
          aria-label="Create a post"
          @click="openCreate(props.createArticle)"
        >
          <CdxIcon :icon="cdxIconAdd" />
        </CdxButton>
        <CdxButton
          weight="quiet"
          size="large"
          aria-label="Search"
          @click="sheet = 'search'"
        >
          <CdxIcon :icon="cdxIconSearch" />
        </CdxButton>
        <CdxButton
          weight="quiet"
          size="large"
          aria-label="Your interests"
          @click="sheet = 'you'"
        >
          <CdxIcon :icon="cdxIconUserAvatar" />
        </CdxButton>
      </nav>

      <div
        ref="layer"
        class="video-first-app__layer"
        :data-theme="globalTheme"
      >
        <CdxToastContainer />
      </div>

      <CreateSheet />

      <CdxDialog
        v-model:open="sheetOpen"
        class="video-first-app__sheet"
        :title="sheetTitle"
        :use-close-button="true"
      >
        <template v-if="sheet === 'search'">
          <ArticleLookup
            placeholder="Search Wikipedia"
            @select="openArticle"
          />
        </template>

        <template v-else-if="sheet === 'saved'">
          <p class="video-first-app__sheet-heading">
            {{ savedArticles.length }} articles
          </p>
          <ul class="video-first-app__rows">
            <li
              v-for="title in savedArticles"
              :key="title"
            >
              <a
                href="#"
                class="video-first-app__link"
                @click.prevent="openArticle(title)"
              >{{
                title
              }}</a>
            </li>
          </ul>
          <p class="video-first-app__sheet-heading">
            {{ savedPosts.length }} posts
          </p>
          <p
            v-if="!savedPosts.length"
            class="video-first-app__muted"
          >
            Posts you save from More options show up here.
          </p>
          <div
            v-else
            class="video-first-app__grid"
          >
            <PostThumb
              v-for="post in savedPosts"
              :key="post.id"
              :post="post"
              @select="openSavedPost(post.id)"
            />
          </div>
        </template>

        <template v-else-if="sheet === 'you'">
          <p class="video-first-app__muted">
            New posts in your feed are picked from the articles you read and the posts you like.
          </p>
          <p class="video-first-app__sheet-heading">
            History
          </p>
          <ul class="video-first-app__rows">
            <li
              v-for="h in state.history"
              :key="h.title"
            >
              {{ h.verb === 'read' ? 'Read' : 'Liked' }}
              <a
                href="#"
                class="video-first-app__link"
                @click.prevent="openArticle(h.title)"
              >{{
                h.title
              }}</a>
            </li>
          </ul>
          <p class="video-first-app__sheet-heading">
            Interests
          </p>
          <ul class="video-first-app__rows">
            <li
              v-for="[tag, weight] in interestRows"
              :key="tag"
              class="video-first-app__interest"
            >
              <span>{{ tag }}</span><span class="video-first-app__muted">{{ weight }}</span>
            </li>
          </ul>
        </template>
      </CdxDialog>
    </template>
  </AppChromeWrapper>
</template>
