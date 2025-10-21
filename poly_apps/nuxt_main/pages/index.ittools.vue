<script setup lang="ts">
// IT Tools App Entry Point
// This file acts as the main entry point for the IT Tools application
// It delegates to the app-specific page component located in app_ittools

// Import the main IT Tools page component from the app_ittools directory
import ItToolsPage from '@/app_ittools/pages_app_ittools/index.vue';

// The component is automatically available as ItToolsPage in the template
// Nuxt 3 with <script setup> will auto-register the imported component
</script>

<template>
  <!-- Render the IT Tools application page -->
  <ItToolsPage />
</template>
