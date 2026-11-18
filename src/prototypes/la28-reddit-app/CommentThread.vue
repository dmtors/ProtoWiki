<script setup lang="ts">
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconArrowDown, cdxIconArrowUp, cdxIconSpeechBubble } from '@wikimedia/codex-icons'

import type { Comment } from '../la28-shared/data'

defineOptions({ name: 'CommentThread' })

defineProps<{ comment: Comment; depth?: number }>()

function avatarColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return `hsl(${hash} 55% 50%)`
}
</script>

<template>
  <div
    class="comment"
    :class="{ 'comment--reply': (depth ?? 0) > 0 }"
  >
    <div class="comment__meta">
      <span
        class="comment__avatar"
        :style="{ backgroundColor: avatarColor(comment.author) }"
      />
      <strong>{{ comment.author }}</strong>
      <span>· {{ comment.age }}</span>
    </div>
    <div class="comment__content">
      <p class="comment__body">
        {{ comment.body }}
      </p>
      <div class="comment__actions">
        <CdxIcon
          :icon="cdxIconArrowUp"
          size="small"
        />
        <span>{{ comment.score }}</span>
        <CdxIcon
          :icon="cdxIconArrowDown"
          size="small"
        />
        <span class="comment__reply">
          <CdxIcon
            :icon="cdxIconSpeechBubble"
            size="small"
          />
          Reply
        </span>
      </div>
      <CommentThread
        v-for="(reply, index) in comment.replies ?? []"
        :key="index"
        :comment="reply"
        :depth="(depth ?? 0) + 1"
      />
    </div>
  </div>
</template>

<style scoped>
.comment {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25, 4px);
}

.comment--reply {
  margin-top: var(--spacing-75, 12px);
}

.comment__meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
}

.comment__meta strong {
  color: var(--color-base, #202122);
}

.comment__avatar {
  width: 22px;
  height: 22px;
  margin-inline-end: var(--spacing-25, 4px);
  border-radius: 50%;
}

.comment__content {
  margin-inline-start: 10px;
  padding-inline-start: 18px;
  border-inline-start: 2px solid var(--border-color-muted, #dadde3);
}

.comment__body {
  margin: 0;
  font-size: var(--font-size-small, 0.875rem);
  line-height: 1.5;
}

.comment__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  margin-top: var(--spacing-25, 4px);
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-x-small, 0.75rem);
  font-weight: var(--font-weight-bold, 700);
}

.comment__actions .cdx-icon {
  color: currentColor;
}

.comment__reply {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  margin-inline-start: var(--spacing-50, 8px);
}
</style>
