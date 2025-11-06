<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-sky-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-code text-emerald-600"></i>
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
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">JSON Input</h3>
                <p class="text-xs text-slate-500">Paste raw JSON or drag a file.</p>
              </div>
              <button @click="clear" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Reset</button>
            </header>
            <div class="px-5 py-4 space-y-3">
              <textarea
                v-model="jsonInput"
                rows="12"
                class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder='{ "name": "Ada Lovelace", "skills": ["math", "poetry"] }'
              ></textarea>
              <label class="flex items-center justify-between text-xs text-slate-600">
                <span>Indent spaces</span>
                <select v-model.number="indent" class="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-emerald-500 focus:border-transparent">
                  <option :value="2">2</option>
                  <option :value="4">4</option>
                  <option :value="6">6</option>
                  <option :value="8">8</option>
                </select>
              </label>
            </div>
          </section>

          <div class="flex items-center justify-between">
            <button
              @click="prettify"
              :disabled="!canPrettify"
              class="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-magic mr-2"></i>
              Prettify JSON
            </button>
          </div>
          <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
        </div>

        <div class="lg:col-span-3">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm min-h-[24rem] flex flex-col">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Formatted Output</h3>
                <p class="text-xs text-slate-500">Copy or download prettified JSON.</p>
              </div>
              <div class="flex items-center space-x-3 text-xs text-slate-400">
                <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
                <button
                  @click="copyOutput"
                  :disabled="!output"
                  class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <i class="fas fa-copy mr-1"></i>Copy
                </button>
              </div>
            </header>
            <div class="relative flex-1">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                <i class="fas fa-spinner fa-spin text-emerald-600 text-xl"></i>
              </div>
              <textarea
                v-model="output"
                readonly
                class="w-full h-full px-4 py-4 border-0 rounded-b-xl bg-slate-900 text-emerald-300 font-mono text-xs"
              ></textarea>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-500">
      <span>Endpoint: <code class="text-slate-700">/web/json/prettify</code></span>
      <span>{{ output ? 'Length: ' + output.length + ' chars' : 'Awaiting conversion' }}</span>
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
  "name": "Grace Hopper",
  "roles": ["engineer", "navy"],
  "active": true
}');
const indent = ref(2);
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canPrettify = computed(() => jsonInput.value.trim().length > 0 && !loading.value);

const prettify = async () => {
  if (!canPrettify.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.jsonPrettify(jsonInput.value, indent.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      output.value = response.data.prettified || response.data.formatted || response.data.json || JSON.stringify(response.data, null, 2);
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to format JSON');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'JSON prettify service unavailable';
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

prettify();
</script>
