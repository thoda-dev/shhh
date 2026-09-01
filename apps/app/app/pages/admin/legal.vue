<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { LegalDurationUnit } from '~~/shared/utils/legal-template'

type LegalSlug = 'privacy' | 'terms' | 'notice'
type LegalLocale = 'en' | 'fr'

interface LegalDocumentRow {
  slug: LegalSlug
  locale: LegalLocale
  content: string
  updatedAt: string | null
}

interface LegalIndex {
  documents: LegalDocumentRow[]
  templates: { slug: LegalSlug, locale: LegalLocale }[]
  // What the instance already knows about its own retention, to start the fill-in form from.
  durations: Record<string, { amount: number, unit: LegalDurationUnit }>
}

const SLUGS: LegalSlug[] = ['privacy', 'terms', 'notice']
const LOCALES: LegalLocale[] = ['en', 'fr']

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (user.value?.role !== 'super_admin') {
  await navigateTo(localePath('/'))
}

const { data: index, refresh } = await useFetch<LegalIndex>('/api/admin/legal')

const slug = ref<LegalSlug>('privacy')
const editedLocale = ref<LegalLocale>('en')
// The editor writes Markdown but never shows it; this is the way back to the text itself.
const rawMode = ref(false)

// Unsaved text, keyed by document and language. Filling the template can write several languages at once, and switching tabs must not throw away what is not saved yet.
const drafts = ref<Record<string, string>>({})
const draftKey = computed(() => `${slug.value}:${editedLocale.value}`)

const stored = computed(() =>
  index.value?.documents.find(entry => entry.slug === slug.value && entry.locale === editedLocale.value) ?? null
)

const content = computed({
  get: () => drafts.value[draftKey.value] ?? stored.value?.content ?? '',
  set: value => (drafts.value[draftKey.value] = value)
})

const localeLabels = computed(() =>
  Object.fromEntries(LOCALES.map(code => [code, t(`admin.legal.locales.${code}`)]))
)

const slugItems = computed<TabsItem[]>(() =>
  SLUGS.map(value => ({ label: t(`legal.documents.${value}`), value }))
)
// Deliberately independent of `drafts`: these items feed UTabs, and rebuilding them on every
// keystroke made the tab component churn. The unsaved languages are shown beside the tabs instead.
const localeItems = computed<TabsItem[]>(() =>
  LOCALES.map(value => ({ label: localeLabels.value[value], value }))
)

const unsavedLocales = computed(() => LOCALES.filter((code) => {
  const draft = drafts.value[`${slug.value}:${code}`]
  if (draft === undefined) return false
  const saved = index.value?.documents.find(entry => entry.slug === slug.value && entry.locale === code)
  return draft.trim() !== (saved?.content ?? '').trim()
}))

const templateLocales = computed(() =>
  LOCALES.filter(code => index.value?.templates.some(entry => entry.slug === slug.value && entry.locale === code))
)
const dirty = computed(() => unsavedLocales.value.length > 0)

const saving = ref(false)
const saved = ref(false)
const errorMessage = ref('')

function persist(locale: LegalLocale, value: string) {
  return $fetch('/api/admin/legal', { method: 'PUT', body: { slug: slug.value, locale, content: value } })
}

// Reloads what the database now holds and drops the drafts that reached it, keeping any that did not.
async function settle(persisted: LegalLocale[]) {
  await refresh()
  // The footer reads the published list from public settings, loaded once per app lifecycle.
  await refreshPublicSettings()
  const keys = persisted.map(code => `${slug.value}:${code}`)
  drafts.value = Object.fromEntries(Object.entries(drafts.value).filter(([key]) => !keys.includes(key)))
}

// Saves every language of this document that has unsaved text, not only the tab on screen: the fill-in form writes several at once, and having to visit each tab to save it was a good way to publish half of them.
async function save() {
  const pending = unsavedLocales.value.map(code => ({ code, content: drafts.value[`${slug.value}:${code}`] ?? '' }))
  if (!pending.length) return

  saving.value = true
  saved.value = false
  errorMessage.value = ''
  const persisted: LegalLocale[] = []

  try {
    for (const entry of pending) {
      await persist(entry.code, entry.content)
      persisted.push(entry.code)
    }
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.legal.errors.generic')
  } finally {
    await settle(persisted)
    saving.value = false
  }
}

const templateOpen = ref(false)
const templates = ref<Record<string, string>>({})
const loadingTemplate = ref(false)

