<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-stream text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Network</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">IP range</h3>
          <p class="text-xs text-slate-500">Expand start-end notation into individual addresses.</p>
        </header>
        <div class="px-5 py-4 grid gap-4 md:grid-cols-2">
          <input v-model="start" type="text" class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-transparent" placeholder="Start IP e.g. 10.0.0.1">
          <input v-model="end" type="text" class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-transparent" placeholder="End IP e.g. 10.0.0.10">
        </div>
        <div class="px-5 pb-4 flex items-center justify-between">
          <p class="text-xs text-slate-500">Range string: <code class="text-slate-700">{{ rangeString || '—' }}</code></p>
          <button
            @click="expand"
            :disabled="!canExpand"
            class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-list mr-2"></i>
            Expand Range
          </button>
        </div>
        <p v-if="error" class="px-5 pb-4 text-sm text-red-600">{{ error }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Generated addresses</h3>
            <p class="text-xs text-slate-500">Click any row to copy.</p>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-500">
            <span>{{ results.length }} IPs</span>
            <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
          </div>
        </header>
        <div class="relative max-h-96 overflow-y-auto">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-indigo-600 text-xl"></i>
          </div>
          <ul>
            <li
              v-for="ipAddress in results"
              :key="ipAddress"
              class="px-5 py-3 border-b border-slate-100 text-sm font-mono hover:bg-indigo-50 cursor-pointer"
              @click="copy(ipAddress)"
            >
              {{ ipAddress }}
            </li>
          </ul>
          <p v-if="!loading && results.length === 0" class="px-5 py-6 text-sm text-slate-500">Results will appear here.</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/ipv4/expand</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const start = ref('192.168.1.1');
const end = ref('192.168.1.5');
const results = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canExpand = computed(() => start.value.trim().length > 0 && end.value.trim().length > 0 && !loading.value);
const rangeString = computed(() => {
  if (!start.value || !end.value) return '';
  return `${start.value.trim()}-${end.value.trim()}`;
});

const expand = async () => {
  if (!canExpand.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const startTime = performance.now();

  try {
    const response = await props.api.ipv4Expand(rangeString.value);
    executionTime.value = Math.round(performance.now() - startTime);
    if (response.success && response.data) {
      results.value = response.data.ips || [];
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to expand range');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - startTime);
    error.value = err?.message || 'Range expander unavailable';
    results.value = [];
  } finally {
    loading.value = false;
  }
};

const copy = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

expand();
</script>
