<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-cyan-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-compress-alt text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Web</span>
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
              <h3 class="text-sm font-semibold text-slate-700">Formatted JSON</h3>
              <p class="text-xs text-slate-500">Paste pretty JSON to compress the payload.</p>
            </div>
            <button @click="clear" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Clear</button>
          </header>
          <div class="px-5 py-4">
            <textarea
              v-model="jsonInput"
              rows="18"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder='{
  "user": {
    "id": 42,
    "roles": ["admin", "editor"]
  }
}'
            ></textarea>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Minified Output</h3>
              <p class="text-xs text-slate-500">Ideal for transport or embedding.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <span v-if="sizeSavings" class="font-semibold text-emerald-600">↓ {{ sizeSavings }}</span>
              <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
            </div>
          </header>
          <div class="relative flex-1">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <i class="fas fa-spinner fa-spin text-indigo-600 text-xl"></i>
            </div>
            <textarea
              v-model="output"
              readonly
              class="w-full h-full px-4 py-4 border-0 rounded-b-xl bg-slate-900 text-cyan-200 font-mono text-xs"
            ></textarea>
          </div>
          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="minify"
              :disabled="!canMinify"
              class="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-compress mr-2"></i>
              Minify JSON
            </button>
            <button
              @click="copyOutput"
              :disabled="!output"
              class="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <i class="fas fa-copy mr-1"></i>
              Copy
            </button>
          </footer>
        </section>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/web/json/minify</code></span>
      <span v-if="output">{{ output.length }} chars</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const jsonInput = ref('{
  "products": [
    { "id": 1, "name": "Laptop", "price": 1299 },
    { "id": 2, "name": "Monitor", "price": 399 }
  ]
}');
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canMinify = computed(() => jsonInput.value.trim().length > 0 && !loading.value);
const sizeSavings = computed(() => {
  if (!output.value) return '';
  const original = jsonInput.value.length;
  const compressed = output.value.length;
  if (!original) return '';
  const delta = original - compressed;
  const pct = ((delta / original) * 100).toFixed(1);
  return `${delta} chars (${pct}%)`;
});

const minify = async () => {
  if (!canMinify.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.jsonMinify(jsonInput.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      output.value = response.data.minified || response.data.compact || response.data.json || '';
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to minify JSON');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'JSON minify service unavailable';
    output.value = '';
  } finally {
    loading.value = false;
  }
};

const clear = () => {
  jsonInput.value = '';
  output.value = '';
  error.value = null;
  executionTime.value = null;
};

const copyOutput = async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

minify();
</script>
