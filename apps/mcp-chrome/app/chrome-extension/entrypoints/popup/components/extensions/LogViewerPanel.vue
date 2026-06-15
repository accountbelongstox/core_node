<template>
  <div
    class="rounded-xl p-6 shadow-sm space-y-4"
    style="background: var(--surface); color: var(--text)"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between pb-4 border-b"
      style="border-color: var(--border)"
    >
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-bold" style="color: var(--text)">📋 Task Queue Logs</h3>
        <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
          {{ logs.length }} logs
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="testStatus.state === 'testing'"
          @click="testRefresh"
        >
          {{ testStatus.state === 'testing' ? '…' : '↻ ' + t('logTestRefresh') }}
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded transition-colors tk-ghost-btn"
          @click="clearLogs"
        >
          {{ t('logClearAll') }}
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded transition-colors tk-ghost-btn"
          @click="autoScroll = !autoScroll"
        >
          {{ autoScroll ? '⏸ ' + t('logPause') : '▶ ' + t('logAuto') }}
        </button>
      </div>
    </div>

    <!-- Test / refresh status line -->
    <div
      v-if="testStatus.state !== 'idle'"
      :class="[
        'text-xs rounded px-3 py-2 border',
        testStatus.state === 'ok'
          ? 'bg-green-50 border-green-200 text-green-700'
          : testStatus.state === 'fail'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'tk-neutral-line',
      ]"
    >
      {{ testStatus.state === 'ok' ? '● ' : testStatus.state === 'fail' ? '○ ' : '' }}
      {{ testStatus.message }}
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="level in logLevels"
        :key="level"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded transition-colors',
          selectedLevel === level
            ? getLevelActiveClass(level)
            : 'tk-filter-inactive',
        ]"
        @click="selectedLevel = selectedLevel === level ? null : level"
      >
        {{ level.toUpperCase() }}
        <span class="ml-1">({{ getLevelCount(level) }})</span>
      </button>
    </div>

    <!-- Log List -->
    <div
      ref="logContainer"
      class="space-y-2 max-h-96 overflow-y-auto rounded-lg p-3"
      style="background: var(--surface-2)"
    >
      <div
        v-for="log in filteredLogs"
        :key="log.id"
        :class="[
          'p-3 rounded border-l-4 text-sm',
          getLevelBorderClass(log.level),
          getLevelBgClass(log.level),
        ]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span :class="['px-2 py-0.5 text-xs font-bold rounded', getLevelBadgeClass(log.level)]">
                {{ log.level.toUpperCase() }}
              </span>
              <span class="text-xs" style="color: var(--text-muted)">{{ log.source }}</span>
              <span class="text-xs" style="color: var(--text-faint)">{{ formatTimestamp(log.timestamp) }}</span>
            </div>
            <p class="font-medium" style="color: var(--text)">{{ log.message }}</p>
            <div v-if="log.details" class="text-xs rounded p-2 font-mono tk-details">
              {{ formatDetails(log.details) }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredLogs.length === 0" class="text-center py-8" style="color: var(--text-muted)">
        <div class="text-4xl mb-2">📭</div>
        <p class="text-sm">No logs available</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-2 pt-4 border-t" style="border-color: var(--border)">
      <div class="text-center p-2 bg-blue-50 rounded">
        <div class="text-xs text-blue-600 font-medium">DEBUG</div>
        <div class="text-lg font-bold text-blue-700">{{ getLevelCount('debug') }}</div>
      </div>
      <div class="text-center p-2 bg-green-50 rounded">
        <div class="text-xs text-green-600 font-medium">INFO</div>
        <div class="text-lg font-bold text-green-700">{{ getLevelCount('info') }}</div>
      </div>
      <div class="text-center p-2 bg-yellow-50 rounded">
        <div class="text-xs text-yellow-600 font-medium">WARN</div>
        <div class="text-lg font-bold text-yellow-700">{{ getLevelCount('warn') }}</div>
      </div>
      <div class="text-center p-2 bg-red-50 rounded">
        <div class="text-xs text-red-600 font-medium">ERROR</div>
        <div class="text-lg font-bold text-red-700">{{ getLevelCount('error') }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { getMessage as t } from '../../../../utils/i18n';

interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  timestamp: number;
  source: string;
  message: string;
  details?: any;
}

const logs = ref<LogEntry[]>([]);
const selectedLevel = ref<string | null>(null);
const autoScroll = ref(true);
const logContainer = ref<HTMLElement | null>(null);

const logLevels = ['debug', 'info', 'warn', 'error'];

// Test / refresh status (confirms the QUEUE_LOG_GET_ALL pipe works).
const testStatus = ref<{ state: 'idle' | 'testing' | 'ok' | 'fail'; message: string }>({
  state: 'idle',
  message: '',
});

// Filtered logs
const filteredLogs = computed(() => {
  if (!selectedLevel.value) {
    return logs.value;
  }
  return logs.value.filter(log => log.level === selectedLevel.value);
});

// Get level count
const getLevelCount = (level: string): number => {
  return logs.value.filter(log => log.level === level).length;
};

// Format timestamp
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// Format details
const formatDetails = (details: any): string => {
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
};

// Level styling
const getLevelBorderClass = (level: string): string => {
  const classes: Record<string, string> = {
    debug: 'border-blue-500',
    info: 'border-green-500',
    warn: 'border-yellow-500',
    error: 'border-red-500',
  };
  return classes[level] || 'border-gray-500';
};

const getLevelBgClass = (level: string): string => {
  const classes: Record<string, string> = {
    debug: 'bg-blue-50',
    info: 'bg-green-50',
    warn: 'bg-yellow-50',
    error: 'bg-red-50',
  };
  return classes[level] || 'bg-gray-50';
};

const getLevelBadgeClass = (level: string): string => {
  const classes: Record<string, string> = {
    debug: 'bg-blue-100 text-blue-700',
    info: 'bg-green-100 text-green-700',
    warn: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };
  return classes[level] || 'bg-gray-100 text-gray-700';
};

const getLevelActiveClass = (level: string): string => {
  const classes: Record<string, string> = {
    debug: 'bg-blue-500 text-white',
    info: 'bg-green-500 text-white',
    warn: 'bg-yellow-500 text-white',
    error: 'bg-red-500 text-white',
  };
  return classes[level] || 'bg-gray-500 text-white';
};

// Clear logs
const clearLogs = async () => {
  try {
    await chrome.runtime.sendMessage({
      type: 'QUEUE_LOG_CLEAR',
    });
    logs.value = [];
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
};

// Scroll to bottom
const scrollToBottom = () => {
  if (autoScroll.value && logContainer.value) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }
};

// Watch logs and auto-scroll
watch(() => logs.value.length, () => {
  scrollToBottom();
});

// Listen for log messages
const handleMessage = (message: any) => {
  if (message.type === 'QUEUE_LOG' && message.log) {
    logs.value.push(message.log);

    // Keep last 500 logs
    if (logs.value.length > 500) {
      logs.value = logs.value.slice(-500);
    }
  }
};

// Fetch initial logs
const fetchLogs = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'QUEUE_LOG_GET_ALL',
    });

    if (response && response.success && response.data) {
      logs.value = response.data.logs || [];
    }
  } catch (error) {
    console.error('Failed to fetch logs:', error);
  }
};

