<script setup lang="ts">
defineProps<{
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="t('common.cancel')"
          :disabled="loading"
          @click="open = false"
        />
        <UButton
          color="error"
          :label="confirmLabel"
          :loading="loading"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
