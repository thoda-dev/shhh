<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { t, locale, locales, setLocale } = useI18n()

// `setLocale` is typed against the configured codes, not plain string: the value comes from `locales`, but the type has to say so.
type LocaleCode = typeof locale.value

const current = computed(() => locales.value.find(entry => entry.code === locale.value))

const items = computed<DropdownMenuItem[]>(() => locales.value.map(entry => ({
  label: entry.name ?? entry.code,
  type: 'checkbox' as const,
  checked: entry.code === locale.value,
  onSelect: () => setLocale(entry.code as LocaleCode)
})))
</script>

<template>
  <!-- A menu rather than a select: the trigger collapses to its icon on a phone, where a select has to keep room for its longest language name. -->
  <UDropdownMenu :items="items">
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-languages"
      :aria-label="t('nav.language')"
    >
      <span class="hidden sm:inline">{{ current?.name ?? locale }}</span>
    </UButton>
  </UDropdownMenu>
</template>