// Test / refresh: re-pull all logs via the real background pipe and confirm it
// responds, reporting how many entries came back.
const testRefresh = async () => {
  testStatus.value = { state: 'testing', message: t('logTesting') };
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'QUEUE_LOG_GET_ALL',
    });
    if (response && response.success && response.data) {
      logs.value = response.data.logs || [];
      testStatus.value = {
        state: 'ok',
        message: t('logTestOk', [String(logs.value.length)]),
      };
      scrollToBottom();
    } else {
      testStatus.value = {
        state: 'fail',
        message: (response && response.error) || t('logTestFail'),
      };
    }
  } catch (err: any) {
    testStatus.value = { state: 'fail', message: err?.message || t('logTestFail') };
  }
};

onMounted(() => {
  chrome.runtime.onMessage.addListener(handleMessage);
  fetchLogs();
  scrollToBottom();
});

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleMessage);
});
</script>

<style scoped>
/* Ghost text button using theme tokens. */
.tk-ghost-btn {
  color: var(--text-muted);
}
.tk-ghost-btn:hover {
  color: var(--text);
  background: var(--surface-2);
}

/* Neutral status line (testing/idle) using theme tokens. */
.tk-neutral-line {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text-muted);
}

/* Inactive level filter button using theme tokens. */
.tk-filter-inactive {
  background: var(--surface-2);
  color: var(--text-muted);
}
.tk-filter-inactive:hover {
  background: var(--border);
}

/* Log detail block using theme tokens. */
.tk-details {
  background: var(--surface);
  color: var(--text-muted);
}
</style>
