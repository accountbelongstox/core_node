<template>
  <div class="space-y-6">
    <!-- Connection Status -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded-full" :class="apiClient.isFullyConnected ? 'bg-green-500' : 'bg-red-500'"></div>
          <span class="text-sm font-medium" :class="apiClient.statusColor">
            {{ apiClient.statusText }}
          </span>
        </div>
        <button
          @click="apiClient.reconnectConnections"
          :disabled="apiClient.isLoading"
          class="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition disabled:opacity-50"
        >
          <i v-if="apiClient.isLoading" class="fas fa-spinner fa-spin mr-1"></i>
          <i v-else class="fas fa-sync mr-1"></i>
          Reconnect
        </button>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        <i class="fas fa-globe text-blue-600 mr-2"></i>
        Browser Automation
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          @click="takeScreenshot"
          :disabled="isProcessing"
          class="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-camera text-2xl"></i>
          <span class="font-medium">Take Screenshot</span>
          <span class="text-sm text-blue-600">Capture current page</span>
        </button>

        <button
          @click="getPageContent"
          :disabled="isProcessing"
          class="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-green-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-file-alt text-2xl"></i>
          <span class="font-medium">Get Page Content</span>
          <span class="text-sm text-green-600">Extract HTML</span>
        </button>

        <button
          @click="openWebPage"
          :disabled="isProcessing"
          class="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-external-link-alt text-2xl"></i>
          <span class="font-medium">Open Page</span>
          <span class="text-sm text-purple-600">Navigate to URL</span>
        </button>

        <button
          @click="clickElement"
          :disabled="isProcessing"
          class="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-orange-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-mouse-pointer text-2xl"></i>
          <span class="font-medium">Click Element</span>
          <span class="text-sm text-orange-600">Interactive clicking</span>
        </button>

        <button
          @click="evaluateJavaScript"
          :disabled="isProcessing"
          class="p-4 bg-red-50 hover:bg-red-100 rounded-lg text-red-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-code text-2xl"></i>
          <span class="font-medium">Execute JS</span>
          <span class="text-sm text-red-600">Run JavaScript</span>
        </button>

        <button
          @click="getBrowserStatus"
          :disabled="isProcessing"
          class="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition flex flex-col items-center space-y-2"
        >
          <i class="fas fa-info-circle text-2xl"></i>
          <span class="font-medium">Browser Status</span>
          <span class="text-sm text-gray-600">Check status</span>
        </button>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-3">Results</h3>
      <div class="bg-gray-50 rounded-lg p-4">
        <pre class="text-sm text-gray-800 whitespace-pre-wrap">{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </div>

    <!-- Browser Status -->
    <div v-if="browserStatus" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-3">Browser Status</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span class="text-sm text-gray-500">Status:</span>
          <span class="ml-2 font-medium" :class="browserStatus.isRunning ? 'text-green-600' : 'text-red-600'">
            {{ browserStatus.isRunning ? 'Running' : 'Stopped' }}
          </span>
        </div>
        <div>
          <span class="text-sm text-gray-500">Port:</span>
          <span class="ml-2 font-medium">{{ browserStatus.port }}</span>
        </div>
        <div>
          <span class="text-sm text-gray-500">URL:</span>
          <span class="ml-2 font-medium text-blue-600 underline">{{ browserStatus.url }}</span>
        </div>
        <div>
          <span class="text-sm text-gray-500">Has Process:</span>
          <span class="ml-2 font-medium">{{ browserStatus.hasChildProcess ? 'Yes' : 'No' }}</span>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <OpenPageModal
      v-if="showOpenPageModal"
      @close="showOpenPageModal = false"
      @open="handleOpenPage"
    />

    <ClickElementModal
      v-if="showClickElementModal"
      @close="showClickElementModal = false"
      @click="handleClickElement"
    />

    <ExecuteJSModal
      v-if="showExecuteJSModal"
      @close="showExecuteJSModal = false"
      @execute="handleExecuteJS"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import OpenPageModal from './OpenPageModal.vue';
import ClickElementModal from './ClickElementModal.vue';
import ExecuteJSModal from './ExecuteJSModal.vue';
import { useApiClient } from '@/app_ittools_pages/composables/useApiClient';

const isProcessing = ref(false);
const result = ref<any>(null);
const browserStatus = ref<any>(null);
const showOpenPageModal = ref(false);
const showClickElementModal = ref(false);
const showExecuteJSModal = ref(false);

const apiClient = useApiClient();

// Browser automation functions via API
const takeScreenshot = async () => {
  if (!apiClient.isFullyConnected.value) {
    result.value = { error: 'Not connected to backend services' };
    return;
  }

  isProcessing.value = true;
  result.value = null;

  try {
    const response = await apiClient.apiClient.post('/api/browser/screenshot', {
      url: 'https://example.com',
      full_page: true
    });
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
    const response = await apiClient.apiClient.post('/api/browser/content', {
      url: 'https://example.com'
    });
    result.value = response;
  } catch (error) {
    result.value = { error: error instanceof Error ? error.message : 'Failed to get page content' };
  } finally {
    isProcessing.value = false;
  }
};

const openWebPage = () => {
  showOpenPageModal.value = true;
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

const clickElement = () => {
  showClickElementModal.value = true;
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

const evaluateJavaScript = () => {
  showExecuteJSModal.value = true;
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
    if (response.success) {
      browserStatus.value = response.data;
    } else {
      browserStatus.value = { error: response.error || 'Failed to get browser status' };
    }
  } catch (error) {
    browserStatus.value = { error: error instanceof Error ? error.message : 'Failed to get browser status' };
  } finally {
    isProcessing.value = false;
  }
};

// Connection status indicator
onMounted(() => {
  // Auto-refresh browser status when connection is established
  const checkStatus = () => {
    if (apiClient.isFullyConnected.value) {
      getBrowserStatus();
    }
  };

  // Check status every 10 seconds
  const statusInterval = setInterval(checkStatus, 10000);

  // Initial check
  checkStatus();

  onUnmounted(() => {
    clearInterval(statusInterval);
  });
});
</script>