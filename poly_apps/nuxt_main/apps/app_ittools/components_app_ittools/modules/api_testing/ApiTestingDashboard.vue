<template>
  <div class="api-testing-dashboard">
    <div class="dashboard-header">
      <h2 class="module-title">{{ t('apiTesting.title') }}</h2>
      <p class="module-description">{{ t('modules.apiTesting.description') }}</p>
    </div>

    <!-- Main Tabs: Request Builder vs API Info -->
    <div class="main-tabs">
      <button
        @click="activeMainTab = 'request'"
        :class="['main-tab-btn', { active: activeMainTab === 'request' }]"
      >
        <i class="fas fa-paper-plane"></i>
        {{ t('apiTesting.requestBuilder') }}
      </button>
      <button
        @click="activeMainTab = 'apiInfo'"
        :class="['main-tab-btn', { active: activeMainTab === 'apiInfo' }]"
      >
        <i class="fas fa-book"></i>
        {{ t('apiTesting.apiInfo') }}
      </button>
    </div>

    <div class="dashboard-content" v-if="activeMainTab === 'request'">
      <!-- Request Builder Section -->
      <div class="request-section glass-panel">
        <h3 class="section-title">{{ t('apiTesting.requestBuilder') }}</h3>

        <!-- Method and URL -->
        <div class="request-line">
          <select v-model="requestData.method" class="method-select">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
          <input
            v-model="requestData.url"
            type="text"
            class="url-input"
            :placeholder="t('apiTesting.url')"
          />
          <button
            @click="sendRequest"
            :disabled="isLoading || !requestData.url"
            class="send-btn"
          >
            <i class="fas" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
            {{ t('apiTesting.send') }}
          </button>
        </div>

        <!-- Tabs for Headers, Params, Body -->
        <div class="tabs">
          <button
            v-for="tab in requestTabs"
            :key="tab"
            @click="activeRequestTab = tab"
            :class="['tab-btn', { active: activeRequestTab === tab }]"
          >
            {{ t(`apiTesting.${tab.toLowerCase()}`) }}
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Headers Tab -->
          <div v-if="activeRequestTab === 'Headers'" class="key-value-editor">
            <div
              v-for="(header, index) in requestData.headers"
              :key="`header-${index}`"
              class="key-value-row"
            >
              <input
                v-model="header.key"
                type="text"
                placeholder="Header Name"
                class="key-input"
              />
              <input
                v-model="header.value"
                type="text"
                placeholder="Header Value"
                class="value-input"
              />
              <button @click="removeHeader(index)" class="remove-btn">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <button @click="addHeader" class="add-btn">
              <i class="fas fa-plus"></i>
              {{ t('apiTesting.addHeader') }}
            </button>
          </div>

          <!-- Params Tab -->
          <div v-if="activeRequestTab === 'Params'" class="key-value-editor">
            <div
              v-for="(param, index) in requestData.params"
              :key="`param-${index}`"
              class="key-value-row"
            >
              <input
                v-model="param.key"
                type="text"
                placeholder="Parameter Name"
                class="key-input"
              />
              <input
                v-model="param.value"
                type="text"
                placeholder="Parameter Value"
                class="value-input"
              />
              <button @click="removeParam(index)" class="remove-btn">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <button @click="addParam" class="add-btn">
              <i class="fas fa-plus"></i>
              {{ t('apiTesting.addParam') }}
            </button>
          </div>

          <!-- Body Tab -->
          <div v-if="activeRequestTab === 'Body'" class="body-editor">
            <textarea
              v-model="requestData.body"
              class="body-textarea"
              :placeholder="t('apiTesting.body')"
              rows="10"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Response Section -->
      <div v-if="response" class="response-section glass-panel">
        <div class="response-header">
          <h3 class="section-title">{{ t('apiTesting.response') }}</h3>
          <div class="response-meta">
            <span class="status-badge" :class="`status-${getStatusClass(response.status)}`">
              {{ response.status }}
            </span>
            <span class="time-badge">
              {{ response.time }}ms
            </span>
            <span class="size-badge">
              {{ formatBytes(response.size) }}
            </span>
          </div>
          <div class="response-actions">
            <button @click="copyResponse" class="action-btn" :title="t('apiTesting.copyResponse')">
              <i class="fas fa-copy"></i>
            </button>
            <button @click="downloadResponse" class="action-btn" :title="t('apiTesting.downloadResponse')">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>

        <!-- Response Tabs -->
        <div class="tabs">
          <button
            v-for="tab in responseTabs"
            :key="tab"
            @click="activeResponseTab = tab"
            :class="['tab-btn', { active: activeResponseTab === tab }]"
          >
            {{ t(`apiTesting.${tab.toLowerCase()}View`) }}
          </button>
        </div>

        <!-- Response Content -->
        <div class="response-content">
          <pre v-if="activeResponseTab === 'Raw'" class="response-raw">{{ response.data }}</pre>
          <pre v-else-if="activeResponseTab === 'Pretty'" class="response-pretty">{{ formatJson(response.data) }}</pre>
          <div v-else-if="activeResponseTab === 'Preview'" class="response-preview" v-html="previewHtml"></div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-panel glass-panel">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- API Info Tab -->
    <div v-if="activeMainTab === 'apiInfo'">
      <ApiInfoViewer />
    </div>
  </div>
</template>

