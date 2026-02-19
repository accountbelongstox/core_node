<template>
  <div class="w-[1400px] min-h-[900px] bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex flex-col">
    <!-- Header Bar -->
    <div class="bg-white/95 backdrop-blur-sm border-b border-gray-200/60 shadow-sm px-8 py-5 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transform transition-transform hover:scale-105">
          <span class="text-2xl">🌐</span>
        </div>
        <div>
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-0.5">Chrome MCP Server</h1>
          <p class="text-xs text-gray-500 font-medium">AI-Powered Browser Automation</p>
        </div>
      </div>
      <LanguageSelector />
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 shadow-sm">
      <div class="flex gap-1 px-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'flex items-center gap-2.5 px-6 py-4 font-medium text-sm transition-all duration-200 relative',
            activeTab === tab.id
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          ]"
          @click="activeTab = tab.id"
        >
          <span class="text-base">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span
            v-if="activeTab === tab.id"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
          ></span>
          <span
            v-else
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent group-hover:bg-gray-300 rounded-full transition-colors"
          ></span>
        </button>
      </div>
    </div>

    <div class="flex-1 px-6 py-6 overflow-y-auto">
      <!-- Server Tab - Bento Box Layout -->
      <div v-show="activeTab === 'server'" class="max-w-7xl mx-auto">
        <div class="grid grid-cols-3 gap-4 auto-rows-fr">
          <!-- Status Card (1x1) -->
          <div class="col-span-1 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6 flex flex-col justify-between transition-all hover:shadow-xl">
            <div>
              <div class="flex items-center justify-between mb-4">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ getMessage('runningStatusLabel') }}</p>
                <button
                  class="px-3 py-1 text-xs font-mono font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  @click="refreshServerStatus"
                  :title="getMessage('refreshStatusButton')"
                >
                  ↻
                </button>
              </div>
              <div class="flex items-center gap-3 mb-2">
                <span :class="['w-3 h-3 rounded-full animate-pulse', getStatusClass()]"></span>
                <span class="text-base font-semibold text-gray-900">{{ getStatusText() }}</span>
              </div>
              <div v-if="serverStatus.lastUpdated" class="text-xs text-gray-500">
                {{ new Date(serverStatus.lastUpdated).toLocaleTimeString() }}
              </div>
            </div>
          </div>

          <!-- Connection Card (2x1) -->
          <div class="col-span-2 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6 flex flex-col justify-between transition-all hover:shadow-xl">
            <div class="space-y-4">
              <div>
                <label for="port" class="block text-sm font-semibold text-gray-700 mb-2">{{ getMessage('connectionPortLabel') }}</label>
                <input
                  type="text"
                  id="port"
                  :value="nativeServerPort"
                  @input="updatePort"
                  class="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <button
                :class="[
                  'w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg',
                  isConnecting
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed shadow-gray-400/30'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
                ]"
                :disabled="isConnecting"
                @click="testNativeConnection"
              >
                <BoltIcon />
                <span>{{
                  isConnecting
                    ? getMessage('connectingStatus')
                    : nativeConnectionStatus === 'connected'
                      ? getMessage('disconnectButton')
                      : getMessage('connectButton')
                }}</span>
              </button>
            </div>
          </div>

          <!-- MCP Config Card (3x1) - Full Width -->
          <div v-if="showMcpConfig" class="col-span-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6 transition-all hover:shadow-xl">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-semibold text-gray-700">{{ getMessage('mcpServerConfigLabel') }}</p>
              <button 
                class="px-4 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" 
                @click="copyMcpConfig"
              >
                {{ copyButtonText }}
              </button>
            </div>
            <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre class="text-xs text-green-400 font-mono leading-relaxed">{{ mcpConfigJson }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Semantic Tab - Bento Box Layout -->
      <div v-show="activeTab === 'semantic'" class="max-w-7xl mx-auto">
        <div class="grid grid-cols-3 gap-4 auto-rows-fr">
          <!-- Engine Status Card (1x1) -->
          <div class="col-span-1 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6 flex flex-col justify-between transition-all hover:shadow-xl">
            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{{ getMessage('semanticEngineLabel') }}</p>
              <div class="flex items-center gap-3 mb-2">
                <span :class="['w-3 h-3 rounded-full animate-pulse', getSemanticEngineStatusClass()]"></span>
                <span class="text-base font-semibold text-gray-900">{{ getSemanticEngineStatusText() }}</span>
              </div>
              <div v-if="semanticEngineLastUpdated" class="text-xs text-gray-500">
                {{ new Date(semanticEngineLastUpdated).toLocaleTimeString() }}
              </div>
            </div>
            <button
              :class="[
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white transition-all duration-200 shadow-md text-sm',
                isSemanticEngineInitializing
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              ]"
              :disabled="isSemanticEngineInitializing"
              @click="initializeSemanticEngine"
            >
              <BoltIcon />
              <span class="text-xs">{{ getSemanticEngineButtonText() }}</span>
            </button>
          </div>

          <!-- Progress Card (2x1) -->
          <div v-if="isSemanticEngineInitializing" class="col-span-2 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6 transition-all hover:shadow-xl">
            <ProgressIndicator
              :visible="isSemanticEngineInitializing"
              :text="semanticEngineInitProgress"
              :showSpinner="true"
            />
          </div>

          <!-- Error Card (3x1) - Full Width -->
          <div v-if="modelInitializationStatus === 'error'" class="col-span-3 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300/60 rounded-xl p-6 shadow-lg shadow-red-200/30">
            <div class="flex gap-4 mb-4">
              <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-100 rounded-full text-red-600 font-bold text-lg">[!]</div>
              <div class="flex-1 space-y-2">
                <p class="font-semibold text-red-800">{{ getMessage('semanticEngineInitFailedStatus') }}</p>
                <p class="text-sm text-red-700">{{ modelErrorMessage || getMessage('semanticEngineInitFailedStatus') }}</p>
                <p class="text-xs text-red-600">{{ getErrorTypeText() }}</p>
              </div>
            </div>
            <button
              class="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-xl hover:from-red-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] text-sm"
              @click="retryModelInitialization"
              :disabled="isModelSwitching || isModelDownloading"
            >
              <span class="font-mono text-xs">[RETRY]</span>
              <span>{{ getMessage('retryButton') }}</span>
            </button>
          </div>

          <!-- Model Selection Cards (1x2 each) -->
          <div class="col-span-3">
            <p class="text-sm font-semibold text-gray-700 mb-4">{{ getMessage('embeddingModelLabel') }}</p>
            <div class="grid grid-cols-3 gap-4">

              <div
                v-for="model in availableModels"
                :key="model.preset"
                :class="[
                  'relative bg-white/90 backdrop-blur-sm border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[200px]',
                  currentModel === model.preset
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20 bg-gradient-to-br from-blue-50/50 to-purple-50/30'
                    : 'border-gray-200/60 hover:border-blue-400 hover:shadow-md hover:shadow-gray-200/50 hover:bg-white',
                  isModelSwitching || isModelDownloading
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                ]"
                @click="
                  !isModelSwitching && !isModelDownloading && switchModel(model.preset as ModelPreset)
                "
              >
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex-1">
                    <p :class="['text-base font-semibold mb-1', currentModel === model.preset ? 'text-blue-600' : 'text-gray-800']">
                      {{ model.preset }}
                    </p>
                    <p class="text-xs text-gray-600 leading-relaxed line-clamp-2">{{ getModelDescription(model) }}</p>
                  </div>
                  <div v-if="currentModel === model.preset" class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-500 rounded-full">
                    <CheckIcon class="text-white w-4 h-4" />
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md">{{ getPerformanceText(model.performance) }}</span>
                  <span class="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-md">{{ model.size }}</span>
                  <span class="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md">{{ model.dimension }}D</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Progress Indicator for Model Switching -->
          <div v-if="isModelSwitching || isModelDownloading" class="col-span-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6">
            <ProgressIndicator
              :visible="isModelSwitching || isModelDownloading"
              :text="getProgressText()"
              :showSpinner="true"
            />
          </div>
        </div>
      </div>

      <!-- Data Tab - Bento Box Layout -->
      <div v-show="activeTab === 'data'" class="max-w-7xl mx-auto">
        <div class="grid grid-cols-4 gap-4 auto-rows-fr">
          <!-- Indexed Pages Card (1x1) -->
          <div class="col-span-1 bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5 hover:border-blue-400 hover:shadow-lg transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ getMessage('indexedPagesLabel') }}</p>
              <div class="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <DocumentIcon class="w-5 h-5" />
              </div>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ storageStats?.indexedPages || 0 }}</p>
          </div>

          <!-- Index Size Card (1x1) -->
          <div class="col-span-1 bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5 hover:border-green-400 hover:shadow-lg transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ getMessage('indexSizeLabel') }}</p>
              <div class="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                <DatabaseIcon class="w-5 h-5" />
              </div>
            </div>
            <p class="text-2xl font-bold text-gray-900">{{ formatIndexSize() }}</p>
          </div>

          <!-- Active Tabs Card (1x1) -->
          <div class="col-span-1 bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5 hover:border-purple-400 hover:shadow-lg transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ getMessage('activeTabsLabel') }}</p>
              <div class="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                <TabIcon class="w-5 h-5" />
              </div>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ getActiveTabsCount() }}</p>
          </div>

          <!-- Vector Documents Card (1x1) -->
          <div class="col-span-1 bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl p-5 hover:border-orange-400 hover:shadow-lg transition-all flex flex-col justify-between">
            <div class="flex items-start justify-between mb-3">
              <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ getMessage('vectorDocumentsLabel') }}</p>
              <div class="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                <VectorIcon class="w-5 h-5" />
              </div>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ storageStats?.totalDocuments || 0 }}</p>
          </div>
          <!-- Clear Data Card (2x1) -->
          <div class="col-span-2 bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl p-6 transition-all hover:shadow-lg">
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm font-semibold text-gray-700">{{ getMessage('indexDataManagementLabel') }}</p>
            </div>
            <ProgressIndicator
              v-if="isClearingData && clearDataProgress"
              :visible="isClearingData"
              :text="clearDataProgress"
              :showSpinner="true"
            />
            <button
              :class="[
                'w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg',
                isClearingData
                  ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]'
              ]"
              :disabled="isClearingData"
              @click="showClearConfirmation = true"
            >
              <TrashIcon />
              <span>{{ isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton') }}</span>
            </button>
          </div>

          <!-- Model Cache Management Card (2x1) -->
          <div class="col-span-2 bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl p-6 transition-all hover:shadow-lg">
            <ModelCacheManagement
              :cache-stats="cacheStats"
              :is-managing-cache="isManagingCache"
              @cleanup-cache="cleanupCache"
              @clear-all-cache="clearAllCache"
            />
          </div>
        </div>
      </div>

      <!-- Extensions Tab -->
      <div v-show="activeTab === 'extensions'">
        <ExtensionsPanel />
      </div>

      <!-- Audio Tab -->
      <div v-show="activeTab === 'audio'">
        <AudioRecordingPanel />
      </div>

      <!-- Settings Tab -->
      <div v-show="activeTab === 'settings'">
        <SettingsCenter />
      </div>

      <!-- Debug Tab - Bento Box Layout -->
      <div v-show="activeTab === 'debug'" class="max-w-7xl mx-auto">
        <div class="grid grid-cols-3 gap-4 auto-rows-fr">
          <!-- Debug Toggle Card (3x1) -->
          <div class="col-span-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-6">
            <button 
              class="w-full px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-mono text-sm font-semibold rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow-md hover:shadow-lg" 
              @click="showDebugInfo = !showDebugInfo"
            >
              {{ showDebugInfo ? '[HIDE DEBUG]' : '[SHOW DEBUG]' }}
            </button>
          </div>

          <!-- Connection Status Card (1x1) -->
          <div v-if="showDebugInfo" class="col-span-1 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-5">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">Connection Status</h3>
            <pre class="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed">{{ JSON.stringify({
              nativeConnectionStatus: nativeConnectionStatus,
              isConnecting: isConnecting,
              port: nativeServerPort
            }, null, 2) }}</pre>
          </div>

          <!-- Server Status Card (1x1) -->
          <div v-if="showDebugInfo" class="col-span-1 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-5">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">Server Status</h3>
            <pre class="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed">{{ JSON.stringify(serverStatus, null, 2) }}</pre>
          </div>

          <!-- Debug Logs Card (1x1) -->
          <div v-if="showDebugInfo" class="col-span-1 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-lg p-5 flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-800">Debug Logs</h3>
              <button 
                class="px-3 py-1.5 bg-red-500 text-white font-mono text-xs font-medium rounded-lg hover:bg-red-600 transition-colors" 
                @click="clearDebugLogs"
              >
                [CLEAR]
              </button>
            </div>
            <div class="bg-gray-900 rounded-lg p-3 flex-1 overflow-y-auto space-y-1 max-h-64">
              <div v-for="(log, index) in debugLogs" :key="index" class="flex gap-2 text-xs font-mono">
                <span class="text-gray-500 flex-shrink-0">{{ log.time }}</span>
                <span :class="[
                  'flex-shrink-0',
                  log.level === 'ERROR' ? 'text-red-400 font-bold' : 
                  log.level === 'SUCCESS' ? 'text-green-400 font-bold' : 
                  'text-blue-400'
                ]">{{ log.level }}</span>
                <span class="text-gray-300 flex-1 break-words">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-3 mt-auto">
      <p class="text-center text-xs text-gray-300 font-mono">chrome mcp server for ai</p>
    </div>

    <ConfirmDialog
      :visible="showClearConfirmation"
      :title="getMessage('confirmClearDataTitle')"
      :message="getMessage('clearDataWarningMessage')"
      :items="[
        getMessage('clearDataList1'),
        getMessage('clearDataList2'),
        getMessage('clearDataList3'),
      ]"
      :warning="getMessage('clearDataIrreversibleWarning')"
      icon="[!]"
      :confirm-text="getMessage('confirmClearButton')"
      :cancel-text="getMessage('cancelButton')"
      :confirming-text="getMessage('clearingStatus')"
      :is-confirming="isClearingData"
      @confirm="confirmClearAllData"
      @cancel="hideClearDataConfirmation"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
  PREDEFINED_MODELS,
  type ModelPreset,
  getModelInfo,
  getCacheStats,
  clearModelCache,
  cleanupModelCache,
} from '@/utils/semantic-similarity-engine';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { getMessage } from '@/utils/i18n';

