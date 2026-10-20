<script setup lang="ts">
/** "More options" for a post: save, flag, show me less like this. */
import {
  cdxIconBookmark,
  cdxIconBookmarkOutline,
  cdxIconEyeClosed,
  cdxIconFlag,
} from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import M3BottomSheet from './M3BottomSheet.vue'
import { showSnackbar } from './snackbar'
import type { Post } from '../video-first-app/data'
import { showLess, state, toggleSave } from '../video-first-app/store'

const props = defineProps<{ post: Post | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ flag: [] }>()

function save(): void {
  const post = props.post
  if (!post) return
  const saved = toggleSave(post)
  open.value = false
  showSnackbar(saved ? 'Post saved' : 'Removed from saved', {
    label: 'Undo',
    run: () => toggleSave(post),
  })
}

function flag(): void {
  open.value = false
  emit('flag')
}

function less(): void {
  if (!props.post) return
  showLess(props.post)
  open.value = false
  showSnackbar('Got it. You’ll see less like this.')
}
</script>

<template>
  <M3BottomSheet
    v-model:open="open"
    title="More options"
  >
    <md-list>
      <md-list-item
        type="button"
        @click="save"
      >
        <CodexSvg
          slot="start"
          :icon="
            props.post && state.saved[props.post.id] ? cdxIconBookmark : cdxIconBookmarkOutline
          "
        />
        <span slot="headline">{{
          props.post && state.saved[props.post.id] ? 'Saved' : 'Save post'
        }}</span>
      </md-list-item>
      <md-list-item
        type="button"
        @click="flag"
      >
        <CodexSvg
          slot="start"
          :icon="cdxIconFlag"
        />
        <span slot="headline">Flag</span>
      </md-list-item>
      <md-list-item
        type="button"
        @click="less"
      >
        <CodexSvg
          slot="start"
          :icon="cdxIconEyeClosed"
        />
        <span slot="headline">Show me less like this</span>
      </md-list-item>
    </md-list>
  </M3BottomSheet>
</template>
