<script setup lang="ts">
/** 9:16 grid tile for a post (article Video tab, Saved). */
import type { Post } from './data'

const props = defineProps<{ post: Post }>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="vf-post-thumb"
    :aria-label="`Video by ${props.post.author}: ${props.post.caption}`"
    @click="emit('select')"
  >
    <img
      class="vf-post-thumb__media"
      :src="props.post.thumb"
      alt=""
    >
  </button>
</template>

<style scoped>
.vf-post-thumb {
  display: block;
  aspect-ratio: 9 / 16;
  width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  background-color: var(--background-color-interactive-subtle);
  cursor: pointer;
}

.vf-post-thumb:focus-visible {
  outline: var(--border-width-thick) solid var(--border-color-progressive--focus);
  outline-offset: var(--border-width-base);
}

.vf-post-thumb__media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
