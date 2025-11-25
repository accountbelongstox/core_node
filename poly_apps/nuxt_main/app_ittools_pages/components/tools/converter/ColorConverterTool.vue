<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-palette text-rose-500"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">Converter</span>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Color input</label>
            <div class="flex items-center space-x-3">
              <input
                v-model="input"
                type="text"
                class="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                placeholder="#FF5733 or rgb(255, 87, 51)"
              />
              <input
                v-model="colorPicker"
                type="color"
                class="w-16 h-12 border border-slate-200 rounded-xl cursor-pointer"
                @input="input = colorPicker"
              />
            </div>
          </div>

          <p class="text-xs text-slate-500">Supports HEX, RGB, HSL, HSV, and CMYK inputs. Try any format and convert to the rest.</p>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Color preview</h3>
                <p class="text-xs text-slate-500">Preview updates to the converted HEX color.</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="px-5 py-4 space-y-4">
              <div class="h-32 rounded-xl border border-slate-200 shadow-inner" :style="previewStyle"></div>
              <div class="grid sm:grid-cols-2 gap-3">
                <div
                  v-for="variant in variants"
                  :key="variant.label"
                  class="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between"
                >
                  <div class="flex-1 mr-3">
                    <span class="text-xs text-slate-500">{{ variant.label }}</span>
                    <p class="font-mono text-sm text-slate-700 break-all mt-1">{{ result?.[variant.key] || '—' }}</p>
                  </div>
                  <button
                    class="text-xs text-rose-500 hover:text-rose-600"
                    :disabled="!(result && result[variant.key])"
                    @click="copyVariant(variant.key)"
                  >
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="input.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-fill-drip mr-2"></i>
        Convert color
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/color</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const input = ref('#FF5733');
const colorPicker = ref('#FF5733');
const result = ref<Record<string, string> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const previewStyle = computed(() => ({
  backgroundColor: result.value?.hex || '#f1f5f9'
}));

const variants = [
  { label: 'HEX', key: 'hex' },
  { label: 'RGB', key: 'rgb' },
  { label: 'HSL', key: 'hsl' },
  { label: 'HSV', key: 'hsv' },
  { label: 'CMYK', key: 'cmyk' }
];

const convert = async () => {
  if (!input.value.trim() || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.convertColor(input.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      if (response.data.hex) {
        colorPicker.value = response.data.hex;
      }
      emit('executed', response.data);
    } else {
      result.value = null;
      error.value = response.error || response.message || 'Conversion failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    result.value = null;
    error.value = err?.message || 'Color converter unavailable';
  } finally {
    loading.value = false;
  }
};

const copyVariant = async (key: string) => {
  if (!result.value || !result.value[key]) return;
  try {
    await navigator.clipboard.writeText(result.value[key]);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
