<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const url = useRequestURL()

// The large preview card is the home page's alone — every other route, a paste above all, keeps the compact one set in `app.vue`.
useSeoMeta({
  // Absolute, not `/og-image.png`: every unfurler resolves it against nothing and needs the origin.
  ogImage: () => `${url.origin}/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${url.origin}/og-image.png`
})

await ensureAuthSessionLoaded()
const user = useAuthUser()
const isAuthenticated = computed(() => !!user.value)

const publicSettings = await ensurePublicSettingsLoaded()
// Mirrors the check in POST /api/pastes: with `public_paste_enabled` off the instance is accounts-only, but reading an existing paste stays open to everyone.
const anonymousBlocked = computed(() => !isAuthenticated.value && publicSettings.value?.publicPasteEnabled === false)

const kindItems = computed<TabsItem[]>(() => [
  { label: t('create.kindText'), value: 'text', icon: 'i-lucide-file-text' },
  { label: t('create.kindFile'), value: 'file', icon: 'i-lucide-paperclip', disabled: !isAuthenticated.value }
])
const kind = ref<'text' | 'file'>('text')

const textContent = ref('')
// Off by default, and deliberately so: a paste is a secret to be copied verbatim far more often than it is a document to be read. See `create.markdownHint`.
const markdownMode = ref(false)
const file = ref<File | null>(null)

// An image cannot be displayed — see `containsMarkdownImage`. The markdown is kept anyway, since the content is often on its way somewhere else, so this warns rather than blocks.
const hasImage = computed(() => markdownMode.value && containsMarkdownImage(textContent.value))

const passwordProtected = ref(false)
const password = ref('')

// The caps for the tier the visitor is actually in. Signing in mid-session changes them, hence the
// computed rather than a value read once.
const limits = computed(() =>
  publicSettings.value?.limits[isAuthenticated.value ? 'authenticated' : 'anonymous']
)

// Prefilled with the instance's own cap rather than left blank behind a placeholder: it is both the
// highest value the server accepts and exactly what it applies when the field is omitted, so what
// the form shows is what the paste gets.
const expiresInDaysInput = ref<number | null>(null)
const unlimitedReads = ref(false)
const maxReadsInput = ref<number | null>(null)

// Offering "unlimited" where the instance caps reads only earns a 400 on submit — the server refuses
// a null maxReads whenever a cap exists.
const canChooseUnlimitedReads = computed(() => limits.value?.maxReads === null)

watch(limits, (tier) => {
  if (!tier) return
  expiresInDaysInput.value = tier.maxRetentionDays
  maxReadsInput.value = tier.maxReads
  unlimitedReads.value = tier.maxReads === null
}, { immediate: true })

const turnstileToken = ref('')

// Offered only at creation and only to authenticated users: it is the one moment the key may reach the server, and there is deliberately no way to share an existing paste.
const canShareByEmail = computed(() => isAuthenticated.value && publicSettings.value?.mailEnabled === true)
const shareByEmail = ref(false)
const recipientsInput = ref('')
const recipients = computed(() =>
  recipientsInput.value.split(/[,;\s]+/).map(value => value.trim()).filter(Boolean)
)
const emailShareSent = ref<boolean | null>(null)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Not in i18n on purpose: address format is the same in every locale, a localised variant would point at somebody's real domain, and it avoids escaping `@`, which vue-i18n reads as its linked-message marker.
const RECIPIENTS_PLACEHOLDER = 'alice@example.com, bob@example.com'

const submitting = ref(false)
const errorMessage = ref('')
const resultUrl = ref('')

