<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-rose-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-code-branch text-purple-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-5">
      <div class="grid gap-5 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500">Baseline</p>
              <h3 class="text-sm font-semibold text-slate-700">JSON A</h3>
            </div>
            <button @click="jsonA = defaultA" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Sample</button>
          </header>
          <textarea
            v-model="jsonA"
            rows="16"
            class="w-full px-4 py-3 border-0 rounded-b-xl font-mono text-xs bg-slate-900 text-purple-100 focus:outline-none"
          ></textarea>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500">Candidate</p>
              <h3 class="text-sm font-semibold text-slate-700">JSON B</h3>
            </div>
            <button @click="jsonB = defaultB" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Sample</button>
          </header>
          <textarea
            v-model="jsonB"
            rows="16"
            class="w-full px-4 py-3 border-0 rounded-b-xl font-mono text-xs bg-slate-900 text-rose-100 focus:outline-none"
          ></textarea>
        </section>
      </div>

      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center space-x-4 text-sm text-slate-600">
          <span><i class="fas fa-equals mr-1 text-slate-400"></i>Matches: {{ matchesLabel }}</span>
          <span><i class="fas fa-exclamation-triangle mr-1 text-amber-500"></i>Differences: {{ differences.length }}</span>
        </div>
        <div class="flex items-center space-x-3">
          <button @click="swap" class="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <i class="fas fa-exchange-alt mr-2"></i>
            Swap JSON
          </button>
          <button
            @click="compare"
            :disabled="!canCompare"
            class="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium shadow hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-search-minus mr-2"></i>
            Compare JSON
          </button>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Differences</h3>
            <p class="text-xs text-slate-500">Only changes reported by the backend are shown below.</p>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-400">
            <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
            <span v-if="results?.hasDifferences" class="text-rose-500 font-semibold">Changes detected</span>
            <span v-else-if="results" class="text-emerald-600 font-semibold">Identical</span>
          </div>
        </header>
        <div class="relative">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-purple-600 text-xl"></i>
          </div>
          <div class="divide-y divide-slate-100" v-if="differences.length">
            <article
              v-for="(diff, idx) in differences"
              :key="idx"
              class="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
            >
              <div>
                <p class="text-xs uppercase tracking-wide text-slate-400">{{ diff.type }}</p>
                <p class="text-sm font-semibold text-slate-800">{{ diff.path || '(root)' }}</p>
                <p class="text-xs text-slate-500">{{ summarize(diff) }}</p>
              </div>
              <div class="text-xs font-mono text-slate-600 space-y-1 w-full lg:w-1/2">
                <p v-if="diff.oldValue !== undefined" class="bg-rose-50 border border-rose-100 rounded px-3 py-2">Old: {{ stringify(diff.oldValue) }}</p>
                <p v-if="diff.newValue !== undefined" class="bg-emerald-50 border border-emerald-100 rounded px-3 py-2">New: {{ stringify(diff.newValue) }}</p>
              </div>
            </article>
          </div>
          <p v-else class="px-5 py-6 text-sm text-slate-500">No differences to display. Run a comparison to inspect the JSON payloads.</p>
        </div>
      </section>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/web/json/diff</code></span>
      <span v-if="results">Status: {{ results.hasDifferences ? 'Modified' : 'Identical' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const defaultA = '{\n  "id": 101,\n  "name": "Service",\n  "version": 1\n}';
const defaultB = '{\n  "id": 101,\n  "name": "Service",\n  "version": 2,\n  "status": "beta"\n}';

const jsonA = ref(defaultA);
const jsonB = ref(defaultB);
const differences = ref<any[]>([]);
const results = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canCompare = computed(() => jsonA.value.trim().length > 0 && jsonB.value.trim().length > 0 && !loading.value);
const matchesLabel = computed(() => {
  if (!results.value) return 'Unknown';
  return results.value.hasDifferences ? 'Partial' : 'Exact';
});

const compare = async () => {
  if (!canCompare.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.jsonDiff(jsonA.value, jsonB.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      differences.value = response.data.differences || [];
      results.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to diff JSON payloads');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'JSON diff service unavailable';
    differences.value = [];
    results.value = null;
  } finally {
    loading.value = false;
  }
};

const swap = () => {
  const temp = jsonA.value;
  jsonA.value = jsonB.value;
  jsonB.value = temp;
  differences.value = [];
  results.value = null;
  error.value = null;
};

const summarize = (diff: any) => {
  if (!diff) return '';
  switch (diff.type) {
    case 'added':
      return 'Field added in JSON B';
    case 'removed':
      return 'Field removed in JSON B';
    case 'modified':
      return 'Value changed between payloads';
    default:
      return diff.type || 'Change detected';
  }
};

const stringify = (value: any) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
};

compare();
</script>
