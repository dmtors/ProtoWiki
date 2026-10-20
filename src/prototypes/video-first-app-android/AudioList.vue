<script setup lang="ts">
/** Commons audio connected to an article, as an M3 list. One plays at a time. */
import { onBeforeUnmount, ref } from 'vue'
import { cdxIconPause, cdxIconPlay } from '@wikimedia/codex-icons'

import CodexSvg from './CodexSvg.vue'
import { formatClock, type AudioRecording } from '../video-first-app/data'

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
  players.forEach((p, id) => id !== rec.id && p.pause())
  player.play().catch(() => (playing.value = null))
}

onBeforeUnmount(() => players.forEach((p) => p.pause()))
</script>

<template>
  <md-list class="vfa-audio">
    <md-list-item
      v-for="rec in recordings"
      :key="rec.id"
    >
      <audio
        :ref="(el) => setPlayer(rec.id, el)"
        :src="rec.src"
        preload="none"
        @play="playing = rec.id"
        @pause="playing === rec.id && (playing = null)"
        @timeupdate="position[rec.id] = players.get(rec.id)?.currentTime ?? 0"
        @ended="
          () => {
            position[rec.id] = 0
            playing = null
          }
        "
      />
      <md-filled-tonal-icon-button
        slot="start"
        :aria-label="playing === rec.id ? `Pause ${rec.title}` : `Play ${rec.title}`"
        @click="toggle(rec)"
      >
        <CodexSvg :icon="playing === rec.id ? cdxIconPause : cdxIconPlay" />
      </md-filled-tonal-icon-button>
      <span slot="headline">{{ rec.title }}</span>
      <span slot="supporting-text">{{ rec.author }} · {{ rec.ago }}</span>
      <span
        slot="end"
        class="md-typescale-label-medium vfa-audio__time"
      >{{
        playing === rec.id || position[rec.id]
          ? formatClock(position[rec.id] ?? 0)
          : formatClock(rec.duration)
      }}</span>
      <!-- Always shown (at 0 until played) so rows don't jump when playback starts. -->
      <md-linear-progress
        slot="supporting-text"
        class="vfa-audio__progress"
        :value="(position[rec.id] ?? 0) / rec.duration"
      />
    </md-list-item>
  </md-list>
</template>

<style scoped>
.vfa-audio {
  --md-list-container-color: transparent;
  --md-list-item-label-text-weight: 700;
}

.vfa-audio__time {
  color: var(--md-sys-color-on-surface-variant);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.vfa-audio__progress {
  display: block;
  margin-top: 8px;
  --md-linear-progress-track-shape: 2px;
}
</style>
