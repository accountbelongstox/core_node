<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/70">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-code text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Converter</span>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Mode</label>
            <div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                class="px-4 py-2 text-sm font-medium rounded-lg transition"
                :class="mode === 'encode' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'"
                @click="mode = 'encode'"
              >
                Encode
              </button>
              <button
                class="px-4 py-2 text-sm font-medium rounded-lg transition"
                :class="mode === 'decode' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'"
                @click="mode = 'decode'"
              >
                Decode
              </button>
            </div>
          </div>

          <p class="text-xs text-slate-500">
            Encoding transforms text into Base64 for safe transport. Decoding converts Base64 back to plain text.
          </p>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ mode === 'encode' ? 'Plain input' : 'Base64 input' }}</h3>
                <p class="text-xs text-slate-500">{{ mode === 'encode' ? 'Enter text to encode into Base64.' : 'Enter Base64 string to decode.' }}</p>
              </div>
              <button
                @click="input = ''"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                Clear
              </button>
            </header>
            <div class="px-5 py-4">
              <textarea
                v-model="input"
                rows="7"
                class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm"
                :placeholder="mode === 'encode' ? 'Text to encode…' : 'Base64 string to decode…'"
              ></textarea>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ mode === 'encode' ? 'Base64 output' : 'Decoded text' }}</h3>
                <p class="text-xs text-slate-500">{{ mode === 'encode' ? 'Result is Base64 encoded using UTF-8.' : 'Decoded result in UTF-8 text.' }}</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="relative px-5 py-4">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-blue-600 text-xl"></i>
              </div>
              <textarea
                v-model="output"
                rows="7"
                readonly
                class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-slate-900 text-emerald-300 font-mono text-sm"
              ></textarea>
              <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{{ output ? 'Length: ' + output.length + ' chars' : 'No output yet' }}</span>
                <button
                  @click="copyOutput"
                  :disabled="!output"
                  class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <i class="fas fa-copy mr-1"></i>
                  Copy
                </button>
              </div>
              <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="input.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas mr-2" :class="mode === 'encode' ? 'fa-arrow-down' : 'fa-arrow-up'"></i>
        {{ mode === 'encode' ? 'Encode to Base64' : 'Decode from Base64' }}
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/base64/{{ mode }}</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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

const mode = ref<'encode' | 'decode'>('encode');
const input = ref('');
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const convert = async () => {
  if (!input.value.trim() || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    if (mode.value === 'encode') {
      const response = await props.api.base64Encode(input.value);
      executionTime.value = Math.round(performance.now() - start);
      if (response.success && response.data?.encoded !== undefined) {
        output.value = response.data.encoded;
        emit('executed', response.data);
      } else {
        output.value = '';
        error.value = response.error || response.message || 'Encoding failed';
      }
    } else {
      const response = await props.api.base64Decode(input.value);
      executionTime.value = Math.round(performance.now() - start);
      if (response.success && response.data?.decoded !== undefined) {
        output.value = response.data.decoded;
        emit('executed', response.data);
      } else {
        output.value = '';
        error.value = response.error || response.message || 'Decoding failed';
      }
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    output.value = '';
    error.value = err?.message || 'Base64 service unavailable';
  } finally {
    loading.value = false;
  }
};

const copyOutput = async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
