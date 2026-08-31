<script setup lang="ts">
import { z } from 'zod'
import type { StepperItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()

const stepperItems = computed<StepperItem[]>(() => [
  { title: t('setup.steps.account.title'), description: t('setup.steps.account.description'), icon: 'i-lucide-user' },
  { title: t('setup.steps.settings.title'), description: t('setup.steps.settings.description'), icon: 'i-lucide-sliders-horizontal' }
])

// Tracked here rather than through UStepper's hasNext/hasPrev, which read as permanently falsy via the template ref and fall through to "Finish" even on the first step.
const activeStep = ref(0)
const isLastStep = computed(() => activeStep.value === stepperItems.value.length - 1)

const accountForm = useTemplateRef('accountForm')
const settingsForm = useTemplateRef('settingsForm')

const accountSchema = computed(() => z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  passwordConfirm: z.string()
}).refine(data => data.password === data.passwordConfirm, {
  message: t('setup.account.passwordMismatch'),
  path: ['passwordConfirm']
}))

const accountState = reactive({
  name: '',
  email: '',
  password: '',
  passwordConfirm: ''
})

const settingsSchema = z.object({
  max_retention_days_anonymous: z.number().int().positive().nullable(),
  max_retention_days_authenticated: z.number().int().positive().nullable(),
  max_text_size_bytes: z.number().int().positive().nullable(),
  max_upload_size_bytes: z.number().int().positive().nullable(),
  max_total_storage_bytes: z.number().int().positive().nullable(),
  rate_limit_anonymous_creates_per_period: z.number().int().positive().nullable(),
  rate_limit_authenticated_creates_per_period: z.number().int().positive().nullable(),
  rate_limit_uploads_per_period: z.number().int().positive().nullable(),
  rate_limit_period_minutes: z.number().int().positive()
})

// Matches app_settings defaults
const settingsState = reactive({
  max_retention_days_anonymous: 7 as number | null,
  max_retention_days_authenticated: 30 as number | null,
  max_text_size_bytes: 100_000 as number | null,
  max_upload_size_bytes: 2_000_000 as number | null,
  max_total_storage_bytes: 40_000_000_000 as number | null,
  rate_limit_anonymous_creates_per_period: null as number | null,
  rate_limit_authenticated_creates_per_period: null as number | null,
  rate_limit_uploads_per_period: null as number | null,
  rate_limit_period_minutes: 10
})

const submitting = ref(false)
const errorMessage = ref('')
const completed = ref(false)

function goBack() {
  activeStep.value--
}

async function goNext() {
  try {
    await accountForm.value?.validate({})
    activeStep.value++
  } catch {
    // Errors are already displayed inline by UForm/UFormField.
  }
}

