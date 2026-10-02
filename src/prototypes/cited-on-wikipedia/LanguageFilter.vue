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
 * Icon-only filter button + dialog with a multiselect lookup of the result's
 * languages. Empty selection = every language included (the default).
 *
 * Picks are a draft until "Apply"; closing the dialog discards them.
 */
import { computed, ref, watch } from 'vue'
import { CdxButton, CdxDialog, CdxField, CdxIcon, CdxMultiselectLookup } from '@wikimedia/codex'
import type { ChipInputItem, MenuItemData } from '@wikimedia/codex'
import { cdxIconFilter } from '@wikimedia/codex-icons'

const props = defineProps<{
  options: LanguageOption[]
  /** Disabled until the check finishes, like Share summary. */
  disabled?: boolean
}>()
/** Applied language codes. */
const selected = defineModel<string[]>({ required: true })

const open = ref(false)
/** What's picked in the dialog — committed to `selected` only on Apply. */
const draft = ref<string[]>([])

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

// The lookup needs both chips and selected values; derive chips from the draft.
const chips = ref<ChipInputItem[]>([])
watch(
  [draft, allItems],
  () => {
    chips.value = draft.value.map((value) => ({
      value,
      label: allItems.value.find((item) => item.value === value)?.label ?? value,
    }))
  },
  { immediate: true },
)

function onChips(next: ChipInputItem[]) {
  chips.value = next
  draft.value = next.map((chip) => String(chip.value))
}

function onDraftSelected(next: (string | number)[]) {
  draft.value = next.map(String)
  query.value = ''
}

function openDialog() {
  draft.value = [...selected.value]
  query.value = ''
  open.value = true
}

function apply() {
  selected.value = [...draft.value]
  open.value = false
}

const active = computed(() => selected.value.length > 0)
const buttonLabel = computed(() =>
  active.value ? `Filter languages (${selected.value.length} selected)` : 'Filter languages',
)
</script>

<template>
  <CdxButton
    :action="active ? 'progressive' : 'default'"
    :aria-label="buttonLabel"
    :disabled="disabled"
    @click="openDialog"
  >
    <CdxIcon :icon="cdxIconFilter" />
  </CdxButton>

  <CdxDialog
    v-model:open="open"
    class="language-filter__dialog"
    title="Filter languages"
    use-close-button
    :primary-action="{ label: 'Apply', actionType: 'progressive' }"
    @primary="apply"
  >
    <CdxField>
      <template #label>Only include certain languages</template>
      <template #help-text>All languages are included by default.</template>
      <CdxMultiselectLookup
        v-model:input-value="query"
        :input-chips="chips"
        :selected="draft"
        :menu-items="menuItems"
        :menu-config="{ visibleItemLimit: 6 }"
        placeholder="Add a language"
        @update:input-chips="onChips"
        @update:selected="onDraftSelected"
      >
        <template #no-results>No matching languages</template>
      </CdxMultiselectLookup>
    </CdxField>
  </CdxDialog>
</template>