import ConfirmDialog from './components/ConfirmDialog.vue';
import ProgressIndicator from './components/ProgressIndicator.vue';
import ModelCacheManagement from './components/ModelCacheManagement.vue';
import AudioRecordingPanel from './components/AudioRecordingPanel.vue';
import ExtensionsPanel from './components/ExtensionsPanel.vue';
import LanguageSelector from './components/LanguageSelector.vue';
import SettingsCenter from './components/SettingsCenter.vue';
import {
  DocumentIcon,
  DatabaseIcon,
  BoltIcon,
  TrashIcon,
  CheckIcon,
  TabIcon,
  VectorIcon,
} from './components/icons';
import { useAppStore } from '@/composables/useAppStore';

const nativeConnectionStatus = ref<'unknown' | 'connected' | 'disconnected'>('unknown');
const isConnecting = ref(false);
const nativeServerPort = ref<number>(12306);

const serverStatus = ref<{
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}>({
  isRunning: false,
  lastUpdated: Date.now(),
});

// Debug related
const showDebugInfo = ref(false);
const debugLogs = ref<Array<{ time: string; level: string; message: string }>>([]);

// Initialize unified app store
const appStore = useAppStore();

// Tab management
const activeTab = ref('server');
const tabs = [
  { id: 'server', label: 'Server', icon: '⚡' },
  { id: 'semantic', label: 'Semantic', icon: '🧠' },
  { id: 'data', label: 'Data', icon: '💾' },
  { id: 'extensions', label: 'Extensions', icon: '🧩' },
  { id: 'audio', label: 'Audio', icon: '🎙️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'debug', label: 'Debug', icon: '🐛' },
];

const addDebugLog = (level: string, message: string) => {
  const time = new Date().toLocaleTimeString();
  debugLogs.value.unshift({ time, level, message });
  if (debugLogs.value.length > 100) {
    debugLogs.value = debugLogs.value.slice(0, 100);
  }
  console.log(`[${level}] ${time} - ${message}`);
};

const clearDebugLogs = () => {
  debugLogs.value = [];
};

const showMcpConfig = computed(() => {
  return nativeConnectionStatus.value === 'connected' && serverStatus.value.isRunning;
});

const copyButtonText = ref(getMessage('copyConfigButton'));

const mcpConfigJson = computed(() => {
  const port = serverStatus.value.port || nativeServerPort.value;
  const config = {
    mcpServers: {
      'streamable-mcp-server': {
        type: 'streamable-http',
        url: `http://127.0.0.1:${port}/mcp`,
      },
    },
  };
  return JSON.stringify(config, null, 2);
});

const currentModel = ref<ModelPreset | null>(null);
const isModelSwitching = ref(false);
const modelSwitchProgress = ref('');

const modelDownloadProgress = ref<number>(0);
const isModelDownloading = ref(false);
const modelInitializationStatus = ref<'idle' | 'downloading' | 'initializing' | 'ready' | 'error'>(
  'idle',
);
const modelErrorMessage = ref<string>('');
const modelErrorType = ref<'network' | 'file' | 'unknown' | ''>('');

const selectedVersion = ref<'quantized'>('quantized');

const storageStats = ref<{
  indexedPages: number;
  totalDocuments: number;
  totalTabs: number;
  indexSize: number;
  isInitialized: boolean;
} | null>(null);
const isRefreshingStats = ref(false);
const isClearingData = ref(false);
const showClearConfirmation = ref(false);
const clearDataProgress = ref('');

const semanticEngineStatus = ref<'idle' | 'initializing' | 'ready' | 'error'>('idle');
const isSemanticEngineInitializing = ref(false);
const semanticEngineInitProgress = ref('');
const semanticEngineLastUpdated = ref<number | null>(null);

// Cache management
const isManagingCache = ref(false);
const cacheStats = ref<{
  totalSize: number;
  totalSizeMB: number;
  entryCount: number;
  entries: Array<{
    url: string;
    size: number;
    sizeMB: number;
    timestamp: number;
    age: string;
    expired: boolean;
  }>;
} | null>(null);

const availableModels = computed(() => {
  return Object.entries(PREDEFINED_MODELS).map(([key, value]) => ({
    preset: key as ModelPreset,
    ...value,
  }));
});

const getStatusClass = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return 'bg-emerald-500';
    } else {
      return 'bg-yellow-500';
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return 'bg-red-500';
  } else {
    return 'bg-gray-500';
  }
};

