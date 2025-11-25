<template>
  <div class="automation-panel">
    <!-- Connection Status -->
    <div class="bento-card status-card">
      <div class="status-content">
        <div class="status-indicator" :class="{ connected: apiClient.isFullyConnected }">
          <span class="status-dot"></span>
          <span class="status-text">{{ apiClient.statusText }}</span>
        </div>
        <button @click="apiClient.reconnectConnections" :disabled="apiClient.isLoading" class="btn-glass">
          <i :class="['fas', apiClient.isLoading ? 'fa-spinner fa-spin' : 'fa-sync']"></i>
          Reconnect
        </button>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bento-card actions-card">
      <div class="card-header">
        <i class="fas fa-globe header-icon"></i>
        <h2>Browser Automation</h2>
      </div>
      
      <div class="actions-grid">
        <button @click="takeScreenshot" :disabled="isProcessing" class="action-btn blue">
          <i class="fas fa-camera"></i>
          <span class="action-title">Take Screenshot</span>
          <span class="action-desc">Capture current page</span>
        </button>

        <button @click="getPageContent" :disabled="isProcessing" class="action-btn green">
          <i class="fas fa-file-alt"></i>
          <span class="action-title">Get Page Content</span>
          <span class="action-desc">Extract HTML</span>
        </button>

        <button @click="openWebPage" :disabled="isProcessing" class="action-btn purple">
          <i class="fas fa-external-link-alt"></i>
          <span class="action-title">Open Page</span>
          <span class="action-desc">Navigate to URL</span>
        </button>

        <button @click="clickElement" :disabled="isProcessing" class="action-btn orange">
          <i class="fas fa-mouse-pointer"></i>
          <span class="action-title">Click Element</span>
          <span class="action-desc">Interactive clicking</span>
        </button>

        <button @click="evaluateJavaScript" :disabled="isProcessing" class="action-btn red">
          <i class="fas fa-code"></i>
          <span class="action-title">Execute JS</span>
          <span class="action-desc">Run JavaScript</span>
        </button>

        <button @click="getBrowserStatus" :disabled="isProcessing" class="action-btn gray">
          <i class="fas fa-info-circle"></i>
          <span class="action-title">Browser Status</span>
          <span class="action-desc">Check status</span>
        </button>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="bento-card results-card">
      <div class="card-header">
        <i class="fas fa-terminal header-icon"></i>
        <h3>Results</h3>
      </div>
      <div class="results-content">
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>

    <!-- Browser Status -->
    <div v-if="browserStatus" class="bento-card status-info-card">
      <div class="card-header">
        <i class="fas fa-server header-icon"></i>
        <h3>Browser Status</h3>
      </div>
      <div class="status-grid">
        <div class="status-item">
          <span class="item-label">Status</span>
          <span class="item-value" :class="browserStatus.isRunning ? 'success' : 'error'">
            {{ browserStatus.isRunning ? 'Running' : 'Stopped' }}
          </span>
        </div>
        <div class="status-item">
          <span class="item-label">Port</span>
          <span class="item-value">{{ browserStatus.port }}</span>
        </div>
        <div class="status-item">
          <span class="item-label">URL</span>
          <span class="item-value link">{{ browserStatus.url }}</span>
        </div>
        <div class="status-item">
          <span class="item-label">Has Process</span>
          <span class="item-value">{{ browserStatus.hasChildProcess ? 'Yes' : 'No' }}</span>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <OpenPageModal v-if="showOpenPageModal" @close="showOpenPageModal = false" @open="handleOpenPage" />
    <ClickElementModal v-if="showClickElementModal" @close="showClickElementModal = false" @click="handleClickElement" />
    <ExecuteJSModal v-if="showExecuteJSModal" @close="showExecuteJSModal = false" @execute="handleExecuteJS" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import OpenPageModal from './OpenPageModal.vue';
import ClickElementModal from './ClickElementModal.vue';
import ExecuteJSModal from './ExecuteJSModal.vue';
import { useApiClient } from '@/apps/app_ittools/composables_app_ittools/useApiClient';

const isProcessing = ref(false);
const result = ref<any>(null);
const browserStatus = ref<any>(null);
const showOpenPageModal = ref(false);
const showClickElementModal = ref(false);
const showExecuteJSModal = ref(false);

const apiClient = useApiClient();

const takeScreenshot = async () => {
  if (!apiClient.isFullyConnected.value) {
    result.value = { error: 'Not connected to backend services' };
    return;
  }
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await apiClient.apiClient.post('/api/browser/screenshot', { url: 'https://example.com', full_page: true });
    result.value = response;
  } catch (error) {
    result.value = { error: error instanceof Error ? error.message : 'Screenshot failed' };
  } finally {
    isProcessing.value = false;
  }
};

const getPageContent = async () => {
  if (!apiClient.isFullyConnected.value) {
    result.value = { error: 'Not connected to backend services' };
    return;
  }
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await apiClient.apiClient.post('/api/browser/content', { url: 'https://example.com' });
    result.value = response;
  } catch (error) {
    result.value = { error: error instanceof Error ? error.message : 'Failed to get page content' };
  } finally {
    isProcessing.value = false;
  }
};

