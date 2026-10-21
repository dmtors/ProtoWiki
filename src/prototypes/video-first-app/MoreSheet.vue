<script setup lang="ts">
/** "More options" for a post: save, flag, show me less like this. */
import { CdxButton, CdxDialog, CdxIcon, useToast } from '@wikimedia/codex'
import {
  cdxIconBookmark,
  cdxIconBookmarkOutline,
  cdxIconEyeClosed,
  cdxIconFlag,
} from '@wikimedia/codex-icons'

import type { Post } from './data'
import { showLess, state, toggleSave } from './store'

const props = defineProps<{ post: Post | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ flag: [] }>()
const toast = useToast()

function save(): void {
  if (!props.post) return
  const saved = toggleSave(props.post)
  open.value = false
  toast.show({ message: saved ? 'Post saved' : 'Removed from saved', autoDismiss: true })
}

function flag(): void {
  open.value = false
  emit('flag')
}

function less(): void {
  if (!props.post) return
  showLess(props.post)
  open.value = false
  toast.show({ message: 'Got it. You’ll see less like this.', autoDismiss: true })
}
</script>

<template>
  <CdxDialog
    v-model:open="open"
    class="video-first-app__sheet"
    title="More options"
    :use-close-button="true"
  >
    <div class="vf-more">
      <CdxButton
        weight="quiet"
        class="vf-more__row"
        @click="save"
      >
        <CdxIcon
          :icon="
            props.post && state.saved[props.post.id] ? cdxIconBookmark : cdxIconBookmarkOutline
          "
        />
        {{ props.post && state.saved[props.post.id] ? 'Saved' : 'Save post' }}
      </CdxButton>
      <CdxButton
        weight="quiet"
        class="vf-more__row"
        @click="flag"
      >
        <CdxIcon :icon="cdxIconFlag" />
        Flag
      </CdxButton>
      <CdxButton
        weight="quiet"
        class="vf-more__row"
        @click="less"
      >
        <CdxIcon :icon="cdxIconEyeClosed" />
        Show me less like this
      </CdxButton>
    </div>
  </CdxDialog>
</template>

<style scoped>
.vf-more {
  display: flex;
  flex-direction: column;
}

/* Full-width rows; Codex paints the states, the design asks for regular-weight labels. */
.vf-more__row.cdx-button {
  justify-content: flex-start;
  width: 100%;
  max-width: none;
  padding-inline: 0;
  font-weight: var(--font-weight-normal);
}
</style>