const getStatusText = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return getMessage('serviceRunningStatus', [(serverStatus.value.port || 'Unknown').toString()]);
    } else {
      return getMessage('connectedServiceNotStartedStatus');
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return getMessage('serviceNotConnectedStatus');
  } else {
    return getMessage('detectingStatus');
  }
};

const formatIndexSize = () => {
  if (!storageStats.value?.indexSize) return '0 MB';
  const sizeInMB = Math.round(storageStats.value.indexSize / (1024 * 1024));
  return `${sizeInMB} MB`;
};

const getModelDescription = (model: any) => {
  switch (model.preset) {
    case 'multilingual-e5-small':
      return getMessage('lightweightModelDescription');
    case 'multilingual-e5-base':
      return getMessage('betterThanSmallDescription');
    default:
      return getMessage('multilingualModelDescription');
  }
};

const getPerformanceText = (performance: string) => {
  switch (performance) {
    case 'fast':
      return getMessage('fastPerformance');
    case 'balanced':
      return getMessage('balancedPerformance');
    case 'accurate':
      return getMessage('accuratePerformance');
    default:
      return performance;
  }
};

const getSemanticEngineStatusText = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return getMessage('semanticEngineReadyStatus');
    case 'initializing':
      return getMessage('semanticEngineInitializingStatus');
    case 'error':
      return getMessage('semanticEngineInitFailedStatus');
    case 'idle':
    default:
      return getMessage('semanticEngineNotInitStatus');
  }
};

