<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-network-wired text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Network</span>
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
            <h3 class="text-sm font-semibold text-slate-700">IPv4 address</h3>
            <p class="text-xs text-slate-500">Enter dotted decimal IPv4 address.</p>
          </div>
          <button
            @click="convert"
            :disabled="!canConvert"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-random mr-2"></i>
            Convert
          </button>
        </header>
        <div class="px-5 py-4 space-y-3">
          <input
            v-model="ip"
            type="text"
            class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="192.168.1.1"
          >
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Representations</h3>
            <p class="text-xs text-slate-500">Copy format variants for docs or tooling.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="relative">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-blue-600 text-xl"></i>
          </div>
          <div class="grid md:grid-cols-2 gap-4 p-5">
            <article
              v-for="row in rows"
              :key="row.label"
              class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50"
            >
              <div class="flex items-center justify-between">
                <p class="text-xs uppercase tracking-wide text-slate-500 font-semibold">{{ row.label }}</p>
                <button @click="copy(row.value)" :disabled="!row.value" class="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
              <p class="mt-2 text-sm font-mono break-all text-slate-800">{{ row.value || '—' }}</p>
            </article>
          </div>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/ipv4/convert</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const ip = ref('192.168.1.1');
const result = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canConvert = computed(() => ip.value.trim().length > 0 && !loading.value);

const rows = computed(() => {
  return [
    { label: 'Dotted', value: result.value?.dotted || result.value?.ip },
    { label: 'Binary', value: result.value?.binary },
    { label: 'Hexadecimal', value: result.value?.hexadecimal || result.value?.hex },
    { label: 'Decimal', value: result.value?.decimal?.toString?.() }
  ];
});

const convert = async () => {
  if (!canConvert.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.ipv4Convert(ip.value.trim(), 'all');
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Conversion failed');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'IPv4 converter unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

const copy = async (value?: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

convert();
</script>
