<template>
  <div class="it-tools-panel">
    <!-- Connection Status -->
    <div class="bento-card status-card">
      <div class="status-content">
        <div class="connection-badge" :class="apiClient.isFullyConnected ? 'connected' : 'disconnected'">
          <span class="status-dot" :class="{ online: apiClient.isFullyConnected }"></span>
          <span>{{ apiClient.statusText }}</span>
        </div>
        <button @click="apiClient.reconnectConnections" :disabled="apiClient.isLoading" class="btn-glass">
          <i :class="['fas', apiClient.isLoading ? 'fa-spinner fa-spin' : 'fa-sync']"></i>
          <span>Reconnect</span>
        </button>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bento-card">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-globe"></i>
          <span>Browser Automation</span>
        </div>
      </div>
      
      <div class="panel-body">
        <div class="bento-grid bento-grid-auto">
          <button v-for="action in BROWSER_ACTIONS_LIST" :key="action.id" @click="handleAction(action.id)" :disabled="isProcessing" class="action-card" :class="action.colorClass">
            <div class="action-card-icon" :class="action.colorClass">
              <i :class="action.icon"></i>
            </div>
            <span class="action-card-title">{{ action.name }}</span>
            <span class="action-card-desc">{{ action.description }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="bento-card">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-terminal"></i>
          <span>Results</span>
        </div>
      </div>
      <div class="panel-body">
        <div class="terminal-output glass-scroll">
          <pre>{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- Browser Status -->
    <div v-if="browserStatus" class="bento-card">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-server"></i>
          <span>Browser Status</span>
        </div>
      </div>
      <div class="panel-body">
        <div class="bento-grid bento-grid-2">
          <div class="status-item-card">
            <span class="label-glass">Status</span>
            <span :class="['tag-glass', browserStatus.isRunning ? 'tag-success' : 'tag-error']">
              {{ browserStatus.isRunning ? 'Running' : 'Stopped' }}
            </span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">Port</span>
            <span class="status-value">{{ browserStatus.port }}</span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">URL</span>
            <span class="status-value text-primary">{{ browserStatus.url }}</span>
          </div>
          <div class="status-item-card">
            <span class="label-glass">Has Process</span>
            <span class="status-value">{{ browserStatus.hasChildProcess ? 'Yes' : 'No' }}</span>
          </div>
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

// Actions configuration
const BROWSER_ACTIONS_LIST = [
  { id: 'screenshot', name: 'Take Screenshot', icon: 'fas fa-camera', description: 'Capture current page', colorClass: 'blue' },
  { id: 'content', name: 'Get Page Content', icon: 'fas fa-file-alt', description: 'Extract HTML', colorClass: 'green' },
  { id: 'open', name: 'Open Page', icon: 'fas fa-external-link-alt', description: 'Navigate to URL', colorClass: 'purple' },
  { id: 'click', name: 'Click Element', icon: 'fas fa-mouse-pointer', description: 'Interactive clicking', colorClass: 'orange' },
  { id: 'execute', name: 'Execute JS', icon: 'fas fa-code', description: 'Run JavaScript', colorClass: 'red' },
  { id: 'status', name: 'Browser Status', icon: 'fas fa-info-circle', description: 'Check status', colorClass: 'gray' }
];

const isProcessing = ref(false);
const result = ref<any>(null);
const browserStatus = ref<any>(null);
const showOpenPageModal = ref(false);
const showClickElementModal = ref(false);
const showExecuteJSModal = ref(false);

const apiClient = useApiClient();

const handleAction = (actionId: string) => {
  switch (actionId) {
    case 'screenshot': takeScreenshot(); break;
    case 'content': getPageContent(); break;
    case 'open': showOpenPageModal.value = true; break;
    case 'click': showClickElementModal.value = true; break;
    case 'execute': showExecuteJSModal.value = true; break;
    case 'status': getBrowserStatus(); break;
  }
};

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
.status-card {
  padding: 1rem 1.25rem;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-item-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
}

.status-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
}

/* Action Card Colors */
.action-card.blue .action-card-icon { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
.action-card.green .action-card-icon { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
.action-card.purple .action-card-icon { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
.action-card.orange .action-card-icon { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }
.action-card.red .action-card-icon { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
.action-card.gray .action-card-icon { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
</style>
