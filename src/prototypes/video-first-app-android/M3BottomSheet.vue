<script setup lang="ts">
/**
 * M3 modal bottom sheet: scrim, surface-container-low, 28dp top corners, drag
 * handle. Drag the handle (or the sheet) down, tap the scrim or press Escape to
 * dismiss. Material Web has no sheet, so this is built from M3 specs on Codex tokens.
 */
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ title?: string; fullHeight?: boolean }>(), {
  title: undefined,
  fullHeight: false,
})
const open = defineModel<boolean>('open', { default: false })

const dragY = ref(0)
let startY: number | null = null

function onPointerDown(e: PointerEvent): void {
  startY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (startY === null) return
  dragY.value = Math.max(0, e.clientY - startY)
}

function onPointerUp(): void {
  if (startY === null) return
  if (dragY.value > 80) open.value = false
  dragY.value = 0
  startY = null
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="vfa-sheet">
    <div
      v-if="open"
      class="vfa-sheet"
    >
      <div
        class="vfa-sheet__scrim"
        @click="open = false"
      />
      <section
        class="vfa-sheet__surface"
        :class="{ 'vfa-sheet__surface--full': props.fullHeight }"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title"
        :style="dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined"
      >
        <div
          class="vfa-sheet__handle-area"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <span class="vfa-sheet__handle" />
        </div>
        <header
          v-if="props.title || $slots.actions"
          class="vfa-sheet__header"
        >
          <h2 class="vfa-sheet__title md-typescale-title-large">
            {{ props.title }}
          </h2>
          <slot name="actions" />
        </header>
        <div class="vfa-sheet__body">
          <slot />
        </div>
        <slot name="footer" />
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.vfa-sheet {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.vfa-sheet__scrim {
  position: absolute;
  inset: 0;
  background-color: var(--md-sys-color-scrim);
  opacity: 0.5;
}

.vfa-sheet__surface {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: 85%;
  border-radius: var(--vfa-shape-extra-large) var(--vfa-shape-extra-large) 0 0;
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  transition: transform 300ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-sheet__surface--full {
  height: 85%;
}

.vfa-sheet__handle-area {
  display: flex;
  justify-content: center;
  padding-block: 22px;
  cursor: grab;
  touch-action: none;
}

.vfa-sheet__handle {
  width: 32px;
  height: 4px;
  border-radius: 2px;
  background-color: var(--md-sys-color-on-surface-variant);
  opacity: 0.4;
}

.vfa-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 var(--vfa-icon-edge) 8px var(--vfa-gutter);
}

.vfa-sheet__title {
  margin: 0;
  font-weight: 700;
}

.vfa-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 16px;
}

.vfa-sheet__body :deep(md-list) {
  --md-list-container-color: transparent;
}

/* Enter: emphasized decelerate up; exit: emphasized accelerate down. */
.vfa-sheet-enter-active .vfa-sheet__surface {
  transition: transform 400ms var(--vfa-ease-emphasized-decelerate);
}

.vfa-sheet-leave-active .vfa-sheet__surface {
  transition: transform 200ms var(--vfa-ease-emphasized-accelerate);
}

.vfa-sheet-enter-active .vfa-sheet__scrim,
.vfa-sheet-leave-active .vfa-sheet__scrim {
  transition: opacity 300ms var(--vfa-ease-standard);
}

.vfa-sheet-enter-active,
.vfa-sheet-leave-active {
  transition: opacity 400ms;
}

.vfa-sheet-enter-from .vfa-sheet__surface,
.vfa-sheet-leave-to .vfa-sheet__surface {
  transform: translateY(100%);
}

.vfa-sheet-enter-from .vfa-sheet__scrim,
.vfa-sheet-leave-to .vfa-sheet__scrim {
  opacity: 0;
}
</style>
