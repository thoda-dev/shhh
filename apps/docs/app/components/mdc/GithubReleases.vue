<script setup lang="ts">
const { data: releases, status, error } = await useFetch('/api/releases')

const formatter = new Intl.DateTimeFormat('en', { dateStyle: 'long' })
</script>

<template>
  <div>
    <div
      v-if="status === 'pending'"
      class="flex flex-col gap-4"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-32 w-full"
      />
    </div>

    <UAlert
      v-else-if="error || !releases"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Releases unavailable"
      description="GitHub did not answer. The full list is always on the releases page of the repository."
      :actions="[{
        label: 'Open on GitHub',
        color: 'neutral',
        variant: 'outline',
        to: 'https://github.com/thoda-dev/shhh/releases',
        target: '_blank',
      }]"
    />

    <div
      v-else
      class="flex flex-col gap-12"
    >
      <section
        v-for="release in releases"
        :key="release.tag"
      >
        <div class="flex flex-wrap items-center gap-2 border-b border-default pb-3">
          <h2
            :id="release.tag"
            class="scroll-mt-20 text-xl font-bold text-highlighted"
          >
            {{ release.title }}
          </h2>

          <UBadge
            v-if="release.prerelease"
            color="warning"
            variant="subtle"
            size="sm"
          >
            Pre-release
          </UBadge>

          <span class="ms-auto flex items-center gap-3 text-sm text-muted">
            <time :datetime="release.publishedAt">{{ formatter.format(new Date(release.publishedAt)) }}</time>

            <ULink
              :to="release.url"
              target="_blank"
              class="inline-flex items-center gap-1 hover:text-default"
            >
              <UIcon name="i-simple-icons-github" class="size-4" />
              <span class="sr-only">{{ release.tag }} on GitHub</span>
            </ULink>
          </span>
        </div>

        <MDCRenderer
          v-if="release.body"
          :body="release.body"
          class="mt-4"
        />
      </section>
    </div>
  </div>
</template>
