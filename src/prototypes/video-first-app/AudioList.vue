<script setup lang="ts">
/** Commons audio connected to an article. One plays at a time. */
import { onBeforeUnmount, ref } from 'vue'
import { CdxButton, CdxIcon } from '@wikimedia/codex'
import { cdxIconPause, cdxIconPlay } from '@wikimedia/codex-icons'

import { formatClock, type AudioRecording } from './data'

defineProps<{ recordings: AudioRecording[] }>()

const playing = ref<string | null>(null)
const position = ref<Record<string, number>>({})
const players = new Map<string, HTMLAudioElement>()

function setPlayer(id: string, el: unknown): void {
  if (el instanceof HTMLAudioElement) players.set(id, el)
  else players.delete(id)
}

function toggle(rec: AudioRecording): void {
  const player = players.get(rec.id)
  if (!player) return
  if (playing.value === rec.id) {
    player.pause()
    return
  }
  players.forEach((p, id) => {
    if (id !== rec.id) p.pause()
  })
  player.play().catch(() => {
    playing.value = null
  })
}

function onTime(rec: AudioRecording): void {
  position.value[rec.id] = players.get(rec.id)?.currentTime ?? 0
}

function onEnded(rec: AudioRecording): void {
  position.value[rec.id] = 0
  playing.value = null
}

onBeforeUnmount(() => players.forEach((p) => p.pause()))
</script>

<template>
  <ul class="vf-audio">
    <li
      v-for="rec in recordings"
      :key="rec.id"
      class="vf-audio__item"
    >
      <audio
        :ref="(el) => setPlayer(rec.id, el)"
        :src="rec.src"
        preload="none"
        @play="playing = rec.id"
        @pause="playing === rec.id && (playing = null)"
        @timeupdate="onTime(rec)"
        @ended="onEnded(rec)"
      />
      <CdxButton
        weight="quiet"
        class="vf-audio__play"
        :aria-label="playing === rec.id ? `Pause ${rec.title}` : `Play ${rec.title}`"
        @click="toggle(rec)"
      >
        <CdxIcon :icon="playing === rec.id ? cdxIconPause : cdxIconPlay" />
      </CdxButton>
      <div class="vf-audio__body">
        <p class="vf-audio__title">
          {{ rec.title }}
        </p>
        <div class="vf-audio__scrub">
          <div
            class="vf-audio__track"
            aria-hidden="true"
          >
            <span
              :style="{
                transform: `scaleX(${Math.max(0.01, (position[rec.id] ?? 0) / rec.duration)})`,
              }"
            />
          </div>
          <span class="vf-audio__time">{{
            playing === rec.id || position[rec.id]
              ? formatClock(position[rec.id] ?? 0)
              : formatClock(rec.duration)
          }}</span>
        </div>
        <p class="vf-audio__byline">
          {{ rec.author }} {{ rec.ago }}
        </p>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.vf-audio {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100);
  margin: 0;
  padding: 0;
  list-style: none;
}

.vf-audio__item {
  display: flex;
  align-items: flex-start;
}

/* The design sets the play glyph flush left, aligned with the page gutter. */
.vf-audio__play.cdx-button {
  flex-shrink: 0;
  margin: calc(-1 * var(--spacing-25)) var(--spacing-50) 0 calc(-1 * var(--spacing-50));
}

.vf-audio__body {
  flex: 1;
  min-width: 0;
}

.vf-audio__title,
.vf-audio__byline {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--font-size-medium);
  line-height: var(--line-height-medium);
}

.vf-audio__title {
  font-weight: var(--font-weight-bold);
}

.vf-audio__scrub {
  display: flex;
  align-items: center;
  gap: var(--spacing-25);
  margin-block: var(--spacing-25);
}

.vf-audio__track {
  flex: 1;
  height: var(--size-25);
  background-color: var(--background-color-interactive);
}

.vf-audio__track span {
  display: block;
  height: 100%;
  background-color: var(--background-color-inverted);
  transform-origin: left center;
}

.vf-audio__time {
  font-family: var(--font-family-monospace--fallback);
  font-size: var(--font-size-x-small);
  line-height: var(--line-height-x-small);
}
</style>