const getSemanticEngineStatusClass = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return 'bg-emerald-500';
    case 'initializing':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'idle':
    default:
      return 'bg-gray-500';
  }
};

const getActiveTabsCount = () => {
  return storageStats.value?.totalTabs || 0;
};

const getProgressText = () => {
  if (isModelDownloading.value) {
    return getMessage('downloadingModelStatus', [modelDownloadProgress.value.toString()]);
  } else if (isModelSwitching.value) {
    return modelSwitchProgress.value || getMessage('switchingModelStatus');
  }
  return '';
};

const getErrorTypeText = () => {
  switch (modelErrorType.value) {
    case 'network':
      return getMessage('networkErrorMessage');
    case 'file':
      return getMessage('modelCorruptedErrorMessage');
    case 'unknown':
    default:
      return getMessage('unknownErrorMessage');
  }
};

const getSemanticEngineButtonText = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return getMessage('reinitializeButton');
    case 'initializing':
      return getMessage('initializingStatus');
    case 'error':
      return getMessage('reinitializeButton');
    case 'idle':
    default:
      return getMessage('initSemanticEngineButton');
  }
};

const loadCacheStats = async () => {
  try {
    cacheStats.value = await getCacheStats();
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    cacheStats.value = null;
  }
};

const cleanupCache = async () => {
  if (isManagingCache.value) return;

  isManagingCache.value = true;
  try {
    await cleanupModelCache();
    // Refresh cache stats
    await loadCacheStats();
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
  } finally {
    isManagingCache.value = false;
  }
};

