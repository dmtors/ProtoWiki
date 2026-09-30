<script lang="ts">
export interface LanguageOption {
  /** Wiki language code, e.g. "ja". */
  value: string
  /** English name, e.g. "Japanese". */
  label: string
  citations: number
}
</script>

<script setup lang="ts">
/**
 * Icon-only filter button + popover with a multiselect lookup of the result's
 * languages. Empty selection = every language included (the default).
 */
import { computed, ref, watch } from 'vue'
import { CdxButton, CdxField, CdxIcon, CdxMultiselectLookup, CdxPopover } from '@wikimedia/codex'
import type { ChipInputItem, MenuItemData } from '@wikimedia/codex'
import { cdxIconFilter } from '@wikimedia/codex-icons'

const props = defineProps<{ options: LanguageOption[] }>()
/** Selected language codes. */
const selected = defineModel<string[]>({ required: true })

const open = ref(false)
const anchor = ref<InstanceType<typeof CdxButton> | null>(null)
const anchorEl = computed(() => (anchor.value?.$el as HTMLElement | undefined) ?? null)

const allItems = computed<MenuItemData[]>(() =>
  props.options.map((option) => ({
    value: option.value,
    label: option.label,
    description: `${option.citations} citation${option.citations === 1 ? '' : 's'}`,
  })),
)

// MultiselectLookup leaves filtering to the parent: narrow the menu to what's typed.
const query = ref('')
const menuItems = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allItems.value
  return allItems.value.filter(
    (item) => item.label?.toLowerCase().includes(q) || String(item.value).toLowerCase().startsWith(q),
  )
})

// The lookup needs both chips and selected values; derive chips from the selection.
const chips = ref<ChipInputItem[]>([])
watch(
  [selected, allItems],
  () => {
    chips.value = selected.value.map((value) => ({
      value,
      label: allItems.value.find((item) => item.value === value)?.label ?? value,
    }))
  },
  { immediate: true },
)

function onChips(next: ChipInputItem[]) {
  chips.value = next
  selected.value = next.map((chip) => String(chip.value))
}

function onSelected(next: (string | number)[]) {
  selected.value = next.map(String)
  query.value = ''
}

const active = computed(() => selected.value.length > 0)
const buttonLabel = computed(() =>
  active.value
    ? `Filter languages (${selected.value.length} selected)`
    : 'Filter languages',
)
</script>

<template>
  <!--
    Single root: the in-place popover adds elements beside the button when open.
    Kept inside this wrapper, they can't pick up the header's flex gaps and
    shove the button sideways.
  -->
  <div class="language-filter">
    <CdxButton
      ref="anchor"
      :action="active ? 'progressive' : 'default'"
      :aria-label="buttonLabel"
      :aria-expanded="open"
      @click="open = !open"
    >
      <CdxIcon :icon="cdxIconFilter" />
    </CdxButton>

    <CdxPopover
      v-model:open="open"
      :anchor="anchorEl"
      class="language-filter__popover"
      placement="bottom-end"
      title="Filter languages"
      use-close-button
      render-in-place
    >
      <CdxField>
        <template #label>Only include certain languages</template>
        <template #help-text>All languages are included by default.</template>
        <CdxMultiselectLookup
          v-model:input-value="query"
          :input-chips="chips"
          :selected="selected"
          :menu-items="menuItems"
          :menu-config="{ visibleItemLimit: 6 }"
          placeholder="Add a language"
          @update:input-chips="onChips"
          @update:selected="onSelected"
        >
          <template #no-results>No matching languages</template>
        </CdxMultiselectLookup>
      </CdxField>
    </CdxPopover>
  </div>
</template>

<!-- Unscoped: CdxPopover's root doesn't carry this component's scope attribute. -->
<style>
/*
 * CdxPopover's body scrolls (overflow-y: auto), which clips the lookup's
 * absolutely positioned menu. This content is short, so let the menu extend
 * past the popover instead.
 */
.language-filter__popover .cdx-popover__body {
  overflow: visible;
}

.language-filter {
  display: inline-flex;
}
</style>
