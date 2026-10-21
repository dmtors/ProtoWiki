<script setup lang="ts">
/** "Flag" from More options: an M3 dialog with a reason picker (mocked submit). */
import { ref, watch } from 'vue'

import { showSnackbar } from './snackbar'
import type { Post } from '../video-first-app/data'
import { flagPost } from '../video-first-app/store'

const props = defineProps<{ post: Post | null }>()
const open = defineModel<boolean>('open', { default: false })

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
  showSnackbar('Thanks. The post was flagged for review.')
}
</script>

<template>
  <md-dialog
    :open="open"
    @closed="open = false"
  >
    <div slot="headline">
      Flag this post?
    </div>
    <form
      slot="content"
      method="dialog"
      class="vfa-flag"
    >
      <label
        v-for="r in REASONS"
        :key="r.value"
        class="vfa-flag__option md-typescale-body-large"
      >
        <md-radio
          name="flag-reason"
          :value="r.value"
          :checked="reason === r.value"
          @change="reason = r.value"
        />
        {{ r.label }}
      </label>
    </form>
    <div slot="actions">
      <md-text-button @click="open = false">
        Cancel
      </md-text-button>
      <md-text-button
        :disabled="!reason"
        @click="submit"
      >
        Flag
      </md-text-button>
    </div>
  </md-dialog>
</template>

<style scoped>
.vfa-flag {
  display: flex;
  flex-direction: column;
}

.vfa-flag__option {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 48px;
  cursor: pointer;
}
</style>
