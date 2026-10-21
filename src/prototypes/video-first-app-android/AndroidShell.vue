<script setup lang="ts">
/**
 * Android (M3) app shell for every screen: AppChromeWrapper with an M3
 * navigation bar (create button in the centre), an optional floating toolbar
 * above it, the snackbar host and the create flow. Colours are Codex tokens
 * through the M3 roles in m3-theme.css.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  cdxIconAdd,
  cdxIconBookmarkList,
  cdxIconHome,
  cdxIconSearch,
  cdxIconUserAvatar,
} from '@wikimedia/codex-icons'
import type { Icon } from '@wikimedia/codex-icons'

import AppChromeWrapper from '@/components/app/AppChromeWrapper.vue'
import type { Theme } from '@/theme'

import CodexSvg from './CodexSvg.vue'
import CreateFlow from './CreateFlow.vue'
import { BASE } from './routes'
import { dismissSnackbar, snackbar } from './snackbar'
import { openCreate } from '../video-first-app/store'
import './m3'
import './m3-theme.css'

const props = withDefaults(
  defineProps<{
    /** Theme for the screen (the feed is always dark). */
    theme?: Theme
    /** Article to pre-connect when the create button is used on this screen. */
    createArticle?: string
    /** Lay the header over the content, which scrolls up and fades out behind it. */
    overlayHeader?: boolean
  }>(),
  { theme: undefined, createArticle: undefined, overlayHeader: false },
)

const route = useRoute()
const router = useRouter()

/** Nav destinations either side of the centre create button. */
const DESTINATIONS: { path: string; label: string; icon: Icon }[] = [
  { path: BASE, label: 'Home', icon: cdxIconHome },
  { path: `${BASE}/saved`, label: 'Saved', icon: cdxIconBookmarkList },
  { path: `${BASE}/search`, label: 'Search', icon: cdxIconSearch },
  { path: `${BASE}/you`, label: 'You', icon: cdxIconUserAvatar },
]

const leading = DESTINATIONS.slice(0, 2)
const trailing = DESTINATIONS.slice(2)

const activePath = computed(() => {
  const path = route.path.replace(/\/$/, '')
  return (
    DESTINATIONS.find((d) => d.path === path)?.path ??
    // Articles and their image / video viewers sit outside the destinations.
    (['article', 'images', 'videos'].some((p) => path.startsWith(`${BASE}/${p}`)) ? '' : BASE)
  )
})

function go(path: string): void {
  if (route.path.replace(/\/$/, '') !== path) router.push(path)
}
</script>

<template>
  <!-- data-theme="light" on the root only fixes the brand blue (see m3-theme.css);
       the app chrome inside carries the screen's real theme. -->
  <AppChromeWrapper
    class="vfa"
    data-theme="light"
    :theme="props.theme"
  >
    <!-- Always render our own header element so the app chrome never falls back to its default bar. -->
    <template #header>
      <div
        class="vfa-header"
        :class="{ 'vfa-header--overlay': props.overlayHeader }"
      >
        <slot name="header" />
      </div>
    </template>

    <slot />

    <template #bottomMenu>
      <div class="vfa-dock">
        <div
          v-if="$slots.toolbar"
          class="vfa-dock__toolbar"
        >
          <slot name="toolbar" />
        </div>

        <Transition name="vfa-snack">
          <div
            v-if="snackbar.current"
            :key="snackbar.current.id"
            class="vfa-snackbar md-typescale-body-medium"
            role="status"
            :class="{ 'vfa-snackbar--raised': $slots.toolbar }"
          >
            <span>{{ snackbar.current.message }}</span>
            <md-text-button
              v-if="snackbar.current.action"
              class="vfa-snackbar__action"
              @click="
                () => {
                  snackbar.current?.action?.run()
                  dismissSnackbar()
                }
              "
            >
              {{ snackbar.current.action.label }}
            </md-text-button>
          </div>
        </Transition>

        <nav
          class="vfa-nav"
          aria-label="Primary"
        >
          <template
            v-for="(group, gi) in [leading, trailing]"
            :key="gi"
          >
            <button
              v-for="d in group"
              :key="d.path"
              type="button"
              class="vfa-nav__item"
              :class="{ 'vfa-nav__item--active': activePath === d.path }"
              :aria-current="activePath === d.path ? 'page' : undefined"
              @click="go(d.path)"
            >
              <span class="vfa-nav__indicator">
                <md-ripple />
                <md-focus-ring inward />
                <CodexSvg :icon="d.icon" />
              </span>
              <span class="vfa-nav__label md-typescale-label-medium">{{ d.label }}</span>
            </button>
            <!-- Centre: Create, styled like the destinations (it opens a sheet, so never "active"). -->
            <button
              v-if="gi === 0"
              type="button"
              class="vfa-nav__item"
              @click="openCreate(props.createArticle)"
            >
              <span class="vfa-nav__indicator">
                <md-ripple />
                <md-focus-ring inward />
                <CodexSvg :icon="cdxIconAdd" />
              </span>
              <span class="vfa-nav__label md-typescale-label-medium">Create</span>
            </button>
          </template>
        </nav>
      </div>

      <CreateFlow />
    </template>
  </AppChromeWrapper>
