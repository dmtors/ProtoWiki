<script setup lang="ts">
/**
 * Standalone embed target for the Share summary dialog. The numbers travel in
 * the query, so the badge renders instantly — no re-check:
 * `?size=detailed&url=https://…&citations=28&languages=20&visits=266603`
 */
definePage({
  meta: {
    hidden: true,
  },
})

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import SummaryBadge from '../SummaryBadge.vue'
import { summaryFromQuery } from '../summary'

const route = useRoute()
const router = useRouter()
const parsed = computed(() => summaryFromQuery(route.query))

/** Links back to the full check for this source. */
const checkerHref = computed(() => {
  if (!parsed.value.summary.source) return undefined
  const { href } = router.resolve({ path: '/cited-on-wikipedia', query: { url: parsed.value.summary.source } })
  return new URL(href, window.location.origin).href
})
</script>

<template>
  <main class="summary-embed-frame">
    <SummaryBadge :summary="parsed.summary" :size="parsed.size" :href="checkerHref" />
  </main>
</template>

<style scoped>
/* 1px inset matches the +2px the dialog adds to the iframe size, so focus rings aren't clipped. */
.summary-embed-frame {
  padding: 1px;
}
</style>
