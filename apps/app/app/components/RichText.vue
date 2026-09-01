<script setup lang="ts">
// `MarkdownDocument` is registered globally by the @comark/nuxt module.
import type { MarkdownDocument as MarkdownDocumentType } from 'comark'
import RichTextTable from './RichTextTable.vue'

defineProps<{ value: MarkdownDocumentType }>()
</script>

<template>
  <div class="rich-text">
    <MarkdownDocument
      :value="value"
      :components="{ table: RichTextTable }"
    />
  </div>
</template>
