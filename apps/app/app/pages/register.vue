<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (user.value) {
  await navigateTo(localePath('/'))
}

const publicSettings = await ensurePublicSettingsLoaded()

// One page, two ways in: an invitation link (?token=…) or public sign-up. The token path works even when registration is closed, which is the point of an invitation.
const token = computed(() => {
  const raw = route.query.token
  return typeof raw === 'string' && raw.length ? raw : null
})

const { data: invitation, error: invitationError } = await useAsyncData(
  'invitation',
  () => token.value ? $fetch<{ email: string, expiresAt: string }>(`/api/invitations/${token.value}`) : Promise.resolve(null),
  { watch: [token] }
)

const openRegistration = computed(() => publicSettings.value?.registrationEnabled === true)
const canRegister = computed(() => !!invitation.value || openRegistration.value)

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128)
})

const state = reactive({ name: '', email: invitation.value?.email ?? '', password: '' })
// The address is fixed by the invitation, so the field is filled and locked; the server ignores any email sent alongside a token anyway.
watch(invitation, (value) => {
  if (value) {
    state.email = value.email
  }
})

const submitting = ref(false)
const errorMessage = ref('')

async function submit(event: FormSubmitEvent<typeof state>) {
  submitting.value = true
  errorMessage.value = ''
  try {
    if (token.value) {
      await $fetch(`/api/invitations/${token.value}/accept`, {
        method: 'POST',
        body: { name: event.data.name, password: event.data.password }
      })
    } else {
      await $fetch('/api/auth/sign-up/email', {
        method: 'POST',
        body: { name: event.data.name, email: event.data.email, password: event.data.password }
      })
    }
    await refreshAuthSession()
    await navigateTo(localePath('/'))
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = message || statusMessage || t('register.errors.generic')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-semibold">
          {{ t('register.title') }}
        </h1>
      </template>

      <UAlert
        v-if="token && invitationError"
        color="error"
        variant="subtle"
        icon="i-lucide-link-2-off"
        :title="t('register.invalidInvitation')"
        :description="t('register.invalidInvitationHint')"
      />

      <UAlert
        v-else-if="!canRegister"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        :title="t('register.closed')"
        :description="t('register.closedHint')"
      />

      <UForm
        v-else
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="submit"
      >
        <UAlert
          v-if="invitation"
          color="info"
          variant="subtle"
          icon="i-lucide-mail-check"
          :title="t('register.invitedTitle')"
          :description="t('register.invitedHint', { email: invitation.email })"
        />

        <UFormField
          :label="t('register.name')"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
            autocomplete="name"
          />
        </UFormField>
        <UFormField
          :label="t('register.email')"
          name="email"
          required
        >
          <UInput
            v-model="state.email"
            type="email"
            :disabled="!!invitation"
            class="w-full"
            autocomplete="email"
          />
        </UFormField>
        <UFormField
          :label="t('register.password')"
          name="password"
          required
          :hint="t('register.passwordHint')"
        >
          <UInput
            v-model="state.password"
            type="password"
            class="w-full"
            autocomplete="new-password"
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
          :label="t('register.submit')"
        />
      </UForm>

      <template #footer>
        <UButton
          variant="ghost"
          size="sm"
          :label="t('register.haveAccount')"
          :to="localePath('/login')"
        />
      </template>
    </UCard>
  </div>
</template>
