<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-calculator text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Math</span>
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
            <h3 class="text-sm font-semibold text-slate-700">Expression</h3>
            <p class="text-xs text-slate-500">Supports +, -, *, /, ^, parentheses, and common functions.</p>
          </div>
          <button
            @click="evaluate"
            :disabled="!canEvaluate"
            class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-equals mr-2"></i>
            Evaluate
          </button>
        </header>
        <div class="px-5 py-4 space-y-3">
          <input
            v-model="expression"
            type="text"
            class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            placeholder="2 * (5 + 3)"
          >
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Result</h3>
            <p class="text-xs text-slate-500">Exact numeric output.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="px-5 py-4">
          <p class="text-3xl font-semibold text-indigo-600" v-if="result !== null">{{ result }}</p>
          <p v-else class="text-sm text-slate-500">Run an evaluation to see the answer.</p>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/math/evaluate</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const expression = ref('2 * (5 + 3)');
const result = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canEvaluate = computed(() => expression.value.trim().length > 0 && !loading.value);

const evaluate = async () => {
  if (!canEvaluate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.evaluateExpression(expression.value.trim());
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data.result;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Evaluation failed');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Math service unavailable';
    result.value = null;
  } finally {
    loading.value = false;
  }
};

evaluate();
</script>
