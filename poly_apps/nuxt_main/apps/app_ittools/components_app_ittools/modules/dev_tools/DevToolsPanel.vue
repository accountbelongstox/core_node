<template>
  <div class="dev-tools-panel">
    <div class="panel-header">
      <h2 class="module-title">{{ t('devTools.title') }}</h2>
      <p class="module-description">{{ t('modules.devTools.description') }}</p>
    </div>

    <!-- IT Tools Integration - reuse existing IT Tools app -->
    <div class="ittools-container">
      <ItToolsApp />
    </div>
  </div>
</template>

<script setup lang="ts">
// Use unified composables
const { t } = useI18n()

// Import existing IT Tools app
import ItToolsApp from '../../ittools_index/ItToolsApp.vue'
</script>

<style scoped>
.dev-tools-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e5e7eb;
}

.module-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.module-description {
  color: #6b7280;
  margin: 0;
}

.ittools-container {
  flex: 1;
  overflow: hidden;
}
</style>
