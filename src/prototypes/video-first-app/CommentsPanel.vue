<script setup lang="ts">
/** Comments under the shrunken video. New comments stay local to the session. */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CdxButton, CdxIcon, CdxTextInput } from '@wikimedia/codex'
import { cdxIconClose, cdxIconSpeechBubble } from '@wikimedia/codex-icons'

import { type Comment, type Post } from './data'
import { addComment } from './store'

const props = defineProps<{ post: Post }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()

const draft = ref('')

const title = computed(() => {
  const n = props.post.comments.length
  return n === 1 ? '1 comment' : `${n} comments`
})

/** Split `[[Title|label]]` markup into text and article links. */
function segments(comment: Comment): { text: string; title?: string }[] {
  const out: { text: string; title?: string }[] = []
  const re = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g
  let last = 0
  for (const m of comment.text.matchAll(re)) {
    if (m.index! > last) out.push({ text: comment.text.slice(last, m.index) })
    out.push({ text: m[2] ?? m[1], title: m[1] })
    last = m.index! + m[0].length
  }
  if (last < comment.text.length) out.push({ text: comment.text.slice(last) })
  return out
}

function openArticle(title: string): void {
  router.push({ path: '/video-first-app/article', query: { title } })
}

function send(): void {
  const text = draft.value.trim()
  if (!text) return
  addComment(props.post, text)
  draft.value = ''
}
</script>

<template>
  <section
    class="vf-comments"
    aria-label="Comments"
  >
    <header class="vf-comments__header">
      <h2 class="vf-comments__title">
        {{ title }}
      </h2>
      <CdxButton
        weight="quiet"
        aria-label="Close comments"
        @click="emit('close')"
      >
        <CdxIcon :icon="cdxIconClose" />
      </CdxButton>
    </header>

    <ul class="vf-comments__list">
      <li
        v-for="comment in props.post.comments"
        :key="comment.id"
        class="vf-comments__item"
      >
        <div class="vf-comments__body">
          <p class="vf-comments__meta">
            <b>{{ comment.author }}</b> {{ comment.ago }}
          </p>
          <p class="vf-comments__text">
            <template
              v-for="(seg, i) in segments(comment)"
              :key="i"
            >
              <a
                v-if="seg.title"
                href="#"
                class="vf-comments__link"
                @click.prevent="openArticle(seg.title)"
              >{{ seg.text }}</a>
              <template v-else>
                {{ seg.text }}
              </template>
            </template>
          </p>
        </div>
        <CdxButton
          class="vf-comments__reply"
          weight="quiet"
          :aria-label="comment.replies ? `${comment.replies} replies` : 'Reply'"
        >
          <span class="vf-comments__reply-inner">
            <CdxIcon :icon="cdxIconSpeechBubble" />
            <span
              v-if="comment.replies"
              class="vf-comments__replies"
            >{{ comment.replies }}</span>
          </span>
        </CdxButton>
      </li>
      <li
        v-if="!props.post.comments.length"
        class="vf-comments__empty"
      >
        No comments yet. Start the conversation.
      </li>
    </ul>

    <form
      class="vf-comments__form"
      @submit.prevent="send"
    >
      <CdxTextInput
        v-model="draft"
        placeholder="Add a comment..."
        aria-label="Add a comment"
      />
    </form>
  </section>
</template>

<style scoped>
.vf-comments {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--background-color-base);
  color: var(--color-base);
}

.vf-comments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-75) var(--spacing-50) var(--spacing-25) var(--spacing-100);
}

.vf-comments__title {
  margin: 0;
  font-family: var(--font-family-sans);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
}

.vf-comments__list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 var(--spacing-50) 0 var(--spacing-100);
  overflow-y: auto;
  list-style: none;
}

.vf-comments__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-50);
  padding-block: var(--spacing-50);
}

.vf-comments__body {
  flex: 1;
  min-width: 0;
}

.vf-comments__meta,
.vf-comments__text,
.vf-comments__empty {
  margin: 0;
  font-size: var(--font-size-medium);
  line-height: var(--line-height-medium);
}

.vf-comments__meta b {
  margin-inline-end: var(--spacing-25);
}

.vf-comments__link {
  color: var(--color-link);
  text-decoration: none;
}

.vf-comments__empty {
  color: var(--color-subtle);
}

/* Icon with its reply count underneath. */
.vf-comments__reply.cdx-button {
  height: auto;
  padding-block: var(--spacing-25);
}

.vf-comments__reply-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vf-comments__replies {
  color: var(--color-subtle);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
}

.vf-comments__form {
  padding: var(--spacing-100);
}

.vf-comments__form :deep(.cdx-text-input) {
  width: 100%;
  max-width: none;
}
</style>
