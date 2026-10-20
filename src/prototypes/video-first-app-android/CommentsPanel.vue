<script setup lang="ts">
/** Comments under the shrunken video, M3 style. New comments stay local to the session. */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  cdxIconClose,
  cdxIconNext,
  cdxIconSpeechBubble,
  cdxIconUserAvatar,
} from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import { articlePath } from './routes'
import type { Comment, Post } from '../video-first-app/data'
import { addComment } from '../video-first-app/store'

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
  let last = 0
  for (const m of comment.text.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)) {
    if (m.index! > last) out.push({ text: comment.text.slice(last, m.index) })
    out.push({ text: m[2] ?? m[1], title: m[1] })
    last = m.index! + m[0].length
  }
  if (last < comment.text.length) out.push({ text: comment.text.slice(last) })
  return out
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
    class="vfa-comments"
    aria-label="Comments"
  >
    <header class="vfa-comments__header">
      <h2 class="md-typescale-title-medium vfa-comments__title">
        {{ title }}
      </h2>
      <md-icon-button
        aria-label="Close comments"
        @click="emit('close')"
      >
        <CodexSvg :icon="cdxIconClose" />
      </md-icon-button>
    </header>

    <ul class="vfa-comments__list">
      <li
        v-for="comment in props.post.comments"
        :key="comment.id"
        class="vfa-comments__item"
      >
        <span class="vfa-comments__avatar">
          <CodexSvg
            :icon="cdxIconUserAvatar"
            :size="20"
          />
        </span>
        <div class="vfa-comments__body">
          <p class="vfa-comments__meta">
            <span class="md-typescale-label-large">{{ comment.author }}</span>
            <span class="md-typescale-body-small vfa-comments__muted">{{ comment.ago }}</span>
          </p>
          <p class="md-typescale-body-medium vfa-comments__text">
            <template
              v-for="(seg, i) in segments(comment)"
              :key="i"
            >
              <a
                v-if="seg.title"
                href="#"
                :data-title="seg.title"
                @click.prevent="router.push(articlePath(seg.title))"
              >{{ seg.text }}</a>
              <template v-else>
                {{ seg.text }}
              </template>
            </template>
          </p>
        </div>
        <div class="vfa-comments__reply">
          <md-icon-button :aria-label="comment.replies ? `${comment.replies} replies` : 'Reply'">
            <CodexSvg
              :icon="cdxIconSpeechBubble"
              :size="20"
            />
          </md-icon-button>
          <span
            v-if="comment.replies"
            class="md-typescale-label-small vfa-comments__muted"
          >{{
            comment.replies
          }}</span>
        </div>
      </li>
      <li
        v-if="!props.post.comments.length"
        class="vfa-comments__empty md-typescale-body-medium"
      >
        No comments yet. Start the conversation.
      </li>
    </ul>

    <form
      class="vfa-comments__form"
      @submit.prevent="send"
    >
      <md-outlined-text-field
        class="vfa-comments__field"
        placeholder="Add a comment…"
        aria-label="Add a comment"
        :value="draft"
        @input="draft = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="send"
      >
        <md-icon-button
          slot="trailing-icon"
          aria-label="Send"
          :disabled="!draft.trim()"
          @click="send"
        >
          <CodexSvg :icon="cdxIconNext" />
        </md-icon-button>
      </md-outlined-text-field>
    </form>
  </section>
</template>

<style scoped>
.vfa-comments {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: var(--vfa-shape-extra-large) var(--vfa-shape-extra-large) 0 0;
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
}

.vfa-comments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px 4px 24px;
}

.vfa-comments__title {
  margin: 0;
}

.vfa-comments__list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 8px 0 16px;
  overflow-y: auto;
  list-style: none;
}

.vfa-comments__item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-block: 8px;
}

.vfa-comments__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-comments__body {
  flex: 1;
  min-width: 0;
}

.vfa-comments__meta,
.vfa-comments__text {
  margin: 0;
}

.vfa-comments__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.vfa-comments__muted,
.vfa-comments__empty {
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-comments__reply .vfa-comments__muted {
  font-weight: 400;
}

.vfa-comments__reply {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vfa-comments__empty {
  padding: 16px 8px;
}

.vfa-comments__form {
  padding: 8px 16px 16px;
}

.vfa-comments__field {
  width: 100%;
  --md-outlined-text-field-container-shape: 28px;
}
</style>