const openWebPage = () => { showOpenPageModal.value = true; };

const handleOpenPage = async (data: { url: string; waitFor: string; selector?: string; timeout: number; userAgent?: string; headless: boolean }) => {
  if (!apiClient.isFullyConnected.value) {
    result.value = { error: 'Not connected to backend services' };
    return;
  }
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await apiClient.apiClient.post('/api/browser/open', data);
    result.value = response;
  } catch (error) {
    result.value = { error: error instanceof Error ? error.message : 'Failed to open page' };
  } finally {
    isProcessing.value = false;
  }
};

const clickElement = () => { showClickElementModal.value = true; };

const handleClickElement = async (data: { url: string; selector: string; clickType: string; waitBefore: number; waitAfter: number; waitForNavigation: boolean }) => {
  if (!apiClient.isFullyConnected.value) {
    result.value = { error: 'Not connected to backend services' };
    return;
  }
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await apiClient.apiClient.post('/api/browser/click', data);
    result.value = response;
  } catch (error) {
    result.value = { error: error instanceof Error ? error.message : 'Failed to click element' };
  } finally {
    isProcessing.value = false;
  }
};

const evaluateJavaScript = () => { showExecuteJSModal.value = true; };

const handleExecuteJS = async (data: { url: string; script: string; context: string; timeout: number; returnResult: boolean }) => {
  if (!apiClient.isFullyConnected.value) {
    result.value = { error: 'Not connected to backend services' };
    return;
  }
  isProcessing.value = true;
  result.value = null;
  try {
    const response = await apiClient.apiClient.post('/api/browser/execute-js', data);
    result.value = response;
  } catch (error) {
    result.value = { error: error instanceof Error ? error.message : 'Failed to execute JavaScript' };
  } finally {
    isProcessing.value = false;
  }
};

const getBrowserStatus = async () => {
  if (!apiClient.isFullyConnected.value) {
    browserStatus.value = { error: 'Not connected to backend services' };
    return;
  }
  isProcessing.value = true;
  browserStatus.value = null;
  try {
    const response = await apiClient.apiClient.get('/api/browser/status');
    if (response.success) browserStatus.value = response.data;
    else browserStatus.value = { error: response.error || 'Failed to get browser status' };
  } catch (error) {
    browserStatus.value = { error: error instanceof Error ? error.message : 'Failed to get browser status' };
  } finally {
    isProcessing.value = false;
  }
};

onMounted(() => {
  const checkStatus = () => {
    if (apiClient.isFullyConnected.value) getBrowserStatus();
  };
  const statusInterval = setInterval(checkStatus, 10000);
  checkStatus();
  onUnmounted(() => { clearInterval(statusInterval); });
});
</script>

<style scoped>
.automation-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-bento, 12px);
}

.bento-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.status-card {
  padding: 1rem 1.25rem;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
  animation: pulse 2s infinite;
}

.status-indicator.connected .status-dot {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.btn-glass {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #4f46e5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-glass:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.btn-glass:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actions-card {
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.header-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 12px;
  color: white;
  font-size: 1rem;
}

.card-header h2, .card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn i:first-child {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.action-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.action-desc {
  font-size: 0.75rem;
  color: #6b7280;
}

.action-btn.blue { background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.2); }
.action-btn.blue i:first-child { color: #3b82f6; }
.action-btn.blue:hover { background: rgba(59, 130, 246, 0.12); }

.action-btn.green { background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.2); }
.action-btn.green i:first-child { color: #22c55e; }
.action-btn.green:hover { background: rgba(34, 197, 94, 0.12); }

.action-btn.purple { background: rgba(139, 92, 246, 0.08); border-color: rgba(139, 92, 246, 0.2); }
.action-btn.purple i:first-child { color: #8b5cf6; }
.action-btn.purple:hover { background: rgba(139, 92, 246, 0.12); }

.action-btn.orange { background: rgba(249, 115, 22, 0.08); border-color: rgba(249, 115, 22, 0.2); }
.action-btn.orange i:first-child { color: #f97316; }
.action-btn.orange:hover { background: rgba(249, 115, 22, 0.12); }

.action-btn.red { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
.action-btn.red i:first-child { color: #ef4444; }
.action-btn.red:hover { background: rgba(239, 68, 68, 0.12); }

.action-btn.gray { background: rgba(107, 114, 128, 0.08); border-color: rgba(107, 114, 128, 0.2); }
.action-btn.gray i:first-child { color: #6b7280; }
.action-btn.gray:hover { background: rgba(107, 114, 128, 0.12); }

.results-card, .status-info-card {
  padding: 1.5rem;
}

.results-content {
  background: rgba(249, 250, 251, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 12px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.results-content pre {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8125rem;
  color: #374151;
  margin: 0;
  white-space: pre-wrap;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.item-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1f2937;
}

.item-value.success { color: #22c55e; }
.item-value.error { color: #ef4444; }
.item-value.link { color: #3b82f6; text-decoration: underline; }
</style>
