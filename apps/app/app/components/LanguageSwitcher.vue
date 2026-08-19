<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const items = computed(() => locales.value.map(l => ({ label: l.name ?? l.code, value: l.code })))

// `setLocale` is typed against the configured codes ('en' | 'fr'), not plain string — the value
// comes from `locales`, so it is always one of them, but the type has to say so.
type LocaleCode = typeof locale.value

const selected = computed({
  get: () => locale.value,
  set: (value: LocaleCode) => setLocale(value)
})
</script>

<template>
  <USelect
    v-model="selected"
    :items="items"
    value-key="value"
    size="sm"
    class="w-28"
  />
</template>
