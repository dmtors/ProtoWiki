<script setup lang="ts">
/**
 * Create flow behind the primary add button: pick photo / audio / video, a mock
 * capture step, then caption + connected articles and Post. No editing tools.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CdxButton,
  CdxDialog,
  CdxField,
  CdxIcon,
  CdxMultiselectLookup,
  CdxTextArea,
  useToast,
} from '@wikimedia/codex'
import type { ChipInputItem, MenuItemData } from '@wikimedia/codex'
import { cdxIconCamera, cdxIconMicrophone, cdxIconPlay, cdxIconStop } from '@wikimedia/codex-icons'
import type { Icon } from '@wikimedia/codex-icons'

import type { PostKind } from './data'
import { publishPost, state } from './store'
import { fetchLeadImage, searchArticles } from './wikiApi'

const router = useRouter()
const route = useRoute()
const toast = useToast()

type Step = 'choose' | 'capture' | 'details'

const step = ref<Step>('choose')
const kind = ref<PostKind>('video')
const recording = ref(false)
const elapsed = ref(0)
const caption = ref('')
const chips = ref<ChipInputItem[]>([])
const selected = ref<string[]>([])
const inputValue = ref('')
const menuItems = ref<MenuItemData[]>([])
const preview = ref<string | null>(null)

let timer: ReturnType<typeof setInterval> | undefined
let abort: AbortController | null = null
let debounce: ReturnType<typeof setTimeout> | undefined

const open = computed({
  get: () => state.createOpen,
  set: (value: boolean) => {
    state.createOpen = value
  },
})

const KINDS: { kind: PostKind; label: string; icon: Icon }[] = [
  { kind: 'photo', label: 'Take a photo', icon: cdxIconCamera },
  { kind: 'audio', label: 'Record audio', icon: cdxIconMicrophone },
  { kind: 'video', label: 'Make a video', icon: cdxIconPlay },
]

const title = computed(() => {
  if (step.value === 'choose') return 'Create'
  const label = { photo: 'Photo', audio: 'Audio', video: 'Video' }[kind.value]
  return step.value === 'capture' ? label : `New ${label.toLowerCase()} post`
})

function reset(): void {
  clearInterval(timer)
  step.value = 'choose'
  recording.value = false
  elapsed.value = 0
  caption.value = ''
  preview.value = null
  menuItems.value = []
  inputValue.value = ''
  const article = state.createArticle
  chips.value = article ? [{ value: article }] : []
  selected.value = article ? [article] : []
}

watch(open, (isOpen) => {
  if (isOpen) reset()
  else clearInterval(timer)
})

function choose(next: PostKind): void {
  kind.value = next
  step.value = 'capture'
}

function capture(): void {
  if (kind.value === 'photo' || recording.value) {
    clearInterval(timer)
    recording.value = false
    step.value = 'details'
    updatePreview()
    return
  }
  recording.value = true
  elapsed.value = 0
  timer = setInterval(() => {
    elapsed.value++
  }, 1000)
}

/** Stand-in for captured media: the first connected article's lead image. */
async function updatePreview(): Promise<void> {
  const first = selected.value[0]
  preview.value = first ? ((await fetchLeadImage(first).catch(() => undefined)) ?? null) : null
}

watch(selected, updatePreview)

