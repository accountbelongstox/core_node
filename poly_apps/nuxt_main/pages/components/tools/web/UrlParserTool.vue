<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-blue-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-link text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">URL to inspect</h3>
            <p class="text-xs text-slate-500">Supports credentials, ports, fragments, and queries.</p>
          </div>
          <button @click="clear" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Clear</button>
        </header>
        <div class="px-5 py-4 space-y-3">
          <input
            v-model="urlInput"
            type="text"
            class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
            placeholder="https://user:pass@example.com:8080/path?query=value#hash"
          >
          <div class="flex items-center justify-between text-xs text-slate-500">
            <span>{{ urlInput.length }} chars</span>
            <button
              @click="parse"
              :disabled="!canParse"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-search mr-2"></i>
              Analyze URL
            </button>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Parsed components</h3>
            <p class="text-xs text-slate-500">Copy individual fields for debugging or documentation.</p>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-400">
            <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
            <span v-if="result">{{ Object.keys(result).length }} attributes</span>
          </div>
        </header>
        <div class="relative">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-blue-600 text-xl"></i>
          </div>
          <div v-if="parsedEntries.length" class="divide-y divide-slate-100">
            <article v-for="entry in parsedEntries" :key="entry.key" class="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-wide text-slate-400">{{ entry.key }}</p>
                <p class="text-sm font-semibold text-slate-800 break-all">{{ entry.value }}</p>
              </div>
              <button
                @click="copy(entry.value)"
                class="self-start sm:self-auto px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy
              </button>
            </article>
          </div>
          <p v-else class="px-5 py-6 text-sm text-slate-500">Enter a URL above to view its parsed segments.</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/text/url/parse</code></span>
      <span v-if="result">Origin: {{ result.origin }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const urlInput = ref('https://user:pass@example.com:8080/docs?tab=overview#intro');
const result = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canParse = computed(() => urlInput.value.trim().length > 0 && !loading.value);

const parsedEntries = computed(() => {
  if (!result.value) return [] as Array<{ key: string; value: string }>;
  return Object.entries(result.value)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, value: String(value) }));
});

const parse = async () => {
  if (!canParse.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.parseUrl(urlInput.value.trim());
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to parse URL');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'URL parser service unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

const clear = () => {
  urlInput.value = '';
  result.value = null;
  executionTime.value = null;
  error.value = null;
};

const copy = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

parse();
</script>
