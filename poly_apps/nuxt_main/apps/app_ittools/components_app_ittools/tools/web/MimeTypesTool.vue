<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-blue-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-file text-violet-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">Web</span>
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
            <h3 class="text-sm font-semibold text-slate-700">Search MIME types</h3>
            <p class="text-xs text-slate-500">Look up by extension (`.png`) or MIME string (`image/png`).</p>
          </div>
          <div class="flex items-center space-x-3">
            <input
              v-model="query"
              type="text"
              class="px-4 py-2 border border-slate-200 rounded-lg focus:ring-violet-500 focus:border-transparent"
              placeholder=".json or application/json"
            >
            <button
              @click="search"
              :disabled="!canSearch"
              class="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium shadow hover:bg-violet-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-search mr-2"></i>
              Search
            </button>
            <button
              @click="loadCatalog"
              :disabled="catalogLoading"
              class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <i v-if="catalogLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-database mr-2"></i>
              {{ catalog.length ? 'Refresh catalog' : 'Load catalog' }}
            </button>
          </div>
        </header>
        <div class="px-5 py-4">
          <div v-if="result" class="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500">Extension</p>
              <p class="text-xl font-semibold">.{{ result.extension }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500">MIME Type</p>
              <p class="text-lg font-semibold text-slate-800">{{ result.mimeType }}</p>
            </div>
            <button @click="copy(result.mimeType)" class="mt-4 sm:mt-0 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white">
              <i class="fas fa-copy mr-1"></i>
              Copy
            </button>
          </div>
          <p v-else class="text-sm text-slate-500">Enter an extension or MIME string to view details.</p>
          <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
        </div>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Catalog</h3>
            <p class="text-xs text-slate-500">Use the filter to drill down.</p>
          </div>
          <input
            v-model="catalogFilter"
            type="text"
            placeholder="Filter catalog..."
            class="px-4 py-2 border border-slate-200 rounded-lg focus:ring-violet-500 focus:border-transparent text-sm"
          >
        </header>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th class="text-left px-4 py-3">Extension</th>
                <th class="text-left px-4 py-3">MIME Type</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="catalogLoading">
                <td colspan="2" class="px-4 py-8 text-center text-slate-500">
                  <i class="fas fa-spinner fa-spin mr-2"></i>
                  Loading catalog...
                </td>
              </tr>
              <tr v-else-if="filteredCatalog.length === 0">
                <td colspan="2" class="px-4 py-8 text-center text-slate-500">No entries yet.</td>
              </tr>
              <tr
                v-else
                v-for="entry in filteredCatalog"
                :key="entry.extension + entry.mimeType"
                class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                @click="result = entry"
              >
                <td class="px-4 py-3 font-semibold">.{{ entry.extension }}</td>
                <td class="px-4 py-3 text-slate-600">{{ entry.mimeType }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/web/mime-types/:extension</code></span>
      <span v-if="catalog.length">Catalog size: {{ catalog.length }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

interface MimeEntry {
  extension: string;
  mimeType: string;
}

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();

const query = ref('.json');
const result = ref<MimeEntry | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const catalogLoading = ref(false);
const catalog = ref<MimeEntry[]>([]);
const catalogFilter = ref('');

const canSearch = computed(() => query.value.trim().length > 0 && !loading.value);

const normalizeEntry = (data: any): MimeEntry | null => {
  if (!data) return null;
  if (Array.isArray(data.extensions)) {
    return data.extensions.length ? { extension: data.extensions[0], mimeType: data.mimeType || '' } : null;
  }
  if (typeof data.extension === 'string' && typeof data.mimeType === 'string') {
    return { extension: data.extension.replace(/^\./, ''), mimeType: data.mimeType };
  }
  if (typeof data === 'object') {
    const [ext, mime] = Object.entries(data)[0] || [];
    if (ext && mime) {
      return { extension: ext.replace(/^\./, ''), mimeType: String(mime) };
    }
  }
  return null;
};

const normalizeCollection = (data: any): MimeEntry[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => normalizeEntry(item)).filter(Boolean) as MimeEntry[];
  }
  if (data.mimeTypes && Array.isArray(data.mimeTypes)) {
    return data.mimeTypes.map((item: any) => normalizeEntry(item)).filter(Boolean) as MimeEntry[];
  }
  if (data.entries && Array.isArray(data.entries)) {
    return data.entries.map((item: any) => normalizeEntry(item)).filter(Boolean) as MimeEntry[];
  }
  const entry = normalizeEntry(data);
  return entry ? [entry] : [];
};

const search = async () => {
  if (!canSearch.value) return;
  loading.value = true;
  error.value = null;

  try {
    const value = query.value.trim();
    if (value.includes('/')) {
      // Fallback to catalog filtering
      if (!catalog.value.length) {
        await loadCatalog();
      }
      result.value = catalog.value.find((entry) => entry.mimeType === value) || null;
      if (!result.value) {
        error.value = 'MIME type not found in catalog';
      }
    } else {
      const response = await props.api.getMimeTypes(value);
      if (response.success && response.data) {
        const entry = normalizeEntry(response.data);
        result.value = entry;
        if (!entry) {
          error.value = 'Extension not found';
        }
      } else {
        throw new Error(response.error || response.message || 'Lookup failed');
      }
    }
  } catch (err: any) {
    error.value = err?.message || 'MIME lookup service unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

const loadCatalog = async () => {
  catalogLoading.value = true;
  try {
    const response = await props.api.getMimeTypes();
    if (response.success && response.data) {
      catalog.value = normalizeCollection(response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to load catalog');
    }
  } catch (err) {
    console.error('Mime catalog error', err);
  } finally {
    catalogLoading.value = false;
  }
};

const filteredCatalog = computed(() => {
  if (!catalog.value.length) return [] as MimeEntry[];
  const q = catalogFilter.value.trim().toLowerCase();
  if (!q) return catalog.value;
  return catalog.value.filter((entry) => entry.extension.toLowerCase().includes(q) || entry.mimeType.toLowerCase().includes(q));
});

const copy = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

search();
</script>
