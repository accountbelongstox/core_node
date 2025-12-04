<template>
  <main class="app-content">
    <!-- Use Nuxt KeepAlive to cache components -->
    <KeepAlive :max="5">
      <component :is="currentModuleComponent" :key="activeModule" />
    </KeepAlive>
  </main>
</template>

<script setup lang="ts">
import { defineAsyncComponent, defineComponent, type Component } from 'vue'
import { useAppState } from '~/app_ittools_pages/composables/useAppState'
import { useI18n } from '~/app_ittools_pages/composables/useI18n'

// Use unified state
const { activeModule } = useAppState()
const { t } = useI18n()

// Lazy load module components (using Nuxt dynamic imports)
const modules: Record<string, () => Promise<Component>> = {
  'api-testing': () => import('~/app_ittools_pages/components/modules/api_testing/ApiTestingDashboard.vue'),
  'dev-tools': () => import('~/app_ittools_pages/components/modules/dev_tools/DevToolsPanel.vue'),
  'system-info': () => import('~/app_ittools_pages/components/modules/system_info/SystemInfoPanel.vue'),
  'vocabulary': () => import('~/app_ittools_pages/components/modules/vocabulary/VocabularyPanel.vue'),
  'code-browser': () => import('~/app_ittools_pages/components/modules/code_browser/CodeBrowserPanel.vue'),
  'static-resources': () => import('~/app_ittools_pages/components/modules/static_resources/StaticResourcesPanel.vue'),
  'mcp-manager': () => import('~/app_ittools_pages/components/modules/mcp_manager/McpManagerPanel.vue'),
  'octane-tasks': () => import('~/app_ittools_pages/components/modules/octane_tasks/OctaneTasksPanel.vue'),
}

// Define reusable loading and error components
const LoadingComponent = defineComponent({
  setup() {
    const { t } = useI18n()
    return { t }
  },
  template: `
    <div class="loading-container">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <p>{{ t('common.loading') }}</p>
      </div>
    </div>
  `
})

const ErrorComponent = defineComponent({
  setup() {
    const { t } = useI18n()
    return { t }
  },
  template: `
    <div class="error-container">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ t('errors.unknownError') }}</p>
    </div>
  `
})

// Dynamically load current module component
const currentModuleComponent = computed(() => {
  const loader = modules[activeModule.value]
  return loader ? defineAsyncComponent({
    loader,
    loadingComponent: LoadingComponent,
    errorComponent: ErrorComponent
  }) : null
})
</script>

<style scoped>
.app-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  background: #f9fafb;
  min-height: calc(100vh - 70px);
}

.loading-container,
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #6b7280;
}

.loading-spinner,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-spinner i {
  font-size: 2rem;
  color: #667eea;
}

.error-container i {
  font-size: 3rem;
  color: #ef4444;
}

@media (max-width: 768px) {
  .app-content {
    padding: 1rem;
  }
}
</style>
