<template>
  <div ref="rootRef" class="relative">
    <!-- Trigger pill -->
    <button
      class="ep-trigger flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors"
      :title="currentEndpointUrl"
      @click="open = !open"
    >
      <span :class="['w-1.5 h-1.5 rounded-full shrink-0 transition-colors', headerDotClass]" />
      <span class="truncate max-w-[110px]" style="color: var(--text)">{{ triggerLabel }}</span>
      <span v-if="autoMode" class="px-1 rounded text-[7px] font-bold bg-indigo-500/15 text-indigo-400 shrink-0">A</span>
      <span class="text-[9px] shrink-0 transition-transform" :class="{ 'rotate-180': open }" style="color: var(--text-faint)">▾</span>
    </button>

    <!-- Dropdown panel — positioned below the trigger, right-aligned -->
    <div
      v-if="open"
      class="ep-panel absolute right-0 top-full mt-1 w-72 rounded-lg border shadow-2xl overflow-hidden"
      style="background: var(--surface-solid, var(--surface)); border-color: var(--border); z-index: 200"
    >
      <!-- Panel header -->
      <div class="flex items-center justify-between px-2.5 py-1.5 border-b" style="border-color: var(--border)">
        <span class="text-[9px] font-bold uppercase tracking-tight" style="color: var(--text-muted)">API Endpoint</span>
        <div class="flex items-center gap-1.5">
          <span v-if="isAutoDetecting" class="text-[8px] text-amber-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Detecting…
          </span>
          <button
            class="ep-btn px-1.5 py-0.5 rounded text-[8px] font-bold disabled:opacity-50"
            :disabled="isRefreshing"
            @click="refreshEndpoints"
          >
            {{ isRefreshing ? 'Testing…' : 'Test All' }}
          </button>
        </div>
      </div>

      <!-- Auto mode row -->
      <button
        class="ep-option w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
        :class="{ 'ep-option--active': autoMode }"
        @click="selectAuto"
      >
        <span class="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
        <span class="text-[10px] font-medium flex-1" style="color: var(--text)">Auto (best available)</span>
        <span v-if="autoMode" class="text-[9px] text-indigo-400 shrink-0">✓</span>
      </button>

      <div class="border-t" style="border-color: var(--border)" />

      <!-- Endpoint list -->
      <div class="max-h-52 overflow-y-auto">
        <div
          v-for="ep in sortedEndpoints"
          :key="ep.id"
          class="ep-option px-2.5 py-1.5 cursor-pointer"
          :class="{ 'ep-option--active': !autoMode && isCurrentEndpoint(ep.id) }"
          @click="selectEndpoint(ep.id)"
        >
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <span :class="['w-2 h-2 rounded-full shrink-0', dotClass(ep.id)]" />
              <span class="text-[10px] font-medium truncate" style="color: var(--text)">{{ ep.description }}</span>
              <span v-if="!autoMode && isCurrentEndpoint(ep.id)" class="text-[9px] shrink-0 text-indigo-400">✓</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span v-if="getStatus(ep.id)" class="text-[8px] font-mono" style="color: var(--text-faint)">
                {{ formatResponseTime(getStatus(ep.id)!.responseTime) }}
              </span>
              <button
                class="ep-btn-test px-1.5 py-0.5 rounded text-[8px] font-bold disabled:opacity-50"
                :disabled="testingId === ep.id"
                @click.stop="testEndpoint(ep)"
              >
                {{ testingId === ep.id ? '…' : 'Test' }}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-1 mt-0.5 pl-3.5">
            <span class="text-[8px] font-mono truncate" style="color: var(--text-faint)">
              {{ ep.protocol }}://{{ ep.url }}{{ ep.port ? ':' + ep.port : '' }}
            </span>
            <span
              :class="['ml-auto px-1 rounded text-[7px] font-bold shrink-0', ep.isLocal ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400']"
            >{{ ep.isLocal ? 'local' : 'remote' }}</span>
          </div>
        </div>
      </div>

      <!-- Add custom -->
      <div class="border-t" style="border-color: var(--border)" />
      <div class="px-2.5 py-1.5">
        <button
          class="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-tight"
          style="color: var(--text-muted)"
          @click="showCustomForm = !showCustomForm"
        >
          <span>Add Custom</span>
          <span style="color: var(--text-faint)">{{ showCustomForm ? '−' : '+' }}</span>
        </button>
        <div v-if="showCustomForm" class="flex flex-col gap-1 mt-1.5">
          <input
            v-model="customUrl"
            type="text"
            placeholder="host or IP"
            class="ep-input w-full px-2 py-1 border rounded text-[10px]"
          />
          <div class="flex gap-1">
            <select v-model="customProtocol" class="ep-input px-2 py-1 border rounded text-[10px]">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
            <input
              v-model.number="customPort"
              type="number"
              placeholder="port"
              class="ep-input flex-1 min-w-0 px-2 py-1 border rounded text-[10px]"
            />
          </div>
          <button
            class="w-full px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9px] font-bold disabled:opacity-40 transition-colors"
            :disabled="!customUrl"
            @click="addCustomEndpoint"
          >
            Add Endpoint
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { apiManager } from '@/services/ApiManager';
import type { ApiEndpoint, EndpointStatus } from '@/services/ApiManager';
import { useAppStore } from '@/composables/useAppStore';

const appStore = useAppStore();

