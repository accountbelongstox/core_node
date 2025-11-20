<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-random text-orange-500"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Network</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">Generation options</h3>
          <p class="text-xs text-slate-500">Optionally constrain vendor OUI.</p>
        </header>
        <div class="px-5 py-4 grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm text-slate-600">
            <span>Count</span>
            <input v-model.number="count" type="number" min="1" max="50" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-orange-500 focus:border-transparent">
          </label>
          <label class="space-y-1 text-sm text-slate-600">
            <span>Vendor OUI (optional)</span>
            <input v-model="vendor" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-orange-500 focus:border-transparent" placeholder="00:1B:63">
          </label>
          <label class="space-y-1 text-sm text-slate-600">
            <span>Separator</span>
            <select v-model="separator" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-orange-500 focus:border-transparent">
              <option value=":">Colon (:)</option>
              <option value="-">Dash (-)</option>
            </select>
          </label>
          <label class="flex items-center space-x-2 text-sm text-slate-600 mt-6">
            <input type="checkbox" v-model="uppercase" class="rounded text-orange-500 focus:ring-orange-500">
            <span>Uppercase output</span>
          </label>
        </div>
        <div class="px-5 pb-4 flex items-center justify-between">
          <button
            @click="generate"
            :disabled="!canGenerate"
            class="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium shadow hover:bg-orange-600 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-random mr-2"></i>
            Generate MACs
          </button>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Generated addresses</h3>
            <p class="text-xs text-slate-500">Click any item to copy.</p>
          </div>
          <div class="text-xs text-slate-500">
            {{ addresses.length }} results
          </div>
        </header>
        <div class="relative max-h-96 overflow-y-auto">
          <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <i class="fas fa-spinner fa-spin text-orange-500 text-xl"></i>
          </div>
          <ul>
            <li
              v-for="mac in addresses"
              :key="mac"
              class="px-5 py-3 border-b border-slate-100 font-mono text-sm hover:bg-orange-50 cursor-pointer"
              @click="copy(mac)"
            >
              {{ mac }}
            </li>
          </ul>
          <p v-if="!loading && addresses.length === 0" class="px-5 py-6 text-sm text-slate-500">No addresses yet.</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/network/mac/generate</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const count = ref(5);
const separator = ref<':' | '-'>(':');
const uppercase = ref(true);
const vendor = ref('');
const addresses = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const canGenerate = computed(() => count.value >= 1 && count.value <= 50 && !loading.value);

const generate = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  error.value = null;

  try {
    const response = await props.api.macGenerate(count.value, separator.value, uppercase.value, vendor.value.trim() || undefined);
    if (response.success && response.data?.addresses) {
      addresses.value = response.data.addresses;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Generation failed');
    }
  } catch (err: any) {
    error.value = err?.message || 'MAC generator unavailable';
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
