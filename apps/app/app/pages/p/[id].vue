<script setup lang="ts">
interface MetaResponse {
  kind: 'text' | 'file'
  passwordProtected: boolean
  readsRemaining: number | null
  expiresAt: string
  fileMime?: string
  fileSize?: number
}

interface RevealTextResponse {
  kind: 'text'
  passwordProtected: boolean
  ciphertext: string
  iv: string
}

interface RevealFileResponse {
  kind: 'file'
  passwordProtected: boolean
  fileBlob: string
  fileIv: string
  fileNameEnc: string
  fileNameIv: string
  fileMime: string
  fileSize: number
}

const { t } = useI18n()
const route = useRoute()
const pasteId = route.params.id as string

const missingKey = ref(false)
const metaError = ref('')
const meta = ref<MetaResponse | null>(null)
const fragmentKey = ref<Bytes | null>(null)

// Only where there is a password, and only for pastes carrying an unlock hash: `reveal.post.ts`
// spends nothing on a wrong one, but its `isNull` legacy branch still burns a read.
const burnWarning = computed(() => [
  t('read.burnWarningDescription'),
  ...(meta.value?.passwordProtected ? [t('read.burnWarningPassword')] : [])
].join(' '))

onMounted(async () => {
  const keyParam = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('key')
  if (!keyParam) {
    missingKey.value = true
    return
  }
  fragmentKey.value = base64UrlToBytes(keyParam)

  try {
    meta.value = await $fetch<MetaResponse>(`/api/pastes/${pasteId}/meta`)
  } catch {
    metaError.value = t('read.errors.notFound')
  }
})

const password = ref('')
const revealing = ref(false)
const revealError = ref('')
const decryptedText = ref('')
const decryptedFile = ref<{ url: string, name: string } | null>(null)

async function reveal() {
  revealError.value = ''
  revealing.value = true
  try {
    // Derived before the request, not after: the server checks the resulting hash inside the same
    // statement that increments the counter, so a wrong password is refused without spending a read.
    // Argon2id runs here, which is why revealing a protected paste pauses for a moment.
    const keyMaterial = await deriveKeyMaterial(fragmentKey.value!, meta.value?.passwordProtected ? password.value : undefined)
    const unlockHash = bytesToBase64(await deriveUnlockHash(keyMaterial))

    const data = await $fetch<RevealTextResponse | RevealFileResponse>(`/api/pastes/${pasteId}/reveal`, {
      method: 'POST',
      body: { unlockHash }
    })
    const aesKey = await importAesKey(keyMaterial)

    if (data.kind === 'text') {
      const plaintext = await decryptBytes(aesKey, base64ToBytes(data.ciphertext), base64ToBytes(data.iv))
      decryptedText.value = new TextDecoder().decode(plaintext)
    } else {
      const fileBytes = await decryptBytes(aesKey, base64ToBytes(data.fileBlob), base64ToBytes(data.fileIv))
      const nameBytes = await decryptBytes(aesKey, base64ToBytes(data.fileNameEnc), base64ToBytes(data.fileNameIv))
      const blob = new Blob([fileBytes as BlobPart], { type: data.fileMime })
      decryptedFile.value = { url: URL.createObjectURL(blob), name: new TextDecoder().decode(nameBytes) }
    }
  } catch {
    // A rejected reveal and a failed decrypt look the same here on purpose: both mean the key or the
    // password is wrong, and neither consumed a read — the server refused before incrementing.
    revealError.value = t('read.errors.decryptFailed')
  } finally {
    revealing.value = false
  }
}

const copied = ref(false)
async function copyText() {
  await navigator.clipboard.writeText(decryptedText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <UCard class="w-full max-w-2xl">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">
            shhh
          </h1>
          <!-- The one page a reader may reach without ever having used the instance, so it also offers the way in. -->
          <BackButton size="sm" />
        </div>
      </template>

      <div v-if="missingKey">
        <UAlert
          color="error"
          variant="subtle"
          :title="t('read.errors.missingKeyTitle')"
          :description="t('read.errors.missingKeyDescription')"
        />
      </div>

      <div v-else-if="metaError">
        <UAlert
          color="error"
          variant="subtle"
          :title="metaError"
        />
      </div>

      <div
        v-else-if="decryptedText || decryptedFile"
        class="space-y-4"
      >
        <template v-if="decryptedText">
          <!-- `break-words` as well as the wrap: a secret is often one long unbroken token. -->
          <pre class="max-h-96 overflow-auto rounded-lg bg-elevated p-4 text-sm break-words whitespace-pre-wrap">{{ decryptedText }}</pre>
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :label="copied ? t('create.result.copied') : t('read.copyText')"
            @click="copyText"
          />
        </template>
        <template v-else-if="decryptedFile">
          <UButton
            :label="t('read.downloadFile', { name: decryptedFile.name })"
            icon="i-lucide-download"
            :to="decryptedFile.url"
            :download="decryptedFile.name"
            external
            class="max-w-full"
            :ui="{ label: 'truncate' }"
          />
        </template>
      </div>

      <div
        v-else-if="meta"
        class="space-y-4"
      >
        <div class="space-y-1 text-sm text-muted">
          <p>{{ t('read.expiresAt', { date: new Date(meta.expiresAt).toLocaleString() }) }}</p>
          <p v-if="meta.readsRemaining !== null">
            {{ t('read.readsRemaining', { count: meta.readsRemaining }) }}
          </p>
        </div>

        <UFormField
          v-if="meta.passwordProtected"
          :label="t('read.passwordLabel')"
        >
          <UInput
            v-model="password"
            type="password"
            class="w-full"
            autocomplete="off"
          />
        </UFormField>

        <UAlert
          color="warning"
          variant="subtle"
          :title="t('read.burnWarningTitle')"
          :description="burnWarning"
        />
        <UAlert
          v-if="revealError"
          color="error"
          variant="subtle"
          :title="revealError"
        />

        <UButton
          block
          :loading="revealing"
          :label="t('read.reveal')"
          @click="reveal"
        />
      </div>

      <div
        v-else
        class="flex justify-center py-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin"
        />
      </div>
    </UCard>
  </div>
</template>
