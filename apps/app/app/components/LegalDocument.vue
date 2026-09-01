<script setup lang="ts">
// `MarkdownDocument` is registered globally by the @comark/nuxt module.
import type { MarkdownDocument as MarkdownDocumentType } from 'comark'
import LegalTable from './LegalTable.vue'

defineProps<{ value: MarkdownDocumentType }>()
</script>

<template>
  <div class="legal-document">
    <MarkdownDocument
      :value="value"
      :components="{ table: LegalTable }"
    />
  </div>
</template>
