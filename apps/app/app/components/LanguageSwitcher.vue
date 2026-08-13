<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const items = computed(() => locales.value.map(l => ({ label: l.name ?? l.code, value: l.code })))

const selected = computed({
  get: () => locale.value,
  set: (value: string) => setLocale(value)
})
</script>

<template>
  <USelect v-model="selected" :items="items" value-key="value" size="sm" class="w-28" />
</template>
