<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-info-circle text-emerald-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Lookup status code</h3>
            <p class="text-xs text-slate-500">Supports informational, success, redirects, client, and server codes.</p>
          </div>
          <div class="flex items-center space-x-3">
            <input
              v-model="codeInput"
              type="number"
              min="100"
              max="599"
              class="px-4 py-2 border border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-transparent"
              placeholder="e.g. 404"
            >
            <button
              @click="lookup"
              :disabled="!canLookup"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              <i v-if="lookupLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-search mr-2"></i>
              Lookup
            </button>
            <button
              @click="loadCatalog"
              :disabled="catalogLoading"
              class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <i v-if="catalogLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-list mr-2"></i>
              {{ catalog.length ? 'Refresh list' : 'Load catalog' }}
            </button>
          </div>
        </header>

        <div class="px-5 py-4" v-if="currentStatus">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p class="text-xs uppercase tracking-wide text-slate-500">{{ familyLabel(currentStatus.code) }}</p>
            <div class="mt-2 flex items-center space-x-3">
              <span class="text-3xl font-semibold" :class="statusColor(currentStatus.code)">{{ currentStatus.code }}</span>
              <p class="text-lg font-semibold text-slate-800">{{ currentStatus.message }}</p>
            </div>
            <p class="mt-3 text-sm text-slate-600">{{ currentStatus.description }}</p>
          </div>
        </div>
        <p v-else class="px-5 py-4 text-sm text-slate-500">Search for a status to see its metadata.</p>
        <p v-if="lookupError" class="px-5 pb-4 text-sm text-red-600">{{ lookupError }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Status catalog</h3>
            <p class="text-xs text-slate-500">Filtered view updates as you type.</p>
          </div>
          <input
            v-model="catalogFilter"
            type="text"
            placeholder="Filter by code or message"
            class="px-4 py-2 border border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-transparent text-sm"
          >
        </header>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th class="text-left px-4 py-3">Code</th>
                <th class="text-left px-4 py-3">Message</th>
                <th class="text-left px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="catalogLoading">
                <td colspan="3" class="px-4 py-8 text-center text-slate-500">
                  <i class="fas fa-spinner fa-spin mr-2"></i>
                  Loading catalog...
                </td>
              </tr>
              <tr v-else-if="filteredCatalog.length === 0">
                <td colspan="3" class="px-4 py-8 text-center text-slate-500">No status codes loaded. Click “Load catalog”.</td>
              </tr>
              <tr
                v-else
                v-for="status in filteredCatalog"
                :key="status.code"
                class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                @click="selectFromCatalog(status)"
              >
                <td class="px-4 py-3 font-semibold" :class="statusColor(status.code)">{{ status.code }}</td>
                <td class="px-4 py-3">{{ status.message }}</td>
                <td class="px-4 py-3 text-slate-500">{{ status.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/web/http-status/:code</code></span>
      <span v-if="catalog.length">Catalog size: {{ catalog.length }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

interface HttpStatusEntry {
  code: number;
  message: string;
  description?: string;
}

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();

const codeInput = ref('200');
const lookupLoading = ref(false);
const catalogLoading = ref(false);
const currentStatus = ref<HttpStatusEntry | null>(null);
const catalog = ref<HttpStatusEntry[]>([]);
const lookupError = ref<string | null>(null);
const catalogFilter = ref('');

const canLookup = computed(() => codeInput.value.trim().length > 0 && !lookupLoading.value);

const familyLabel = (code?: number) => {
  if (!code) return 'Unknown';
  if (code < 200) return 'Informational';
  if (code < 300) return 'Success';
  if (code < 400) return 'Redirection';
  if (code < 500) return 'Client Error';
  return 'Server Error';
};

const statusColor = (code?: number) => {
  if (!code) return 'text-slate-600';
  if (code < 300) return 'text-emerald-600';
  if (code < 400) return 'text-amber-600';
  if (code < 500) return 'text-orange-600';
  return 'text-rose-600';
};

const normalizeEntry = (data: any): HttpStatusEntry | null => {
  if (!data) return null;
  if (typeof data === 'object' && 'code' in data) {
    return {
      code: Number(data.code),
      message: data.message || data.name || '',
      description: data.description || data.detail || ''
    };
  }
  return null;
};

const normalizeCollection = (data: any): HttpStatusEntry[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.map((item) => normalizeEntry(item)).filter(Boolean) as HttpStatusEntry[];
  if (Array.isArray(data.statuses)) return data.statuses.map((item: any) => normalizeEntry(item)).filter(Boolean) as HttpStatusEntry[];
  if (data.data && Array.isArray(data.data)) return data.data.map((item: any) => normalizeEntry(item)).filter(Boolean) as HttpStatusEntry[];
  const entry = normalizeEntry(data);
  return entry ? [entry] : [];
};

const lookup = async () => {
  if (!canLookup.value) return;
  lookupLoading.value = true;
  lookupError.value = null;

  try {
    const code = Number(codeInput.value);
    const response = await props.api.getHttpStatus(code);
    if (response.success && response.data) {
      currentStatus.value = normalizeEntry(response.data);
    } else {
      throw new Error(response.error || response.message || 'Status not found');
    }
  } catch (err: any) {
    lookupError.value = err?.message || 'HTTP status service unavailable';
    currentStatus.value = null;
  } finally {
    lookupLoading.value = false;
  }
};

const loadCatalog = async () => {
  catalogLoading.value = true;
  try {
    const response = await props.api.getHttpStatus();
    if (response.success && response.data) {
      catalog.value = normalizeCollection(response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to load catalog');
    }
  } catch (err) {
    console.error('Catalog load failed', err);
  } finally {
    catalogLoading.value = false;
  }
};

const filteredCatalog = computed(() => {
  if (!catalog.value.length) return [] as HttpStatusEntry[];
  const query = catalogFilter.value.trim().toLowerCase();
  if (!query) return catalog.value;
  return catalog.value.filter((entry) => entry.code.toString().includes(query) || entry.message?.toLowerCase().includes(query));
});

const selectFromCatalog = (entry: HttpStatusEntry) => {
  currentStatus.value = entry;
  codeInput.value = String(entry.code);
};

lookup();
</script>