function onLookupInput(value: string): void {
  clearTimeout(debounce)
  abort?.abort()
  if (!value.trim()) {
    menuItems.value = []
    return
  }
  debounce = setTimeout(async () => {
    abort = new AbortController()
    try {
      menuItems.value = (await searchArticles(value, abort.signal)).map((r) => ({
        value: r.title,
        label: r.title,
        description: r.description,
        thumbnail: r.thumb ? { url: r.thumb } : null,
      }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') menuItems.value = []
    }
  }, 200)
}

const canPost = computed(() => selected.value.length > 0 && Boolean(preview.value))

function post(): void {
  if (!canPost.value) return
  publishPost({
    kind: kind.value,
    caption: caption.value.trim(),
    articles: [...selected.value],
    media: preview.value!,
  })
  open.value = false
  toast.show({ type: 'success', message: 'Posted to your feed', autoDismiss: true })
  if (route.path !== '/video-first-app') router.push('/video-first-app')
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <CdxDialog
    v-model:open="open"
    class="video-first-app__sheet"
    :title="title"
    :use-close-button="true"
    :primary-action="
      step === 'details'
        ? { label: 'Post', actionType: 'progressive', disabled: !canPost }
        : undefined
    "
    :default-action="step !== 'choose' ? { label: 'Back' } : undefined"
    @primary="post"
    @default="step = step === 'details' ? 'capture' : 'choose'"
  >
    <div
      v-if="step === 'choose'"
      class="vf-create__choices"
    >
      <CdxButton
        v-for="option in KINDS"
        :key="option.kind"
        weight="quiet"
        class="vf-create__choice"
        @click="choose(option.kind)"
      >
        <CdxIcon :icon="option.icon" />
        {{ option.label }}
      </CdxButton>
    </div>

    <div
      v-else-if="step === 'capture'"
      class="vf-create__capture"
    >
      <div
        class="vf-create__viewfinder"
        data-theme="dark"
      >
        <CdxIcon :icon="kind === 'audio' ? cdxIconMicrophone : cdxIconCamera" />
        <span class="vf-create__hint">
          {{ kind === 'photo' ? 'Camera preview' : recording ? `● ${clock(elapsed)}` : 'Ready' }}
        </span>
      </div>
      <CdxButton
        class="vf-create__shutter"
        action="progressive"
        weight="primary"
        size="large"
        :aria-label="
          kind === 'photo' ? 'Take photo' : recording ? 'Stop recording' : 'Start recording'
        "
        @click="capture"
      >
        <CdxIcon
          :icon="
            kind === 'photo'
              ? cdxIconCamera
              : recording
                ? cdxIconStop
                : kind === 'audio'
                  ? cdxIconMicrophone
                  : cdxIconPlay
          "
        />
      </CdxButton>
      <p class="vf-create__hint">
        This prototype doesn’t use your camera or microphone.
      </p>
    </div>

    <div
      v-else
      class="vf-create__details"
    >
      <img
        v-if="preview"
        class="vf-create__preview"
        :src="preview"
        alt=""
      >
      <CdxField>
        <template #label>
          Connected articles
        </template>
        <CdxMultiselectLookup
          v-model:input-chips="chips"
          v-model:selected="selected"
          v-model:input-value="inputValue"
          :menu-items="menuItems"
          :menu-config="{ showThumbnail: true, visibleItemLimit: 4 }"
          placeholder="Search articles"
          @input="onLookupInput"
        />
      </CdxField>
      <CdxField :optional="true">
        <template #label>
          Caption
        </template>
        <CdxTextArea
          v-model="caption"
          placeholder="What does this show?"
        />
      </CdxField>
    </div>
  </CdxDialog>
</template>

<style scoped>
.vf-create__choices {
  display: flex;
  flex-direction: column;
}

.vf-create__choice.cdx-button {
  justify-content: flex-start;
  width: 100%;
  max-width: none;
  padding-inline: 0;
  font-weight: var(--font-weight-normal);
}

.vf-create__capture {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-100);
  text-align: center;
}

.vf-create__viewfinder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-50);
  width: 100%;
  aspect-ratio: 4 / 5;
  background-color: var(--background-color-base);
  color: var(--color-subtle);
}

.vf-create__hint {
  margin: 0;
  color: var(--color-subtle);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.vf-create__shutter.cdx-button {
  border-radius: var(--border-radius-circle);
}

.vf-create__details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100);
}

.vf-create__preview {
  width: var(--size-800);
  aspect-ratio: 9 / 16;
  object-fit: cover;
}
</style>
