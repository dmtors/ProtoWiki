<script setup lang="ts">
/** "Flag" from the more menu: pick a reason, submit (mocked). */
import { ref, watch } from 'vue'
import { CdxDialog, CdxField, CdxRadio, useToast } from '@wikimedia/codex'

import type { Post } from './data'
import { flagPost } from './store'

const props = defineProps<{ post: Post | null }>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const REASONS = [
  { value: 'inaccurate', label: 'Inaccurate or misleading' },
  { value: 'unrelated', label: 'Not related to the connected articles' },
  { value: 'copyright', label: 'Copyright problem' },
  { value: 'harassment', label: 'Harassment or hate' },
  { value: 'spam', label: 'Spam' },
]

const reason = ref<string | null>(null)
watch(open, (isOpen) => {
  if (isOpen) reason.value = null
})

function submit(): void {
  if (!props.post || !reason.value) return
  flagPost(props.post)
  open.value = false
  toast.show({
    type: 'success',
    message: 'Thanks — the post was flagged for review',
    autoDismiss: true,
  })
}
</script>

<template>
  <CdxDialog
    v-model:open="open"
    class="video-first-app__sheet"
    title="Flag this post"
    :use-close-button="true"
    :primary-action="{ label: 'Flag', actionType: 'destructive', disabled: !reason }"
    :default-action="{ label: 'Cancel' }"
    @primary="submit"
    @default="open = false"
  >
    <CdxField :is-fieldset="true">
      <template #label>
        What’s wrong with it?
      </template>
      <CdxRadio
        v-for="r in REASONS"
        :key="r.value"
        v-model="reason"
        name="flag-reason"
        :input-value="r.value"
      >
        {{ r.label }}
      </CdxRadio>
    </CdxField>
  </CdxDialog>
</template>
