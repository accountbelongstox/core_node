<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-project-diagram text-emerald-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Network</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Network input</h3>
            <p class="text-xs text-slate-500">Provide base IP and CIDR prefix length.</p>
          </div>
          <div class="flex items-center space-x-3 text-sm text-slate-600">
            <input v-model="ip" type="text" class="px-4 py-2 border border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-transparent" placeholder="192.168.1.0">
            <label class="flex items-center space-x-2">
              <span>/</span>
              <input v-model.number="cidr" type="number" min="1" max="32" class="w-16 px-2 py-2 border border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-transparent">
            </label>
            <button
              @click="calculate"
              :disabled="!canCalculate"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-equals mr-2"></i>
              Calculate
            </button>
          </div>
        </header>
        <p v-if="error" class="px-5 py-3 text-sm text-red-600">{{ error }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Subnet summary</h3>
            <p class="text-xs text-slate-500">Key properties of the calculated network.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="relative">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-emerald-600 text-xl"></i>
          </div>
          <div class="grid gap-4 md:grid-cols-3 p-5">
            <article v-for="field in fields" :key="field.key" class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-semibold">{{ field.label }}</p>
              <p class="mt-2 text-sm font-mono break-all text-slate-800">{{ field.value || '—' }}</p>
            </article>
          </div>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/ipv4/subnet</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const ip = ref('192.168.1.0');
const cidr = ref(24);
const result = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canCalculate = computed(() => ip.value.trim().length > 0 && cidr.value >= 1 && cidr.value <= 32 && !loading.value);

const fields = computed(() => {
  const data = result.value || {};
  return [
    { key: 'networkAddress', label: 'Network Address', value: data.networkAddress },
    { key: 'broadcastAddress', label: 'Broadcast Address', value: data.broadcastAddress },
    { key: 'subnetMask', label: 'Subnet Mask', value: data.subnetMask },
    { key: 'wildcard', label: 'Wildcard Mask', value: data.wildcard },
    { key: 'firstHost', label: 'First Host', value: data.firstHost },
    { key: 'lastHost', label: 'Last Host', value: data.lastHost },
    { key: 'hostCount', label: 'Host Count', value: data.hostCount?.toString?.() },
    { key: 'ipClass', label: 'IP Class', value: data.ipClass },
    { key: 'cidr', label: 'CIDR', value: data.cidr ? `/${data.cidr}` : `/${cidr.value}` }
  ];
});

const calculate = async () => {
  if (!canCalculate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.ipv4Subnet(ip.value.trim(), cidr.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to calculate subnet');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Subnet calculator unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

calculate();
</script>
