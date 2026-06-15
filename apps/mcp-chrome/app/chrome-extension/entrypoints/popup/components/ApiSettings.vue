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

    <!-- Current endpoint summary -->
    <div
      class="px-2 py-1 rounded text-[9px] break-all mb-2"
      style="background: var(--surface-2); color: var(--text-faint)"
    >
      {{ t('apiCurrentLabel') }}
      <strong style="color: var(--text)">{{ currentEndpointUrl }}</strong>
    </div>

    <!-- Endpoint list -->
    <div class="flex flex-col gap-1 mb-2">
      <div
        v-for="endpoint in sortedEndpoints"
        :key="endpoint.id"
        :class="[
          'group rounded-md border px-2 py-1.5 cursor-pointer transition-colors',
          isCurrentEndpoint(endpoint.id) ? 'tk-endpoint-active' : 'tk-endpoint',
        ]"
        @click="selectEndpoint(endpoint.id)"
      >
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span :class="['w-2 h-2 rounded-full shrink-0', dotClass(endpoint.id)]"></span>
            <span class="text-[10px] font-medium truncate" style="color: var(--text)">
              {{ endpoint.description }}
            </span>
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
            {{ endpoint.protocol }}://{{ endpoint.url }}{{ endpoint.port ? ':' + endpoint.port : '' }}
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
import { useAppStore } from '@/composables/useAppStore';

const appStore = useAppStore();

const BASE_INTERVAL_MS = 15000;
const MAX_INTERVAL_MS = 60000;
const PROBE_TIMEOUT_MS = 3000;

const currentEndpoint = ref<ApiEndpoint | null>(null);
const endpointStatuses = ref<EndpointStatus[]>([]);
const isRefreshing = ref(false);
const isAutoDetecting = ref(false);
const testingId = ref<string | null>(null);
const showCustomForm = ref(false);

const customUrl = ref('');
const customProtocol = ref<'http' | 'https'>('http');
const customPort = ref<number | undefined>(undefined);

let autoDetectTimer: ReturnType<typeof setTimeout> | null = null;
let currentBackoff = BASE_INTERVAL_MS;
let disposed = false;

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

const getStatus = (id: string): EndpointStatus | undefined =>
  endpointStatuses.value.find((s) => s.endpoint.id === id);

const dotClass = (id: string): string => {
  const status = getStatus(id);
  if (!status) return 'bg-slate-500';
  return status.isAvailable ? 'bg-emerald-500' : 'bg-rose-500';
};

const formatResponseTime = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;

// Keep the appStore endpoint id in sync so other consumers stay consistent.
const syncAppStore = (endpointId: string) => {
  try {
    appStore.setCurrentEndpoint(endpointId);
  } catch (error) {
    console.warn('[API Settings] Failed to sync appStore endpoint:', error);
  }
};

const refreshEndpoints = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    const statuses = await Promise.all(
      apiManager.getAllEndpoints().map((endpoint) =>
        apiManager.checkEndpoint(endpoint, PROBE_TIMEOUT_MS),
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
    const status = await apiManager.checkEndpoint(endpoint, PROBE_TIMEOUT_MS);
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
    currentEndpoint.value = apiManager.getCurrentEndpoint();
    syncAppStore(endpointId);
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

// Self-scheduling recovery loop. Each cycle re-probes the CURRENT endpoint (a
// single cheap check, so failure/recovery is noticed promptly); only when it is
// actually unreachable do we sweep for a healthy alternative. While everything
// is down the interval backs off (15s → up to 60s) so an outage can't spin the
// CPU or flood the log; it resets to the base interval as soon as we recover.
const tick = async () => {
  if (disposed) return;
  if (isRefreshing.value || testingId.value) {
    scheduleNext();
    return;
  }
  try {
    const current = currentEndpoint.value;
    if (current) {
      const status = await apiManager.checkEndpoint(current, PROBE_TIMEOUT_MS);
      upsertStatus(status);
      if (status.isAvailable) {
        currentBackoff = BASE_INTERVAL_MS;
        return;
      }
    }
    // Current endpoint is down (or none selected) — look for a healthy one.
    isAutoDetecting.value = true;
    const detected = await apiManager.autoDetectEndpoint(PROBE_TIMEOUT_MS);
    if (detected) {
      currentEndpoint.value = detected;
      syncAppStore(detected.id);
      await refreshEndpoints();
      currentBackoff = BASE_INTERVAL_MS;
    } else {
      currentBackoff = Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
    }
  } catch (error) {
    console.error('[API Settings] Auto-detect cycle failed:', error);
    currentBackoff = Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
  } finally {
    isAutoDetecting.value = false;
    scheduleNext();
  }
};

onMounted(async () => {
  await apiManager.initialize({ autoDetect: false });
  currentEndpoint.value = apiManager.getCurrentEndpoint();
  await refreshEndpoints();
  scheduleNext();
});

onUnmounted(() => {
  disposed = true;
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
.tk-endpoint {
  background: var(--surface-2);
  border-color: var(--border);
}
.tk-endpoint:hover {
  border-color: var(--border-strong);
}
.tk-endpoint-active {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.tk-input {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text);
}
</style>
