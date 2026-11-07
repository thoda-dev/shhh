<script setup lang="ts">
import type { MarkdownDocument as MarkdownDocumentType } from 'comark'

interface LegalDocumentResponse {
  slug: string
  locale: string
  updatedAt: string
  document: MarkdownDocumentType
}

const { t, locale } = useI18n()
const route = useRoute()

const slug = computed(() => String(route.params.slug))

const { data } = await useFetch<LegalDocumentResponse>(() => `/api/legal/${slug.value}`, {
  query: { locale }
})

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: t('legal.notFound'), fatal: true })
}

// Overrides the app-wide title: these pages are the one part a reader may arrive at cold.
useSeoMeta({
  title: () => t(`legal.documents.${slug.value}`),
  description: () => t('legal.seoDescription')
})

const updatedAt = computed(() =>
  data.value ? new Date(data.value.updatedAt).toLocaleDateString(locale.value) : ''
)
</script>

<template>
  <UContainer class="max-w-3xl py-10 sm:py-16">
    <UPageHeader
      :title="t(`legal.documents.${slug}`)"
      :description="t('legal.updatedAt', { date: updatedAt })"
      class="mb-8"
    />

    <UAlert
      v-if="data && data.locale !== locale"
      color="neutral"
      variant="subtle"
      icon="i-lucide-languages"
      :title="t('legal.otherLanguage')"
      class="mb-6"
    />

    <RichText :value="data!.document" />
  </UContainer>
</template>
