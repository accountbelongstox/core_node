<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-hashtag text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Crypto</span>
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
      <div class="grid gap-5 lg:grid-cols-5">
        <div class="lg:col-span-3 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Text to Hash</label>
            <textarea
              v-model="text"
              @input="handleInput"
              rows="6"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Paste or type text to hash..."
            ></textarea>
          </div>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Algorithm</label>
              <select
                v-model="algorithm"
                @change="handleAlgorithmChange"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="md5">MD5</option>
                <option value="sha1">SHA-1</option>
                <option value="sha256">SHA-256</option>
                <option value="sha512">SHA-512</option>
              </select>
            </div>
            <div class="flex items-end">
              <button
                @click="copyResult"
                :disabled="!result"
                class="inline-flex items-center justify-center w-full px-4 py-2.5 border border-blue-200 text-blue-600 rounded-xl font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-2"></i>
                {{ copied ? 'Copied!' : 'Copy result' }}
              </button>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700">Hash Preview</h3>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">{{ executionTime }} ms</span>
            </div>
          </div>

          <div class="relative">
            <div
              class="min-h-[180px] border border-slate-200 rounded-xl bg-slate-900 text-emerald-300 font-mono text-sm p-4 shadow-inner"
            >
              <div v-if="loading" class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-emerald-300 text-xl"></i>
              </div>
              <div v-if="error" class="text-red-300 break-all">{{ error }}</div>
              <div v-else-if="result" class="break-all leading-relaxed">{{ result }}</div>
              <div v-else class="text-slate-500">Hash output will appear here…</div>
            </div>
          </div>

          <div class="mt-4 grid gap-2 text-xs text-slate-500">
            <div class="flex items-center justify-between">
              <span>Input length</span>
              <span>{{ text.length }} characters</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Current algorithm</span>
              <span class="font-medium text-slate-600 uppercase">{{ algorithm }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <div class="text-xs text-slate-500">
        Endpoint: <code class="text-slate-700">/crypto/hash</code>
      </div>
      <div class="flex items-center space-x-3">
        <button
          @click="reset"
          class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white transition"
        >
          Reset
        </button>
        <button
          @click="execute"
          :disabled="!text || loading"
          class="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-play mr-2"></i>
          Hash Now
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
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

const text = ref('');
const algorithm = ref<'md5' | 'sha1' | 'sha256' | 'sha512'>('sha256');
const loading = ref(false);
const result = ref('');
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);
const copied = ref(false);

const canAutoExecute = computed(() => text.value.trim().length > 0);

const runHash = async () => {
  if (!text.value.trim()) {
    result.value = '';
    error.value = null;
    executionTime.value = null;
    return;
  }

  loading.value = true;
  error.value = null;
  copied.value = false;

  const start = performance.now();

  try {
    const response = await props.api.hashText(text.value, algorithm.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.hash) {
      result.value = response.data.hash;
      emit('executed', response.data);
    } else {
      error.value = response.error || response.message || 'Hash operation failed';
      result.value = '';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Unable to hash text right now';
    result.value = '';
  } finally {
    loading.value = false;
  }
};

const debouncedRun = useDebounceFn(() => {
  if (canAutoExecute.value) {
    runHash();
  }
}, 400);

const handleInput = () => {
  debouncedRun();
};

const handleAlgorithmChange = () => {
  if (canAutoExecute.value) {
    runHash();
  }
};

const execute = () => {
  runHash();
};

const copyResult = async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const reset = () => {
  text.value = '';
  algorithm.value = 'sha256';
  result.value = '';
  executionTime.value = null;
  error.value = null;
  copied.value = false;
};

</script>
