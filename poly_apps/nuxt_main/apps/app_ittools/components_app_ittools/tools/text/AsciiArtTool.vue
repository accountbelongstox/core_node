<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-800 to-slate-900">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-terminal text-green-400"></i>
            <h2 class="text-2xl font-semibold text-white">ASCII Art Generator</h2>
          </div>
          <p class="text-sm text-slate-300">Convert text to ASCII art</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Text</label>
            <input v-model="text" type="text" maxlength="50"
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 text-lg"
              placeholder="Enter text (max 50 chars)" />
            <div class="text-xs text-slate-400 mt-1 text-right">{{ text.length }}/50</div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Font</label>
            <select v-model="font" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
              <option v-for="f in fonts" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Horizontal Layout</label>
              <select v-model="horizontalLayout" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
                <option value="default">Default</option>
                <option value="full">Full</option>
                <option value="fitted">Fitted</option>
                <option value="controlled smushing">Controlled Smushing</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Vertical Layout</label>
              <select v-model="verticalLayout" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
                <option value="default">Default</option>
                <option value="full">Full</option>
                <option value="fitted">Fitted</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Width: {{ width }}</label>
            <input v-model.number="width" type="range" min="40" max="200" class="w-full" />
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">ASCII Art</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-800 rounded-xl bg-slate-900 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-green-400 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="border border-slate-800 rounded-xl bg-slate-900 p-4 overflow-x-auto">
              <pre class="text-green-400 font-mono text-xs leading-none">{{ result }}</pre>
            </div>

            <div class="flex space-x-3">
              <button @click="copyResult" 
                class="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition flex items-center justify-center space-x-2">
                <i :class="copied ? 'fas fa-check text-green-600' : 'fas fa-copy'"></i>
                <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
              </button>
              <button @click="downloadResult" 
                class="px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-900 p-8 text-center text-slate-400">
            <i class="fas fa-terminal text-4xl mb-2 text-green-600"></i>
            <p>Enter text to generate ASCII art</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        Reset
      </button>
      <button @click="generate" :disabled="!text || loading"
        class="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-magic mr-2"></i>
        Generate
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const text = ref('');
const font = ref('Standard');
const horizontalLayout = ref('default');
const verticalLayout = ref('default');
const width = ref(80);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<string>('');
const executionTime = ref<number | null>(null);
const copied = ref(false);

const fonts = [
  'Standard', 'Big', 'Small', 'Banner', 'Block', 'Bubble', 'Digital', 
  'Ivrit', 'Lean', 'Mini', 'Script', 'Shadow', 'Slant', 'Speed', 'Star Wars'
];

const generate = async () => {
  if (!text.value) return;
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/text/ascii-art', {
      text: text.value,
      font: font.value,
      horizontal_layout: horizontalLayout.value,
      vertical_layout: verticalLayout.value,
      width: width.value
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data.art || response.data.ascii;
    } else {
      error.value = response.error || 'Failed to generate ASCII art';
    }
  } catch (err: any) {
    error.value = err.message || 'Error generating ASCII art';
  } finally {
    loading.value = false;
  }
};

const copyResult = async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    error.value = 'Failed to copy to clipboard';
  }
};

const downloadResult = () => {
  if (!result.value) return;
  const blob = new Blob([result.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ascii-art.txt';
  a.click();
  URL.revokeObjectURL(url);
};

const reset = () => {
  text.value = '';
  font.value = 'Standard';
  result.value = '';
  error.value = null;
};
</script>