async function openTemplate() {
  if (content.value.trim() && !confirm(t('admin.legal.confirmTemplate'))) return
  loadingTemplate.value = true
  errorMessage.value = ''
  try {
    const fetched = await Promise.all(templateLocales.value.map(code =>
      $fetch<{ content: string }>('/api/admin/legal/template', { query: { slug: slug.value, locale: code } })
        .then(response => [code, response.content] as const)
    ))
    templates.value = Object.fromEntries(fetched)
    templateOpen.value = true
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.legal.errors.generic')
  } finally {
    loadingTemplate.value = false
  }
}

// Scoped to the tab on screen, unlike saving: removing the French text must not remove the English one.
async function unpublish() {
  if (!confirm(t('admin.legal.confirmDelete'))) return

  saving.value = true
  errorMessage.value = ''
  try {
    await persist(editedLocale.value, '')
    await settle([editedLocale.value])
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.legal.errors.generic')
  } finally {
    saving.value = false
  }
}

// Nothing is written to the database here: every language filled in lands in its editor, and each still has to be saved on its own tab.
function applyTemplate(filled: { locale: string, content: string }[]) {
  for (const entry of filled) {
    drafts.value[`${slug.value}:${entry.locale}`] = entry.content
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-1 flex-col p-4">
    <div class="mb-2 flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">
        {{ t('admin.legal.title') }}
      </h1>
      <BackButton />
    </div>
    <AdminNav />

    <p class="mb-6 text-sm text-muted">
      {{ t('admin.legal.description') }}
    </p>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <UTabs
        v-model="slug"
        :items="slugItems"
        :content="false"
        size="sm"
        class="w-full sm:w-auto"
      />
      <UTabs
        v-model="editedLocale"
        :items="localeItems"
        :content="false"
        size="sm"
        class="w-full sm:w-auto"
      />
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UButton
        variant="ghost"
        size="sm"
        :icon="rawMode ? 'i-lucide-pen-line' : 'i-lucide-file-code'"
        :label="rawMode ? t('admin.legal.richText') : t('admin.legal.raw')"
        @click="rawMode = !rawMode"
      />
      <UButton
        variant="subtle"
        size="sm"
        icon="i-lucide-file-plus-2"
        :disabled="!templateLocales.length"
        :loading="loadingTemplate"
        :label="t('admin.legal.insertTemplate')"
        @click="openTemplate"
      />
      <span
        v-if="stored?.updatedAt"
        class="text-xs text-muted"
      >
        {{ t('admin.legal.publishedAt', { date: formatDate(stored.updatedAt) }) }}
      </span>
      <span
        v-else
        class="text-xs text-muted"
      >
        {{ t('admin.legal.unpublished') }}
      </span>
    </div>

    <!-- Takes the slack the rest of the page leaves, so the actions below it never fall off screen. `min-h-0` is what lets it shrink instead of pushing them down. -->
    <div class="min-h-64 flex-1 basis-0">
      <UTextarea
        v-if="rawMode"
        :key="`raw-${draftKey}`"
        v-model="content"
        :placeholder="t('admin.legal.placeholder')"
        class="h-full w-full font-mono"
        :ui="{ base: 'text-xs h-full resize-none' }"
      />
      <LegalEditor
        v-else
        :key="draftKey"
        v-model="content"
        class="h-full"
      />
    </div>

    <p
      v-if="unsavedLocales.length"
      class="mt-2 text-xs text-warning"
    >
      {{ t('admin.legal.unsavedIn', { languages: unsavedLocales.map(code => localeLabels[code]).join(', ') }) }}
    </p>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mt-4"
    />

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <UButton
        icon="i-lucide-save"
        :loading="saving"
        :disabled="!dirty"
        :label="unsavedLocales.length > 1 ? t('admin.legal.saveAll', { count: unsavedLocales.length }) : t('admin.legal.save')"
        @click="save"
      />
      <UButton
        v-if="stored"
        color="error"
        variant="ghost"
        icon="i-lucide-trash-2"
        :label="t('admin.legal.unpublish')"
        @click="unpublish"
      />
      <span
        v-if="saved"
        class="text-sm text-success"
      >
        {{ t('admin.legal.saved') }}
      </span>
    </div>

    <p class="mt-6 text-xs text-muted">
      {{ t('admin.legal.hint') }}
    </p>

    <LegalTemplateDialog
      v-model:open="templateOpen"
      :templates="templates"
      :locale-labels="localeLabels"
      :current-locale="editedLocale"
      :suggested-durations="index?.durations ?? {}"
      @apply="applyTemplate"
    />
  </div>
</template>
