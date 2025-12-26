<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-teal-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-globe text-teal-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">Network</span>
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
            <h3 class="text-sm font-semibold text-slate-700">User agent string</h3>
            <p class="text-xs text-slate-500">Paste browser UA or capture from HTTP headers.</p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              @click="useSample('desktop')"
              class="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
            >Desktop sample</button>
            <button
              @click="useSample('mobile')"
              class="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
            >Mobile sample</button>
            <button
              @click="parse"
              :disabled="!canParse"
              class="px-4 py-2 rounded-lg bg-teal-600 text-white font-medium shadow hover:bg-teal-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-search mr-2"></i>
              Analyze
            </button>
          </div>
        </header>
        <textarea
          v-model="userAgent"
          rows="6"
          class="w-full px-4 py-3 border-0 rounded-b-xl font-mono text-xs bg-slate-900 text-teal-100 focus:outline-none"
        ></textarea>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Parsed attributes</h3>
            <p class="text-xs text-slate-500">High-level summary of browser, OS, engine, and platform.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="relative">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-teal-600 text-xl"></i>
          </div>
          <div class="grid gap-4 md:grid-cols-3 p-5">
            <div v-for="card in cards" :key="card.label" class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-semibold">{{ card.label }}</p>
              <p class="mt-2 text-sm font-semibold text-slate-800">{{ card.value || '—' }}</p>
              <p class="text-xs text-slate-400" v-if="card.helper">{{ card.helper }}</p>
            </div>
          </div>
          <p v-if="error" class="px-5 pb-5 text-sm text-red-600">{{ error }}</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/user-agent/parse</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const desktopUA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const mobileUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const userAgent = ref(desktopUA);
const parsed = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canParse = computed(() => userAgent.value.trim().length > 0 && !loading.value);

const cards = computed(() => {
  return [
    { label: 'Browser', value: parsed.value?.browser, helper: parsed.value?.version ? `v${parsed.value.version}` : null },
    { label: 'Operating System', value: parsed.value?.os, helper: parsed.value?.osVersion },
    { label: 'Device', value: parsed.value?.platform || parsed.value?.device, helper: parsed.value?.type },
    { label: 'Engine', value: parsed.value?.engine },
    { label: 'User Agent', value: parsed.value?.ua || parsed.value?.userAgent },
    { label: 'Bot', value: parsed.value?.bot ? 'Likely Bot' : 'Human' }
  ];
});

const parse = async () => {
  if (!canParse.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.parseUserAgent(userAgent.value.trim());
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      parsed.value = { ua: userAgent.value.trim(), ...response.data };
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to parse user agent');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'User agent service unavailable';
    parsed.value = null;
  } finally {
    loading.value = false;
  }
};

const useSample = (type: 'desktop' | 'mobile') => {
  userAgent.value = type === 'desktop' ? desktopUA : mobileUA;
  parse();
};

parse();
</script>
