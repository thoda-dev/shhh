<script setup lang="ts">
const props = defineProps<{
  label: string
  min?: number
}>()

const modelValue = defineModel<number | null>({ required: true })

const unlimited = ref(modelValue.value === null)
const numberValue = ref(modelValue.value ?? props.min ?? 1)

watch(unlimited, (isUnlimited) => {
  modelValue.value = isUnlimited ? null : numberValue.value
})

watch(numberValue, (value) => {
  if (!unlimited.value) {
    modelValue.value = value
  }
})
</script>

<template>
  <UFormField :label="label">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <UInput
        v-model.number="numberValue"
        type="number"
        :min="min ?? 0"
        :disabled="unlimited"
        class="min-w-40 flex-1"
      />
      <div class="flex shrink-0 items-center gap-1.5">
        <USwitch v-model="unlimited" />
        <span class="text-sm text-muted">{{ $t('setup.settings.unlimited') }}</span>
      </div>
    </div>
  </UFormField>
</template>
