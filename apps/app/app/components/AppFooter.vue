<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const settings = await ensurePublicSettingsLoaded()
const documents = computed(() => settings.value?.legalDocuments ?? [])
</script>

<template>
  <UFooter :ui="{ root: 'border-t border-default' }">
    <template #left>
      <p class="text-sm text-muted">
        {{ t('footer.tagline') }}
      </p>
    </template>

    <nav
      v-if="documents.length"
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm"
    >
      <ULink
        v-for="slug in documents"
        :key="slug"
        :to="localePath(`/legal/${slug}`)"
        class="text-muted hover:text-default"
      >
        {{ t(`legal.documents.${slug}`) }}
      </ULink>
    </nav>

    <!-- Upstream project and its documentation, not the running instance: a fork may repoint them, but they are attribution. -->
    <template #right>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-book-open"
        :aria-label="t('nav.documentation')"
        href="https://shhh-docs.thoda.dev"
        target="_blank"
        rel="noopener noreferrer"
      />
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-github"
        aria-label="GitHub"
        href="https://github.com/thoda-dev/shhh"
        target="_blank"
        rel="noopener noreferrer"
      />
    </template>
  </UFooter>
</template>