async function finish() {
  try {
    await settingsForm.value?.validate({})
  } catch {
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/setup/complete', {
      method: 'POST',
      body: {
        name: accountState.name,
        email: accountState.email,
        password: accountState.password,
        settings: settingsState
      }
    })
    completed.value = true
    await refreshAuthSession()
    setTimeout(() => navigateTo(localePath('/')), 1200)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('setup.errors.generic')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <UCard class="w-full max-w-2xl">
      <template #header>
        <h1 class="text-xl font-semibold">
          {{ t('setup.title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('setup.subtitle') }}
        </p>
      </template>

      <div
        v-if="completed"
        class="flex flex-col items-center gap-3 py-8 text-center"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-10 text-success"
        />
        <p>{{ t('setup.success') }}</p>
      </div>

      <template v-else>
        <UStepper
          v-model="activeStep"
          :items="stepperItems"
          disabled
          class="mb-6"
        />

        <UForm
          v-if="activeStep === 0"
          ref="accountForm"
          :schema="accountSchema"
          :state="accountState"
          class="space-y-4"
          @submit="goNext"
        >
          <UFormField
            :label="t('setup.account.name')"
            name="name"
            required
          >
            <UInput
              v-model="accountState.name"
              class="w-full"
              autocomplete="name"
            />
          </UFormField>
          <UFormField
            :label="t('setup.account.email')"
            name="email"
            required
          >
            <UInput
              v-model="accountState.email"
              type="email"
              class="w-full"
              autocomplete="email"
            />
          </UFormField>
          <UFormField
            :label="t('setup.account.password')"
            name="password"
            required
          >
            <UInput
              v-model="accountState.password"
              type="password"
              class="w-full"
              autocomplete="new-password"
            />
          </UFormField>
          <UFormField
            :label="t('setup.account.passwordConfirm')"
            name="passwordConfirm"
            required
          >
            <UInput
              v-model="accountState.passwordConfirm"
              type="password"
              class="w-full"
              autocomplete="new-password"
            />
          </UFormField>
        </UForm>

        <UForm
          v-else
          ref="settingsForm"
          :schema="settingsSchema"
          :state="settingsState"
          class="space-y-6"
          @submit="finish"
        >
          <fieldset class="space-y-4">
            <legend class="mb-2 text-sm font-medium">
              {{ t('setup.settings.retentionSection') }}
            </legend>
            <UnlimitedNumberField
              v-model="settingsState.max_retention_days_anonymous"
              :label="t('setup.settings.maxRetentionDaysAnonymous')"
            />
            <UnlimitedNumberField
              v-model="settingsState.max_retention_days_authenticated"
              :label="t('setup.settings.maxRetentionDaysAuthenticated')"
            />
          </fieldset>

          <fieldset class="space-y-4">
            <legend class="mb-2 text-sm font-medium">
              {{ t('setup.settings.sizesSection') }}
            </legend>
            <UnlimitedNumberField
              v-model="settingsState.max_text_size_bytes"
              :label="t('setup.settings.maxTextSizeBytes')"
            />
            <UnlimitedNumberField
              v-model="settingsState.max_upload_size_bytes"
              :label="t('setup.settings.maxUploadSizeBytes')"
            />
            <UnlimitedNumberField
              v-model="settingsState.max_total_storage_bytes"
              :label="t('setup.settings.maxTotalStorageBytes')"
            />
          </fieldset>

          <fieldset class="space-y-4">
            <legend class="mb-2 text-sm font-medium">
              {{ t('setup.settings.rateLimitsSection') }}
            </legend>
            <UnlimitedNumberField
              v-model="settingsState.rate_limit_anonymous_creates_per_period"
              :label="t('setup.settings.rateLimitAnonymousCreatesPerPeriod')"
            />
            <UnlimitedNumberField
              v-model="settingsState.rate_limit_authenticated_creates_per_period"
              :label="t('setup.settings.rateLimitAuthenticatedCreatesPerPeriod')"
            />
            <UnlimitedNumberField
              v-model="settingsState.rate_limit_uploads_per_period"
              :label="t('setup.settings.rateLimitUploadsPerPeriod')"
            />
            <UFormField
              :label="t('setup.settings.rateLimitPeriodMinutes')"
              name="rate_limit_period_minutes"
              required
            >
              <UInput
                v-model.number="settingsState.rate_limit_period_minutes"
                type="number"
                min="1"
                class="w-full"
              />
            </UFormField>
          </fieldset>
        </UForm>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
          class="my-4"
        />

        <div class="mt-6 flex justify-between">
          <UButton
            v-if="activeStep > 0"
            variant="ghost"
            :label="t('setup.actions.back')"
            icon="i-lucide-arrow-left"
            @click="goBack"
          />
          <div v-else />

          <UButton
            v-if="!isLastStep"
            trailing-icon="i-lucide-arrow-right"
            :label="t('setup.actions.next')"
            @click="goNext"
          />
          <UButton
            v-else
            :label="t('setup.actions.finish')"
            :loading="submitting"
            @click="finish"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
