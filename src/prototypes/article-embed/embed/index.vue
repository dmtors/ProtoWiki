<script setup lang="ts">
/**
 * Standalone embed target — what the iframe in the Embed dialog loads.
 * `?title=Halley's_Comet&host=en.wikipedia.org&size=medium&signals=reads,references&link=donate`
 */
definePage({
  meta: {
    hidden: true,
  },
})

import { computed } from 'vue'
import { useRoute } from 'vue-router'

import EmbedCard from '../EmbedCard.vue'
import { embedOptionsFromQuery } from '../embedOptions'

const route = useRoute()
const title = computed(() => String(route.query.title ?? ''))
const host = computed(() => String(route.query.host ?? 'en.wikipedia.org'))
const options = computed(() => embedOptionsFromQuery(route.query))
</script>

<template>
  <main class="article-embed-frame">
    <EmbedCard
      v-if="title"
      :key="`${host}/${title}`"
      :title="title"
      :host="host"
      :size="options.size"
      :signals="options.signals"
      :link="options.link"
    />
  </main>
</template>

<style scoped>
.article-embed-frame {
  padding: var(--spacing-12);
  background-color: var(--background-color-base);
}
</style>
