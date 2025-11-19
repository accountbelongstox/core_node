<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-fuchsia-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-text-height text-purple-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Converter</span>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Input text</label>
            <textarea
              v-model="input"
              rows="5"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              placeholder="Enter text to convert to different cases"
            ></textarea>
          </div>
          <p class="text-xs text-slate-500">Convert phrases to camelCase, PascalCase, snake_case, kebab-case, and more.</p>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Converted cases</h3>
                <p class="text-xs text-slate-500">Copy any variant for code or text usage.</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="px-5 py-4">
              <div class="grid sm:grid-cols-2 gap-3">
                <div
                  v-for="variant in variants"
                  :key="variant.key"
                  class="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between"
                >
                  <div class="flex-1 mr-3">
                    <div class="text-xs text-slate-500 flex items-center space-x-2">
                      <i :class="['fas', variant.icon]"></i>
                      <span>{{ variant.label }}</span>
                    </div>
                    <p class="font-mono text-sm text-slate-700 break-all mt-1">{{ result?.[variant.key] || '—' }}</p>
                  </div>
                  <button
                    class="text-xs text-purple-500 hover:text-purple-600"
                    :disabled="!(result && result[variant.key])"
                    @click="copyVariant(variant.key)"
                  >
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
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
        :disabled="input.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-purple-500 text-white font-medium shadow hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-sync-alt mr-2"></i>
        Convert cases
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/case</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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

const input = ref('');
const loading = ref(false);
const result = ref<Record<string, string> | null>(null);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const convert = async () => {
  if (!input.value.trim() || loading.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.convertCase(input.value);
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
    error.value = err?.message || 'Case converter unavailable';
  } finally {
    loading.value = false;
  }
};

const variants = [
  { label: 'camelCase', key: 'camelCase', icon: 'fa-wave-square' },
  { label: 'PascalCase', key: 'PascalCase', icon: 'fa-heading' },
  { label: 'snake_case', key: 'snake_case', icon: 'fa-ellipsis-h' },
  { label: 'kebab-case', key: 'kebab-case', icon: 'fa-minus' },
  { label: 'SCREAMING_SNAKE_CASE', key: 'SCREAMING_SNAKE_CASE', icon: 'fa-volume-up' },
  { label: 'Title Case', key: 'Title Case', icon: 'fa-font' }
];

const copyVariant = async (variantKey: string) => {
  if (!result.value || !result.value[variantKey]) return;
  try {
    await navigator.clipboard.writeText(result.value[variantKey]);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

onMounted(() => {
  convert();
});

</script>
