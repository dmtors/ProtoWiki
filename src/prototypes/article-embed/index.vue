<script setup lang="ts">
definePage({
  meta: {
    category: 'prototype',
    platform: 'web',
  },
})

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'

import ShareMenu from './ShareMenu.vue'
</script>

<template>
  <ChromeWrapper>
    <!-- No `article` prop → a random article loads on each visit. -->
    <ArticleLive>
      <template #header-actions="{ title, host }">
        <ShareMenu :title="title" :host="host" />
      </template>
    </ArticleLive>
  </ChromeWrapper>
</template>
