<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
const isAuthenticated = computed(() => !!user.value)

const kindItems = computed<TabsItem[]>(() => [
  { label: t('create.kindText'), value: 'text', icon: 'i-lucide-file-text' },
  { label: t('create.kindFile'), value: 'file', icon: 'i-lucide-paperclip', disabled: !isAuthenticated.value }
])
const kind = ref<'text' | 'file'>('text')

const textContent = ref('')
const file = ref<File | null>(null)

const passwordProtected = ref(false)
const password = ref('')

const expiresInDaysInput = ref<number | null>(null)
const unlimitedReads = ref(false)
const maxReadsInput = ref<number | null>(null)

const turnstileToken = ref('')

const submitting = ref(false)
const errorMessage = ref('')
const resultUrl = ref('')

function validate(): string | null {
  if (kind.value === 'text' && !textContent.value.trim()) return t('create.errors.emptyText')
  if (kind.value === 'file' && !file.value) return t('create.errors.noFile')
  if (passwordProtected.value && password.value.length < 4) return t('create.errors.passwordTooShort')
  if (!turnstileToken.value) return t('create.errors.missingTurnstile')
  return null
}

async function submit() {
  errorMessage.value = ''
  const validationError = validate()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  submitting.value = true
  try {
    const fragmentKeyBytes = generateFragmentKey()
    const aesKey = await deriveAesKey(fragmentKeyBytes, passwordProtected.value ? password.value : undefined)

    const payload: Record<string, unknown> = {
      passwordProtected: passwordProtected.value,
      turnstileToken: turnstileToken.value,
      maxReads: unlimitedReads.value ? null : (maxReadsInput.value ?? undefined),
      expiresInDays: expiresInDaysInput.value ?? undefined
    }

    if (kind.value === 'text') {
      const { ciphertext, iv } = await encryptBytes(aesKey, new TextEncoder().encode(textContent.value))
      payload.kind = 'text'
      payload.ciphertext = bytesToBase64(ciphertext)
      payload.iv = bytesToBase64(iv)
    } else {
      const selectedFile = file.value!
      const { ciphertext: fileBlob, iv: fileIv } = await encryptBytes(aesKey, new Uint8Array(await selectedFile.arrayBuffer()))
      const { ciphertext: fileNameEnc, iv: fileNameIv } = await encryptBytes(aesKey, new TextEncoder().encode(selectedFile.name))
      payload.kind = 'file'
      payload.fileBlob = bytesToBase64(fileBlob)
      payload.fileIv = bytesToBase64(fileIv)
      payload.fileNameEnc = bytesToBase64(fileNameEnc)
      payload.fileNameIv = bytesToBase64(fileNameIv)
      payload.fileMime = selectedFile.type || 'application/octet-stream'
    }

    const paste = await $fetch<{ id: string }>('/api/pastes', { method: 'POST', body: payload })
    const fragment = bytesToBase64Url(fragmentKeyBytes)
    resultUrl.value = `${window.location.origin}${localePath(`/p/${paste.id}`)}#key=${fragment}`
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || t('create.errors.generic')
  } finally {
    submitting.value = false
  }
}

const copied = ref(false)
async function copyLink() {
  await navigator.clipboard.writeText(resultUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function reset() {
  resultUrl.value = ''
  textContent.value = ''
  file.value = null
  passwordProtected.value = false
  password.value = ''
  expiresInDaysInput.value = null
  unlimitedReads.value = false
  maxReadsInput.value = null
  turnstileToken.value = ''
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-2xl">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold">shhh</h1>
            <p class="text-sm text-muted">{{ t('create.subtitle') }}</p>
          </div>
          <UButton v-if="isAuthenticated" variant="ghost" size="sm" icon="i-lucide-list" :label="t('dashboard.title')" :to="localePath('/dashboard')" />
        </div>
      </template>

      <div v-if="resultUrl" class="space-y-4">
        <UAlert color="success" variant="subtle" :title="t('create.result.title')" :description="t('create.result.warning')" />
        <div class="flex items-center gap-2">
          <UInput :model-value="resultUrl" readonly class="w-full font-mono text-xs" />
          <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" :label="copied ? t('create.result.copied') : t('create.result.copy')" @click="copyLink" />
        </div>
        <UButton variant="ghost" :label="t('create.result.createAnother')" @click="reset" />
      </div>

      <div v-else class="space-y-5">
        <UTooltip :text="t('create.fileRequiresLogin')" :disabled="isAuthenticated" :delay-duration="0">
          <UTabs v-model="kind" :items="kindItems" :content="false" />
        </UTooltip>

        <UTextarea
          v-if="kind === 'text'"
          v-model="textContent"
          :rows="10"
          autoresize
          :maxrows="20"
          :placeholder="t('create.textPlaceholder')"
          class="w-full font-mono"
        />
        <UFileUpload v-else v-model="file" class="min-h-40 w-full" />

        <div class="flex items-center gap-3">
          <USwitch v-model="passwordProtected" :label="t('create.passwordProtect')" />
        </div>
        <UInput v-if="passwordProtected" v-model="password" type="password" :placeholder="t('create.passwordPlaceholder')" class="w-full" autocomplete="new-password" />

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('create.expiresInDays')">
            <UInput v-model.number="expiresInDaysInput" type="number" min="1" :placeholder="t('create.instanceDefault')" class="w-full" />
          </UFormField>
          <UFormField :label="t('create.maxReads')">
            <UInput v-if="!unlimitedReads" v-model.number="maxReadsInput" type="number" min="1" :placeholder="t('create.instanceDefault')" class="w-full" />
            <UButton v-else disabled variant="subtle" :label="t('create.unlimitedReads')" class="w-full justify-center" />
          </UFormField>
        </div>
        <USwitch v-model="unlimitedReads" :label="t('create.unlimitedReads')" />

        <NuxtTurnstile v-model="turnstileToken" />

        <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />

        <UButton block :loading="submitting" :label="t('create.submit')" @click="submit" />
      </div>
    </UCard>
  </div>
</template>