function validate(): string | null {
  if (kind.value === 'text' && !textContent.value.trim()) return t('create.errors.emptyText')
  if (kind.value === 'file' && !file.value) return t('create.errors.noFile')
  if (passwordProtected.value && password.value.length < 4) return t('create.errors.passwordTooShort')
  if (!turnstileToken.value) return t('create.errors.missingTurnstile')

  if (shareByEmail.value && canShareByEmail.value) {
    if (!recipients.value.length) return t('create.errors.noRecipients')
    if (recipients.value.some(email => !EMAIL_PATTERN.test(email))) return t('create.errors.invalidRecipient')
    const max = publicSettings.value?.maxEmailRecipients
    if (max !== null && max !== undefined && recipients.value.length > max) {
      return t('create.errors.tooManyRecipients', { max })
    }
  }
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
    const keyMaterial = await deriveKeyMaterial(fragmentKeyBytes, passwordProtected.value ? password.value : undefined)
    const aesKey = await importAesKey(keyMaterial)

    const payload: Record<string, unknown> = {
      passwordProtected: passwordProtected.value,
      // Lets the server refuse a reveal from someone who has the id but not the key or the password,
      // so neither can spend a read. It learns nothing from the hash itself.
      unlockHash: bytesToBase64(await deriveUnlockHash(keyMaterial)),
      turnstileToken: turnstileToken.value,
      maxReads: unlimitedReads.value ? null : (maxReadsInput.value ?? undefined),
      expiresInDays: expiresInDaysInput.value ?? undefined
    }

    if (kind.value === 'text') {
      const { ciphertext, iv } = await encryptBytes(aesKey, new TextEncoder().encode(textContent.value))
      payload.kind = 'text'
      payload.ciphertext = bytesToBase64(ciphertext)
      payload.iv = bytesToBase64(iv)
      payload.format = markdownMode.value ? 'markdown' : 'plain'
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

    const fragment = bytesToBase64Url(fragmentKeyBytes)

    // The server builds the emailed link, so it needs the fragment key. Sent in the same request as the paste: no second call, and no endpoint accepts a key for an existing paste.
    if (shareByEmail.value && canShareByEmail.value) {
      payload.share = { fragmentKey: fragment, recipients: recipients.value }
    }

    const paste = await $fetch<{ id: string, shared?: boolean }>('/api/pastes', { method: 'POST', body: payload })
    resultUrl.value = `${window.location.origin}${localePath(`/p/${paste.id}`)}#key=${fragment}`
    emailShareSent.value = paste.shared ?? null
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('create.errors.generic')
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

// Opens the user's own mail client with the body pre-filled and no recipient, so the link never leaves the browser.
// Available to everyone, including anonymous users and instances with no mail provider.
const mailtoHref = computed(() => {
  const subject = t('create.result.mailtoSubject')
  const body = `${t('create.result.mailtoBody')}\n\n${resultUrl.value}`
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

function reset() {
  resultUrl.value = ''
  textContent.value = ''
  markdownMode.value = false
  file.value = null
  passwordProtected.value = false
  password.value = ''
  // Back to the instance's caps, not to blank: an empty field after the first paste would put the
  // form right back in the state this prefill exists to avoid.
  expiresInDaysInput.value = limits.value?.maxRetentionDays ?? null
  maxReadsInput.value = limits.value?.maxReads ?? null
  unlimitedReads.value = limits.value?.maxReads === null
  turnstileToken.value = ''
  shareByEmail.value = false
  recipientsInput.value = ''
  emailShareSent.value = null
}
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <UCard class="w-full max-w-5xl">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold">
            shhh
          </h1>
          <p class="text-sm text-muted">
            {{ t('create.subtitle') }}
          </p>
        </div>
      </template>

      <div
        v-if="anonymousBlocked"
        class="space-y-4"
      >
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          :title="t('create.anonymousDisabled.title')"
          :description="t('create.anonymousDisabled.description')"
        />
        <UButton
          block
          icon="i-lucide-log-in"
          :label="t('login.submit')"
          :to="localePath('/login')"
        />
      </div>

      <div
        v-else-if="resultUrl"
        class="space-y-4"
      >
        <UAlert
          color="success"
          variant="subtle"
          :title="t('create.result.title')"
          :description="t('create.result.warning')"
        />
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <UInput
            :model-value="resultUrl"
            readonly
            class="w-full font-mono text-xs"
          />
          <UButton
            block
            class="sm:w-auto"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :label="copied ? t('create.result.copied') : t('create.result.copy')"
            @click="copyLink"
          />
        </div>

        <UAlert
          v-if="emailShareSent === true"
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          :title="t('create.result.emailSent')"
        />
        <UAlert
          v-else-if="emailShareSent === false"
          color="warning"
          variant="subtle"
          icon="i-lucide-mail-x"
          :title="t('create.result.emailFailed')"
          :description="t('create.result.emailFailedHint')"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            variant="subtle"
            icon="i-lucide-mail"
            :label="t('create.result.mailtoShare')"
            :href="mailtoHref"
          />
          <UButton
            variant="ghost"
            :label="t('create.result.createAnother')"
            @click="reset"
          />
        </div>
      </div>

      <div
        v-else
        class="space-y-5"
      >
        <UTooltip
          :text="t('create.fileRequiresLogin')"
          :disabled="isAuthenticated"
          :delay-duration="0"
        >
          <UTabs
            v-model="kind"
            :items="kindItems"
            :content="false"
          />
        </UTooltip>

        <template v-if="kind === 'text'">
          <div class="space-y-1">
            <USwitch
              v-model="markdownMode"
              :label="t('create.markdownFormat')"
            />
            <p class="text-xs text-muted">
              {{ t('create.markdownHint') }}
            </p>
          </div>

          <TextEditor
            v-if="markdownMode"
            v-model="textContent"
            class="max-h-96"
          />
          <UTextarea
            v-else
            v-model="textContent"
            :rows="10"
            autoresize
            :maxrows="20"
            :placeholder="t('create.textPlaceholder')"
            class="w-full font-mono"
          />

          <UAlert
            v-if="hasImage"
            color="warning"
            variant="subtle"
            icon="i-lucide-image-off"
            :title="t('editor.imageWarningTitle')"
            :description="t('editor.imageWarningDescription')"
          />
        </template>
        <!-- The default layout hides the file name behind a full-frame image preview, and puts the card under the dropzone rather than in it. -->
        <UFileUpload
          v-if="kind === 'file'"
          v-model="file"
          layout="list"
          position="inside"
          class="min-h-40 w-full"
        />

        <div class="flex items-center gap-3">
          <USwitch
            v-model="passwordProtected"
            :label="t('create.passwordProtect')"
          />
        </div>
        <UInput
          v-if="passwordProtected"
          v-model="password"
          type="password"
          :placeholder="t('create.passwordPlaceholder')"
          class="w-full"
          autocomplete="new-password"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('create.expiresInDays')">
            <UInput
              v-model.number="expiresInDaysInput"
              type="number"
              min="1"
              :max="limits?.maxRetentionDays ?? undefined"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('create.maxReads')">
            <UInput
              v-if="!unlimitedReads"
              v-model.number="maxReadsInput"
              type="number"
              min="1"
              :max="limits?.maxReads ?? undefined"
              class="w-full"
            />
            <UButton
              v-else
              disabled
              variant="subtle"
              :label="t('create.unlimitedReads')"
              class="w-full justify-center"
            />
          </UFormField>
        </div>
        <USwitch
          v-if="canChooseUnlimitedReads"
          v-model="unlimitedReads"
          :label="t('create.unlimitedReads')"
        />

        <template v-if="canShareByEmail">
          <USwitch
            v-model="shareByEmail"
            :label="t('create.shareByEmail')"
          />
          <div
            v-if="shareByEmail"
            class="space-y-2"
          >
            <UFormField
              :label="t('create.recipients')"
              :hint="publicSettings?.maxEmailRecipients !== null ? t('create.recipientsMax', { max: publicSettings?.maxEmailRecipients }) : undefined"
            >
              <UInput
                v-model="recipientsInput"
                :placeholder="RECIPIENTS_PLACEHOLDER"
                class="w-full"
              />
            </UFormField>
            <p class="text-xs text-muted">
              {{ t('create.recipientsHint') }}
            </p>
          </div>
        </template>

        <NuxtTurnstile v-model="turnstileToken" />

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          block
          :loading="submitting"
          :label="t('create.submit')"
          @click="submit"
        />
      </div>
    </UCard>
  </div>
</template>
