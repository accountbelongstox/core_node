<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-fuchsia-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-tachometer-alt text-fuchsia-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-fuchsia-100 text-fuchsia-700">Math</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Benchmark setup</h3>
            <p class="text-xs text-slate-500">Provide operation descriptor and sample payload.</p>
          </header>
          <div class="px-5 py-4 space-y-4">
            <label class="block text-sm text-slate-600">
              <span>Operation name</span>
              <input v-model="operation" type="text" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-fuchsia-500 focus:border-transparent" placeholder="sort">
            </label>
            <label class="block text-sm text-slate-600">
              <span>Iterations</span>
              <input v-model.number="iterations" type="number" min="1" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-fuchsia-500 focus:border-transparent" placeholder="10000">
            </label>
            <label class="block text-sm text-slate-600">
              <span>Data payload (JSON)</span>
              <textarea v-model="dataInput" rows="8" class="mt-2 w-full px-4 py-3 border border-slate-200 rounded-xl font-mono text-xs focus:ring-fuchsia-500 focus:border-transparent" placeholder="[3,1,4,1,5,9,2,6]" />
            </label>
            <button
              @click="run"
              :disabled="!canRun"
              class="w-full px-4 py-2 rounded-lg bg-fuchsia-600 text-white font-medium shadow hover:bg-fuchsia-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-play mr-2"></i>
              Run Benchmark
            </button>
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Results</h3>
              <p class="text-xs text-slate-500">Average/min/max timings per backend measurement.</p>
            </div>
            <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
          </header>
          <div class="relative">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <i class="fas fa-spinner fa-spin text-fuchsia-600 text-xl"></i>
            </div>
            <div class="grid gap-4 md:grid-cols-2 p-5">
              <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
                <p class="text-xs uppercase tracking-wide text-slate-500">Average</p>
                <p class="mt-2 text-lg font-semibold text-fuchsia-600">{{ formatted(result?.averageTime) }}</p>
              </article>
              <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
                <p class="text-xs uppercase tracking-wide text-slate-500">Min</p>
                <p class="mt-2 text-lg font-semibold text-slate-800">{{ formatted(result?.minTime) }}</p>
              </article>
              <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
                <p class="text-xs uppercase tracking-wide text-slate-500">Max</p>
                <p class="mt-2 text-lg font-semibold text-slate-800">{{ formatted(result?.maxTime) }}</p>
              </article>
              <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
                <p class="text-xs uppercase tracking-wide text-slate-500">Iterations</p>
                <p class="mt-2 text-lg font-semibold text-slate-800">{{ result?.iterations || '—' }}</p>
              </article>
            </div>
            <p v-if="!loading && !result" class="px-5 py-6 text-sm text-slate-500">Run a benchmark to view metrics.</p>
          </div>
        </section>
      </div>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/math/benchmark</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const operation = ref('sort');
const iterations = ref(10000);
const dataInput = ref('[3,1,4,1,5,9,2,6]');
const result = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canRun = computed(() => operation.value.trim().length > 0 && iterations.value > 0 && !loading.value);

const parseData = () => {
  if (!dataInput.value.trim()) return undefined;
  try {
    return JSON.parse(dataInput.value);
  } catch (err) {
    throw new Error('Data payload must be valid JSON');
  }
};

const formatted = (value?: number) => {
  if (value === undefined || value === null) return '—';
  if (result.value?.unit) return `${value.toFixed(4)} ${result.value.unit}`;
  return value.toFixed(4);
};

const run = async () => {
  if (!canRun.value) return;
  let data: any;
  try {
    data = parseData();
  } catch (err: any) {
    error.value = err.message;
    return;
  }

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.benchmark(operation.value.trim(), iterations.value, data);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Benchmark failed');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Benchmark service unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

</script>
