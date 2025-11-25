<!-- AI WARNING: Edit apps/app_ittools/components_app_ittools/ittools_index/ItToolsApp.vue for logic changes -->
<template>
  <ItToolsApp />
</template>

<script setup lang="ts">
// Centralized import from apps/app_ittools/ per NUXT_MULTI_APP_ARCHITECTURE.md
import ItToolsApp from '@/apps/app_ittools/components_app_ittools/ittools_index/ItToolsApp.vue';

definePageMeta({
  layout: 'default',
  middleware: []
});
</script>
