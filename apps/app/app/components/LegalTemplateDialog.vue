<script setup lang="ts">
const props = defineProps<{
  // locale → raw template. The form is built from every one of them, so toggling a language never reflows the fields.
  templates: Record<string, string>
  localeLabels: Record<string, string>
  currentLocale: string
  // Prefilled from the instance's own settings; a placeholder with no suggestion starts empty.
  suggestedDurations: Record<string, { amount: number, unit: LegalDurationUnit }>
}>()
const emit = defineEmits<{ apply: [filled: { locale: string, content: string }[]] }>()

const open = defineModel<boolean>('open', { required: true })

const { t, te, locale: i18nLocale } = useI18n()

// The keys of `templates` are locale codes; this is where they stop being plain strings.
type UiLocale = typeof i18nLocale.value
const locales = computed(() => Object.keys(props.templates) as UiLocale[])
const placeholders = computed(() =>
  [...new Set(Object.values(props.templates).flatMap(extractLegalPlaceholders))]
)

// One value shared by every language.
const shared = ref<Record<string, string>>({})
// One value per language, for the fields that are a sentence rather than a fact.
const perLocale = ref<Record<string, Record<string, string>>>({})
const durations = ref<Record<string, { amount: number | string | undefined, unit: LegalDurationUnit }>>({})

const included = ref<Record<string, boolean>>({})
const selectedLocales = ref<Record<string, boolean>>({})

const chosenLocales = computed(() => locales.value.filter(code => selectedLocales.value[code]))

// Reset on every opening: the dialog is reused across documents and languages.
watch([open, placeholders], () => {
  if (!open.value) return

  shared.value = {}
  perLocale.value = {}
  durations.value = {}

  for (const key of placeholders.value) {
    const kind = legalFieldKind(key)
    if (kind === 'duration') {
      const suggestion = props.suggestedDurations[key]
      durations.value[key] = { amount: suggestion?.amount, unit: suggestion?.unit ?? 'days' }
    } else if (kind === 'wording' || kind === 'date') {
      perLocale.value[key] = Object.fromEntries(locales.value.map(code => [
        code,
        // The one field whose answer the app already knows, written the way each language writes it.
        kind === 'date' ? new Date().toLocaleDateString(code, { dateStyle: 'long' }) : ''
      ]))
    } else {
      shared.value[key] = ''
    }
  }

  included.value = Object.fromEntries(placeholders.value.map(key => [key, true]))
  selectedLocales.value = Object.fromEntries(locales.value.map(code => [code, code === props.currentLocale]))
}, { immediate: true })

// A placeholder nobody has translated yet still gets a readable field.
function label(key: string) {
  const path = `admin.legal.placeholders.${key}`
  return te(path) ? t(path) : key.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase())
}

// Written out rather than left to vue-i18n's plural syntax: the unit has to be resolved in the document's language, not the one the admin is reading.
function unitWord(unit: LegalDurationUnit, count: number, locale: UiLocale) {
  return t(`admin.legal.template.units.${unit}.${count === 1 ? 'one' : 'other'}`, {}, { locale })
}

const unitItems = computed(() => LEGAL_DURATION_UNITS.map(unit => ({
  label: unitWord(unit, 2, i18nLocale.value),
  value: unit
})))

// An address is the only field anybody writes on several lines.
const isMultiline = (key: string) => key.includes('ADDRESS')

function valueFor(key: string, locale: UiLocale): string {
  const kind = legalFieldKind(key)

  if (kind === 'duration') {
    const { amount, unit } = durations.value[key] ?? { amount: undefined, unit: 'days' as const }
    const count = parseDurationAmount(amount)
    return count === null ? '' : `${count} ${unitWord(unit, count, locale)}`
  }

  if (kind === 'wording' || kind === 'date') return perLocale.value[key]?.[locale] ?? ''

  return shared.value[key] ?? ''
}

function apply() {
  const removed = placeholders.value.filter(key => !included.value[key])

  emit('apply', chosenLocales.value.map(code => ({
    locale: code,
    content: fillLegalTemplate(
      props.templates[code]!,
      Object.fromEntries(placeholders.value.map(key => [key, valueFor(key, code)])),
      removed
    )
  })))

  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('admin.legal.template.title')"
    :description="t('admin.legal.template.description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        <div class="rounded-md border border-default p-3">
          <p class="mb-2 text-sm font-medium">
            {{ t('admin.legal.template.languages') }}
          </p>
          <div class="flex flex-wrap gap-4">
            <USwitch
              v-for="code in locales"
              :key="code"
              v-model="selectedLocales[code]"
              size="xs"
              :label="localeLabels[code]"
            />
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ t('admin.legal.template.languagesHint') }}
          </p>
        </div>

        <div
          v-for="key in placeholders"
          :key="key"
        >
          <div class="mb-1.5 flex items-center justify-between gap-3">
            <label
              class="text-sm font-medium"
              :class="included[key] ? '' : 'text-dimmed line-through'"
            >
              {{ label(key) }}
            </label>
            <UTooltip :text="t('admin.legal.template.includeHint')">
              <USwitch
                v-model="included[key]"
                size="xs"
              />
            </UTooltip>
          </div>

          <!-- A number and a unit, never the two in one field: the unit is written in each language's own words when the document is produced. -->
          <div
            v-if="legalFieldKind(key) === 'duration'"
            class="flex gap-2"
          >
            <UInput
              v-model="durations[key]!.amount"
              type="number"
              min="1"
              :disabled="!included[key]"
              placeholder="30"
              class="w-28"
            />
            <USelect
              v-model="durations[key]!.unit"
              :items="unitItems"
              :disabled="!included[key]"
              class="w-40"
            />
          </div>

          <!-- A sentence cannot be reused across languages, so each selected one gets its own. -->
          <div
            v-else-if="perLocale[key]"
            class="space-y-2"
          >
            <UInput
              v-for="code in chosenLocales"
              :key="code"
              v-model="perLocale[key]![code]"
              :disabled="!included[key]"
              class="w-full"
            >
              <template #leading>
                <span class="text-xs text-dimmed uppercase">{{ code }}</span>
              </template>
            </UInput>
          </div>

          <UTextarea
            v-else-if="isMultiline(key)"
            v-model="shared[key]"
            :rows="3"
            :disabled="!included[key]"
            :placeholder="LEGAL_PLACEHOLDER_EXAMPLES[key]"
            class="w-full"
          />
          <UInput
            v-else
            v-model="shared[key]"
            :disabled="!included[key]"
            :placeholder="LEGAL_PLACEHOLDER_EXAMPLES[key]"
            class="w-full"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-4">
        <p class="text-xs text-muted">
          {{ t('admin.legal.template.hint') }}
        </p>
        <div class="flex shrink-0 gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('common.cancel')"
            @click="open = false"
          />
          <UButton
            icon="i-lucide-file-plus-2"
            :disabled="!chosenLocales.length"
            :label="t('admin.legal.template.apply')"
            @click="apply"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
