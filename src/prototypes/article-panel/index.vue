<script setup lang="ts">
/**
 * A stand-in for someone else's website — a blog post with ordinary links to
 * Wikipedia. It includes the loader exactly as a real site would
 * (`<script src="…/embeds/article-panel.js">`), which turns those links into
 * previews: popover on hover (desktop), bottom sheet on tap (mobile).
 *
 * The preview itself is `./panel/`, shown by the loader in an iframe.
 */
definePage({
  meta: {
    category: 'prototype',
    platform: 'web',
  },
})

import { computed, onBeforeUnmount, onMounted } from 'vue'

/** Same URL a host site would paste — the loader works out the panel's address from it. */
const loaderSrc = computed(() => new URL(`${import.meta.env.BASE_URL}embeds/article-panel.js`, window.location.origin).href)

const snippet = computed(() => `<script src="${loaderSrc.value}" defer><\/script>`)

let script: HTMLScriptElement | null = null

onMounted(() => {
  script = document.createElement('script')
  script.src = loaderSrc.value
  document.body.appendChild(script)
})

onBeforeUnmount(() => {
  // A single-page app leaving the page: stop previews so other prototypes aren't affected.
  ;(window as unknown as { WikipediaArticlePanel?: { destroy(): void } }).WikipediaArticlePanel?.destroy()
  script?.remove()
})
</script>

<template>
  <div class="host">
    <header class="host__header">
      <span class="host__brand">Orbit Notes</span>
      <nav class="host__nav" aria-label="Site">
        <span>Sky guides</span>
        <span>Missions</span>
        <span>About</span>
      </nav>
    </header>

    <main class="host__article">
      <p class="host__kicker">Sky guides · 6 min read</p>
      <h1 class="host__title">Waiting for the comet that comes back</h1>

      <p>
        Every 75 years or so, a familiar visitor swings past the Sun.
        <a href="https://en.wikipedia.org/wiki/Halley%27s_Comet">Halley's Comet</a>
        is the only short-period comet you can reliably see without a telescope, and most people get
        one chance in a lifetime.
      </p>

      <p>
        It's named after <a href="https://en.wikipedia.org/wiki/Edmond_Halley">Edmond Halley</a>, who
        worked out in 1705 that sightings in 1531, 1607 and 1682 were the same object, and predicted its
        return. He didn't live to see it, but the comet arrived on schedule in 1758.
      </p>

      <p>
        Its last visit, in 1986, was a quiet one from Earth, but a busy one in space: a fleet of probes,
        led by the European
        <a href="https://en.wikipedia.org/wiki/Giotto_(spacecraft)">Giotto</a> mission, flew out to meet
        it. Giotto passed within 600 km of the nucleus and photographed a dark, peanut-shaped core.
      </p>

      <p>
        The comet's debris doesn't wait 75 years, though. Twice a year Earth crosses its trail, giving us
        the <a href="https://en.wikipedia.org/wiki/Orionids">Orionids</a> in October and the
        <span data-wikipedia="Eta Aquariids" data-lang="en" tabindex="0" class="host__mention">Eta Aquariids</span>
        in May.
      </p>

      <p>
        The next return is due in mid-2061. If you'd rather read about it in French, here's
        <a href="https://fr.wikipedia.org/wiki/Comète_de_Halley">la comète de Halley</a>.
      </p>
    </main>

    <aside class="host__publishers">
      <h2>For publishers: add Wikipedia previews to your site</h2>
      <p>
        Paste this before <code>&lt;/body&gt;</code>. Links to Wikipedia articles get a preview, and you
        can mark any text with <code>data-wikipedia="Article title"</code>.
      </p>
      <pre><code>{{ snippet }}</code></pre>
    </aside>
  </div>
</template>

<style scoped>
/*
 * Deliberately not Wikipedia-styled: this is someone else's site. Codex tokens
 * are only used for colour so it follows light/dark mode.
 */
.host {
  min-height: 100vh;
  background-color: var(--background-color-base);
  color: var(--color-base);
  font-family: Georgia, 'Times New Roman', serif;
}

.host__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 720px;
  margin: 0 auto;
  padding: 20px;
  border-bottom: 1px solid var(--border-color-muted);
}

.host__brand {
  font-weight: bold;
  font-size: 1.25rem;
  letter-spacing: 0.02em;
}

.host__nav {
  display: flex;
  gap: 16px;
  font-size: 0.95rem;
  color: var(--color-subtle);
}

.host__article,
.host__publishers {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 20px;
}

.host__kicker {
  margin: 32px 0 8px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-subtle);
}

.host__title {
  margin: 0 0 24px;
  font-size: 2.25rem;
  line-height: 1.15;
  font-weight: normal;
}

.host__article p {
  margin: 0 0 1.2em;
  font-size: 1.15rem;
  line-height: 1.7;
}

.host__article a {
  color: inherit;
  text-decoration-line: underline;
  text-decoration-color: var(--color-progressive);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

/* A non-link mention marked with data-wikipedia. */
.host__mention {
  border-bottom: 2px dotted var(--color-progressive);
  cursor: help;
}

.host__publishers {
  margin-top: 40px;
  padding-top: 24px;
  padding-bottom: 48px;
  border-top: 1px solid var(--border-color-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.95rem;
}

.host__publishers h2 {
  margin: 0 0 8px;
  font-family: inherit;
  font-size: 1rem;
}

.host__publishers pre {
  overflow-x: auto;
  padding: 12px;
  border-radius: 4px;
  background-color: var(--background-color-neutral-subtle);
  font-size: 0.85rem;
}
</style>
