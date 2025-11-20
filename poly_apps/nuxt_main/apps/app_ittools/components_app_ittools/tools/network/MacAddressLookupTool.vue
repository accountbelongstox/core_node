<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-rose-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-search text-rose-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">Network</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">Query</h3>
          <p class="text-xs text-slate-500">Accepts colon, dash, or plain formats.</p>
        </header>
        <div class="px-5 py-4 flex items-center space-x-3">
          <input
            v-model="mac"
            type="text"
            class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-rose-500 focus:border-transparent"
            placeholder="00:1B:63:84:45:E6"
          >
          <button
            @click="lookup"
            :disabled="!canLookup"
            class="px-4 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-search mr-2"></i>
            Lookup
          </button>
        </div>
        <p v-if="error" class="px-5 pb-4 text-sm text-red-600">{{ error }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Vendor details</h3>
            <p class="text-xs text-slate-500">Information is sourced from backend OUI database.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="relative">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-rose-500 text-xl"></i>
          </div>
          <dl class="grid md:grid-cols-3 gap-4 p-5">
            <div class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
              <dt class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Vendor</dt>
              <dd class="mt-2 text-sm text-slate-800">{{ result?.vendor || '—' }}</dd>
            </div>
            <div class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
              <dt class="text-xs uppercase tracking-wide text-slate-500 font-semibold">OUI Prefix</dt>
              <dd class="mt-2 text-sm text-slate-800 font-mono">{{ result?.prefix || '—' }}</dd>
            </div>
            <div class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
              <dt class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Country</dt>
              <dd class="mt-2 text-sm text-slate-800">{{ result?.country || '—' }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/mac/lookup</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const mac = ref('00:1B:63:84:45:E6');
const result = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canLookup = computed(() => mac.value.trim().length > 0 && !loading.value);

const lookup = async () => {
  if (!canLookup.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.macLookup(mac.value.trim());
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Lookup failed');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'MAC lookup service unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

lookup();
</script>
