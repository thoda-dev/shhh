<script setup lang="ts">
interface SettingsShape {
  max_retention_days_anonymous: number | null
  max_retention_days_authenticated: number | null
  max_reads_anonymous: number | null
  max_reads_authenticated: number | null
  max_text_size_bytes: number | null
  max_upload_size_bytes: number | null
  max_total_pastes: number | null
  max_total_storage_bytes: number | null
  rate_limit_anonymous_creates_per_period: number | null
  rate_limit_authenticated_creates_per_period: number | null
  rate_limit_uploads_per_period: number | null
  rate_limit_period_minutes: number
  max_email_recipients_per_paste: number | null
  max_emails_sent_per_period: number | null
  email_rate_limit_period_hours: number
  invitation_expiry_days: number | null
  registration_enabled: boolean
  public_paste_enabled: boolean
  require_2fa: boolean
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value || !ADMIN_ROLES.has(user.value.role)) {
  await navigateTo(localePath('/'))
}

const { data: settingsData } = await useFetch<SettingsShape>('/api/admin/settings')

const state = reactive<SettingsShape>({
  max_retention_days_anonymous: settingsData.value?.max_retention_days_anonymous ?? 7,
  max_retention_days_authenticated: settingsData.value?.max_retention_days_authenticated ?? 30,
  max_reads_anonymous: settingsData.value?.max_reads_anonymous ?? null,
  max_reads_authenticated: settingsData.value?.max_reads_authenticated ?? null,
  max_text_size_bytes: settingsData.value?.max_text_size_bytes ?? 100_000,
  max_upload_size_bytes: settingsData.value?.max_upload_size_bytes ?? 2_000_000,
  max_total_pastes: settingsData.value?.max_total_pastes ?? null,
  max_total_storage_bytes: settingsData.value?.max_total_storage_bytes ?? 40_000_000_000,
  rate_limit_anonymous_creates_per_period: settingsData.value?.rate_limit_anonymous_creates_per_period ?? null,
  rate_limit_authenticated_creates_per_period: settingsData.value?.rate_limit_authenticated_creates_per_period ?? null,
  rate_limit_uploads_per_period: settingsData.value?.rate_limit_uploads_per_period ?? null,
  rate_limit_period_minutes: settingsData.value?.rate_limit_period_minutes ?? 10,
  max_email_recipients_per_paste: settingsData.value?.max_email_recipients_per_paste ?? 3,
  max_emails_sent_per_period: settingsData.value?.max_emails_sent_per_period ?? null,
  email_rate_limit_period_hours: settingsData.value?.email_rate_limit_period_hours ?? 1,
  invitation_expiry_days: settingsData.value?.invitation_expiry_days ?? 7,
  registration_enabled: settingsData.value?.registration_enabled ?? true,
  public_paste_enabled: settingsData.value?.public_paste_enabled ?? true,
  require_2fa: settingsData.value?.require_2fa ?? false
})

const saving = ref(false)
const saved = ref(false)
const errorMessage = ref('')

