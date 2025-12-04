<template>
  <div class="api-info-viewer">
    <div class="viewer-header">
      <h3 class="section-title">{{ t('apiTesting.apiReference') }}</h3>
      <button @click="refreshApiInfo" :disabled="isLoading" class="refresh-btn-small">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
      </button>
    </div>

    <!-- Applications List -->
    <div v-if="applications.length" class="applications-grid">
      <div
        v-for="app in applications"
        :key="app.name"
        class="app-card"
        @click="selectApp(app)"
        :class="{ active: selectedApp?.name === app.name }"
      >
        <div class="app-icon">
          <i class="fas fa-cube"></i>
        </div>
        <div class="app-info">
          <h4 class="app-name">{{ app.name }}</h4>
          <p class="app-endpoints">{{ app.endpoints }} {{ t('apiTesting.endpoints') }}</p>
        </div>
      </div>
    </div>

    <!-- Selected App Details -->
    <div v-if="selectedApp" class="app-details">
      <div class="details-header">
        <h4>{{ selectedApp.name }}</h4>
        <span class="version-badge">{{ selectedApp.version }}</span>
      </div>

      <div v-if="selectedApp.description" class="app-description">
        {{ selectedApp.description }}
      </div>

      <!-- Endpoints List -->
      <div class="endpoints-list">
        <div
          v-for="(endpoint, index) in selectedApp.endpointsList"
          :key="index"
          class="endpoint-item"
        >
          <div class="endpoint-header">
            <span class="method-badge" :class="`method-${getMethodClass(endpoint.method)}`">
              {{ endpoint.method || 'ANY' }}
            </span>
            <code class="endpoint-path">{{ endpoint.path }}</code>
          </div>

          <div v-if="endpoint.description" class="endpoint-description">
            {{ endpoint.description }}
          </div>

          <div v-if="endpoint.parameters && endpoint.parameters.length" class="endpoint-params">
            <div class="params-label">{{ t('apiTesting.params') }}:</div>
            <div class="params-list">
              <span
                v-for="param in endpoint.parameters"
                :key="param"
                class="param-tag"
              >
                {{ param }}
              </span>
            </div>
          </div>

          <div class="endpoint-meta">
            <span v-if="endpoint.auth_required" class="auth-required">
              <i class="fas fa-lock"></i> {{ t('apiTesting.authRequired') }}
            </span>
            <span v-else class="auth-not-required">
              <i class="fas fa-lock-open"></i> {{ t('apiTesting.noAuth') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// API Info Viewer - displays real backend API endpoints
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/api_info

import { useI18n } from '~/app_ittools_pages/composables/useI18n'
import { useApi } from '~/app_ittools_pages/composables/useApi'
import type { ApiInfoResponse, ApplicationInfo, ApiEndpointInfo } from '~/app_ittools_pages/types/api-types'

interface AppSummary {
  name: string
  version: string
  description?: string
  endpoints: number
  endpointsList: ApiEndpointInfo[]
}

// Use unified composables
const { t } = useI18n()
const api = useApi()

// State
const apiInfo = ref<ApiInfoResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedApp = ref<AppSummary | null>(null)

// Computed applications list
const applications = computed<AppSummary[]>(() => {
  if (!apiInfo.value?.public_info?.api_reference) return []

  const apps: AppSummary[] = []

  Object.entries(apiInfo.value.public_info.api_reference).forEach(([key, value]) => {
    if (typeof value === 'object' && 'endpoints' in value) {
      const appInfo = value as ApplicationInfo
      apps.push({
        name: appInfo.app_name || key,
        version: appInfo.api_version || 'v1',
        description: appInfo.app_description,
        endpoints: appInfo.endpoints?.length || 0,
        endpointsList: appInfo.endpoints || []
      })
    }
  })

  // Sort by endpoint count
  return apps.sort((a, b) => b.endpoints - a.endpoints)
})

// Fetch API info
const refreshApiInfo = async () => {
  isLoading.value = true
  error.value = null

  try {
    const response = await api.get('API_INFO')

    if (response.success && response.data) {
      apiInfo.value = response.data
      // Auto-select first app if none selected
      if (!selectedApp.value && applications.value.length > 0) {
        selectedApp.value = applications.value[0]
      }
    } else {
      throw new Error(t('errors.unknownError'))
    }
  } catch (err: any) {
    error.value = err.message || t('errors.networkError')
  } finally {
    isLoading.value = false
  }
}

// Select app
const selectApp = (app: AppSummary) => {
  selectedApp.value = app
}

// Get method class for styling
const getMethodClass = (method?: string): string => {
  if (!method) return 'any'
  const m = method.toUpperCase()
  if (m.includes('GET')) return 'get'
  if (m.includes('POST')) return 'post'
  if (m.includes('PUT')) return 'put'
  if (m.includes('DELETE')) return 'delete'
  if (m.includes('PATCH')) return 'patch'
  return 'any'
}

// Load on mount
onMounted(() => {
  refreshApiInfo()
})
</script>

<style scoped>
.api-info-viewer {
  padding: 1.5rem;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.refresh-btn-small {
  padding: 0.5rem 0.75rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.refresh-btn-small:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}

.refresh-btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.app-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.25rem;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-card:hover {
  border-color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.app-card.active {
  border-color: #6366f1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.app-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
}

.app-info {
  flex: 1;
}

.app-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.app-endpoints {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.app-details {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  border: 2px solid #e5e7eb;
}

.details-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.details-header h4 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.version-badge {
  padding: 0.25rem 0.75rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.app-description {
  color: #6b7280;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #f3f4f6;
}

.endpoints-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.endpoint-item {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.method-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 60px;
  text-align: center;
}

.method-get {
  background: #dcfce7;
  color: #166534;
}

.method-post {
  background: #dbeafe;
  color: #1e40af;
}

.method-put {
  background: #fef3c7;
  color: #92400e;
}

.method-delete {
  background: #fee2e2;
  color: #991b1b;
}

.method-patch {
  background: #e0e7ff;
  color: #3730a3;
}

.method-any {
  background: #f3f4f6;
  color: #374151;
}

.endpoint-path {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #1f2937;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  flex: 1;
}

.endpoint-description {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.endpoint-params {
  margin-top: 0.75rem;
}

.params-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.params-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.param-tag {
  padding: 0.25rem 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #374151;
  font-family: 'Courier New', monospace;
}

.endpoint-meta {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.auth-required {
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.auth-not-required {
  color: #059669;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
