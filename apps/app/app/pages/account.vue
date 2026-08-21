<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import QRCode from 'qrcode'

const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value) {
  await navigateTo(localePath('/login'))
}

const publicSettings = await ensurePublicSettingsLoaded()
// With 2FA required this is the only page a non-enrolled account can reach, so it explains why and hides the disable flow, which the server refuses anyway.
const twoFactorRequired = computed(() => publicSettings.value?.require2fa === true)
const mustEnrollNow = computed(() => twoFactorRequired.value && !user.value?.twoFactorEnabled)

// --- Profile ---
const nameSchema = z.object({ name: z.string().min(1).max(100) })
const nameState = reactive({ name: user.value?.name ?? '' })
const savingName = ref(false)
const nameSaved = ref(false)
const nameError = ref('')

async function saveName(event: FormSubmitEvent<typeof nameState>) {
  savingName.value = true
  nameError.value = ''
  try {
    await $fetch('/api/auth/update-user', { method: 'POST', body: { name: event.data.name } })
    await refreshAuthSession()
    nameSaved.value = true
    setTimeout(() => (nameSaved.value = false), 2000)
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    nameError.value = message || statusMessage || t('account.errors.generic')
  } finally {
    savingName.value = false
  }
}

// --- Email address ---
// Only offered when the instance can send mail: the confirmation goes to the current address, and without it the change is unverifiable.
const canChangeEmail = computed(() => publicSettings.value?.mailEnabled === true)
const newEmail = ref('')
const changingEmail = ref(false)
const emailRequested = ref(false)
const emailError = ref('')

async function requestEmailChange() {
  changingEmail.value = true
  emailError.value = ''
  emailRequested.value = false
  try {
    await $fetch('/api/auth/change-email', {
      method: 'POST',
      body: { newEmail: newEmail.value, callbackURL: '/account' }
    })
    emailRequested.value = true
    newEmail.value = ''
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    emailError.value = message || statusMessage || t('account.errors.generic')
  } finally {
    changingEmail.value = false
  }
}

// --- Password ---
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string()
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: t('account.password.mismatch'),
    path: ['confirmPassword']
  })
const passwordState = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const savingPassword = ref(false)
const passwordSaved = ref(false)
const passwordError = ref('')

async function savePassword(event: FormSubmitEvent<typeof passwordState>) {
  savingPassword.value = true
  passwordError.value = ''
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: event.data.currentPassword, newPassword: event.data.newPassword }
    })
    passwordState.currentPassword = ''
    passwordState.newPassword = ''
    passwordState.confirmPassword = ''
    passwordSaved.value = true
    setTimeout(() => (passwordSaved.value = false), 2000)
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    passwordError.value = message || statusMessage || t('account.errors.generic')
  } finally {
    savingPassword.value = false
  }
}

// --- Two-factor authentication ---
const twoFactorStep = ref<'idle' | 'confirming'>('idle')
const enrollPassword = ref('')
const totpQrDataUrl = ref('')
const totpSecret = ref('')
const backupCodes = ref<string[]>([])
const confirmCode = ref('')
const twoFactorError = ref('')
const twoFactorLoading = ref(false)

async function startEnroll() {
  twoFactorError.value = ''
  twoFactorLoading.value = true
  try {
    const result = await $fetch<{ totpURI: string, backupCodes: string[] }>('/api/auth/two-factor/enable', {
      method: 'POST',
      body: { password: enrollPassword.value }
    })
    totpQrDataUrl.value = await QRCode.toDataURL(result.totpURI)
    totpSecret.value = new URL(result.totpURI).searchParams.get('secret') ?? ''
    backupCodes.value = result.backupCodes
    twoFactorStep.value = 'confirming'
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    twoFactorError.value = message || statusMessage || t('account.errors.generic')
  } finally {
    twoFactorLoading.value = false
  }
}

