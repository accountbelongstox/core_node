<!-- AI WARNING: Edit app_ittools_pages/components/ittools_index/LaravelWebPanel.vue for logic changes -->
<template>
  <LaravelWebPanel />
</template>

<script setup lang="ts">
// Centralized import per NUXT_MULTI_APP_ARCHITECTURE.md
import LaravelWebPanel from '~/app_ittools_pages/components/ittools_index/LaravelWebPanel.vue';

definePageMeta({
  layout: 'blank',
  middleware: []
});
</script>
