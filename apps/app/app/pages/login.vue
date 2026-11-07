<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

interface SignInResponse {
  twoFactorRedirect?: boolean
}

definePageMeta({ layout: 'auth', middleware: 'guest' })

const { t } = useI18n()
const localePath = useLocalePath()

const publicSettings = await ensurePublicSettingsLoaded()

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const fields = computed<AuthFormField[]>(() => [
  { name: 'email', type: 'email', label: t('login.email'), required: true, autocomplete: 'email' },
  { name: 'password', type: 'password', label: t('login.password'), required: true, autocomplete: 'current-password' }
])

const submitting = ref(false)
const errorMessage = ref('')

const needsTwoFactor = ref(false)
const useBackupCode = ref(false)

const codeSchema = z.object({ code: z.string().min(1) })
const codeFields = computed<AuthFormField[]>(() => [{
  name: 'code',
  type: 'text',
  label: useBackupCode.value ? t('login.twoFactor.backupCode') : t('login.twoFactor.code'),
  placeholder: useBackupCode.value ? undefined : t('account.twoFactor.codePlaceholder'),
  autocomplete: useBackupCode.value ? 'off' : 'one-time-code',
  autofocus: true
}])

async function submit(event: FormSubmitEvent<z.output<typeof schema>>) {
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
    await navigateTo(localePath('/dashboard'))
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = message || statusMessage || t('login.errors.generic')
  } finally {
    submitting.value = false
  }
}

async function submitCode(event: FormSubmitEvent<z.output<typeof codeSchema>>) {
  submitting.value = true
  errorMessage.value = ''
  try {
    const path = useBackupCode.value ? '/api/auth/two-factor/verify-backup-code' : '/api/auth/two-factor/verify-totp'
    await $fetch(path, { method: 'POST', body: { code: event.data.code } })
    await refreshAuthSession()
    await navigateTo(localePath('/dashboard'))
  } catch {
    errorMessage.value = t('login.twoFactor.errors.invalidCode')
  } finally {
    submitting.value = false
  }
}

function toggleBackupCode() {
  useBackupCode.value = !useBackupCode.value
  errorMessage.value = ''
}
</script>

<template>
  <UPageCard
    variant="subtle"
    class="w-full max-w-sm shadow-lg"
  >
    <UAuthForm
      v-if="!needsTwoFactor"
      :schema="schema"
      :fields="fields"
      icon="i-lucide-log-in"
      :title="t('login.title')"
      :description="t('login.subtitle')"
      :loading="submitting"
      :submit="{ label: t('login.submit') }"
      @submit="submit"
    >
      <template
        v-if="errorMessage"
        #validation
      >
        <UAlert
          color="error"
          variant="subtle"
          :title="errorMessage"
        />
      </template>

      <!-- Only when the instance is open: an invited user reaches /register through their link, so advertising it here would be a dead end on a closed instance. -->
      <template
        v-if="publicSettings?.registrationEnabled"
        #footer
      >
        {{ t('login.noAccountQuestion') }}
        <ULink
          :to="localePath('/register')"
          class="font-medium text-primary"
        >
          {{ t('register.title') }}
        </ULink>
      </template>
    </UAuthForm>

    <!-- Keyed on the mode so the typed code does not carry over between an authenticator code and a backup code. -->
    <UAuthForm
      v-else
      :key="useBackupCode ? 'backup' : 'totp'"
      :schema="codeSchema"
      :fields="codeFields"
      icon="i-lucide-shield-check"
      :title="t('login.twoFactor.title')"
      :description="useBackupCode ? t('login.twoFactor.backupCodeHint') : t('login.twoFactor.totpHint')"
      :loading="submitting"
      :submit="{ label: t('login.twoFactor.submit') }"
      @submit="submitCode"
    >
      <template
        v-if="errorMessage"
        #validation
      >
        <UAlert
          color="error"
          variant="subtle"
          :title="errorMessage"
        />
      </template>

      <template #footer>
        <UButton
          variant="link"
          :label="useBackupCode ? t('login.twoFactor.useTotp') : t('login.twoFactor.useBackupCode')"
          @click="toggleBackupCode"
        />
      </template>
    </UAuthForm>
  </UPageCard>
</template>
