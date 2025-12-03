<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-percent text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Math</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">Scenario</h3>
          <p class="text-xs text-slate-500">Choose calculation type and fill values.</p>
        </header>
        <div class="px-5 py-4 space-y-4">
          <label class="block text-sm text-slate-600">
            <span class="font-semibold">Operation</span>
            <select v-model="operation" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-transparent">
              <option value="percent_of">What is X% of Y?</option>
              <option value="what_percent">X is what percent of Y?</option>
              <option value="percentage_change">Percentage change from X to Y</option>
            </select>
          </label>
          <div class="grid md:grid-cols-2 gap-4">
            <label class="block text-sm text-slate-600">
              <span class="font-semibold">Value 1</span>
              <input v-model.number="value1" type="number" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-transparent" placeholder="e.g. 20">
            </label>
            <label class="block text-sm text-slate-600">
              <span class="font-semibold">Value 2</span>
              <input v-model.number="value2" type="number" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-transparent" placeholder="e.g. 100">
            </label>
          </div>
          <button
            @click="calculate"
            :disabled="!canCalculate"
            class="w-full px-4 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-equals mr-2"></i>
            Calculate
          </button>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Result</h3>
            <p class="text-xs text-slate-500">Detailed breakdown with formula.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="px-5 py-4 space-y-3">
          <p v-if="result" class="text-2xl font-semibold text-amber-600">{{ result.result }}</p>
          <p v-if="result?.formula" class="text-sm text-slate-600 font-mono">{{ result.formula }}</p>
          <p v-if="!result" class="text-sm text-slate-500">Run a calculation to view the outcome.</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/math/percentage</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const operation = ref<'percent_of' | 'what_percent' | 'percentage_change'>('percent_of');
const value1 = ref<number | null>(20);
const value2 = ref<number | null>(100);
const result = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canCalculate = computed(() => value1.value !== null && value2.value !== null && !loading.value);

const calculate = async () => {
  if (!canCalculate.value || value1.value === null || value2.value === null) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.calculatePercentage(operation.value, value1.value, value2.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Calculation failed');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Percentage service unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

calculate();
</script>
