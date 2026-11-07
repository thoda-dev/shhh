<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth', middleware: 'guest' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

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

// The address is fixed by the invitation, so the field is filled and locked; the server ignores any email sent alongside a token anyway.
const fields = computed<AuthFormField[]>(() => [
  { name: 'name', type: 'text', label: t('register.name'), required: true, autocomplete: 'name' },
  { name: 'email', type: 'email', label: t('register.email'), required: true, autocomplete: 'email', defaultValue: invitation.value?.email, disabled: !!invitation.value },
  { name: 'password', type: 'password', label: t('register.password'), required: true, autocomplete: 'new-password', hint: t('register.passwordHint') }
])

const submitting = ref(false)
const errorMessage = ref('')

async function submit(event: FormSubmitEvent<z.output<typeof schema>>) {
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
    await navigateTo(localePath('/dashboard'))
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = message || statusMessage || t('register.errors.generic')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UPageCard
    variant="subtle"
    class="w-full max-w-sm shadow-lg"
  >
    <UAuthForm
      v-if="canRegister && !(token && invitationError)"
      :schema="schema"
      :fields="fields"
      icon="i-lucide-user-plus"
      :title="t('register.title')"
      :description="invitation ? t('register.invitedHint', { email: invitation.email }) : t('register.subtitle')"
      :loading="submitting"
      :submit="{ label: t('register.submit') }"
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

      <template #footer>
        {{ t('register.haveAccountQuestion') }}
        <ULink
          :to="localePath('/login')"
          class="font-medium text-primary"
        >
          {{ t('login.title') }}
        </ULink>
      </template>
    </UAuthForm>

    <div
      v-else
      class="space-y-4"
    >
      <UAlert
        v-if="token && invitationError"
        color="error"
        variant="subtle"
        icon="i-lucide-link-2-off"
        :title="t('register.invalidInvitation')"
        :description="t('register.invalidInvitationHint')"
      />
      <UAlert
        v-else
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        :title="t('register.closed')"
        :description="t('register.closedHint')"
      />
      <UButton
        block
        color="neutral"
        variant="subtle"
        :label="t('login.title')"
        :to="localePath('/login')"
      />
    </div>
  </UPageCard>
</template>