const clearAllCache = async () => {
  if (isManagingCache.value) return;

  isManagingCache.value = true;
  try {
    await clearModelCache();
    // Refresh cache stats
    await loadCacheStats();
  } catch (error) {
    console.error('Failed to clear cache:', error);
  } finally {
    isManagingCache.value = false;
  }
};

const saveSemanticEngineState = async () => {
  try {
    const semanticEngineState = {
      status: semanticEngineStatus.value,
      lastUpdated: semanticEngineLastUpdated.value,
    };
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ semanticEngineState });
  } catch (error) {
    console.error('Failed to save semantic engine state:', error);
  }
};

const initializeSemanticEngine = async () => {
  if (isSemanticEngineInitializing.value) return;

  const isReinitialization = semanticEngineStatus.value === 'ready';
  console.log(
    `[LAUNCH] User triggered semantic engine ${isReinitialization ? 'reinitialization' : 'initialization'}`,
  );

  isSemanticEngineInitializing.value = true;
  semanticEngineStatus.value = 'initializing';
  semanticEngineInitProgress.value = isReinitialization
    ? getMessage('semanticEngineInitializingStatus')
    : getMessage('semanticEngineInitializingStatus');
  semanticEngineLastUpdated.value = Date.now();

  await saveSemanticEngineState();

  try {
    // eslint-disable-next-line no-undef
    chrome.runtime
      .sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.INITIALIZE_SEMANTIC_ENGINE,
      })
      .catch((error) => {
        console.error('[X] Error sending semantic engine initialization request:', error);
      });

    startSemanticEngineStatusPolling();

    semanticEngineInitProgress.value = isReinitialization
      ? getMessage('processingStatus')
      : getMessage('processingStatus');
  } catch (error: any) {
    console.error('[X] Failed to send initialization request:', error);
    semanticEngineStatus.value = 'error';
    semanticEngineInitProgress.value = `Failed to send initialization request: ${error?.message || 'Unknown error'}`;

    await saveSemanticEngineState();

    setTimeout(() => {
      semanticEngineInitProgress.value = '';
    }, 5000);

    isSemanticEngineInitializing.value = false;
    semanticEngineLastUpdated.value = Date.now();
    await saveSemanticEngineState();
  }
};

const checkSemanticEngineStatus = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS,
    });

    if (response && response.success && response.status) {
      const status = response.status;

      if (status.initializationStatus === 'ready') {
        semanticEngineStatus.value = 'ready';
        semanticEngineLastUpdated.value = Date.now();
        isSemanticEngineInitializing.value = false;
        semanticEngineInitProgress.value = getMessage('semanticEngineReadyStatus');
        await saveSemanticEngineState();
        stopSemanticEngineStatusPolling();
        setTimeout(() => {
          semanticEngineInitProgress.value = '';
        }, 2000);
      } else if (
        status.initializationStatus === 'downloading' ||
        status.initializationStatus === 'initializing'
      ) {
        semanticEngineStatus.value = 'initializing';
        isSemanticEngineInitializing.value = true;
        semanticEngineInitProgress.value = getMessage('semanticEngineInitializingStatus');
        semanticEngineLastUpdated.value = Date.now();
        await saveSemanticEngineState();
      } else if (status.initializationStatus === 'error') {
        semanticEngineStatus.value = 'error';
        semanticEngineLastUpdated.value = Date.now();
        isSemanticEngineInitializing.value = false;
        semanticEngineInitProgress.value = getMessage('semanticEngineInitFailedStatus');
        await saveSemanticEngineState();
        stopSemanticEngineStatusPolling();
        setTimeout(() => {
          semanticEngineInitProgress.value = '';
        }, 5000);
      } else {
        semanticEngineStatus.value = 'idle';
        isSemanticEngineInitializing.value = false;
        await saveSemanticEngineState();
      }
    } else {
      semanticEngineStatus.value = 'idle';
      isSemanticEngineInitializing.value = false;
      await saveSemanticEngineState();
    }
  } catch (error) {
    console.error('Popup: Failed to check semantic engine status:', error);
    semanticEngineStatus.value = 'idle';
    isSemanticEngineInitializing.value = false;
    await saveSemanticEngineState();
  }
};

