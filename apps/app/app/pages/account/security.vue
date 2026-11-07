<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import QRCode from 'qrcode'

const { t } = useI18n()
const toast = useToast()
const user = useAuthUser()

const publicSettings = await ensurePublicSettingsLoaded()
// With 2FA required, the disable flow is hidden: the server refuses it anyway.
const twoFactorRequired = computed(() => publicSettings.value?.require2fa === true)

function errorText(error: unknown) {
  const { statusMessage, message } = fetchErrorMessages(error)
  return message || statusMessage || t('account.errors.generic')
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

async function savePassword(event: FormSubmitEvent<typeof passwordState>) {
  savingPassword.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: event.data.currentPassword, newPassword: event.data.newPassword }
    })
    passwordState.currentPassword = ''
    passwordState.newPassword = ''
    passwordState.confirmPassword = ''
    toast.add({ color: 'success', icon: 'i-lucide-check', title: t('account.saved') })
  } catch (error) {
    toast.add({ color: 'error', title: errorText(error) })
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
    twoFactorError.value = errorText(error)
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
    toast.add({ color: 'success', icon: 'i-lucide-shield-check', title: t('account.twoFactor.enabledToast') })
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
    twoFactorError.value = errorText(error)
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
    twoFactorError.value = errorText(error)
  } finally {
    regenerating.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-10">
    <UForm
      id="password"
      :schema="passwordSchema"
      :state="passwordState"
      @submit="savePassword"
    >
      <UPageCard
        :title="t('account.password.title')"
        :description="t('account.password.description')"
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <UButton
          form="password"
          type="submit"
          :loading="savingPassword"
          :label="t('account.password.save')"
          class="w-fit lg:ms-auto"
        />
      </UPageCard>

      <UPageCard variant="subtle">
        <UFormField
          :label="t('account.password.current')"
          name="currentPassword"
          class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
        >
          <UInput
            v-model="passwordState.currentPassword"
            type="password"
            class="w-full sm:w-64"
            autocomplete="current-password"
          />
        </UFormField>
        <USeparator />
        <UFormField
          :label="t('account.password.new')"
          name="newPassword"
          class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
        >
          <UInput
            v-model="passwordState.newPassword"
            type="password"
            class="w-full sm:w-64"
            autocomplete="new-password"
          />
        </UFormField>
        <USeparator />
        <UFormField
          :label="t('account.password.confirm')"
          name="confirmPassword"
          class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
        >
          <UInput
            v-model="passwordState.confirmPassword"
            type="password"
            class="w-full sm:w-64"
            autocomplete="new-password"
          />
        </UFormField>
      </UPageCard>
    </UForm>

    <div>
      <UPageCard
        :title="t('account.twoFactor.title')"
        :description="t('account.twoFactor.description')"
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <UBadge
          :color="user?.twoFactorEnabled ? 'success' : 'neutral'"
          variant="subtle"
          :icon="user?.twoFactorEnabled ? 'i-lucide-shield-check' : 'i-lucide-shield-off'"
          :label="user?.twoFactorEnabled ? t('account.twoFactor.enabled') : t('account.twoFactor.disabled')"
          class="w-fit lg:ms-auto"
        />
      </UPageCard>

      <UPageCard variant="subtle">
        <UAlert
          v-if="twoFactorError"
          color="error"
          variant="subtle"
          :title="twoFactorError"
        />

        <!-- Enrollment: step 1, ask for password -->
        <form
          v-if="!user?.twoFactorEnabled && twoFactorStep === 'idle'"
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="startEnroll"
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
            type="submit"
            icon="i-lucide-shield-plus"
            class="justify-center"
            :loading="twoFactorLoading"
            :disabled="!enrollPassword"
            :label="t('account.twoFactor.enable')"
          />
        </form>

        <!-- Enrollment: step 2, scan QR + confirm code -->
        <div
          v-else-if="twoFactorStep === 'confirming'"
          class="space-y-5"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
            <img
              :src="totpQrDataUrl"
              :alt="t('account.twoFactor.title')"
              class="size-44 max-w-full shrink-0 rounded-lg border border-default bg-white p-2"
            >
            <div class="min-w-0 space-y-2">
              <p class="text-sm text-muted">
                {{ t('account.twoFactor.scanInstructions') }}
              </p>
              <p class="text-xs text-muted">
                {{ t('account.twoFactor.manualEntry') }}
              </p>
              <code class="block rounded-md bg-elevated px-2 py-1 font-mono text-xs break-all text-highlighted">{{ totpSecret }}</code>
            </div>
          </div>

          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="t('account.twoFactor.backupCodesTitle')"
            :description="t('account.twoFactor.backupCodesWarning')"
          />
          <div class="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-3 font-mono text-xs sm:grid-cols-3">
            <span
              v-for="code in backupCodes"
              :key="code"
            >{{ code }}</span>
          </div>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            :icon="copiedBackupCodes ? 'i-lucide-check' : 'i-lucide-copy'"
            :label="copiedBackupCodes ? t('create.result.copied') : t('account.twoFactor.copyBackupCodes')"
            @click="copyBackupCodes"
          />

          <USeparator />

          <form
            class="flex flex-col gap-3 sm:flex-row sm:items-end"
            @submit.prevent="confirmEnroll"
          >
            <UFormField
              :label="t('account.twoFactor.confirmCode')"
              class="flex-1"
            >
              <UInput
                v-model="confirmCode"
                :placeholder="t('account.twoFactor.codePlaceholder')"
                autocomplete="one-time-code"
                class="w-full"
              />
            </UFormField>
            <div class="flex gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                :label="t('account.twoFactor.cancel')"
                @click="cancelEnroll"
              />
              <UButton
                type="submit"
                :loading="twoFactorLoading"
                :disabled="confirmCode.length < 6"
                :label="t('account.twoFactor.confirm')"
              />
            </div>
          </form>
        </div>

        <!-- Already enabled: regenerate backup codes, and disable unless the instance forbids it -->
        <template v-else>
          <div
            v-if="backupCodes.length"
            class="space-y-2"
          >
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="t('account.twoFactor.backupCodesTitle')"
              :description="t('account.twoFactor.regeneratedWarning')"
            />
            <div class="grid grid-cols-2 gap-1 rounded-lg bg-elevated p-3 font-mono text-xs sm:grid-cols-3">
              <span
                v-for="code in backupCodes"
                :key="code"
              >{{ code }}</span>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              :icon="copiedBackupCodes ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copiedBackupCodes ? t('create.result.copied') : t('account.twoFactor.copyBackupCodes')"
              @click="copyBackupCodes"
            />
          </div>

          <form
            class="flex flex-col gap-3 sm:flex-row sm:items-end"
            @submit.prevent="regenerateBackupCodes"
          >
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
              type="submit"
              color="neutral"
              variant="subtle"
              icon="i-lucide-refresh-cw"
              class="justify-center"
              :loading="regenerating"
              :disabled="!regeneratePassword"
              :label="t('account.twoFactor.regenerate')"
            />
          </form>

          <USeparator />

          <p
            v-if="twoFactorRequired"
            class="text-sm text-muted"
          >
            {{ t('account.twoFactor.lockedByInstance') }}
          </p>
          <form
            v-else
            class="flex flex-col gap-3 sm:flex-row sm:items-end"
            @submit.prevent="disableTwoFactor"
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
              type="submit"
              color="error"
              variant="subtle"
              icon="i-lucide-shield-off"
              class="justify-center"
              :loading="disabling"
              :disabled="!disablePassword"
              :label="t('account.twoFactor.disable')"
            />
          </form>
        </template>
      </UPageCard>
    </div>
  </div>
</template>
