<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-keyboard text-slate-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-200 text-slate-700">Converter</span>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Text</label>
            <textarea
              v-model="text"
              rows="4"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
              placeholder="Enter text..."
            ></textarea>
          </div>

          <p class="text-xs text-slate-500">Conversion type: <span class="font-semibold">{{ conversionLabel }}</span></p>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Converted output</h3>
                <p class="text-xs text-slate-500">Copy the result for use elsewhere.</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="relative px-5 py-4">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-slate-500 text-xl"></i>
              </div>
              <textarea
                v-model="output"
                rows="10"
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
                  Copy output
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
        :disabled="text.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-slate-600 text-white font-medium shadow hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-random mr-2"></i>
        Convert text
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">{{ endpoint }}</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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

const text = ref('Hello World');
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const conversionLabel = computed(() => {
  switch (props.tool.id) {
    case 'text_to_binary':
      return 'Text → Binary';
    case 'text_to_unicode':
      return 'Text → Unicode';
    case 'text_to_nato_alphabet':
      return 'Text → NATO Alphabet';
    default:
      return 'Conversion';
  }
});

const endpoint = computed(() => {
  switch (props.tool.id) {
    case 'text_to_binary':
      return '/converter/text-to-binary';
    case 'text_to_unicode':
      return '/converter/text-to-unicode';
    case 'text_to_nato_alphabet':
      return '/converter/text-to-nato';
    default:
      return '/converter/text';
  }
});

const convert = async () => {
  if (!text.value.trim() || loading.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    let response;
    if (props.tool.id === 'text_to_binary') {
      response = await props.api.textToBinary(text.value);
    } else if (props.tool.id === 'text_to_unicode') {
      response = await props.api.textToUnicode(text.value);
    } else if (props.tool.id === 'text_to_nato_alphabet') {
      response = await props.api.textToNato(text.value);
    }

    executionTime.value = Math.round(performance.now() - start);

    if (response?.success && response.data) {
      const firstValue = Object.values(response.data)[0];
      output.value = typeof firstValue === 'string' ? firstValue : JSON.stringify(firstValue, null, 2);
      emit('executed', response.data);
    } else {
      output.value = '';
      error.value = response?.error || response?.message || 'Conversion failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    output.value = '';
    error.value = err?.message || 'Text conversion service unavailable';
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

onMounted(() => {
  convert();
});

</script>
