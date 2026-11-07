<script setup lang="ts">
import type { MarkdownDocument } from 'comark'

interface MetaResponse {
  kind: 'text' | 'file'
  format?: 'plain' | 'markdown'
  passwordProtected: boolean
  readsRemaining: number | null
  expiresAt: string
  fileMime?: string
  fileSize?: number
}

interface RevealTextResponse {
  kind: 'text'
  format: 'plain' | 'markdown'
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

// The markdown is parsed here and nowhere else: the plaintext exists only in this browser, so the
// server that renders every other document in the app cannot see this one.
const rendered = ref<MarkdownDocument | null>(null)
// The rendered document is what the creator composed, but the source is what the reader copies, so
// the way to it is always one click away.
const showSource = ref(false)

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
      if (data.format === 'markdown') rendered.value = await parsePasteMarkdown(decryptedText.value)
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
  <UContainer class="flex flex-1 flex-col items-center justify-center py-10 sm:py-16">
    <UCard
      class="w-full max-w-3xl shadow-lg"
      :ui="{ body: 'p-4 sm:p-6' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring ring-primary/25 ring-inset">
            <UIcon
              :name="decryptedText || decryptedFile ? 'i-lucide-lock-open' : 'i-lucide-lock'"
              class="size-5 text-primary"
            />
          </div>
          <div class="min-w-0">
            <h1 class="font-semibold text-highlighted">
              {{ t('read.title') }}
            </h1>
            <p class="text-sm text-muted">
              {{ t('read.subtitle') }}
            </p>
          </div>
        </div>
      </template>

      <UAlert
        v-if="missingKey"
        color="error"
        variant="subtle"
        icon="i-lucide-link-2-off"
        :title="t('read.errors.missingKeyTitle')"
        :description="t('read.errors.missingKeyDescription')"
      />

      <UAlert
        v-else-if="metaError"
        color="error"
        variant="subtle"
        icon="i-lucide-file-x"
        :title="metaError"
      />

      <div
        v-else-if="decryptedText || decryptedFile"
        class="space-y-4"
      >
        <template v-if="decryptedText">
          <div
            v-if="rendered && !showSource"
            class="max-h-[60vh] overflow-auto rounded-lg border border-default bg-elevated/50 p-4"
          >
            <RichText :value="rendered" />
          </div>
          <!-- `break-words` as well as the wrap: a secret is often one long unbroken token. -->
          <pre
            v-else
            class="max-h-[60vh] overflow-auto rounded-lg border border-default bg-elevated/50 p-4 text-sm break-words whitespace-pre-wrap text-highlighted"
          >{{ decryptedText }}</pre>

          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? t('create.result.copied') : (rendered ? t('read.copySource') : t('read.copyText'))"
              class="justify-center"
              @click="copyText"
            />
            <!-- Named after what it switches to, since what is on screen is already visible. -->
            <UButton
              v-if="rendered"
              color="neutral"
              variant="subtle"
              :icon="showSource ? 'i-lucide-file-text' : 'i-lucide-file-code'"
              :label="showSource ? t('read.viewRendered') : t('read.viewSource')"
              class="justify-center"
              @click="showSource = !showSource"
            />
          </div>
        </template>
        <UButton
          v-else-if="decryptedFile"
          size="lg"
          :label="t('read.downloadFile', { name: decryptedFile.name })"
          icon="i-lucide-download"
          :to="decryptedFile.url"
          :download="decryptedFile.name"
          external
          class="max-w-full"
          :ui="{ label: 'truncate' }"
        />
      </div>

      <div
        v-else-if="meta"
        class="space-y-5"
      >
        <div class="flex flex-wrap gap-2">
          <UBadge
            color="neutral"
            variant="subtle"
            :icon="meta.kind === 'file' ? 'i-lucide-paperclip' : 'i-lucide-file-text'"
            :label="meta.kind === 'file' ? t('create.kindFile') : t('create.kindText')"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-clock"
            :label="t('read.expiresAt', { date: new Date(meta.expiresAt).toLocaleString() })"
          />
          <UBadge
            v-if="meta.readsRemaining !== null"
            color="neutral"
            variant="subtle"
            icon="i-lucide-eye"
            :label="t('read.readsRemaining', { count: meta.readsRemaining })"
          />
          <UBadge
            v-if="meta.passwordProtected"
            color="neutral"
            variant="subtle"
            icon="i-lucide-key-round"
            :label="t('dashboard.passwordProtected')"
          />
        </div>

        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-flame"
          :title="t('read.burnWarningTitle')"
          :description="burnWarning"
        />

        <form
          class="space-y-4"
          @submit.prevent="reveal"
        >
          <UFormField
            v-if="meta.passwordProtected"
            :label="t('read.passwordLabel')"
          >
            <UInput
              v-model="password"
              type="password"
              icon="i-lucide-key-round"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>

          <UAlert
            v-if="revealError"
            color="error"
            variant="subtle"
            :title="revealError"
          />

          <UButton
            type="submit"
            block
            size="lg"
            icon="i-lucide-eye"
            :loading="revealing"
            :label="t('read.reveal')"
          />
        </form>
      </div>

      <div
        v-else
        class="flex justify-center py-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-muted"
        />
      </div>
    </UCard>
  </UContainer>
</template>