<script setup lang="ts">
// Import composables
import { useApi } from '@/apps/app_ittools/composables_app_ittools/useApi'
import { useI18n } from '@/apps/app_ittools/composables_app_ittools/useI18n'

// Import API Info Viewer component
import ApiInfoViewer from './ApiInfoViewer.vue'

interface KeyValue {
  key: string
  value: string
}

interface RequestData {
  method: string
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
}

interface ResponseData {
  status: number
  time: number
  size: number
  data: any
}

// Use unified composables
const { t } = useI18n()
const api = useApi()

// State
const activeMainTab = ref('request')
const activeRequestTab = ref('Headers')
const activeResponseTab = ref('Pretty')
const isLoading = ref(false)
const error = ref<string | null>(null)
const response = ref<ResponseData | null>(null)

const requestData = ref<RequestData>({
  method: 'GET',
  url: '',
  headers: [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Accept', value: 'application/json' }
  ],
  params: [],
  body: ''
})

// Tabs
const requestTabs = ['Headers', 'Params', 'Body']
const responseTabs = ['Raw', 'Pretty', 'Preview']

// Methods
const addHeader = () => {
  requestData.value.headers.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  requestData.value.headers.splice(index, 1)
}

const addParam = () => {
  requestData.value.params.push({ key: '', value: '' })
}

const removeParam = (index: number) => {
  requestData.value.params.splice(index, 1)
}

const sendRequest = async () => {
  if (!requestData.value.url) return

  isLoading.value = true
  error.value = null
  response.value = null

  const startTime = performance.now()

  try {
    // Build headers object
    const headers: Record<string, string> = {}
    requestData.value.headers.forEach(h => {
      if (h.key && h.value) {
        headers[h.key] = h.value
      }
    })

    // Build params object
    const params: Record<string, string> = {}
    requestData.value.params.forEach(p => {
      if (p.key && p.value) {
        params[p.key] = p.value
      }
    })

    // Parse body if JSON
    let body = requestData.value.body
    if (body && headers['Content-Type']?.includes('json')) {
      try {
        body = JSON.parse(body)
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }

    // Make API call using unified API client
    const result = await api.call('API_TEST_EXECUTE', {
      method: requestData.value.method as any,
      body: {
        url: requestData.value.url,
        method: requestData.value.method,
        headers,
        params,
        body
      }
    })

    const endTime = performance.now()

    if (result.success && result.data) {
      response.value = {
        status: result.data.status || 200,
        time: Math.round(endTime - startTime),
        size: JSON.stringify(result.data).length,
        data: result.data.body || result.data
      }
    } else {
      throw new Error(result.error || t('errors.unknownError'))
    }
  } catch (err: any) {
    error.value = err.message || t('errors.networkError')
  } finally {
    isLoading.value = false
  }
}

const copyResponse = async () => {
  if (!response.value) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(response.value.data, null, 2))
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const downloadResponse = () => {
  if (!response.value) return
  const blob = new Blob([JSON.stringify(response.value.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `api-response-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const formatJson = (data: any): string => {
  try {
    return JSON.stringify(data, null, 2)
  } catch (e) {
    return String(data)
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const getStatusClass = (status: number): string => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'redirect'
  if (status >= 400 && status < 500) return 'client-error'
  return 'server-error'
}

const previewHtml = computed(() => {
  if (!response.value) return ''
  try {
    return `<pre>${formatJson(response.value.data)}</pre>`
  } catch (e) {
    return String(response.value.data)
  }
})
</script>

<style scoped>
.api-testing-dashboard {
  padding: 1.5rem;
}

.dashboard-header {
  margin-bottom: 1.5rem;
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

.main-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.main-tab-btn {
  padding: 1rem 1.5rem;
  background: transparent;
  border: none;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.main-tab-btn:hover {
  color: #6366f1;
}

.main-tab-btn.active {
  color: #6366f1;
  font-weight: 600;
}

.main-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #6366f1;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
}

.request-line {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.method-select {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-weight: 600;
  color: #6366f1;
  background: white;
  cursor: pointer;
  min-width: 120px;
}

.url-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.url-input:focus {
  outline: none;
  border-color: #6366f1;
}

.send-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1rem;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tab-btn:hover {
  color: #6366f1;
}

.tab-btn.active {
  color: #6366f1;
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #6366f1;
}

.key-value-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.key-value-row {
  display: flex;
  gap: 0.75rem;
}

.key-input,
.value-input {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
}

.key-input {
  flex: 1;
}

.value-input {
  flex: 2;
}

.remove-btn {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #ef4444;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.add-btn {
  padding: 0.75rem 1rem;
  background: #f0fdf4;
  color: #22c55e;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  align-self: flex-start;
}

.body-textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  resize: vertical;
}

.response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.response-meta {
  display: flex;
  gap: 0.75rem;
}

.status-badge,
.time-badge,
.size-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge {
  background: #f3f4f6;
  color: #6b7280;
}

.status-success {
  background: #d1fae5;
  color: #059669;
}

.status-client-error {
  background: #fee2e2;
  color: #dc2626;
}

.status-server-error {
  background: #fef2f2;
  color: #991b1b;
}

.time-badge {
  background: #dbeafe;
  color: #2563eb;
}

.size-badge {
  background: #e0e7ff;
  color: #6366f1;
}

.response-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 0.75rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.response-content {
  max-height: 500px;
  overflow: auto;
}

.response-raw,
.response-pretty {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  margin: 0;
}

.error-panel {
  background: #fef2f2;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
}
</style>
