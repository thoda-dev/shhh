<script setup lang="ts">
defineProps<{
  /** Drops the wordmark, for the collapsed sidebar. */
  iconOnly?: boolean
}>()
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <!-- The raster mark until the SVG icon on the roadmap exists; the apple-touch size is the sharpest one shipped. -->
    <img
      src="/apple-touch-icon.png"
      alt=""
      width="28"
      height="28"
      class="size-7 shrink-0"
    >
    <span
      v-if="!iconOnly"
      class="text-lg font-semibold tracking-tight text-highlighted"
    >shhh</span>
  </span>
</template>
