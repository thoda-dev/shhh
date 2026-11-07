<script setup lang="ts">
const props = defineProps<{
  label: string
  description?: string
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
  <!-- Label beside the control from `sm` up, as in the dashboard's settings rows; stacked below it. -->
  <UFormField
    :label="label"
    :description="description"
    class="flex justify-between gap-x-6 gap-y-2 max-sm:flex-col sm:items-center"
  >
    <div class="flex items-center gap-3">
      <UInput
        v-model.number="numberValue"
        type="number"
        :min="min ?? 0"
        :disabled="unlimited"
        class="w-full sm:w-40"
      />
      <USwitch
        v-model="unlimited"
        :label="$t('setup.settings.unlimited')"
        class="shrink-0"
      />
    </div>
  </UFormField>
</template>
