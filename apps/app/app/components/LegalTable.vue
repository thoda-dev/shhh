<script setup lang="ts">
// Tiptap renders tables inside a `div.tableWrapper`; the published page needs the same wrapper for the two to scroll and look alike.
</script>

<template>
  <div class="tableWrapper">
    <table>
      <slot />
    </table>
  </div>
</template>
