<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-infinity text-purple-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Network</span>
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
            <h3 class="text-sm font-semibold text-slate-700">Generator options</h3>
            <p class="text-xs text-slate-500">ULAs follow RFC 4193 fd00::/8 block.</p>
          </div>
          <div class="flex items-center space-x-3">
            <label class="flex items-center space-x-2 text-sm text-slate-600">
              <span>Count</span>
              <input v-model.number="count" type="number" min="1" max="32" class="w-20 px-2 py-2 border border-slate-200 rounded-lg focus:ring-purple-500 focus:border-transparent">
            </label>
            <button
              @click="generate"
              :disabled="!canGenerate"
              class="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium shadow hover:bg-purple-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-bolt mr-2"></i>
              Generate
            </button>
          </div>
        </header>
        <p v-if="error" class="px-5 py-3 text-sm text-red-600">{{ error }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Generated ULAs</h3>
            <p class="text-xs text-slate-500">Tap to copy; includes /48 prefix.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="relative max-h-96 overflow-y-auto">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-purple-600 text-xl"></i>
          </div>
          <ul>
            <li
              v-for="address in addresses"
              :key="address"
              class="px-5 py-3 border-b border-slate-100 font-mono text-sm hover:bg-purple-50 cursor-pointer"
              @click="copy(address)"
            >
              {{ address }}
            </li>
          </ul>
          <p v-if="!loading && addresses.length === 0" class="px-5 py-6 text-sm text-slate-500">Run generator to view addresses.</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/ipv6/ula</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const count = ref(3);
const addresses = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canGenerate = computed(() => count.value > 0 && count.value <= 32 && !loading.value);

const generate = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.ipv6GenerateUla(count.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      addresses.value = response.data.addresses || [];
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to generate ULA');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'IPv6 generator unavailable';
    addresses.value = [];
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

generate();
</script>