async function save() {
  saving.value = true
  saved.value = false
  errorMessage.value = ''
  try {
    const updated = await $fetch<SettingsShape>('/api/admin/settings', { method: 'PUT', body: state })
    Object.assign(state, updated)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || t('admin.settings.errors.generic')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl p-4 pt-12">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('admin.settings.title') }}</h1>
      <UButton variant="ghost" icon="i-lucide-arrow-left" :label="t('dashboard.backToCreate')" :to="localePath('/')" />
    </div>
    <div class="mb-6 flex gap-2">
      <UButton variant="ghost" size="sm" icon="i-lucide-settings" :label="t('admin.settings.title')" :to="localePath('/admin/settings')" disabled />
      <UButton variant="ghost" size="sm" icon="i-lucide-shield" :label="t('admin.allowedIps.title')" :to="localePath('/admin/allowed-ips')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-ban" :label="t('admin.bannedIps.title')" :to="localePath('/admin/banned-ips')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-users" :label="t('admin.users.title')" :to="localePath('/admin/users')" />
    </div>

    <div class="space-y-8">
      <fieldset class="space-y-4">
        <legend class="mb-2 text-sm font-medium">{{ t('admin.settings.retentionSection') }}</legend>
        <UnlimitedNumberField v-model="state.max_retention_days_anonymous" :label="t('admin.settings.maxRetentionDaysAnonymous')" />
        <UnlimitedNumberField v-model="state.max_retention_days_authenticated" :label="t('admin.settings.maxRetentionDaysAuthenticated')" />
        <UnlimitedNumberField v-model="state.max_reads_anonymous" :label="t('admin.settings.maxReadsAnonymous')" />
        <UnlimitedNumberField v-model="state.max_reads_authenticated" :label="t('admin.settings.maxReadsAuthenticated')" />
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="mb-2 text-sm font-medium">{{ t('admin.settings.sizesSection') }}</legend>
        <UnlimitedNumberField v-model="state.max_text_size_bytes" :label="t('admin.settings.maxTextSizeBytes')" />
        <UnlimitedNumberField v-model="state.max_upload_size_bytes" :label="t('admin.settings.maxUploadSizeBytes')" />
        <UnlimitedNumberField v-model="state.max_total_pastes" :label="t('admin.settings.maxTotalPastes')" />
        <UnlimitedNumberField v-model="state.max_total_storage_bytes" :label="t('admin.settings.maxTotalStorageBytes')" />
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="mb-2 text-sm font-medium">{{ t('admin.settings.rateLimitsSection') }}</legend>
        <UnlimitedNumberField v-model="state.rate_limit_anonymous_creates_per_period" :label="t('admin.settings.rateLimitAnonymousCreatesPerPeriod')" />
        <UnlimitedNumberField v-model="state.rate_limit_authenticated_creates_per_period" :label="t('admin.settings.rateLimitAuthenticatedCreatesPerPeriod')" />
        <UnlimitedNumberField v-model="state.rate_limit_uploads_per_period" :label="t('admin.settings.rateLimitUploadsPerPeriod')" />
        <UFormField :label="t('admin.settings.rateLimitPeriodMinutes')">
          <UInput v-model.number="state.rate_limit_period_minutes" type="number" min="1" class="w-full" />
        </UFormField>
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="mb-2 text-sm font-medium">{{ t('admin.settings.emailSection') }}</legend>
        <UnlimitedNumberField v-model="state.max_email_recipients_per_paste" :label="t('admin.settings.maxEmailRecipientsPerPaste')" />
        <UnlimitedNumberField v-model="state.max_emails_sent_per_period" :label="t('admin.settings.maxEmailsSentPerPeriod')" />
        <UFormField :label="t('admin.settings.emailRateLimitPeriodHours')">
          <UInput v-model.number="state.email_rate_limit_period_hours" type="number" min="1" class="w-full" />
        </UFormField>
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="mb-2 text-sm font-medium">{{ t('admin.settings.invitationsSection') }}</legend>
        <UnlimitedNumberField v-model="state.invitation_expiry_days" :label="t('admin.settings.invitationExpiryDays')" />
      </fieldset>

      <fieldset class="space-y-3">
        <legend class="mb-2 text-sm font-medium">{{ t('admin.settings.accessSection') }}</legend>
        <USwitch v-model="state.registration_enabled" :label="t('admin.settings.registrationEnabled')" />
        <USwitch v-model="state.public_paste_enabled" :label="t('admin.settings.publicPasteEnabled')" />
        <USwitch v-model="state.require_2fa" :label="t('admin.settings.require2fa')" />
      </fieldset>

      <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
      <UAlert v-if="saved" color="success" variant="subtle" :title="t('admin.settings.saved')" />

      <UButton block :loading="saving" :label="t('admin.settings.save')" @click="save" />
    </div>
  </div>
</template>
