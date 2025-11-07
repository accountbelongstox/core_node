<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-red-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-scroll text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Converter</span>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition"
            title="Close"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm space-y-4 px-5 py-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Roman numeral</label>
            <input
              v-model="roman"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              placeholder="XIV"
            />
          </div>
          <p class="text-xs text-slate-500">Supports numerals from I to MMMCMXCIX (3999).</p>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Converted value</h3>
              <p class="text-xs text-slate-500">Roman numeral and Arabic value.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">{{ executionTime }} ms</span>
            </div>
          </header>
          <div class="relative px-5 py-4 space-y-3">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-amber-500 text-xl"></i>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p class="text-xs text-slate-500">Normalized Roman</p>
                <p class="text-lg font-semibold text-slate-800">{{ result?.roman || '—' }}</p>
              </div>
              <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p class="text-xs text-slate-500">Arabic value</p>
                <p class="text-lg font-semibold text-slate-800">{{ result?.arabic !== undefined ? result.arabic : '—' }}</p>
              </div>
            </div>
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          </div>
        </section>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="roman.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-exchange-alt mr-2"></i>
        Convert numeral
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/roman/to-arabic</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
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

const roman = ref('XIV');
const result = ref<{ roman: string; arabic: number } | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const convert = async () => {
  if (!roman.value.trim() || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.romanToArabic(roman.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      result.value = null;
      error.value = response.error || response.message || 'Conversion failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    result.value = null;
    error.value = err?.message || 'Roman numeral converter unavailable';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  convert();
});

</script>
