<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const user = useAuthUser()

const publicSettings = await ensurePublicSettingsLoaded()

function errorText(error: unknown) {
  const { statusMessage, message } = fetchErrorMessages(error)
  return message || statusMessage || t('account.errors.generic')
}

// --- Profile ---
const nameSchema = z.object({ name: z.string().min(1).max(100) })
const nameState = reactive({ name: user.value?.name ?? '' })
const savingName = ref(false)

async function saveName(event: FormSubmitEvent<typeof nameState>) {
  savingName.value = true
  try {
    await $fetch('/api/auth/update-user', { method: 'POST', body: { name: event.data.name } })
    await refreshAuthSession()
    toast.add({ color: 'success', icon: 'i-lucide-check', title: t('account.saved') })
  } catch (error) {
    toast.add({ color: 'error', title: errorText(error) })
  } finally {
    savingName.value = false
  }
}

// --- Email address ---
// Only offered when the instance can send mail: the confirmation goes to the current address, and without it the change is unverifiable.
const canChangeEmail = computed(() => publicSettings.value?.mailEnabled === true)
const newEmail = ref('')
const changingEmail = ref(false)

async function requestEmailChange() {
  changingEmail.value = true
  try {
    await $fetch('/api/auth/change-email', {
      method: 'POST',
      body: { newEmail: newEmail.value, callbackURL: '/account' }
    })
    newEmail.value = ''
    toast.add({ color: 'success', icon: 'i-lucide-mail-check', title: t('account.email.requested'), description: t('account.email.requestedHint') })
  } catch (error) {
    toast.add({ color: 'error', title: errorText(error) })
  } finally {
    changingEmail.value = false
  }
}

// --- Account deletion (GDPR right to erasure) ---
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')
const deletePassword = ref('')
const deleteConfirmation = ref('')
const deleteOpen = ref(false)
const deleting = ref(false)

async function deleteAccount() {
  deleting.value = true
  try {
    await $fetch('/api/account/me', {
      method: 'DELETE',
      body: { password: deletePassword.value, confirmation: deleteConfirmation.value }
    })
    await refreshAuthSession()
    await navigateTo(localePath('/'))
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    toast.add({ color: 'error', title: statusMessage || message || t('account.errors.generic') })
  } finally {
    deleting.value = false
    deleteOpen.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-10">
    <UForm
      id="profile"
      :schema="nameSchema"
      :state="nameState"
      @submit="saveName"
    >
      <UPageCard
        :title="t('account.profile.title')"
        :description="t('account.profile.description')"
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <UButton
          form="profile"
          type="submit"
          :loading="savingName"
          :label="t('account.profile.save')"
          class="w-fit lg:ms-auto"
        />
      </UPageCard>

      <UPageCard variant="subtle">
        <UFormField
          name="name"
          :label="t('account.profile.name')"
          class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
        >
          <UInput
            v-model="nameState.name"
            autocomplete="name"
            class="w-full sm:w-64"
          />
        </UFormField>
        <USeparator />
        <UFormField
          :label="t('account.profile.email')"
          :description="canChangeEmail ? undefined : t('account.email.unavailable')"
          class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
        >
          <UInput
            :model-value="user?.email"
            disabled
            class="w-full sm:w-64"
          />
        </UFormField>
      </UPageCard>
    </UForm>

    <div v-if="canChangeEmail">
      <UPageCard
        :title="t('account.email.title')"
        :description="t('account.email.hint')"
        variant="naked"
        class="mb-4"
      />
      <UPageCard variant="subtle">
        <form
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="requestEmailChange"
        >
          <UFormField
            :label="t('account.email.new')"
            class="flex-1"
          >
            <UInput
              v-model="newEmail"
              type="email"
              class="w-full"
              autocomplete="email"
            />
          </UFormField>
          <UButton
            type="submit"
            color="neutral"
            variant="subtle"
            :loading="changingEmail"
            :disabled="!newEmail"
            :label="t('account.email.submit')"
            class="justify-center"
          />
        </form>
      </UPageCard>
    </div>

    <div>
      <UPageCard
        :title="t('account.delete.title')"
        :description="t('account.delete.warningHint')"
        variant="naked"
        class="mb-4"
        :ui="{ title: 'text-error' }"
      />

      <!-- The super admin is a system account, outside the individual right to erasure: the server refuses it too, this only avoids offering a button that always fails. -->
      <UPageCard
        v-if="isSuperAdmin"
        variant="subtle"
      >
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-shield"
          :title="t('account.delete.superAdminTitle')"
          :description="t('account.delete.superAdminHint')"
        />
      </UPageCard>

      <UPageCard
        v-else
        variant="subtle"
        class="ring-error/25"
      >
        <form
          class="space-y-4"
          @submit.prevent="deleteOpen = true"
        >
          <UFormField
            :label="t('account.delete.passwordLabel')"
            class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
          >
            <UInput
              v-model="deletePassword"
              type="password"
              class="w-full sm:w-64"
              autocomplete="current-password"
            />
          </UFormField>
          <UFormField
            :label="t('account.delete.confirmationLabel')"
            :description="user?.email"
            class="flex justify-between gap-4 max-sm:flex-col sm:items-start"
            :ui="{ description: 'break-all' }"
          >
            <UInput
              v-model="deleteConfirmation"
              class="w-full sm:w-64"
            />
          </UFormField>
          <UButton
            type="submit"
            color="error"
            icon="i-lucide-trash-2"
            :disabled="!deletePassword || !deleteConfirmation"
            :label="t('account.delete.submit')"
          />
        </form>
      </UPageCard>

      <ConfirmDialog
        v-model:open="deleteOpen"
        :title="t('account.delete.warningTitle')"
        :description="t('account.delete.confirm')"
        :confirm-label="t('account.delete.submit')"
        :loading="deleting"
        @confirm="deleteAccount"
      />
    </div>
  </div>
</template>
