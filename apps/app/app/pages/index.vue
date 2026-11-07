<script setup lang="ts">
const { t } = useI18n()
const url = useRequestURL()

// The large preview card is the home page's alone — every other route, a paste above all, keeps the compact one set in `app.vue`.
useSeoMeta({
  // Absolute, not `/og-image.png`: every unfurler resolves it against nothing and needs the origin.
  ogImage: () => `${url.origin}/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${url.origin}/og-image.png`
})

const steps = computed(() => [
  { icon: 'i-lucide-lock-keyhole', title: t('landing.steps.encrypt.title'), description: t('landing.steps.encrypt.description') },
  { icon: 'i-lucide-link', title: t('landing.steps.link.title'), description: t('landing.steps.link.description') },
  { icon: 'i-lucide-flame', title: t('landing.steps.burn.title'), description: t('landing.steps.burn.description') }
])

const features = computed(() => [
  { icon: 'i-lucide-key-round', title: t('landing.features.password.title'), description: t('landing.features.password.description') },
  { icon: 'i-lucide-eye', title: t('landing.features.reads.title'), description: t('landing.features.reads.description') },
  { icon: 'i-lucide-paperclip', title: t('landing.features.files.title'), description: t('landing.features.files.description') },
  { icon: 'i-lucide-heading', title: t('landing.features.markdown.title'), description: t('landing.features.markdown.description') },
  { icon: 'i-lucide-mail', title: t('landing.features.email.title'), description: t('landing.features.email.description') },
  { icon: 'i-lucide-layout-dashboard', title: t('landing.features.dashboard.title'), description: t('landing.features.dashboard.description') }
])

const selfHostLinks = computed(() => [
  { label: t('landing.selfHost.docs'), icon: 'i-lucide-book-open', to: 'https://shhh-docs.thoda.dev', target: '_blank' },
  { label: t('landing.selfHost.github'), icon: 'i-lucide-github', to: 'https://github.com/thoda-dev/shhh', target: '_blank', color: 'neutral' as const, variant: 'subtle' as const }
])
</script>

<template>
  <div>
    <!-- The form sits inside the hero, not under it: creating a paste is what nearly every visit is for, so it has to be on screen without scrolling. -->
    <UPageHero
      :title="t('landing.hero.title')"
      :description="t('landing.hero.description')"
      :ui="{
        container: 'py-10 sm:py-14 lg:py-16 gap-8 sm:gap-y-10',
        title: 'text-4xl sm:text-5xl lg:text-6xl',
        description: 'mx-auto max-w-2xl text-base sm:text-lg'
      }"
    >
      <template #top>
        <div
          class="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-linear-to-b from-primary/10 to-transparent"
          aria-hidden="true"
        />
      </template>

      <template #headline>
        <UBadge
          color="primary"
          variant="subtle"
          icon="i-lucide-shield-check"
          :label="t('landing.hero.headline')"
          class="rounded-full"
        />
      </template>

      <UCard
        id="create"
        class="mx-auto w-full max-w-5xl shadow-lg"
        :ui="{ body: 'p-4 sm:p-6' }"
      >
        <PasteForm />
      </UCard>
    </UPageHero>

    <UPageSection
      id="how-it-works"
      :headline="t('landing.nav.howItWorks')"
      :title="t('landing.how.title')"
      :description="t('landing.how.description')"
      class="border-t border-default"
    >
      <UPageGrid>
        <UPageCard
          v-for="(step, index) in steps"
          :key="step.title"
          :icon="step.icon"
          :title="`${index + 1}. ${step.title}`"
          :description="step.description"
          variant="subtle"
          :ui="{ leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25' }"
        />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="features"
      :headline="t('landing.nav.features')"
      :title="t('landing.featuresSection.title')"
      :description="t('landing.featuresSection.description')"
      :features="features"
      class="border-t border-default bg-elevated/25"
    />

    <UPageSection
      :ui="{ container: 'py-12 sm:py-16 lg:py-20' }"
    >
      <UPageCTA
        :title="t('landing.selfHost.title')"
        :description="t('landing.selfHost.description')"
        :links="selfHostLinks"
        variant="subtle"
      />
    </UPageSection>
  </div>
</template>
