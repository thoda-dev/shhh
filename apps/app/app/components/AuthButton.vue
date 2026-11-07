<script setup lang="ts">
defineProps<{
  /** Full-width and stacked, for the mobile menu. */
  block?: boolean
}>()

const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()

// Only when registration is open, so it is never a dead end; an invited user arrives through their link.
const publicSettings = await ensurePublicSettingsLoaded()
const canRegister = computed(() => publicSettings.value?.registrationEnabled === true)
</script>

<template>
  <div :class="block ? 'flex flex-col gap-2' : 'flex items-center gap-2'">
    <UButton
      v-if="user"
      icon="i-lucide-layout-dashboard"
      :label="t('nav.dashboard')"
      :to="localePath('/dashboard')"
      :block="block"
    />
    <template v-else>
      <UButton
        color="neutral"
        :variant="block ? 'subtle' : 'ghost'"
        :label="t('login.title')"
        :to="localePath('/login')"
        :block="block"
      />
      <UButton
        v-if="canRegister"
        :label="t('register.title')"
        :to="localePath('/register')"
        :block="block"
      />
    </template>
  </div>
</template>