const BASE_INTERVAL_MS = 15000;
const MAX_INTERVAL_MS = 60000;
const PROBE_TIMEOUT_MS = 3000;

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const currentEndpoint = ref<ApiEndpoint | null>(null);
const endpointStatuses = ref<EndpointStatus[]>([]);
const isRefreshing = ref(false);
const isAutoDetecting = ref(false);
const testingId = ref<string | null>(null);
const showCustomForm = ref(false);
const autoMode = ref(false);

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
  if (!ep) return 'None';
  const port = ep.port ? `:${ep.port}` : '';
  return `${ep.protocol}://${ep.url}${port}`;
});

const triggerLabel = computed(() => {
  const ep = currentEndpoint.value;
  if (!ep) return 'None';
  const port = ep.port ? `:${ep.port}` : '';
  return `${ep.url}${port}`;
});

const isCurrentEndpoint = (id: string) => currentEndpoint.value?.id === id;

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

const syncAppStore = (endpointId: string) => {
  try {
    appStore.setCurrentEndpoint(endpointId);
  } catch {
    // appStore unavailable; apiManager remains authoritative
  }
};

const refreshEndpoints = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    const statuses = await Promise.all(
      apiManager.getAllEndpoints().map((ep) => apiManager.checkEndpoint(ep, PROBE_TIMEOUT_MS, 0)),
    );
    endpointStatuses.value = statuses;
  } finally {
    isRefreshing.value = false;
  }
};

const testEndpoint = async (ep: ApiEndpoint) => {
  if (testingId.value) return;
  testingId.value = ep.id;
  try {
    const status = await apiManager.checkEndpoint(ep, PROBE_TIMEOUT_MS, 0);
    const idx = endpointStatuses.value.findIndex((s) => s.endpoint.id === ep.id);
    if (idx >= 0) endpointStatuses.value[idx] = status;
    else endpointStatuses.value = [...endpointStatuses.value, status];
  } finally {
    testingId.value = null;
  }
};

const selectEndpoint = async (endpointId: string) => {
  const success = await apiManager.setEndpoint(endpointId);
  if (success) {
    autoMode.value = false;
    open.value = false;
    currentEndpoint.value = apiManager.getCurrentEndpoint();
    syncAppStore(endpointId);
    currentBackoff = BASE_INTERVAL_MS;
  }
};

const selectAuto = async () => {
  autoMode.value = true;
  open.value = false;
  await apiManager.setAutoMode(true);
  isAutoDetecting.value = true;
  try {
    const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
    endpointStatuses.value = [...apiManager.getAllEndpointStatuses()];
    if (best) {
      currentEndpoint.value = best;
      syncAppStore(best.id);
    }
  } finally {
    isAutoDetecting.value = false;
    currentBackoff = BASE_INTERVAL_MS;
  }
};

const addCustomEndpoint = async () => {
  if (!customUrl.value) return;
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

const tick = async () => {
  if (disposed) return;
  if (isRefreshing.value || testingId.value) { scheduleNext(); return; }
  try {
    if (autoMode.value) {
      isAutoDetecting.value = true;
      const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
      endpointStatuses.value = [...apiManager.getAllEndpointStatuses()];
      if (best) {
        currentEndpoint.value = best;
        syncAppStore(best.id);
        currentBackoff = BASE_INTERVAL_MS;
      } else {
        currentBackoff = Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
      }
      return;
    }
    const current = currentEndpoint.value;
    if (current) {
      const status = await apiManager.checkEndpoint(current, PROBE_TIMEOUT_MS);
      upsertStatus(status);
      currentBackoff = status.isAvailable
        ? BASE_INTERVAL_MS
        : Math.min(currentBackoff * 1.5, MAX_INTERVAL_MS);
    }
  } finally {
    isAutoDetecting.value = false;
    scheduleNext();
  }
};

const onDocumentClick = (e: MouseEvent) => {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false;
};

onMounted(async () => {
  await apiManager.initialize({ autoDetect: false });
  autoMode.value = apiManager.isAutoMode();
  currentEndpoint.value = apiManager.getCurrentEndpoint();
  await refreshEndpoints();
  if (autoMode.value) {
    const best = await apiManager.selectBestAvailable(PROBE_TIMEOUT_MS);
    if (best) { currentEndpoint.value = best; syncAppStore(best.id); }
  }
  document.addEventListener('click', onDocumentClick);
  scheduleNext();
});

onUnmounted(() => {
  disposed = true;
  document.removeEventListener('click', onDocumentClick);
  if (autoDetectTimer !== null) { clearTimeout(autoDetectTimer); autoDetectTimer = null; }
});
</script>

<style scoped>
.ep-trigger {
  background: var(--surface-2);
  border-color: var(--border);
}
.ep-trigger:hover {
  border-color: var(--border-strong);
  background: var(--surface);
}
.ep-btn {
  background: var(--surface-2);
  color: var(--text);
  transition: background 0.12s;
}
.ep-btn:hover:not(:disabled) {
  background: var(--surface-solid);
}
.ep-btn-test {
  background: var(--surface-2);
  color: var(--text);
  transition: background 0.12s;
}
.ep-btn-test:hover:not(:disabled) {
  background: var(--accent);
  color: var(--accent-fg);
}
.ep-option {
  transition: background 0.1s;
}
.ep-option:hover {
  background: var(--surface-2);
}
.ep-option--active {
  background: var(--accent-soft);
}
.ep-input {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text);
}
</style>
