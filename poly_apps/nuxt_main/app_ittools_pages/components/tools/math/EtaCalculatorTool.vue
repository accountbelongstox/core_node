<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-teal-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-hourglass-half text-teal-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">Math</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">Progress snapshot</h3>
          <p class="text-xs text-slate-500">Estimate completion times for long-running tasks.</p>
        </header>
        <div class="px-5 py-4 grid md:grid-cols-2 gap-4">
          <label class="block text-sm text-slate-600">
            <span>Total items</span>
            <input v-model.number="totalItems" type="number" min="1" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-teal-500 focus:border-transparent" placeholder="1000">
          </label>
          <label class="block text-sm text-slate-600">
            <span>Completed items</span>
            <input v-model.number="completedItems" type="number" min="0" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-teal-500 focus:border-transparent" placeholder="250">
          </label>
          <label class="block text-sm text-slate-600">
            <span>Elapsed time (seconds)</span>
            <input v-model.number="elapsedTime" type="number" min="1" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-teal-500 focus:border-transparent" placeholder="3600">
          </label>
          <label class="block text-sm text-slate-600">
            <span>Time unit</span>
            <select v-model="unit" class="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-teal-500 focus:border-transparent">
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </label>
        </div>
        <div class="px-5 pb-4">
          <button
            @click="calculate"
            :disabled="!canCalculate"
            class="w-full px-4 py-2 rounded-lg bg-teal-600 text-white font-medium shadow hover:bg-teal-700 disabled:opacity-60"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
            <i v-else class="fas fa-chart-line mr-2"></i>
            Calculate ETA
          </button>
        </div>
        <p v-if="error" class="px-5 pb-4 text-sm text-red-600">{{ error }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Estimates</h3>
            <p class="text-xs text-slate-500">Remaining time and projected completion.</p>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
        </header>
        <div class="grid gap-4 md:grid-cols-3 p-5">
          <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p class="text-xs uppercase tracking-wide text-slate-500">Remaining</p>
            <p class="mt-2 text-lg font-semibold text-teal-600">{{ formattedRemaining }}</p>
          </article>
          <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p class="text-xs uppercase tracking-wide text-slate-500">ETA Timestamp</p>
            <p class="mt-2 text-sm font-semibold text-slate-800">{{ etaResult?.estimatedCompletion || '—' }}</p>
          </article>
          <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p class="text-xs uppercase tracking-wide text-slate-500">Throughput</p>
            <p class="mt-2 text-sm font-semibold text-slate-800">{{ throughput }}</p>
          </article>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/math/eta</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const totalItems = ref(1000);
const completedItems = ref(250);
const elapsedTime = ref(3600);
const unit = ref<'seconds' | 'minutes' | 'hours'>('seconds');
const etaResult = ref<Record<string, any> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canCalculate = computed(() => totalItems.value > 0 && completedItems.value >= 0 && elapsedTime.value > 0 && completedItems.value <= totalItems.value && !loading.value);

const formattedRemaining = computed(() => {
  if (!etaResult.value?.remainingTime) return '—';
  const seconds = etaResult.value.remainingTime;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [] as string[];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
});

const throughput = computed(() => {
  if (!etaResult.value?.itemsPerSecond) return '—';
  return `${etaResult.value.itemsPerSecond.toFixed(2)} items/s`;
});

const calculate = async () => {
  if (!canCalculate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.calculateEta(totalItems.value, completedItems.value, elapsedTime.value, unit.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      etaResult.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to calculate ETA');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'ETA service unavailable';
    etaResult.value = null;
  } finally {
    loading.value = false;
  }
};

calculate();
</script>
