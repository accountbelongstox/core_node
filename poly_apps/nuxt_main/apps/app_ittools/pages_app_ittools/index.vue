<template>
  <LaravelWebPanel />
</template>

<script setup lang="ts">
// Import new Laravel Web Panel main layout
import LaravelWebPanel from '@/apps/app_ittools/components_app_ittools/ittools_index_components/LaravelWebPanel.vue'

definePageMeta({
  layout: 'blank',  // Use blank layout as LaravelWebPanel is full-page
  middleware: []
})
</script>
