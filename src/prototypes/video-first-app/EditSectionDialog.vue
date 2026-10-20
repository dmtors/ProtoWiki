<script setup lang="ts">
/**
 * Plain-text section editor for the Read tab. Publishing rewrites the section's
 * paragraphs in the page only — nothing is sent to Wikipedia.
 */
import { ref, watch } from 'vue'
import {
  CdxDialog,
  CdxField,
  CdxMessage,
  CdxTextArea,
  CdxTextInput,
  useToast,
} from '@wikimedia/codex'

const props = defineProps<{ section: { title: string; text: string } | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ publish: [text: string] }>()
const toast = useToast()

const text = ref('')
const summary = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    text.value = props.section?.text ?? ''
    summary.value = ''
  }
})

function publish(): void {
  emit('publish', text.value)
  open.value = false
  toast.show({
    type: 'success',
    message: 'Edit published (sample only — not saved to Wikipedia)',
    autoDismiss: true,
  })
}
</script>

<template>
  <CdxDialog
    v-model:open="open"
    class="video-first-app__sheet"
    :title="`Edit: ${props.section?.title ?? ''}`"
    :use-close-button="true"
    :primary-action="{
      label: 'Publish',
      actionType: 'progressive',
      disabled: text === (props.section?.text ?? ''),
    }"
    :default-action="{ label: 'Cancel' }"
    @primary="publish"
    @default="open = false"
  >
    <CdxMessage class="vf-edit__note">
      Posts connected to this article stay linked to it after your edit.
    </CdxMessage>
    <CdxField>
      <template #label>
        Section text
      </template>
      <CdxTextArea
        v-model="text"
        :autosize="true"
        rows="8"
      />
    </CdxField>
    <CdxField :optional="true">
      <template #label>
        Edit summary
      </template>
      <CdxTextInput
        v-model="summary"
        placeholder="Briefly describe your changes"
      />
    </CdxField>
  </CdxDialog>
</template>

<style scoped>
.vf-edit__note {
  margin-bottom: var(--spacing-100);
}
</style>
