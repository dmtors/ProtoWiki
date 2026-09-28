<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CdxCheckbox,
  CdxDialog,
  CdxField,
  CdxIcon,
  CdxMenuButton,
  CdxRadio,
  CdxSelect,
  CdxTextArea,
} from '@wikimedia/codex'
import type { MenuButtonItemData } from '@wikimedia/codex'
import { cdxIconArticle, cdxIconLink, cdxIconMarkup, cdxIconShare } from '@wikimedia/codex-icons'

import EmbedCard from './EmbedCard.vue'
import {
  DEFAULT_EMBED_OPTIONS,
  EMBED_FRAME_HEIGHT,
  EMBED_LINKS,
  EMBED_SIGNALS,
  EMBED_SIZES,
  embedOptionsToQuery,
  type EmbedLink,
  type EmbedSignal,
  type EmbedSize,
} from './embedOptions'

const props = defineProps<{
  /** Page title being shared (null while a random article resolves). */
  title: string | null
  host: string
}>()

const menuItems: MenuButtonItemData[] = [
  { value: 'copy-url', label: 'Copy URL', icon: cdxIconLink },
  { value: 'preview', label: 'Article preview', icon: cdxIconArticle },
  { value: 'embed', label: 'Embed', icon: cdxIconMarkup },
]

const selected = ref<string | null>(null)
const embedOpen = ref(false)

async function onSelect(value: string | null) {
  if (value === 'embed') embedOpen.value = true
  // 'copy-url' and 'preview' are placeholders for now.

  // Reset so the same item can be picked again.
  await nextTick()
  selected.value = null
}

const size = ref<EmbedSize>(DEFAULT_EMBED_OPTIONS.size)
const signals = ref<EmbedSignal[]>([...DEFAULT_EMBED_OPTIONS.signals])
const link = ref<EmbedLink>(DEFAULT_EMBED_OPTIONS.link)

/** Keep the author's picks in the canonical signal order regardless of click order. */
const orderedSignals = computed(() =>
  EMBED_SIGNALS.map((s) => s.value).filter((v) => signals.value.includes(v)),
)

const router = useRouter()

/** Absolute URL of the standalone embed route for this article + options. */
const embedSrc = computed(() => {
  if (!props.title) return ''
  const { href } = router.resolve({
    path: '/article-embed/embed',
    query: {
      title: props.title,
      host: props.host,
      ...embedOptionsToQuery({ size: size.value, signals: orderedSignals.value, link: link.value }),
    },
  })
  return new URL(href, window.location.origin).href
})

const embedCode = computed(
  () =>
    `<iframe src="${embedSrc.value}" width="600" height="${EMBED_FRAME_HEIGHT[size.value]}" style="border:0" ` +
    `title="${(props.title ?? '').replace(/"/g, '&quot;')} — Wikipedia" loading="lazy"></iframe>`,
)

/** Editable copy of the generated code — resets whenever the article (and so the code) changes. */
const embedCodeText = ref('')
watch(embedCode, (code) => (embedCodeText.value = code), { immediate: true })

const primaryAction = computed(() => ({
  label: 'Copy',
  actionType: 'progressive' as const,
  disabled: !props.title,
}))

async function copyEmbedCode() {
  try {
    await navigator.clipboard.writeText(embedCodeText.value)
  } catch {
    // Clipboard blocked (insecure context / permissions) — the code is still selectable.
  }
}
</script>

<template>
  <CdxMenuButton
    v-model:selected="selected"
    :menu-items="menuItems"
    aria-label="Share"
    weight="quiet"
    @update:selected="onSelect"
  >
    <CdxIcon :icon="cdxIconShare" />
  </CdxMenuButton>

  <CdxDialog
    v-model:open="embedOpen"
    title="Embed article"
    use-close-button
    :primary-action="primaryAction"
    @primary="copyEmbedCode"
  >
    <div v-if="title" class="share-menu__options">
      <CdxField is-fieldset>
        <template #label>Size</template>
        <CdxRadio
          v-for="option in EMBED_SIZES"
          :key="option.value"
          v-model="size"
          name="embed-size"
          :input-value="option.value"
          inline
        >
          {{ option.label }}
        </CdxRadio>
      </CdxField>

      <CdxField is-fieldset>
        <template #label>Trust signals</template>
        <CdxCheckbox
          v-for="option in EMBED_SIGNALS"
          :key="option.value"
          v-model="signals"
          :input-value="option.value"
          inline
        >
          {{ option.label }}
        </CdxCheckbox>
      </CdxField>

      <CdxField>
        <template #label>Link</template>
        <CdxSelect v-model:selected="link" :menu-items="EMBED_LINKS" class="share-menu__link" />
      </CdxField>
    </div>

    <div v-if="title" class="share-menu__embed">
      <EmbedCard
        :key="`${host}/${title}`"
        :title="title"
        :host="host"
        :size="size"
        :signals="orderedSignals"
        :link="link"
      />

      <CdxField>
        <CdxTextArea v-model="embedCodeText" :rows="4" />
        <template #label>Embed code</template>
      </CdxField>
    </div>
  </CdxDialog>
</template>

<style scoped>
.share-menu__options {
  margin-bottom: var(--spacing-150);
}

/* Tighter than Codex's default 16px stacking between option fields. */
.share-menu__options .cdx-field:not(:first-child) {
  margin-top: var(--spacing-50);
}

/* Codex Select is inline-block (its handle is already width: 100%) — span the dialog. */
.share-menu__link {
  display: block;
}

.share-menu__embed {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25);
}
</style>
