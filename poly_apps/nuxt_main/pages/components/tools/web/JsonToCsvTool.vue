<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-lime-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-file-csv text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">JSON Array Input</h3>
              <p class="text-xs text-slate-500">Supports arrays of flat objects.</p>
            </div>
            <button @click="useSample" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Sample</button>
          </header>
          <div class="px-5 py-4 space-y-4">
            <textarea
              v-model="jsonInput"
              rows="16"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder='[
  { "name": "Ada", "role": "Researcher" },
  { "name": "Alan", "role": "Engineer" }
]'
            ></textarea>
            <div class="flex items-center justify-between text-xs text-slate-600 gap-4">
              <label class="flex items-center space-x-2">
                <span>Delimiter</span>
                <select v-model="delimiter" class="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-amber-500 focus:border-transparent">
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="\t">Tab</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </label>
              <label class="flex items-center space-x-2">
                <input type="checkbox" v-model="includeHeaders" class="rounded text-amber-600 focus:ring-amber-500" />
                <span>Include headers</span>
              </label>
            </div>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">CSV Output</h3>
              <p class="text-xs text-slate-500">Copy or download the generated CSV.</p>
            </div>
            <div class="flex items-center space-x-3 text-xs text-slate-400">
              <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
              <span v-if="output">Rows: {{ rowCount }}</span>
            </div>
          </header>
          <div class="relative flex-1">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <i class="fas fa-spinner fa-spin text-amber-600 text-xl"></i>
            </div>
            <textarea
              v-model="output"
              readonly
              class="w-full h-full px-4 py-4 border-0 rounded-b-xl bg-slate-900 text-lime-200 font-mono text-xs"
            ></textarea>
          </div>
          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="convert"
              :disabled="!canConvert"
              class="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-file-export mr-2"></i>
              Convert to CSV
            </button>
            <div class="flex items-center space-x-2">
              <button
                @click="copyOutput"
                :disabled="!output"
                class="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy
              </button>
              <button
                @click="downloadCsv"
                :disabled="!output"
                class="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-download mr-1"></i>
                Download
              </button>
            </div>
          </footer>
        </section>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/converter/json-to-csv</code></span>
      <span v-if="output">{{ output.length }} chars</span>
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

const jsonInput = ref('[\n  { "name": "Alice", "age": 30 },\n  { "name": "Bob", "age": 28 }\n]');
const delimiter = ref(',');
const includeHeaders = ref(true);
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canConvert = computed(() => jsonInput.value.trim().length > 0 && !loading.value);
const rowCount = computed(() => {
  if (!output.value) return 0;
  return output.value.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
});

const convert = async () => {
  if (!canConvert.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.jsonToCsv(jsonInput.value, delimiter.value, includeHeaders.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.csv) {
      output.value = response.data.csv;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to convert JSON to CSV');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'JSON to CSV service unavailable';
    output.value = '';
  } finally {
    loading.value = false;
  }
};

const copyOutput = async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const downloadCsv = () => {
  if (!output.value) return;
  const blob = new Blob([output.value], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ittools-export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const useSample = () => {
  jsonInput.value = '[\n  { "id": 1, "product": "Keyboard", "price": 89.99 },\n  { "id": 2, "product": "Mouse", "price": 54.5 }\n]';
};

convert();
</script>
