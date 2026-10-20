<script setup lang="ts">
definePage({
  meta: {
    platform: 'app',
  },
})

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { cdxIconBookmark, cdxIconEye, cdxIconHeart } from '@wikimedia/codex-icons'

import AndroidShell from '../AndroidShell.vue'
import CodexSvg from '../CodexSvg.vue'
import { articlePath } from '../routes'
import { state } from '../../video-first-app/store'

const router = useRouter()

const VERB_ICON = { read: cdxIconEye, liked: cdxIconHeart, saved: cdxIconBookmark }
const VERB_LABEL = { read: 'Read', liked: 'Liked', saved: 'Saved' }

const interests = computed(() =>
  Object.entries(state.interests)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1]),
)
</script>

<template>
  <AndroidShell>
    <template #header>
      <header class="vfa-appbar">
        <h1 class="md-typescale-title-large">
          You
        </h1>
      </header>
    </template>

    <p class="vfa-intro md-typescale-body-medium">
      Your feed is made of Wikimedia Commons videos about the articles you read, like and save.
    </p>

    <h2 class="vfa-label md-typescale-title-small">
      History
    </h2>
    <md-list
      v-if="state.history.length"
      class="vfa-list"
    >
      <md-list-item
        v-for="h in state.history"
        :key="h.title"
        type="button"
        @click="router.push(articlePath(h.title))"
      >
        <CodexSvg
          slot="start"
          :icon="VERB_ICON[h.verb]"
        />
        <span slot="headline">{{ h.title }}</span>
        <span slot="supporting-text">{{ VERB_LABEL[h.verb] }}</span>
      </md-list-item>
    </md-list>
    <p
      v-else
      class="vfa-empty md-typescale-body-medium"
    >
      Nothing yet.
    </p>

    <h2 class="vfa-label md-typescale-title-small">
      Interest weights
    </h2>
    <md-list
      v-if="interests.length"
      class="vfa-list"
    >
      <md-list-item
        v-for="[topic, weight] in interests"
        :key="topic"
      >
        <span slot="headline">{{ topic }}</span>
        <span
          slot="end"
          class="md-typescale-label-large"
        >{{ weight }}</span>
      </md-list-item>
    </md-list>
    <p
      v-else
      class="vfa-empty md-typescale-body-medium"
    >
      Read, like or save something and it shows up here.
    </p>
  </AndroidShell>
</template>

<style scoped>
.vfa-appbar {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px;
}

.vfa-appbar h1 {
  margin: 0;
}

.vfa-intro {
  margin: 0;
  padding: 0 16px 8px;
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-label {
  margin: 0;
  padding: 16px 16px 8px;
  color: var(--md-sys-color-on-surface-variant);
}

.vfa-list {
  --md-list-container-color: transparent;
}

.vfa-empty {
  margin: 0;
  padding: 0 16px;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
