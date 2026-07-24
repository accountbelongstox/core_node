<template>
  <div
    class="rounded-lg p-2.5 overflow-hidden border"
    style="background: var(--surface); border-color: var(--border)"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-1.5">
      <h4 class="text-[9px] font-bold uppercase tracking-tight" style="color: var(--text-muted)">
        {{ t('apiConfigurationLabel') }}
      </h4>
      <div class="flex items-center gap-1.5">
        <span v-if="isAutoDetecting" class="text-[8px] text-amber-400 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          {{ t('apiAutoDetecting') }}
        </span>
        <button
          class="tk-btn px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors disabled:opacity-50"
          :disabled="isRefreshing"
          @click="refreshEndpoints"
        >
          {{ isRefreshing ? t('apiTesting') : t('apiTestAll') }}
        </button>
      </div>
    </div>

    <!-- Endpoint dropdown -->
    <div ref="dropdownRef" class="relative mb-2">
      <button
        class="tk-select w-full flex items-center justify-between gap-1.5 px-2 py-1.5 border rounded-md text-left transition-colors"
        @click="dropdownOpen = !dropdownOpen"
      >
        <span class="flex items-center gap-1.5 min-w-0">
          <span :class="['w-2 h-2 rounded-full shrink-0', headerDotClass]"></span>
          <span class="text-[10px] font-medium truncate" style="color: var(--text)">
            {{ selectedLabel }}
          </span>
          <span
            v-if="autoMode"
            class="px-1 rounded text-[7px] font-bold shrink-0 bg-indigo-500/15 text-indigo-400"
          >
            {{ t('apiAutoTag') }}
          </span>
        </span>
        <span
          class="text-[9px] shrink-0 transition-transform"
          :class="{ 'rotate-180': dropdownOpen }"
          style="color: var(--text-faint)"
          >▾</span
        >
      </button>

      <div
        v-if="dropdownOpen"
        class="tk-dropdown absolute left-0 right-0 z-20 mt-1 rounded-md border shadow-lg overflow-hidden"
      >
        <!-- Auto (best available by weight) -->
        <button
          class="tk-option w-full flex items-center justify-between gap-1.5 px-2 py-1.5 text-left transition-colors"
          :class="{ 'tk-option-active': autoMode }"
          @click="selectAuto"
        >
          <span class="flex items-center gap-1.5 min-w-0">
            <span class="w-2 h-2 rounded-full shrink-0 bg-indigo-500"></span>
            <span class="text-[10px] font-medium truncate" style="color: var(--text)">
              {{ t('apiAutoMode') }}
            </span>
          </span>
          <span v-if="autoMode" class="text-[9px] shrink-0 text-indigo-400">✓</span>
        </button>

        <div class="border-t" style="border-color: var(--border)"></div>

        <!-- Concrete endpoints, highest weight first -->
        <div
          v-for="endpoint in sortedEndpoints"
          :key="endpoint.id"
          class="tk-option px-2 py-1.5 cursor-pointer transition-colors"
          :class="{ 'tk-option-active': !autoMode && isCurrentEndpoint(endpoint.id) }"
          @click="selectEndpoint(endpoint.id)"
        >
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <span :class="['w-2 h-2 rounded-full shrink-0', dotClass(endpoint.id)]"></span>
              <span class="text-[10px] font-medium truncate" style="color: var(--text)">
                {{ endpoint.description }}
              </span>
              <span v-if="!autoMode && isCurrentEndpoint(endpoint.id)" class="text-[9px] shrink-0 text-indigo-400">✓</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="getStatus(endpoint.id)"
                class="text-[8px] font-mono"
                style="color: var(--text-faint)"
              >
                {{ formatResponseTime(getStatus(endpoint.id)!.responseTime) }}
              </span>
              <button
                class="tk-btn-test px-1.5 py-0.5 rounded text-[8px] font-bold transition-colors disabled:opacity-50"
                :disabled="testingId === endpoint.id"
                @click.stop="testEndpoint(endpoint)"
              >
                {{ testingId === endpoint.id ? '...' : t('apiTest') }}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-1 mt-1 pl-3.5">
            <span class="text-[8px] font-mono truncate" style="color: var(--text-faint)">
              {{ endpoint.protocol }}://{{ endpoint.url
              }}{{ endpoint.port ? ':' + endpoint.port : '' }}
            </span>
            <span
              :class="[
                'ml-auto px-1 rounded text-[7px] font-bold shrink-0',
                endpoint.isLocal ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400',
              ]"
            >
              {{ endpoint.isLocal ? t('apiLocalTag') : t('apiRemoteTag') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Current endpoint summary -->
    <div
      class="px-2 py-1 rounded text-[9px] break-all mb-2"
      style="background: var(--surface-2); color: var(--text-faint)"
    >
      {{ t('apiCurrentLabel') }}
      <strong style="color: var(--text)">{{ currentEndpointUrl }}</strong>
    </div>

    <!-- Add custom endpoint -->
    <div class="border-t pt-2" style="border-color: var(--border)">
      <button
        class="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-tight mb-1.5"
        style="color: var(--text-muted)"
        @click="showCustomForm = !showCustomForm"
      >
        <span>{{ t('apiAddCustomLabel') }}</span>
        <span style="color: var(--text-faint)">{{ showCustomForm ? '−' : '+' }}</span>
      </button>
      <div v-if="showCustomForm" class="flex flex-col gap-1.5">
        <input
          v-model="customUrl"
          type="text"
          :placeholder="t('apiCustomUrlPlaceholder')"
          class="tk-input w-full px-2 py-1 border rounded text-[10px]"
        />
        <div class="flex gap-1.5">
          <select v-model="customProtocol" class="tk-input px-2 py-1 border rounded text-[10px]">
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
          <input
            v-model.number="customPort"
            type="number"
            :placeholder="t('apiPortPlaceholder')"
            class="tk-input flex-1 min-w-0 px-2 py-1 border rounded text-[10px]"
          />
        </div>
        <button
          class="w-full px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9px] font-bold transition-colors disabled:opacity-40"
          :disabled="!customUrl"
          @click="addCustomEndpoint"
        >
          {{ t('apiAddEndpoint') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { apiManager } from '@/services/ApiManager';
import type { ApiEndpoint, EndpointStatus } from '@/services/ApiManager';
import { getMessage as t } from '@/utils/i18n';

const BASE_INTERVAL_MS = 15000;
const MAX_INTERVAL_MS = 60000;
const PROBE_TIMEOUT_MS = 3000;

const currentEndpoint = ref<ApiEndpoint | null>(null);
const endpointStatuses = ref<EndpointStatus[]>([]);
const isRefreshing = ref(false);
const isAutoDetecting = ref(false);
const testingId = ref<string | null>(null);
const showCustomForm = ref(false);
const dropdownOpen = ref(false);
const autoMode = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const customUrl = ref('');
const customProtocol = ref<'http' | 'https'>('http');
const customPort = ref<number | undefined>(undefined);

let autoDetectTimer: ReturnType<typeof setTimeout> | null = null;
let currentBackoff = BASE_INTERVAL_MS;
let disposed = false;
let unsubEndpoint: (() => void) | null = null;

const sortedEndpoints = computed(() =>
  [...apiManager.getAllEndpoints()].sort((a, b) => a.priority - b.priority),
);

const currentEndpointUrl = computed(() => {
  const ep = currentEndpoint.value;
  if (!ep) return t('apiNone');
  const port = ep.port ? `:${ep.port}` : '';
  return `${ep.protocol}://${ep.url}${port}`;
});

const isCurrentEndpoint = (id: string) => currentEndpoint.value?.id === id;

// Dropdown header label: in auto mode show "Auto · <resolved server>", otherwise
// the manually-selected server's name.
const selectedLabel = computed(() => {
  const ep = currentEndpoint.value;
  if (autoMode.value) {
    return ep ? `${t('apiAutoMode')} · ${ep.description}` : t('apiAutoMode');
  }
  return ep ? ep.description : t('apiNone');
});

const headerDotClass = computed(() =>
  currentEndpoint.value ? dotClass(currentEndpoint.value.id) : 'bg-slate-500',
);

const getStatus = (id: string): EndpointStatus | undefined =>
  endpointStatuses.value.find((s) => s.endpoint.id === id);

const dotClass = (id: string): string => {
  const status = getStatus(id);
  if (!status) return 'bg-slate-500';
  return status.isAvailable ? 'bg-emerald-500' : 'bg-rose-500';
};

const formatResponseTime = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;

const refreshEndpoints = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    // Manual "Test All" wants fast feedback — no retry (retries=0). The retry
    // only belongs to the background auto-detect loop, where stability matters.
    const statuses = await Promise.all(
      apiManager.getAllEndpoints().map((endpoint) =>
        apiManager.checkEndpoint(endpoint, PROBE_TIMEOUT_MS, 0),
      ),
    );
    endpointStatuses.value = statuses;
  } catch (error) {
    console.error('[API Settings] Failed to refresh endpoints:', error);
  } finally {
    isRefreshing.value = false;
  }
};

const testEndpoint = async (endpoint: ApiEndpoint) => {
  if (testingId.value) return;
  testingId.value = endpoint.id;
  try {
    const status = await apiManager.checkEndpoint(endpoint, PROBE_TIMEOUT_MS, 0);
    const idx = endpointStatuses.value.findIndex((s) => s.endpoint.id === endpoint.id);
    if (idx >= 0) {
      endpointStatuses.value[idx] = status;
    } else {
      endpointStatuses.value = [...endpointStatuses.value, status];
    }
  } catch (error) {
    console.error('[API Settings] Failed to test endpoint:', error);
  } finally {
    testingId.value = null;
  }
};

const selectEndpoint = async (endpointId: string) => {
  const success = await apiManager.setEndpoint(endpointId);
  if (success) {
    autoMode.value = false;
    dropdownOpen.value = false;
    currentEndpoint.value = apiManager.getCurrentEndpoint();
    currentBackoff = BASE_INTERVAL_MS;
  }
};

// Switch to auto mode: probe in weight order and ride the highest-weight
// endpoint that answers. The background tick keeps it on the best available.
const selectAuto = async () => {
  autoMode.value = true;
  dropdownOpen.value = false;
  await apiManager.setAutoMode(true);
  isAutoDetecting.value = true;
  try {
    const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
    endpointStatuses.value = [...apiManager.getAllEndpointStatuses()];
    if (best) {
      currentEndpoint.value = best;
    }
  } finally {
    isAutoDetecting.value = false;
    currentBackoff = BASE_INTERVAL_MS;
  }
};

const onDocumentClick = (event: MouseEvent) => {
  if (!dropdownOpen.value) return;
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    dropdownOpen.value = false;
  }
};

const addCustomEndpoint = async () => {
  if (!customUrl.value) return;
  try {
    await apiManager.addCustomEndpoint({
      url: customUrl.value,
      protocol: customProtocol.value,
      port: customPort.value,
      priority: 99,
      isLocal: false,
      description: `Custom: ${customUrl.value}`,
    });
    customUrl.value = '';
    customPort.value = undefined;
    await refreshEndpoints();
  } catch (error) {
    console.error('[API Settings] Failed to add custom endpoint:', error);
  }
};

const upsertStatus = (status: EndpointStatus) => {
  const idx = endpointStatuses.value.findIndex((s) => s.endpoint.id === status.endpoint.id);
  if (idx >= 0) endpointStatuses.value[idx] = status;
  else endpointStatuses.value = [...endpointStatuses.value, status];
};

const scheduleNext = () => {
  if (disposed) return;
  autoDetectTimer = setTimeout(tick, currentBackoff);
};

// Self-scheduling monitor loop. Behaviour depends on the mode:
//   • Auto mode  — sweep endpoints in weight order and ride the highest-weight
//     one that answers, upgrading back as better endpoints recover.
//   • Manual mode — the user pinned a server, so we only re-probe it for status
//     (red/green dot) and never switch away.
// While everything is down the interval backs off (15s → up to 60s) so an
// outage can't spin the CPU or flood the log; it resets on recovery.
const tick = async () => {
  if (disposed) return;
  if (isRefreshing.value || testingId.value) {
    scheduleNext();
    return;
  }
  try {
    if (autoMode.value) {
      isAutoDetecting.value = true;
      const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
      endpointStatuses.value = [...apiManager.getAllEndpointStatuses()];
      if (best) {
        currentEndpoint.value = best;
        currentBackoff = BASE_INTERVAL_MS;
      } else {
        currentBackoff = Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
      }
      return;
    }

    // Manual mode: just monitor the pinned endpoint, don't switch away.
    const current = currentEndpoint.value;
    if (current) {
      const status = await apiManager.checkEndpoint(current, PROBE_TIMEOUT_MS);
      upsertStatus(status);
      currentBackoff = status.isAvailable
        ? BASE_INTERVAL_MS
        : Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
    }
  } catch (error) {
    console.error('[API Settings] Monitor cycle failed:', error);
    currentBackoff = Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
  } finally {
    isAutoDetecting.value = false;
    scheduleNext();
  }
};

onMounted(async () => {
  await apiManager.initialize({ autoDetect: false });
  autoMode.value = apiManager.isAutoMode();
  currentEndpoint.value = apiManager.getCurrentEndpoint();
  await refreshEndpoints();
  // In auto mode, immediately settle on the best available endpoint so the
  // header reflects the real pick instead of the last provisional one.
  if (autoMode.value) {
    const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
    if (best) {
      currentEndpoint.value = best;
    }
  }
  document.addEventListener('click', onDocumentClick);
  unsubEndpoint = apiManager.onEndpointChange(() => {
    currentEndpoint.value = apiManager.getCurrentEndpoint();
    autoMode.value = apiManager.isAutoMode();
    void refreshEndpoints();
  });
  scheduleNext();
});

onUnmounted(() => {
  disposed = true;
  unsubEndpoint?.();
  document.removeEventListener('click', onDocumentClick);
  if (autoDetectTimer !== null) {
    clearTimeout(autoDetectTimer);
    autoDetectTimer = null;
  }
});
</script>

<style scoped>
/* Token-driven surfaces for utilities Tailwind can't express as a variable. */
.tk-btn {
  background: var(--surface-2);
  color: var(--text);
}
.tk-btn:hover:not(:disabled) {
  background: var(--surface-solid);
}
.tk-btn-test {
  background: var(--surface-2);
  color: var(--text);
}
.tk-btn-test:hover:not(:disabled) {
  background: var(--accent);
  color: var(--accent-fg);
}
.tk-select {
  background: var(--surface-2);
  border-color: var(--border);
}
.tk-select:hover {
  border-color: var(--border-strong);
}
.tk-dropdown {
  background: var(--surface-solid, var(--surface));
  border-color: var(--border);
}
.tk-option:hover {
  background: var(--surface-2);
}
.tk-option-active {
  background: var(--accent-soft);
}
.tk-input {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text);
}
</style>
