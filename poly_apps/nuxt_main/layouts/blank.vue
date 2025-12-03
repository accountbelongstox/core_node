<template>
  <div class="layout-blank">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Blank layout for full-page applications
// No header, footer, or sidebar - just the page content
</script>

<style scoped>
.layout-blank {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