const retryModelInitialization = async () => {
  if (!currentModel.value) return;

  console.log('[RETRY] Retrying model initialization...');

  modelErrorMessage.value = '';
  modelErrorType.value = '';
  modelInitializationStatus.value = 'downloading';
  modelDownloadProgress.value = 0;
  isModelDownloading.value = true;
  await switchModel(currentModel.value);
};

const updatePort = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const newPort = Number(target.value);
  nativeServerPort.value = newPort;

  await savePortPreference(newPort);
};

const checkNativeConnection = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({ type: 'ping_native' });
    nativeConnectionStatus.value = response?.connected ? 'connected' : 'disconnected';
  } catch (error) {
    console.error('Failed to check Native connection status:', error);
    nativeConnectionStatus.value = 'disconnected';
  }
};

const checkServerStatus = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS,
    });
    if (response?.success && response.serverStatus) {
      serverStatus.value = response.serverStatus;
      // Update unified app store
      appStore.updateServerStatus(response.serverStatus);
    }

    if (response?.connected !== undefined) {
      nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
    }
  } catch (error) {
    console.error('Failed to check server status:', error);
  }
};

const refreshServerStatus = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS,
    });
    if (response?.success && response.serverStatus) {
      serverStatus.value = response.serverStatus;
      // Update unified app store
      appStore.updateServerStatus(response.serverStatus);
    }

    if (response?.connected !== undefined) {
      nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
    }
  } catch (error) {
    console.error('Failed to refresh server status:', error);
  }
};

const copyMcpConfig = async () => {
  try {
    await navigator.clipboard.writeText(mcpConfigJson.value);
    copyButtonText.value = '[OK] ' + getMessage('configCopiedNotification');

    setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  } catch (error) {
    console.error('Failed to copy configuration:', error);
    copyButtonText.value = '[X] ' + getMessage('networkErrorMessage');

    setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  }
};

const testNativeConnection = async () => {
  if (isConnecting.value) return;
  isConnecting.value = true;
  try {
    if (nativeConnectionStatus.value === 'connected') {
      addDebugLog('INFO', 'Disconnecting from native host');
      // eslint-disable-next-line no-undef
      await chrome.runtime.sendMessage({ type: 'disconnect_native' });
      nativeConnectionStatus.value = 'disconnected';
      addDebugLog('INFO', 'Disconnected successfully');
    } else {
      addDebugLog('INFO', `Attempting to connect to port: ${nativeServerPort.value}`);
      console.log(`Attempting to connect to port: ${nativeServerPort.value}`);
      // eslint-disable-next-line no-undef
      const response = await chrome.runtime.sendMessage({
        type: 'connect_native',
        port: nativeServerPort.value,
      });
      addDebugLog('INFO', `Received response: ${JSON.stringify(response)}`);
      if (response && response.success) {
        nativeConnectionStatus.value = 'connected';
        addDebugLog('SUCCESS', `Connected successfully to port ${response.port}`);
        console.log('Connection successful:', response);
        await savePortPreference(nativeServerPort.value);

        // Wait a bit for server to start, then refresh status
        setTimeout(async () => {
          await refreshServerStatus();
          addDebugLog('INFO', 'Server status refreshed');
        }, 500);
      } else {
        nativeConnectionStatus.value = 'disconnected';
        addDebugLog('ERROR', `Connection failed: ${JSON.stringify(response)}`);
        console.error('Connection failed:', response);
      }
    }
  } catch (error) {
    addDebugLog('ERROR', `Failed to test connection: ${error}`);
    console.error('Failed to test connection:', error);
    nativeConnectionStatus.value = 'disconnected';
  } finally {
    isConnecting.value = false;
  }
};

const loadModelPreference = async () => {
  try {
    // eslint-disable-next-line no-undef
    const result = await chrome.storage.local.get([
      'selectedModel',
      'selectedVersion',
      'modelState',
      'semanticEngineState',
    ]);

    if (result.selectedModel) {
      const storedModel = result.selectedModel as string;
      console.log('[INFO] Stored model from storage:', storedModel);

      if (PREDEFINED_MODELS[storedModel as ModelPreset]) {
        currentModel.value = storedModel as ModelPreset;
        console.log(`[OK] Loaded valid model: ${currentModel.value}`);
      } else {
        console.warn(
          `[WARNING] Stored model "${storedModel}" not found in PREDEFINED_MODELS, using default`,
        );
        currentModel.value = 'multilingual-e5-small';
        await saveModelPreference(currentModel.value);
      }
    } else {
      console.log('[WARNING] No model found in storage, using default');
      currentModel.value = 'multilingual-e5-small';
      await saveModelPreference(currentModel.value);
    }

    selectedVersion.value = 'quantized';
    console.log('[OK] Using quantized version (fixed)');

    await saveVersionPreference('quantized');

    if (result.modelState) {
      const modelState = result.modelState;

      if (modelState.status === 'ready') {
        modelInitializationStatus.value = 'ready';
        modelDownloadProgress.value = modelState.downloadProgress || 100;
        isModelDownloading.value = false;
      } else {
        modelInitializationStatus.value = 'idle';
        modelDownloadProgress.value = 0;
        isModelDownloading.value = false;

        await saveModelState();
      }
    } else {
      modelInitializationStatus.value = 'idle';
      modelDownloadProgress.value = 0;
      isModelDownloading.value = false;
    }

    if (result.semanticEngineState) {
      const semanticState = result.semanticEngineState;
      if (semanticState.status === 'ready') {
        semanticEngineStatus.value = 'ready';
        semanticEngineLastUpdated.value = semanticState.lastUpdated || Date.now();
      } else if (semanticState.status === 'error') {
        semanticEngineStatus.value = 'error';
        semanticEngineLastUpdated.value = semanticState.lastUpdated || Date.now();
      } else {
        semanticEngineStatus.value = 'idle';
      }
    } else {
      semanticEngineStatus.value = 'idle';
    }
  } catch (error) {
    console.error('[X] Failed to load model preference:', error);
  }
};

