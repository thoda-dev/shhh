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

definePageMeta({ layout: 'dashboard', middleware: 'auth', role: 'super_admin' })

const { t, locale } = useI18n()
const toast = useToast()

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

// The parser drops images and the CSP would refuse a remote one anyway, so an operator who writes one sees it vanish with nothing said. Same warning as the paste form.
const hasImage = computed(() => containsMarkdownImage(content.value))

const localeLabels = computed(() =>
  Object.fromEntries(LOCALES.map(code => [code, t(`admin.legal.locales.${code}`)]))
)

const slugItems = computed<TabsItem[]>(() =>
  SLUGS.map(value => ({ label: t(`legal.documents.${value}`), value }))
)
// Deliberately independent of `drafts`: these items feed UTabs, and rebuilding them on every
// keystroke made the tab component churn. The unsaved languages are listed under the editor instead.
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
  errorMessage.value = ''
  const persisted: LegalLocale[] = []

  try {
    for (const entry of pending) {
      await persist(entry.code, entry.content)
      persisted.push(entry.code)
    }
    toast.add({ color: 'success', icon: 'i-lucide-check', title: t('admin.legal.saved') })
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

// Both actions that throw text away ask first, through the same dialog.
const pendingAction = ref<'template' | 'unpublish' | null>(null)
const confirmOpen = computed({
  get: () => pendingAction.value !== null,
  set: (value: boolean) => {
    if (!value) pendingAction.value = null
  }
})

function requestTemplate() {
  if (content.value.trim()) pendingAction.value = 'template'
  else openTemplate()
}

async function runPending() {
  const action = pendingAction.value
  pendingAction.value = null
  if (action === 'template') await openTemplate()
  else if (action === 'unpublish') await unpublish()
}

async function openTemplate() {
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
  <UDashboardPanel id="admin-legal">
    <template #header>
      <UDashboardNavbar :title="t('admin.legal.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-save"
            :loading="saving"
            :disabled="!dirty"
            :label="unsavedLocales.length > 1 ? t('admin.legal.saveAll', { count: unsavedLocales.length }) : t('admin.legal.save')"
            @click="save"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar :ui="{ root: 'flex-wrap gap-y-2 py-2 h-auto min-h-(--ui-header-height)', left: 'flex-wrap', right: 'flex-wrap' }">
        <template #left>
          <UTabs
            v-model="slug"
            :items="slugItems"
            :content="false"
            size="xs"
          />
          <UTabs
            v-model="editedLocale"
            :items="localeItems"
            :content="false"
            size="xs"
          />
        </template>
        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="rawMode ? 'i-lucide-pen-line' : 'i-lucide-file-code'"
            :label="rawMode ? t('admin.legal.richText') : t('admin.legal.raw')"
            @click="rawMode = !rawMode"
          />
          <UButton
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-file-plus-2"
            :disabled="!templateLocales.length"
            :loading="loadingTemplate"
            :label="t('admin.legal.insertTemplate')"
            @click="requestTemplate"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span class="min-w-0 flex-1">{{ t('admin.legal.description') }}</span>
        <UBadge
          :color="stored?.updatedAt ? 'success' : 'neutral'"
          variant="subtle"
          size="sm"
          :label="stored?.updatedAt ? t('admin.legal.publishedAt', { date: formatDate(stored.updatedAt) }) : t('admin.legal.unpublished')"
        />
      </div>

      <!-- Takes the slack the rest of the panel leaves, so the actions below it never fall off screen. `basis-0` is what stops it from claiming its content height first. -->
      <div class="min-h-80 flex-1 basis-0">
        <UTextarea
          v-if="rawMode"
          :key="`raw-${draftKey}`"
          v-model="content"
          :placeholder="t('admin.legal.placeholder')"
          class="h-full w-full font-mono"
          :ui="{ base: 'text-xs h-full resize-none' }"
        />
        <TextEditor
          v-else
          :key="draftKey"
          v-model="content"
          class="h-full"
        />
      </div>

      <UAlert
        v-if="hasImage"
        color="warning"
        variant="subtle"
        icon="i-lucide-image-off"
        :title="t('editor.imageWarningTitle')"
        :description="t('editor.imageWarningDescription')"
      />

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :title="errorMessage"
      />

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          v-if="unsavedLocales.length"
          class="text-xs text-warning"
        >
          {{ t('admin.legal.unsavedIn', { languages: unsavedLocales.map(code => localeLabels[code]).join(', ') }) }}
        </p>
        <p class="flex-1 text-xs text-muted">
          {{ t('admin.legal.hint') }}
        </p>
        <UButton
          v-if="stored"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          :label="t('admin.legal.unpublish')"
          @click="pendingAction = 'unpublish'"
        />
      </div>

      <LegalTemplateDialog
        v-model:open="templateOpen"
        :templates="templates"
        :locale-labels="localeLabels"
        :current-locale="editedLocale"
        :suggested-durations="index?.durations ?? {}"
        @apply="applyTemplate"
      />

      <ConfirmDialog
        v-model:open="confirmOpen"
        :title="pendingAction === 'unpublish' ? t('admin.legal.unpublish') : t('admin.legal.insertTemplate')"
        :description="pendingAction === 'unpublish' ? t('admin.legal.confirmDelete') : t('admin.legal.confirmTemplate')"
        :confirm-label="pendingAction === 'unpublish' ? t('admin.legal.unpublish') : t('admin.legal.insertTemplate')"
        @confirm="runPending"
      />
    </template>
  </UDashboardPanel>
</template>