async function confirmEnroll() {
  twoFactorError.value = ''
  twoFactorLoading.value = true
  try {
    await $fetch('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: confirmCode.value } })
    await refreshAuthSession()
    cancelEnroll()
  } catch {
    twoFactorError.value = t('account.twoFactor.errors.invalidCode')
  } finally {
    twoFactorLoading.value = false
  }
}

function cancelEnroll() {
  twoFactorStep.value = 'idle'
  enrollPassword.value = ''
  confirmCode.value = ''
  totpQrDataUrl.value = ''
  totpSecret.value = ''
  backupCodes.value = []
}

const disablePassword = ref('')
const disabling = ref(false)
async function disableTwoFactor() {
  twoFactorError.value = ''
  disabling.value = true
  try {
    await $fetch('/api/auth/two-factor/disable', { method: 'POST', body: { password: disablePassword.value } })
    await refreshAuthSession()
    disablePassword.value = ''
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    twoFactorError.value = message || statusMessage || t('account.errors.generic')
  } finally {
    disabling.value = false
  }
}

const copiedBackupCodes = ref(false)
async function copyBackupCodes() {
  await navigator.clipboard.writeText(backupCodes.value.join('\n'))
  copiedBackupCodes.value = true
  setTimeout(() => (copiedBackupCodes.value = false), 2000)
}

// --- Backup code regeneration (2FA already enabled) ---
const regeneratePassword = ref('')
const regenerating = ref(false)
async function regenerateBackupCodes() {
  twoFactorError.value = ''
  regenerating.value = true
  try {
    const result = await $fetch<{ backupCodes: string[] }>('/api/auth/two-factor/generate-backup-codes', {
      method: 'POST',
      body: { password: regeneratePassword.value }
    })
    // Reuses the enrollment screen's code list minus the QR step: the previous codes are dead, so these are shown once with the same warning.
    backupCodes.value = result.backupCodes
    regeneratePassword.value = ''
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    twoFactorError.value = message || statusMessage || t('account.errors.generic')
  } finally {
    regenerating.value = false
  }
}

// --- Account deletion (GDPR right to erasure) ---
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')
const deletePassword = ref('')
const deleteConfirmation = ref('')
const deleting = ref(false)
const deleteError = ref('')

async function deleteAccount() {
  if (!confirm(t('account.delete.confirm'))) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch('/api/account/me', {
      method: 'DELETE',
      body: { password: deletePassword.value, confirmation: deleteConfirmation.value }
    })
    await refreshAuthSession()
    await navigateTo(localePath('/'))
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    deleteError.value = statusMessage || message || t('account.errors.generic')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl p-4 pt-12">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('account.title') }}
      </h1>
      <UButton
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="t('dashboard.backToCreate')"
        :to="localePath('/')"
      />
    </div>

    <UAlert
      v-if="mustEnrollNow"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      :title="t('account.twoFactor.requiredTitle')"
      :description="t('account.twoFactor.requiredDescription')"
      class="mb-6"
    />

    <div class="space-y-6">
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium">
            {{ t('account.profile.title') }}
          </h2>
        </template>
        <UForm
          :schema="nameSchema"
          :state="nameState"
          class="space-y-3"
          @submit="saveName"
        >
          <UFormField
            :label="t('account.profile.name')"
            name="name"
          >
            <UInput
              v-model="nameState.name"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('account.profile.email')">
            <UInput
              :model-value="user?.email"
              disabled
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="nameError"
            color="error"
            variant="subtle"
            :title="nameError"
          />
          <UAlert
            v-if="nameSaved"
            color="success"
            variant="subtle"
            :title="t('account.saved')"
          />
          <UButton
            type="submit"
            :loading="savingName"
            :label="t('account.profile.save')"
          />
        </UForm>

        <div
          v-if="canChangeEmail"
          class="mt-4 space-y-3 border-t border-default pt-4"
        >
          <UFormField
            :label="t('account.email.new')"
            :hint="t('account.email.hint')"
          >
            <UInput
              v-model="newEmail"
              type="email"
              class="w-full"
              autocomplete="email"
            />
          </UFormField>
          <UAlert
            v-if="emailError"
            color="error"
            variant="subtle"
            :title="emailError"
          />
          <UAlert
            v-if="emailRequested"
            color="success"
            variant="subtle"
            :title="t('account.email.requested')"
            :description="t('account.email.requestedHint')"
          />
          <UButton
            variant="subtle"
            :loading="changingEmail"
            :disabled="!newEmail"
            :label="t('account.email.submit')"
            @click="requestEmailChange"
          />
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-sm font-medium">
            {{ t('account.password.title') }}
          </h2>
        </template>
        <UForm
          :schema="passwordSchema"
          :state="passwordState"
          class="space-y-3"
          @submit="savePassword"
        >
          <UFormField
            :label="t('account.password.current')"
            name="currentPassword"
          >
            <UInput
              v-model="passwordState.currentPassword"
              type="password"
              class="w-full"
              autocomplete="current-password"
            />
          </UFormField>
          <UFormField
            :label="t('account.password.new')"
            name="newPassword"
          >
            <UInput
              v-model="passwordState.newPassword"
              type="password"
              class="w-full"
              autocomplete="new-password"
            />
          </UFormField>
          <UFormField
            :label="t('account.password.confirm')"
            name="confirmPassword"
          >
            <UInput
              v-model="passwordState.confirmPassword"
              type="password"
              class="w-full"
              autocomplete="new-password"
            />
          </UFormField>
          <UAlert
            v-if="passwordError"
            color="error"
            variant="subtle"
            :title="passwordError"
          />
          <UAlert
            v-if="passwordSaved"
            color="success"
            variant="subtle"
            :title="t('account.saved')"
          />
          <UButton
            type="submit"
            :loading="savingPassword"
            :label="t('account.password.save')"
          />
        </UForm>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-medium">
              {{ t('account.twoFactor.title') }}
            </h2>
            <UBadge
              v-if="user?.twoFactorEnabled"
              color="success"
              variant="subtle"
              size="sm"
            >
              {{ t('account.twoFactor.enabled') }}
            </UBadge>
            <UBadge
              v-else
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ t('account.twoFactor.disabled') }}
            </UBadge>
          </div>
        </template>

        <UAlert
          v-if="twoFactorError"
          color="error"
          variant="subtle"
          :title="twoFactorError"
          class="mb-3"
        />

        <!-- Enrollment: step 1, ask for password -->
        <div
          v-if="!user?.twoFactorEnabled && twoFactorStep === 'idle'"
          class="flex items-end gap-2"
        >
          <UFormField
            :label="t('account.twoFactor.passwordToEnable')"
            class="flex-1"
          >
            <UInput
              v-model="enrollPassword"
              type="password"
              class="w-full"
              autocomplete="current-password"
            />
          </UFormField>
          <UButton
            :loading="twoFactorLoading"
            :disabled="!enrollPassword"
            :label="t('account.twoFactor.enable')"
            @click="startEnroll"
          />
        </div>

        <!-- Enrollment: step 2, scan QR + confirm code -->
        <div
          v-else-if="twoFactorStep === 'confirming'"
          class="space-y-4"
        >
          <p class="text-sm text-muted">
            {{ t('account.twoFactor.scanInstructions') }}
          </p>
          <img
            :src="totpQrDataUrl"
            :alt="t('account.twoFactor.title')"
            class="size-48 rounded-lg border border-default p-2"
          >
          <p class="font-mono text-xs text-muted">
            {{ t('account.twoFactor.manualEntry') }}: {{ totpSecret }}
          </p>

          <UAlert
            color="warning"
            variant="subtle"
            :title="t('account.twoFactor.backupCodesTitle')"
            :description="t('account.twoFactor.backupCodesWarning')"
          />
          <div class="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-3 font-mono text-xs">
            <span
              v-for="code in backupCodes"
              :key="code"
            >{{ code }}</span>
          </div>
          <UButton
            size="sm"
            variant="ghost"
            :icon="copiedBackupCodes ? 'i-lucide-check' : 'i-lucide-copy'"
            :label="copiedBackupCodes ? t('create.result.copied') : t('account.twoFactor.copyBackupCodes')"
            @click="copyBackupCodes"
          />

          <UFormField :label="t('account.twoFactor.confirmCode')">
            <UInput
              v-model="confirmCode"
              :placeholder="t('account.twoFactor.codePlaceholder')"
              class="w-full"
            />
          </UFormField>
          <div class="flex gap-2">
            <UButton
              :loading="twoFactorLoading"
              :disabled="confirmCode.length < 6"
              :label="t('account.twoFactor.confirm')"
              @click="confirmEnroll"
            />
            <UButton
              variant="ghost"
              :label="t('account.twoFactor.cancel')"
              @click="cancelEnroll"
            />
          </div>
        </div>

        <!-- Already enabled: regenerate backup codes, and disable unless the instance forbids it -->
        <div
          v-else
          class="space-y-4"
        >
          <div
            v-if="backupCodes.length"
            class="space-y-2"
          >
            <UAlert
              color="warning"
              variant="subtle"
              :title="t('account.twoFactor.backupCodesTitle')"
              :description="t('account.twoFactor.regeneratedWarning')"
            />
            <div class="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-3 font-mono text-xs">
              <span
                v-for="code in backupCodes"
                :key="code"
              >{{ code }}</span>
            </div>
            <UButton
              size="sm"
              variant="ghost"
              :icon="copiedBackupCodes ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copiedBackupCodes ? t('create.result.copied') : t('account.twoFactor.copyBackupCodes')"
              @click="copyBackupCodes"
            />
          </div>

          <div class="flex items-end gap-2">
            <UFormField
              :label="t('account.twoFactor.passwordToRegenerate')"
              class="flex-1"
            >
              <UInput
                v-model="regeneratePassword"
                type="password"
                class="w-full"
                autocomplete="current-password"
              />
            </UFormField>
            <UButton
              variant="subtle"
              :loading="regenerating"
              :disabled="!regeneratePassword"
              :label="t('account.twoFactor.regenerate')"
              @click="regenerateBackupCodes"
            />
          </div>

          <p
            v-if="twoFactorRequired"
            class="text-sm text-muted"
          >
            {{ t('account.twoFactor.lockedByInstance') }}
          </p>
          <div
            v-else
            class="flex items-end gap-2 border-t border-default pt-4"
          >
            <UFormField
              :label="t('account.twoFactor.passwordToDisable')"
              class="flex-1"
            >
              <UInput
                v-model="disablePassword"
                type="password"
                class="w-full"
                autocomplete="current-password"
              />
            </UFormField>
            <UButton
              color="error"
              variant="subtle"
              :loading="disabling"
              :disabled="!disablePassword"
              :label="t('account.twoFactor.disable')"
              @click="disableTwoFactor"
            />
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-error">
            {{ t('account.delete.title') }}
          </h2>
        </template>

        <!-- The super admin is a system account, outside the individual right to erasure — the
             server refuses it too, this only avoids offering a button that always fails. -->
        <UAlert
          v-if="isSuperAdmin"
          color="neutral"
          variant="subtle"
          icon="i-lucide-shield"
          :title="t('account.delete.superAdminTitle')"
          :description="t('account.delete.superAdminHint')"
        />

        <div
          v-else
          class="space-y-3"
        >
          <UAlert
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="t('account.delete.warningTitle')"
            :description="t('account.delete.warningHint')"
          />

          <UFormField :label="t('account.delete.passwordLabel')">
            <UInput
              v-model="deletePassword"
              type="password"
              class="w-full"
              autocomplete="current-password"
            />
          </UFormField>
          <UFormField
            :label="t('account.delete.confirmationLabel')"
            :hint="user?.email"
          >
            <UInput
              v-model="deleteConfirmation"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="deleteError"
            color="error"
            variant="subtle"
            :title="deleteError"
          />

          <UButton
            color="error"
            icon="i-lucide-trash-2"
            :loading="deleting"
            :disabled="!deletePassword || !deleteConfirmation"
            :label="t('account.delete.submit')"
            @click="deleteAccount"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