const saveModelPreference = async (model: ModelPreset) => {
  try {
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ selectedModel: model });
  } catch (error) {
    console.error('Failed to save model preference:', error);
  }
};

const saveVersionPreference = async (version: 'full' | 'quantized' | 'compressed') => {
  try {
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ selectedVersion: version });
  } catch (error) {
    console.error('Failed to save version preference:', error);
  }
};

const savePortPreference = async (port: number) => {
  try {
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ nativeServerPort: port });
    console.log(`Port preference saved: ${port}`);
  } catch (error) {
    console.error('Failed to save port preference:', error);
  }
};

const loadPortPreference = async () => {
  try {
    // eslint-disable-next-line no-undef
    const result = await chrome.storage.local.get(['nativeServerPort']);
    if (result.nativeServerPort) {
      nativeServerPort.value = result.nativeServerPort;
      console.log(`Port preference loaded: ${result.nativeServerPort}`);
    }
  } catch (error) {
    console.error('Failed to load port preference:', error);
  }
};

const saveModelState = async () => {
  try {
    const modelState = {
      status: modelInitializationStatus.value,
      downloadProgress: modelDownloadProgress.value,
      isDownloading: isModelDownloading.value,
      lastUpdated: Date.now(),
    };
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ modelState });
  } catch (error) {
    console.error('Failed to save model state:', error);
  }
};

let statusMonitoringInterval: ReturnType<typeof setInterval> | null = null;
let semanticEngineStatusPollingInterval: ReturnType<typeof setInterval> | null = null;

const startModelStatusMonitoring = () => {
  if (statusMonitoringInterval) {
    clearInterval(statusMonitoringInterval);
  }

  statusMonitoringInterval = setInterval(async () => {
    try {
      // eslint-disable-next-line no-undef
      const response = await chrome.runtime.sendMessage({
        type: 'get_model_status',
      });

      if (response && response.success) {
        const status = response.status;
        modelInitializationStatus.value = status.initializationStatus || 'idle';
        modelDownloadProgress.value = status.downloadProgress || 0;
        isModelDownloading.value = status.isDownloading || false;

        if (status.initializationStatus === 'error') {
          modelErrorMessage.value = status.errorMessage || getMessage('modelFailedStatus');
          modelErrorType.value = status.errorType || 'unknown';
        } else {
          modelErrorMessage.value = '';
          modelErrorType.value = '';
        }

        await saveModelState();

        if (status.initializationStatus === 'ready' || status.initializationStatus === 'error') {
          stopModelStatusMonitoring();
        }
      }
    } catch (error) {
      console.error('Failed to get model status:', error);
    }
  }, 1000);
};

const stopModelStatusMonitoring = () => {
  if (statusMonitoringInterval) {
    clearInterval(statusMonitoringInterval);
    statusMonitoringInterval = null;
  }
};

const startSemanticEngineStatusPolling = () => {
  if (semanticEngineStatusPollingInterval) {
    clearInterval(semanticEngineStatusPollingInterval);
  }

  semanticEngineStatusPollingInterval = setInterval(async () => {
    try {
      await checkSemanticEngineStatus();
    } catch (error) {
      console.error('Semantic engine status polling failed:', error);
    }
  }, 2000);
};

const stopSemanticEngineStatusPolling = () => {
  if (semanticEngineStatusPollingInterval) {
    clearInterval(semanticEngineStatusPollingInterval);
    semanticEngineStatusPollingInterval = null;
  }
};

const refreshStorageStats = async () => {
  if (isRefreshingStats.value) return;

  isRefreshingStats.value = true;
  try {
    console.log('[REFRESH] Refreshing storage statistics...');

    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: 'get_storage_stats',
    });

    if (response && response.success) {
      storageStats.value = {
        indexedPages: response.stats.indexedPages || 0,
        totalDocuments: response.stats.totalDocuments || 0,
        totalTabs: response.stats.totalTabs || 0,
        indexSize: response.stats.indexSize || 0,
        isInitialized: response.stats.isInitialized || false,
      };
      console.log('[OK] Storage stats refreshed:', storageStats.value);
    } else {
      console.error('[X] Failed to get storage stats:', response?.error);
      storageStats.value = {
        indexedPages: 0,
        totalDocuments: 0,
        totalTabs: 0,
        indexSize: 0,
        isInitialized: false,
      };
    }
  } catch (error) {
    console.error('[X] Error refreshing storage stats:', error);
    storageStats.value = {
      indexedPages: 0,
      totalDocuments: 0,
      totalTabs: 0,
      indexSize: 0,
      isInitialized: false,
    };
  } finally {
    isRefreshingStats.value = false;
  }
};

const hideClearDataConfirmation = () => {
  showClearConfirmation.value = false;
};

