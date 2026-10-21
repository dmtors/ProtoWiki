<script setup lang="ts">
/**
 * Create flow behind the FAB: an M3 bottom sheet to pick photo / audio / video,
 * then an M3 full-screen dialog with a mock capture step and the post details
 * (connected articles as input chips, caption). No editing tools.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  cdxIconArticle,
  cdxIconCamera,
  cdxIconClose,
  cdxIconMicrophone,
  cdxIconPlay,
  cdxIconStop,
} from '@wikimedia/codex-icons'
import type { Icon } from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import M3BottomSheet from './M3BottomSheet.vue'
import { BASE } from './routes'
import { showSnackbar } from './snackbar'
import type { PostKind } from '../video-first-app/data'
import { publishPost, state } from '../video-first-app/store'
import { fetchLeadImage, searchArticles } from '../video-first-app/wikiApi'

const route = useRoute()
const router = useRouter()

const KINDS: { kind: PostKind; label: string; icon: Icon }[] = [
  { kind: 'photo', label: 'Take a photo', icon: cdxIconCamera },
  { kind: 'audio', label: 'Record audio', icon: cdxIconMicrophone },
  { kind: 'video', label: 'Make a video', icon: cdxIconPlay },
]

const chooseOpen = computed({
  get: () => state.createOpen,
  set: (v: boolean) => {
    state.createOpen = v
  },
})

const dialogOpen = ref(false)
const step = ref<'capture' | 'details'>('capture')
const kind = ref<PostKind>('video')
const recording = ref(false)
const elapsed = ref(0)
const caption = ref('')
const articles = ref<string[]>([])
const query = ref('')
const results = ref<{ title: string; description?: string }[]>([])
const preview = ref<string | null>(null)

let timer: ReturnType<typeof setInterval> | undefined
let debounce: ReturnType<typeof setTimeout> | undefined
let abort: AbortController | null = null

function choose(next: PostKind): void {
  kind.value = next
  step.value = 'capture'
  recording.value = false
  elapsed.value = 0
  caption.value = ''
  query.value = ''
  results.value = []
  articles.value = state.createArticle ? [state.createArticle] : []
  chooseOpen.value = false
  dialogOpen.value = true
}

function capture(): void {
  if (kind.value === 'photo' || recording.value) {
    clearInterval(timer)
    recording.value = false
    step.value = 'details'
    return
  }
  recording.value = true
  timer = setInterval(() => elapsed.value++, 1000)
}

function close(): void {
  clearInterval(timer)
  dialogOpen.value = false
}

/** Stand-in for captured media: the first connected article's lead image. */
watch(
  articles,
  async (list) => {
    preview.value = list[0]
      ? ((await fetchLeadImage(list[0]).catch(() => undefined)) ?? null)
      : null
  },
  { deep: true },
)

