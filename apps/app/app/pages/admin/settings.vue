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
  invitation_expiry_days: number | null
  registration_enabled: boolean
  public_paste_enabled: boolean
  require_2fa: boolean
}

definePageMeta({ layout: 'dashboard', middleware: 'auth', role: 'admin' })

const { t } = useI18n()
const toast = useToast()

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
  invitation_expiry_days: settingsData.value?.invitation_expiry_days ?? 7,
  registration_enabled: settingsData.value?.registration_enabled ?? true,
  public_paste_enabled: settingsData.value?.public_paste_enabled ?? true,
  require_2fa: settingsData.value?.require_2fa ?? false
})

type NumberKey = { [K in keyof SettingsShape]: SettingsShape[K] extends number | null ? K : never }[keyof SettingsShape]

// One entry per card, so the template renders sections instead of repeating a field nine times over.
const SECTIONS: { key: string, fields: NumberKey[] }[] = [
  { key: 'retention', fields: ['max_retention_days_anonymous', 'max_retention_days_authenticated', 'max_reads_anonymous', 'max_reads_authenticated'] },
  { key: 'sizes', fields: ['max_text_size_bytes', 'max_upload_size_bytes', 'max_total_pastes', 'max_total_storage_bytes'] },
  { key: 'rateLimits', fields: ['rate_limit_anonymous_creates_per_period', 'rate_limit_authenticated_creates_per_period', 'rate_limit_uploads_per_period'] },
  { key: 'email', fields: ['max_email_recipients_per_paste'] },
  { key: 'invitations', fields: ['invitation_expiry_days'] }
]

// The i18n keys are the camelCase form of the column names.
function fieldLabel(field: string) {
  return t(`admin.settings.${field.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())}`)
}

const saving = ref(false)

async function save() {
  saving.value = true
  try {
    const updated = await $fetch<SettingsShape>('/api/admin/settings', { method: 'PUT', body: state })
    Object.assign(state, updated)
    // Three of these keys drive app-wide behaviour and are cached in a `useState` loaded once per app lifecycle, so without this a toggle would only apply after a full reload.
    await refreshPublicSettings()
    toast.add({ color: 'success', icon: 'i-lucide-check', title: t('admin.settings.saved') })
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    toast.add({ color: 'error', title: statusMessage || message || t('admin.settings.errors.generic') })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel
    id="admin-settings"
    :ui="{ body: 'lg:py-12' }"
  >
    <template #header>
      <UDashboardNavbar :title="t('admin.settings.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-save"
            :loading="saving"
            :label="t('admin.settings.save')"
            @click="save"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full flex-col gap-4 sm:gap-6 lg:max-w-3xl lg:gap-10">
        <div
          v-for="section in SECTIONS"
          :key="section.key"
        >
          <UPageCard
            :title="t(`admin.settings.${section.key}Section`)"
            :description="t(`admin.settings.${section.key}Hint`)"
            variant="naked"
            class="mb-4"
          />
          <UPageCard variant="subtle">
            <template
              v-for="(field, index) in section.fields"
              :key="field"
            >
              <USeparator v-if="index > 0" />
              <UnlimitedNumberField
                v-model="state[field]"
                :label="fieldLabel(field)"
              />
            </template>
            <template v-if="section.key === 'rateLimits'">
              <USeparator />
              <UFormField
                :label="t('admin.settings.rateLimitPeriodMinutes')"
                class="flex justify-between gap-x-6 gap-y-2 max-sm:flex-col sm:items-center"
              >
                <UInput
                  v-model.number="state.rate_limit_period_minutes"
                  type="number"
                  min="1"
                  class="w-full sm:w-40"
                />
              </UFormField>
            </template>
          </UPageCard>
        </div>

        <div>
          <UPageCard
            :title="t('admin.settings.accessSection')"
            :description="t('admin.settings.accessHint')"
            variant="naked"
            class="mb-4"
          />
          <UPageCard variant="subtle">
            <USwitch
              v-model="state.registration_enabled"
              :label="t('admin.settings.registrationEnabled')"
            />
            <USeparator />
            <USwitch
              v-model="state.public_paste_enabled"
              :label="t('admin.settings.publicPasteEnabled')"
            />
            <USeparator />
            <USwitch
              v-model="state.require_2fa"
              :label="t('admin.settings.require2fa')"
            />
          </UPageCard>
        </div>

        <UButton
          icon="i-lucide-save"
          :loading="saving"
          :label="t('admin.settings.save')"
          class="w-fit self-end"
          @click="save"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