const confirmClearAllData = async () => {
  if (isClearingData.value) return;

  isClearingData.value = true;
  clearDataProgress.value = getMessage('clearingStatus');

  try {
    console.log('[DELETE] Starting to clear all data...');

    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: 'clear_all_data',
    });

    if (response && response.success) {
      clearDataProgress.value = getMessage('dataClearedNotification');
      console.log('[OK] All data cleared successfully');

      await refreshStorageStats();

      setTimeout(() => {
        clearDataProgress.value = '';
        hideClearDataConfirmation();
      }, 2000);
    } else {
      throw new Error(response?.error || 'Failed to clear data');
    }
  } catch (error: any) {
    console.error('[X] Failed to clear all data:', error);
    clearDataProgress.value = `Failed to clear data: ${error?.message || 'Unknown error'}`;

    setTimeout(() => {
      clearDataProgress.value = '';
    }, 5000);
  } finally {
    isClearingData.value = false;
  }
};

const switchModel = async (newModel: ModelPreset) => {
  console.log(`[SWITCH] switchModel called with newModel: ${newModel}`);

  if (isModelSwitching.value) {
    console.log('[PAUSE] Model switch already in progress, skipping');
    return;
  }

  const isSameModel = newModel === currentModel.value;
  const currentModelInfo = currentModel.value
    ? getModelInfo(currentModel.value)
    : getModelInfo('multilingual-e5-small');
  const newModelInfo = getModelInfo(newModel);
  const isDifferentDimension = currentModelInfo.dimension !== newModelInfo.dimension;

  console.log(`[STATS] Switch analysis:`);
  console.log(`   - Same model: ${isSameModel} (${currentModel.value} -> ${newModel})`);
  console.log(
    `   - Current dimension: ${currentModelInfo.dimension}, New dimension: ${newModelInfo.dimension}`,
  );
  console.log(`   - Different dimension: ${isDifferentDimension}`);

  if (isSameModel && !isDifferentDimension) {
    console.log('[OK] Same model and dimension - no need to switch');
    return;
  }

  const switchReasons = [];
  if (!isSameModel) switchReasons.push('different model');
  if (isDifferentDimension) switchReasons.push('different dimension');

  console.log(`[LAUNCH] Switching model due to: ${switchReasons.join(', ')}`);
  console.log(
    `[INFO] Model: ${currentModel.value} (${currentModelInfo.dimension}D) -> ${newModel} (${newModelInfo.dimension}D)`,
  );

  isModelSwitching.value = true;
  modelSwitchProgress.value = getMessage('switchingModelStatus');

  modelInitializationStatus.value = 'downloading';
  modelDownloadProgress.value = 0;
  isModelDownloading.value = true;

  try {
    await saveModelPreference(newModel);
    await saveVersionPreference('quantized');
    await saveModelState();

    modelSwitchProgress.value = getMessage('semanticEngineInitializingStatus');

    startModelStatusMonitoring();

    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: 'switch_semantic_model',
      modelPreset: newModel,
      modelVersion: 'quantized',
      modelDimension: newModelInfo.dimension,
      previousDimension: currentModelInfo.dimension,
    });

    if (response && response.success) {
      currentModel.value = newModel;
      modelSwitchProgress.value = getMessage('successNotification');
      console.log(
        'Model switch successful:',
        newModel,
        'version: quantized',
        'dimension:',
        newModelInfo.dimension,
      );

      modelInitializationStatus.value = 'ready';
      isModelDownloading.value = false;
      await saveModelState();

      setTimeout(() => {
        modelSwitchProgress.value = '';
      }, 2000);
    } else {
      throw new Error(response?.error || 'Model switch failed');
    }
  } catch (error: any) {
    console.error('Model switch failed:', error);
    modelSwitchProgress.value = `Model switch failed: ${error?.message || 'Unknown error'}`;

    modelInitializationStatus.value = 'error';
    isModelDownloading.value = false;

    const errorMessage = error?.message || 'Unknown error';
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout')
    ) {
      modelErrorType.value = 'network';
      modelErrorMessage.value = getMessage('networkErrorMessage');
    } else if (
      errorMessage.includes('corrupt') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('format')
    ) {
      modelErrorType.value = 'file';
      modelErrorMessage.value = getMessage('modelCorruptedErrorMessage');
    } else {
      modelErrorType.value = 'unknown';
      modelErrorMessage.value = errorMessage;
    }

    await saveModelState();

    setTimeout(() => {
      modelSwitchProgress.value = '';
    }, 8000);
  } finally {
    isModelSwitching.value = false;
  }
};

const setupServerStatusListener = () => {
  // eslint-disable-next-line no-undef
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED && message.payload) {
      serverStatus.value = message.payload;
      // Update unified app store
      appStore.updateServerStatus(message.payload);
      console.log('Server status updated:', message.payload);
    }
  });
};

onMounted(async () => {
  // Initialize unified app store
  await appStore.initialize();

  await loadPortPreference();
  await loadModelPreference();
  await checkNativeConnection();
  await checkServerStatus();
  await refreshStorageStats();
  await loadCacheStats();

  await checkSemanticEngineStatus();
  setupServerStatusListener();
});

onUnmounted(() => {
  stopModelStatusMonitoring();
  stopSemanticEngineStatusPolling();
});
</script>