</template>

<style scoped>
.vfa-header {
  flex-shrink: 0;
  background-color: var(--md-sys-color-surface);
}

/*
 * Overlay header: out of the layout, over the scrolling content. Solid
 * surface colour behind the title and icons (which end ~54px down), then an
 * eased fade from 56px to 20px below the bar, so content dissolves smoothly
 * with no visible edge. Only the controls take taps.
 */
.vfa-header--overlay {
  position: absolute;
  inset: 0 0 auto;
  z-index: 4;
  padding-bottom: 20px;
  background: linear-gradient(
    to bottom,
    var(--md-sys-color-surface) 56px,
    color-mix(in srgb, var(--md-sys-color-surface) 94%, transparent) 61px,
    color-mix(in srgb, var(--md-sys-color-surface) 82%, transparent) 66px,
    color-mix(in srgb, var(--md-sys-color-surface) 64%, transparent) 71px,
    color-mix(in srgb, var(--md-sys-color-surface) 44%, transparent) 76px,
    color-mix(in srgb, var(--md-sys-color-surface) 26%, transparent) 81px,
    color-mix(in srgb, var(--md-sys-color-surface) 11%, transparent) 86px,
    transparent 92px
  );
  pointer-events: none;
}

.vfa-header--overlay :deep(:is(button, a, md-icon-button)) {
  pointer-events: auto;
}

.vfa-dock {
  position: relative;
  flex-shrink: 0;
}

/* M3 floating toolbar: centred, 16dp above the navigation bar, over the content. */
.vfa-dock__toolbar {
  position: absolute;
  right: 0;
  bottom: calc(100% + 16px);
  left: 0;
  z-index: 5;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.vfa-dock__toolbar > :deep(*) {
  pointer-events: auto;
}

/* — M3 navigation bar: 80dp, 64×32 pill indicator behind the active icon — */

.vfa-nav {
  display: flex;
  height: 80px;
  background-color: var(--md-sys-color-surface-container);
}

.vfa-nav__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 12px 0 16px;
  border: 0;
  background: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.vfa-nav__item:focus-visible {
  outline: none;
}

.vfa-nav__indicator {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 32px;
  border-radius: 16px;
  transition: background-color 200ms var(--vfa-ease-standard);
  --md-focus-ring-shape: 16px;
}

.vfa-nav__item--active .vfa-nav__indicator {
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.vfa-nav__label {
  font-weight: 500;
}

.vfa-nav__item--active .vfa-nav__label {
  color: var(--md-sys-color-on-surface);
  font-weight: 700;
}

/* — M3 snackbar: inverse surface, 4dp corners, above the bar (and FAB) — */

.vfa-snackbar {
  position: absolute;
  right: var(--vfa-gutter);
  bottom: calc(100% + 16px);
  left: var(--vfa-gutter);
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 48px;
  box-sizing: border-box;
  padding: 4px 8px 4px 16px;
  border-radius: 4px;
  background-color: var(--md-sys-color-inverse-surface);
  color: var(--md-sys-color-inverse-on-surface);
  box-shadow: 0 3px 6px var(--md-sys-color-shadow);
}

.vfa-snackbar--raised {
  bottom: calc(100% + 16px + 56px + 16px);
}

.vfa-snackbar__action {
  --md-text-button-label-text-color: var(--md-sys-color-inverse-primary);
}

.vfa-snack-enter-active {
  transition:
    opacity 200ms var(--vfa-ease-standard),
    transform 300ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-snack-leave-active {
  transition: opacity 150ms var(--vfa-ease-standard);
}

.vfa-snack-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.vfa-snack-leave-to {
  opacity: 0;
}
</style>
