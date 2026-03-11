<template>
  <div class="w-[1400px] min-h-[900px] bg-[#0f172a] text-slate-200 flex flex-col rounded-2xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
    <!-- Header (reference: advanced-control-panel) -->
    <header class="h-14 border-b border-slate-800 flex items-center justify-between px-5 bg-slate-900/80 backdrop-blur-md z-20 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div>
          <h1 class="text-[13px] font-black tracking-tighter text-white uppercase italic">Chrome MCP Server</h1>
          <p class="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">AI-Powered Browser Automation</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <LanguageSelector />
        <div class="w-px h-6 bg-slate-800"></div>
        <div class="flex items-center gap-2">
          <div :class="['w-2 h-2 rounded-full', (nativeConnectionStatus === 'connected' && serverStatus.isRunning) ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500']"></div>
        </div>
      </div>
    </header>

    <!-- Tab Navigation (reference) -->
    <nav class="h-12 border-b border-slate-800/60 bg-slate-950/20 flex items-center px-2 gap-1 shrink-0 overflow-x-auto no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap',
          activeTab === tab.id ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        ]"
      >
        <span :class="['transition-transform duration-200', activeTab === tab.id ? 'scale-110' : 'opacity-60']">
          <component :is="tab.iconComponent" />
        </span>
        {{ tab.label }}
      </button>
    </nav>

    <!-- Main Content (reference) -->
    <main class="flex-1 p-5 overflow-hidden relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/5 via-slate-950 to-slate-950">
      <div class="max-w-7xl mx-auto h-full flex flex-col">
        <div class="flex items-center justify-between mb-4 shrink-0">
          <h2 class="text-xl font-black text-white tracking-tight flex items-center gap-3">
            {{ tabs.find(t => t.id === activeTab)?.label }}
            <span class="h-0.5 w-12 bg-indigo-500/30 rounded-full"></span>
          </h2>
          <span class="text-[10px] text-slate-500 font-mono bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">MOD::VIEW_0{{ tabs.findIndex(t => t.id === activeTab) + 1 }}</span>
        </div>
        <div class="flex-1 overflow-y-auto pr-1 no-scrollbar">
      <!-- Server Tab (reference: Card + indigo/slate) -->
      <div v-show="activeTab === 'server'" class="space-y-3">
        <div class="flex items-center justify-between p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-lg">
          <div>
            <h3 class="text-sm font-bold text-white">{{ getMessage('runningStatusLabel') }}</h3>
            <p class="text-[10px] text-slate-500">Port: {{ nativeServerPort }} • TCP/HTTP</p>
          </div>
          <button
            @click="testNativeConnection"
            :disabled="isConnecting"
            :class="[
              'px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm',
              nativeConnectionStatus === 'connected'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white',
              isConnecting && 'opacity-60 cursor-not-allowed'
            ]"
          >
            {{ isConnecting ? getMessage('connectingStatus') : nativeConnectionStatus === 'connected' ? getMessage('disconnectButton') : getMessage('connectButton') }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">{{ getMessage('connectionPortLabel') }}</h4>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-[11px] text-slate-400">Listener Port</span>
                <input type="text" :value="nativeServerPort" @input="updatePort" class="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-indigo-400 font-mono" />
              </div>
              <button @click="refreshServerStatus" class="w-full bg-slate-700 hover:bg-slate-600 text-[10px] py-1.5 rounded transition-colors flex items-center justify-center gap-2">
                ↻ {{ getMessage('refreshStatusButton') }}
              </button>
            </div>
          </div>
          <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">{{ getMessage('runningStatusLabel') }}</h4>
            <div class="flex flex-col justify-center items-center gap-1">
              <span :class="['w-3 h-3 rounded-full animate-pulse flex-shrink-0', getStatusClass()]"></span>
              <span class="text-xs font-semibold text-slate-200">{{ getStatusText() }}</span>
              <span v-if="serverStatus.lastUpdated" class="text-[9px] text-slate-500">{{ new Date(serverStatus.lastUpdated).toLocaleTimeString() }}</span>
            </div>
          </div>
        </div>
        <div v-if="showMcpConfig" class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{{ getMessage('mcpServerConfigLabel') }}</h4>
            <button @click="copyMcpConfig" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-[10px] rounded transition-colors flex items-center justify-center gap-2">{{ copyButtonText }}</button>
          </div>
          <div class="bg-slate-950 rounded-lg p-3 overflow-x-auto">
            <pre class="text-xs text-indigo-400 font-mono leading-relaxed">{{ mcpConfigJson }}</pre>
          </div>
        </div>
      </div>

      <!-- Semantic Tab (reference) -->
      <div v-show="activeTab === 'semantic'" class="space-y-3">
        <div class="flex justify-between items-center px-1">
          <div :class="['flex items-center gap-1.5 px-2 py-0.5 rounded-full border', semanticEngineStatus === 'ready' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400']">
            <div :class="['w-1 h-1 rounded-full', semanticEngineStatus === 'ready' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400']"></div>
            <span class="text-[9px] font-bold uppercase tracking-wider">{{ getSemanticEngineStatusText() }}</span>
          </div>
          <button
            @click="initializeSemanticEngine"
            :disabled="isSemanticEngineInitializing"
            class="text-[10px] text-indigo-400 hover:underline disabled:opacity-50"
          >{{ getSemanticEngineButtonText() }}</button>
        </div>
        <div v-if="isSemanticEngineInitializing" class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
          <ProgressIndicator :visible="true" :text="semanticEngineInitProgress" :showSpinner="true" />
        </div>
        <div v-if="modelInitializationStatus === 'error'" class="bg-rose-950/30 border border-rose-700/50 rounded-lg p-4">
          <div class="flex gap-4 mb-3">
            <div class="w-10 h-10 flex items-center justify-center bg-rose-500/20 rounded-full text-rose-400 font-bold text-lg">[!]</div>
            <div class="flex-1 space-y-1">
              <p class="font-semibold text-rose-300">{{ getMessage('semanticEngineInitFailedStatus') }}</p>
              <p class="text-[11px] text-rose-400/90">{{ modelErrorMessage || getErrorTypeText() }}</p>
            </div>
          </div>
          <button
            @click="retryModelInitialization"
            :disabled="isModelSwitching || isModelDownloading"
            class="w-full py-1.5 bg-rose-600/20 border border-rose-600/40 text-rose-400 text-[10px] font-bold rounded hover:bg-rose-600/30 disabled:opacity-50"
          >[RETRY] {{ getMessage('retryButton') }}</button>
        </div>
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
          <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">{{ getMessage('embeddingModelLabel') }}</h4>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="model in availableModels"
              :key="model.preset"
              @click="!isModelSwitching && !isModelDownloading && switchModel(model.preset as ModelPreset)"
              :class="[
                'p-2 rounded border cursor-pointer transition-all',
                currentModel === model.preset ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800',
                (isModelSwitching || isModelDownloading) && 'opacity-50 cursor-not-allowed'
              ]"
            >
              <div class="flex justify-between items-center">
                <span class="text-[11px] font-medium text-slate-200">{{ model.preset }}</span>
                <CheckIcon v-if="currentModel === model.preset" class="w-3 h-3 text-indigo-400" />
              </div>
              <p class="text-[9px] text-slate-500 line-clamp-2">{{ getModelDescription(model) }}</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <span class="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] rounded">{{ getPerformanceText(model.performance) }}</span>
                <span class="px-1.5 py-0.5 bg-slate-700/50 text-slate-400 text-[9px] rounded">{{ model.dimension }}D</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="isModelSwitching || isModelDownloading" class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
          <ProgressIndicator :visible="true" :text="getProgressText()" :showSpinner="true" />
        </div>
      </div>

      <!-- Data Tab (reference) -->
      <div v-show="activeTab === 'data'" class="space-y-3">
        <div class="grid grid-cols-3 gap-2">
          <div class="p-2 bg-slate-800 border border-slate-700 rounded-lg text-center">
            <p class="text-[9px] text-slate-500 uppercase font-bold">{{ getMessage('indexedPagesLabel') }}</p>
            <p class="text-sm font-mono font-bold text-slate-100">{{ storageStats?.indexedPages || 0 }}</p>
          </div>
          <div class="p-2 bg-slate-800 border border-slate-700 rounded-lg text-center">
            <p class="text-[9px] text-slate-500 uppercase font-bold">{{ getMessage('indexSizeLabel') }}</p>
            <p class="text-sm font-mono font-bold text-slate-100">{{ formatIndexSize() }}</p>
          </div>
          <div class="p-2 bg-slate-800 border border-slate-700 rounded-lg text-center">
            <p class="text-[9px] text-slate-500 uppercase font-bold">{{ getMessage('activeTabsLabel') }}</p>
            <p class="text-sm font-mono font-bold text-slate-100">{{ getActiveTabsCount() }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">{{ getMessage('indexDataManagementLabel') }}</h4>
            <ProgressIndicator v-if="isClearingData && clearDataProgress" :visible="true" :text="clearDataProgress" :showSpinner="true" />
            <button
              @click="showClearConfirmation = true"
              :disabled="isClearingData"
              :class="['w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2', isClearingData ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-rose-900/20 border border-rose-900/40 text-rose-400 hover:bg-rose-900/30']"
            >
              <TrashIcon class="w-3 h-3" />
              {{ isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton') }}
            </button>
          </div>
          <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
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

      <!-- Debug Tab (reference) -->
      <div v-show="activeTab === 'debug'" class="h-full flex flex-col gap-2">
        <div class="flex justify-between items-center bg-slate-950 p-1.5 border border-slate-800 rounded-lg">
          <div class="flex gap-2">
            <button @click="showDebugInfo = false" :class="['px-3 py-0.5 rounded text-[10px] font-bold transition-all', !showDebugInfo ? 'bg-indigo-600 text-white' : 'text-slate-500']">LOGS</button>
            <button @click="showDebugInfo = true" :class="['px-3 py-0.5 rounded text-[10px] font-bold transition-all', showDebugInfo ? 'bg-indigo-600 text-white' : 'text-slate-500']">JSON STATE</button>
          </div>
          <button @click="clearDebugLogs" class="text-rose-400 text-[10px] font-bold hover:underline px-2">Purge</button>
        </div>
        <div class="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-3 overflow-y-auto font-mono text-[10px] min-h-[200px]">
          <template v-if="showDebugInfo">
            <pre class="text-indigo-400 leading-relaxed">{{ JSON.stringify({
              connection: { nativeConnectionStatus, isConnecting, port: nativeServerPort },
              server: serverStatus
            }, null, 2) }}</pre>
          </template>
          <div v-else class="space-y-1.5">
            <div v-for="(log, index) in debugLogs" :key="index" class="flex gap-2 leading-tight">
              <span class="text-slate-600 shrink-0">[{{ log.time }}]</span>
              <span :class="['shrink-0 font-bold', log.level === 'ERROR' ? 'text-rose-500' : log.level === 'SUCCESS' ? 'text-emerald-500' : 'text-indigo-400']">{{ log.level }}</span>
              <span class="text-slate-400">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
        </div>
      </div>
    </main>

    <!-- Footer (reference) -->
    <footer class="h-10 border-t border-slate-800 bg-slate-950 px-5 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-6">
        <div class="flex flex-col">
          <span class="text-[8px] text-slate-600 uppercase font-black tracking-widest">Core Sys</span>
          <div class="flex items-center gap-1.5">
            <div :class="['w-1.5 h-1.5 rounded-full', (nativeConnectionStatus === 'connected' && serverStatus.isRunning) ? 'bg-emerald-500' : 'bg-rose-500']"></div>
            <span class="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Ready</span>
          </div>
        </div>
        <div class="flex flex-col">
          <span class="text-[8px] text-slate-600 uppercase font-black tracking-widest">Sync Port</span>
          <span class="text-[10px] font-mono text-indigo-500 uppercase tracking-tighter">{{ serverStatus.port || nativeServerPort }} // Active</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <div class="text-[10px] font-bold text-slate-500 tracking-tighter uppercase leading-none">Chrome MCP</div>
          <div class="text-[12px] font-mono text-indigo-400 font-black">AI Automation</div>
        </div>
        <div class="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-800 cursor-pointer transition-colors group">
          <svg class="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      </div>
    </footer>

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
  ServerIcon,
  SemanticIcon,
  DataIcon,
  ExtensionIcon,
  AudioIcon,
  SettingsIcon,
  DebugIcon,
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
  { id: 'server', label: 'Server', iconComponent: ServerIcon },
  { id: 'semantic', label: 'Semantic', iconComponent: SemanticIcon },
  { id: 'data', label: 'Data', iconComponent: DataIcon },
  { id: 'extensions', label: 'Extensions', iconComponent: ExtensionIcon },
  { id: 'audio', label: 'Audio', iconComponent: AudioIcon },
  { id: 'settings', label: 'Settings', iconComponent: SettingsIcon },
  { id: 'debug', label: 'Debug', iconComponent: DebugIcon },
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

