<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-sky-50 to-cyan-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-thermometer-half text-cyan-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-700">Converter</span>
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
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Value</label>
            <input
              v-model.number="value"
              type="number"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">From unit</label>
            <select
              v-model="from"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
            >
              <option value="celsius">Celsius (°C)</option>
              <option value="fahrenheit">Fahrenheit (°F)</option>
              <option value="kelvin">Kelvin (K)</option>
            </select>
          </div>

          <p class="text-xs text-slate-500">Conversions provide results in Celsius, Fahrenheit, and Kelvin simultaneously.</p>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Converted values</h3>
                <p class="text-xs text-slate-500">Temperatures rounded to two decimals.</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="px-5 py-4">
              <div class="grid sm:grid-cols-3 gap-3">
                <TempCard label="Celsius" unit="°C" :value="result?.celsius" />
                <TempCard label="Fahrenheit" unit="°F" :value="result?.fahrenheit" />
                <TempCard label="Kelvin" unit="K" :value="result?.kelvin" />
              </div>
              <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="loading"
        class="px-5 py-2 rounded-lg bg-cyan-500 text-white font-medium shadow hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-exchange-alt mr-2"></i>
        Convert temperature
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/temperature</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, onMounted } from 'vue';
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

const value = ref(0);
const from = ref<'celsius' | 'fahrenheit' | 'kelvin'>('celsius');
const result = ref<Record<string, number> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const convert = async () => {
  if (loading.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.convertTemperature(value.value, from.value);
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
    error.value = err?.message || 'Temperature service unavailable';
  } finally {
    loading.value = false;
  }
};

const TempCard = defineComponent({
  name: 'TempCard',
  props: {
    label: { type: String, required: true },
    unit: { type: String, required: true },
    value: { type: Number, default: null }
  },
  setup(props) {
    const displayValue = computed(() => {
      if (props.value === null || props.value === undefined) {
        return '—';
      }
      return `${props.value.toFixed(2)} ${props.unit}`;
    });

    return () => (
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
        <p class="text-xs text-slate-500">{props.label}</p>
        <p class="text-lg font-semibold text-slate-800">{displayValue.value}</p>
      </div>
    );
  }
});

onMounted(() => {
  convert();
});

</script>
