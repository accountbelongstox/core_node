<template>
  <div class="tk-card rounded-lg p-2.5 overflow-hidden border">
    <div class="flex items-center justify-between mb-1.5">
      <h4 class="text-[9px] font-bold uppercase tracking-tight" style="color: var(--text-muted)">
        {{ getMessage('cacheStorageTitle') }}
      </h4>
      <button
        class="tk-btn px-2 py-0.5 rounded text-[9px] font-bold transition-colors disabled:opacity-50"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? getMessage('loadingStatus') : getMessage('cacheRefreshButton') }}
      </button>
    </div>

    <!-- Location string -->
    <div class="mb-2 px-2 py-1.5 rounded" style="background: var(--surface-2)">
      <span class="block text-[8px] mb-0.5" style="color: var(--text-faint)">
        {{ getMessage('cacheLocationLabel') }}
      </span>
      <code class="block text-[9px] font-mono break-all" style="color: var(--text)">
        {{ location }}
      </code>
    </div>

    <!-- Unavailable fallback: read-only intended structure -->
    <template v-if="!available">
      <p class="text-[9px] mb-1.5" style="color: var(--warning)">
        {{ getMessage('cacheUnavailableNote') }}
      </p>
      <ul class="space-y-1">
        <li
          v-for="ns in NAMESPACES"
          :key="ns"
          class="flex items-center justify-between px-2 py-1 rounded text-[9px]"
          style="background: var(--surface-2); color: var(--text-muted)"
        >
          <span class="font-mono">{{ CACHE_ROOT }}/{{ ns }}/</span>
          <span class="text-[8px]" style="color: var(--text-faint)">{{ getMessage('cacheReadOnlyTag') }}</span>
        </li>
      </ul>
    </template>

    <!-- Available: per-namespace stats + actions -->
    <template v-else>
      <ul class="space-y-1 mb-2">
        <li
          v-for="info in namespaces"
          :key="info.namespace"
          class="flex items-center justify-between gap-1.5 px-2 py-1 rounded"
          style="background: var(--surface-2)"
        >
          <div class="min-w-0">
            <span class="block text-[10px] font-mono truncate" style="color: var(--text)">
              {{ CACHE_ROOT }}/{{ info.namespace }}/
            </span>
            <span class="block text-[8px]" style="color: var(--text-faint)">
              {{ info.fileCount }} {{ getMessage('itemsUnit') }} · {{ formatBytes(info.totalBytes) }}
            </span>
          </div>
          <button
            class="shrink-0 px-2 py-0.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 rounded text-[8px] font-bold transition-colors disabled:opacity-50"
            :disabled="busy"
            @click="onClearNamespace(info.namespace)"
          >
            {{ getMessage('cacheClearButton') }}
          </button>
        </li>
      </ul>

      <button
        class="w-full px-2 py-1.5 bg-rose-900/20 border border-rose-900/40 text-rose-400 rounded text-[9px] font-bold transition-all hover:bg-rose-900/30 disabled:opacity-50"
        :disabled="busy"
        @click="onClearAll"
      >
        {{ getMessage('cacheClearAllButton') }}
      </button>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { getMessage } from '@/utils/i18n';
import {
  CACHE_ROOT,
  NAMESPACES,
  describeLocation,
  isAvailable,
  ensureNamespaces,
  listNamespaces,
  clearNamespace,
  clearAll,
  type CacheNamespace,
  type NamespaceInfo,
} from '../composables/useCacheStore';

const available = ref(isAvailable());
const location = ref(describeLocation());
const namespaces = ref<NamespaceInfo[]>([]);
const loading = ref(false);
const busy = ref(false);

function formatBytes(bytes: number): string {
  if (bytes <= 0) return `0 ${getMessage('bytesUnit')}`;
  const kb = 1024;
  if (bytes < kb) return `${bytes} ${getMessage('bytesUnit')}`;
  if (bytes < kb * kb) return `${(bytes / kb).toFixed(1)} ${getMessage('kilobytesUnit')}`;
  return `${(bytes / (kb * kb)).toFixed(1)} ${getMessage('megabytesUnit')}`;
}

async function refresh() {
  loading.value = true;
  try {
    available.value = isAvailable();
    location.value = describeLocation();
    if (available.value) {
      await ensureNamespaces();
      namespaces.value = await listNamespaces();
    } else {
      namespaces.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function onClearNamespace(ns: CacheNamespace) {
  busy.value = true;
  try {
    await clearNamespace(ns);
    namespaces.value = await listNamespaces();
  } finally {
    busy.value = false;
  }
}

async function onClearAll() {
  busy.value = true;
  try {
    await clearAll();
    namespaces.value = await listNamespaces();
  } finally {
    busy.value = false;
  }
}

onMounted(refresh);
</script>

<style scoped>
.tk-card {
  background: var(--surface);
  border-color: var(--border);
}
.tk-btn {
  background: var(--surface-2);
  color: var(--text);
}
.tk-btn:hover {
  background: var(--surface-solid);
}
</style>
