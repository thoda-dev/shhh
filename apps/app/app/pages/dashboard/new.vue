<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useI18n()
</script>

<template>
  <UDashboardPanel id="new-paste">
    <template #header>
      <UDashboardNavbar :title="t('dashboard.new')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <p class="text-sm text-muted">
          {{ t('create.subtitle') }}
        </p>
        <UCard :ui="{ body: 'p-4 sm:p-6' }">
          <PasteForm />
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