function onQuery(e: Event): void {
  query.value = (e.target as HTMLInputElement).value
  clearTimeout(debounce)
  abort?.abort()
  if (!query.value.trim()) {
    results.value = []
    return
  }
  debounce = setTimeout(async () => {
    abort = new AbortController()
    try {
      results.value = await searchArticles(query.value, abort.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') results.value = []
    }
  }, 200)
}

function addArticle(title: string): void {
  if (!articles.value.includes(title)) articles.value.push(title)
  query.value = ''
  results.value = []
}

function removeArticle(title: string): void {
  articles.value = articles.value.filter((a) => a !== title)
}

const canPost = computed(() => articles.value.length > 0 && Boolean(preview.value))

function post(): void {
  if (!canPost.value) return
  publishPost({
    kind: kind.value,
    caption: caption.value.trim(),
    articles: [...articles.value],
    media: preview.value!,
  })
  close()
  showSnackbar('Posted to your feed')
  if (route.path.replace(/\/$/, '') !== BASE) router.push(BASE)
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const title = computed(
  () => ({ photo: 'New photo', audio: 'New recording', video: 'New video' })[kind.value],
)

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <M3BottomSheet
    v-model:open="chooseOpen"
    title="Create"
  >
    <md-list>
      <md-list-item
        v-for="option in KINDS"
        :key="option.kind"
        type="button"
        @click="choose(option.kind)"
      >
        <CodexSvg
          slot="start"
          :icon="option.icon"
        />
        <span slot="headline">{{ option.label }}</span>
      </md-list-item>
    </md-list>
  </M3BottomSheet>

  <Transition name="vfa-fullscreen">
    <section
      v-if="dialogOpen"
      class="vfa-fullscreen"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <header class="vfa-fullscreen__bar">
        <md-icon-button
          aria-label="Close"
          @click="close"
        >
          <CodexSvg :icon="cdxIconClose" />
        </md-icon-button>
        <h2 class="vfa-fullscreen__title md-typescale-title-large">
          {{ title }}
        </h2>
        <md-filled-button
          v-if="step === 'details'"
          :disabled="!canPost"
          @click="post"
        >
          Post
        </md-filled-button>
      </header>

      <div
        v-if="step === 'capture'"
        class="vfa-capture"
        data-theme="dark"
      >
        <div class="vfa-capture__viewfinder">
          <CodexSvg
            :icon="kind === 'audio' ? cdxIconMicrophone : cdxIconCamera"
            :size="48"
          />
          <span class="md-typescale-body-medium">
            {{
              kind === 'photo'
                ? 'Camera preview'
                : recording
                  ? `● ${clock(elapsed)}`
                  : 'Ready to record'
            }}
          </span>
        </div>
        <md-fab
          size="large"
          variant="primary"
          :aria-label="
            kind === 'photo' ? 'Take photo' : recording ? 'Stop recording' : 'Start recording'
          "
          @click="capture"
        >
          <CodexSvg
            slot="icon"
            :icon="
              kind === 'photo'
                ? cdxIconCamera
                : recording
                  ? cdxIconStop
                  : kind === 'audio'
                    ? cdxIconMicrophone
                    : cdxIconPlay
            "
            :size="36"
          />
        </md-fab>
        <p class="md-typescale-body-small vfa-capture__hint">
          This prototype doesn’t use your camera or microphone.
        </p>
      </div>

      <div
        v-else
        class="vfa-details"
      >
        <img
          v-if="preview"
          class="vfa-details__preview"
          :src="preview"
          alt=""
        >
        <h3 class="md-typescale-title-small vfa-details__label">
          Connected articles
        </h3>
        <md-chip-set v-if="articles.length">
          <md-input-chip
            v-for="a in articles"
            :key="a"
            :label="a"
            @remove="removeArticle(a)"
          >
            <CodexSvg
              slot="icon"
              :icon="cdxIconArticle"
              :size="18"
            />
          </md-input-chip>
        </md-chip-set>
        <md-outlined-text-field
          label="Add an article"
          :value="query"
          supporting-text="Every post grows from at least one Wikipedia article."
          @input="onQuery"
        />
        <md-list
          v-if="results.length"
          class="vfa-details__results"
        >
          <md-list-item
            v-for="r in results"
            :key="r.title"
            type="button"
            @click="addArticle(r.title)"
          >
            <span slot="headline">{{ r.title }}</span>
            <span
              v-if="r.description"
              slot="supporting-text"
            >{{ r.description }}</span>
          </md-list-item>
        </md-list>
        <md-outlined-text-field
          label="Caption"
          type="textarea"
          rows="3"
          :value="caption"
          @input="caption = ($event.target as HTMLTextAreaElement).value"
        />
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.vfa-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
}

.vfa-fullscreen__bar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  padding: 0 var(--vfa-gutter) 0 var(--vfa-icon-edge);
}

.vfa-fullscreen__title {
  flex: 1;
  margin: 0;
  font-weight: 700;
}

.vfa-capture {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: var(--vfa-gutter);
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-capture__viewfinder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: var(--vfa-shape-extra-large);
  background-color: var(--md-sys-color-surface-container-high);
}

.vfa-capture__hint {
  margin: 0;
}

.vfa-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 8px var(--vfa-gutter) 24px;
  overflow-y: auto;
}

.vfa-details__preview {
  width: 96px;
  aspect-ratio: 9 / 16;
  object-fit: cover;
  border-radius: var(--vfa-shape-medium);
}

.vfa-details__label {
  margin: 0;
}

.vfa-details__results {
  --md-list-container-color: var(--md-sys-color-surface-container-low);
  border-radius: var(--vfa-shape-medium);
}

.vfa-fullscreen-enter-active {
  transition:
    transform 400ms var(--vfa-ease-emphasized-decelerate),
    opacity 200ms;
}

.vfa-fullscreen-leave-active {
  transition:
    transform 200ms var(--vfa-ease-emphasized-accelerate),
    opacity 200ms;
}

.vfa-fullscreen-enter-from,
.vfa-fullscreen-leave-to {
  opacity: 0;
  transform: translateY(10%);
}
</style>
