<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CdxDialog, CdxField, CdxRadio, CdxTextArea } from '@wikimedia/codex'

import SummaryBadge from './SummaryBadge.vue'
import { renderSummaryImage } from './renderSummaryImage'
import { SUMMARY_SIZES, summaryToQuery, type CitationSummary, type SummarySize } from './summary'

const props = defineProps<{ summary: CitationSummary }>()
const open = defineModel<boolean>('open', { required: true })

const size = ref<SummarySize>('detailed')
const router = useRouter()

const embedSrc = computed(() => {
  const { href } = router.resolve({
    path: '/cited-on-wikipedia/embed',
    query: summaryToQuery(props.summary, size.value),
  })
  return new URL(href, window.location.origin).href
})

/** The iframe takes the preview's rendered size (+2px so focus rings aren't clipped). */
const previewEl = ref<HTMLElement | null>(null)
const frameSize = ref({ width: 0, height: 0 })

async function measurePreview() {
  await nextTick()
  const badge = previewEl.value?.firstElementChild as HTMLElement | null
  if (!badge) return
  const rect = badge.getBoundingClientRect()
  frameSize.value = { width: Math.ceil(rect.width) + 2, height: Math.ceil(rect.height) + 2 }
}

watch([open, size, () => props.summary], () => open.value && measurePreview(), { immediate: true })

const embedCode = computed(
  () =>
    `<iframe src="${embedSrc.value}" width="${frameSize.value.width}" height="${frameSize.value.height}" ` +
    `style="border:0" title="Cited on Wikipedia" loading="lazy"></iframe>`,
)

/** Editable copy of the generated code — resets when the size or numbers change. */
const embedCodeText = ref('')
watch(embedCode, (code) => (embedCodeText.value = code), { immediate: true })

const status = ref<string | null>(null)

async function copyEmbedCode() {
  try {
    await navigator.clipboard.writeText(embedCodeText.value)
    status.value = 'Embed code copied.'
  } catch {
    status.value = "Couldn't copy — select the embed code and copy it manually."
  }
}

const downloading = ref(false)

async function downloadImage() {
  const badge = previewEl.value?.firstElementChild as HTMLElement | null
  if (!badge || downloading.value) return
  downloading.value = true
  try {
    const blob = await renderSummaryImage(badge)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `cited-on-wikipedia-${size.value}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 0)
    status.value = 'Image downloaded.'
  } catch {
    status.value = "Couldn't create the image."
  } finally {
    downloading.value = false
  }
}

watch(open, () => (status.value = null))
</script>

<template>
  <CdxDialog
    v-model:open="open"
    title="Share summary"
    use-close-button
    :primary-action="{ label: 'Copy', actionType: 'progressive' }"
    :default-action="{ label: 'Download image', disabled: downloading }"
    @primary="copyEmbedCode"
    @default="downloadImage"
  >
    <CdxField is-fieldset>
      <template #label>Size</template>
      <CdxRadio
        v-for="option in SUMMARY_SIZES"
        :key="option.value"
        v-model="size"
        name="summary-size"
        :input-value="option.value"
        inline
      >
        {{ option.label }}
      </CdxRadio>
    </CdxField>

    <div ref="previewEl" class="share-summary__preview">
      <SummaryBadge :summary="summary" :size="size" />
    </div>

    <CdxField>
      <template #label>Embed code</template>
      <CdxTextArea v-model="embedCodeText" :rows="4" />
    </CdxField>

    <p v-if="status" class="share-summary__status" role="status">
      <small>{{ status }}</small>
    </p>
  </CdxDialog>
</template>

<style scoped>
.share-summary__preview {
  margin-top: var(--spacing-150);
}

.share-summary__status {
  margin: var(--spacing-50) 0 0;
  color: var(--color-subtle);
}
</style>
