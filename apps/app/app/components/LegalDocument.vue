<script setup lang="ts">
// `MarkdownDocument` is registered globally by the @comark/nuxt module.
import type { MarkdownDocument as MarkdownDocumentType } from 'comark'

defineProps<{ value: MarkdownDocumentType }>()
</script>

<template>
  <div class="legal-document">
    <MarkdownDocument :value="value" />
  </div>
</template>

<style scoped>
/* The only prose in the app; the tag set is fixed by shared/utils/legal-markdown.ts. */
.legal-document {
  font-size: 0.9375rem;
  line-height: 1.7;
}

.legal-document :deep(> *:first-child) {
  margin-top: 0;
}

.legal-document :deep(h1) {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--ui-text-highlighted);
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--ui-border);
}

.legal-document :deep(h2) {
  font-size: 1.1875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ui-text-highlighted);
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}

.legal-document :deep(h3),
.legal-document :deep(h4),
.legal-document :deep(h5),
.legal-document :deep(h6) {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin-top: 1.75rem;
  margin-bottom: 0.5rem;
}

.legal-document :deep(p) {
  margin-bottom: 1rem;
}

.legal-document :deep(strong) {
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.legal-document :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.legal-document :deep(a:hover) {
  text-decoration-thickness: 2px;
}

.legal-document :deep(ul),
.legal-document :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.legal-document :deep(ul) {
  list-style: disc;
}

.legal-document :deep(ol) {
  list-style: decimal;
}

.legal-document :deep(li) {
  margin-bottom: 0.375rem;
}

.legal-document :deep(li::marker) {
  color: var(--ui-text-dimmed);
}

.legal-document :deep(blockquote) {
  border-left: 2px solid var(--ui-border-accented);
  padding-left: 1rem;
  margin: 1.25rem 0;
  color: var(--ui-text-muted);
}

/* Retention and cookie tables are the reason these documents need tables at all, and they overflow
   on a phone rather than squeezing the columns. */
.legal-document :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
}

.legal-document :deep(th),
.legal-document :deep(td) {
  border: 1px solid var(--ui-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
}

.legal-document :deep(th) {
  background-color: var(--ui-bg-elevated);
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
}

.legal-document :deep(code) {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.875em;
  background-color: var(--ui-bg-elevated);
  border-radius: var(--ui-radius);
  padding: 0.125rem 0.25rem;
}

.legal-document :deep(pre) {
  background-color: var(--ui-bg-elevated);
  border-radius: var(--ui-radius);
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 1.25rem;
}

.legal-document :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.legal-document :deep(hr) {
  border-top: 1px solid var(--ui-border);
  margin: 2rem 0;
}

.legal-document :deep(img) {
  max-width: 100%;
  border-radius: var(--ui-radius);
}
</style>
