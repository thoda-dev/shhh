<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface SignInResponse {
  twoFactorRedirect?: boolean
}

const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (user.value) {
  await navigateTo(localePath('/'))
}

const publicSettings = await ensurePublicSettingsLoaded()

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const state = reactive({ email: '', password: '' })
const submitting = ref(false)
const errorMessage = ref('')

const needsTwoFactor = ref(false)
const useBackupCode = ref(false)
const code = ref('')

async function submit(event: FormSubmitEvent<typeof state>) {
  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch<SignInResponse>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email: event.data.email, password: event.data.password }
    })
    if (result?.twoFactorRedirect) {
      needsTwoFactor.value = true
      return
    }
    await refreshAuthSession()
    await navigateTo(localePath('/'))
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = message || statusMessage || t('login.errors.generic')
  } finally {
    submitting.value = false
  }
}

async function submitCode() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const path = useBackupCode.value ? '/api/auth/two-factor/verify-backup-code' : '/api/auth/two-factor/verify-totp'
    await $fetch(path, { method: 'POST', body: { code: code.value } })
    await refreshAuthSession()
    await navigateTo(localePath('/'))
  } catch {
    errorMessage.value = t('login.twoFactor.errors.invalidCode')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">
            {{ needsTwoFactor ? t('login.twoFactor.title') : t('login.title') }}
          </h1>
          <BackButton size="sm" />
        </div>
      </template>

      <UForm
        v-if="!needsTwoFactor"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="submit"
      >
        <UFormField
          :label="t('login.email')"
          name="email"
          required
        >
          <UInput
            v-model="state.email"
            type="email"
            class="w-full"
            autocomplete="email"
          />
        </UFormField>
        <UFormField
          :label="t('login.password')"
          name="password"
          required
        >
          <UInput
            v-model="state.password"
            type="password"
            class="w-full"
            autocomplete="current-password"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          block
          type="submit"
          :loading="submitting"
          :label="t('login.submit')"
        />

        <!-- Only when the instance is open: an invited user reaches /register through their link,
             so advertising it here would just be a dead end on a closed instance. -->
        <UButton
          v-if="publicSettings?.registrationEnabled"
          block
          variant="ghost"
          size="sm"
          :label="t('login.noAccount')"
          :to="localePath('/register')"
        />
      </UForm>

      <div
        v-else
        class="space-y-4"
      >
        <p class="text-sm text-muted">
          {{ useBackupCode ? t('login.twoFactor.backupCodeHint') : t('login.twoFactor.totpHint') }}
        </p>
        <UFormField :label="useBackupCode ? t('login.twoFactor.backupCode') : t('login.twoFactor.code')">
          <UInput
            v-model="code"
            :placeholder="useBackupCode ? undefined : t('account.twoFactor.codePlaceholder')"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          block
          :loading="submitting"
          :disabled="!code"
          :label="t('login.twoFactor.submit')"
          @click="submitCode"
        />
        <UButton
          block
          variant="ghost"
          size="sm"
          :label="useBackupCode ? t('login.twoFactor.useTotp') : t('login.twoFactor.useBackupCode')"
          @click="useBackupCode = !useBackupCode; code = ''; errorMessage = ''"
        />
      </div>
    </UCard>
  </div>
</template>
