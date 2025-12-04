<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-not-equal text-violet-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Text Diff</h2>
          </div>
          <p class="text-sm text-slate-600">Compare two texts and highlight differences</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Input Section -->
      <div class="grid gap-4 lg:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Original Text</label>
          <textarea v-model="text1" rows="10" 
            class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 font-mono text-sm resize-none"
            placeholder="Enter original text..."></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Modified Text</label>
          <textarea v-model="text2" rows="10" 
            class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 font-mono text-sm resize-none"
            placeholder="Enter modified text..."></textarea>
        </div>
      </div>

      <!-- Options -->
      <div class="flex items-center space-x-6">
        <label class="flex items-center space-x-2">
          <input v-model="ignoreCase" type="checkbox" class="rounded text-violet-600" />
          <span class="text-sm text-slate-700">Ignore case</span>
        </label>
        <label class="flex items-center space-x-2">
          <input v-model="ignoreWhitespace" type="checkbox" class="rounded text-violet-600" />
          <span class="text-sm text-slate-700">Ignore whitespace</span>
        </label>
        <div class="flex items-center space-x-2">
          <span class="text-sm text-slate-700">Mode:</span>
          <select v-model="diffMode" class="px-3 py-1 border border-slate-200 rounded-lg text-sm">
            <option value="chars">Characters</option>
            <option value="words">Words</option>
            <option value="lines">Lines</option>
          </select>
        </div>
      </div>

      <!-- Result Section -->
      <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
        <i class="fas fa-spinner fa-spin text-violet-600 text-2xl"></i>
      </div>

      <div v-else-if="result" class="space-y-4">
        <!-- Stats -->
        <div class="flex items-center space-x-6 text-sm">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 bg-green-500 rounded"></span>
            <span class="text-slate-600">Added: {{ result.stats?.added || 0 }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 bg-red-500 rounded"></span>
            <span class="text-slate-600">Removed: {{ result.stats?.removed || 0 }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 bg-slate-300 rounded"></span>
            <span class="text-slate-600">Unchanged: {{ result.stats?.unchanged || 0 }}</span>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400 ml-auto">{{ executionTime }}ms</span>
        </div>

        <!-- Diff View -->
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="bg-slate-100 px-4 py-2 border-b flex items-center justify-between">
            <span class="text-sm font-medium text-slate-700">Diff Output</span>
            <div class="flex space-x-2">
              <button @click="viewMode = 'unified'" 
                :class="viewMode === 'unified' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'"
                class="px-3 py-1 rounded text-xs font-medium transition">
                Unified
              </button>
              <button @click="viewMode = 'split'" 
                :class="viewMode === 'split' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'"
                class="px-3 py-1 rounded text-xs font-medium transition">
                Split
              </button>
            </div>
          </div>
          
          <div class="p-4 bg-slate-50 max-h-[400px] overflow-auto font-mono text-sm">
            <template v-if="viewMode === 'unified'">
              <div v-for="(part, idx) in result.diff" :key="idx" 
                :class="getDiffClass(part.type)" class="px-2 py-0.5 -mx-2">
                <span class="opacity-50 mr-2">{{ part.type === 'added' ? '+' : part.type === 'removed' ? '-' : ' ' }}</span>
                <span>{{ part.value }}</span>
              </div>
            </template>
            <template v-else>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <div class="text-xs text-slate-500 mb-2">Original</div>
                  <div v-for="(part, idx) in result.diff" :key="idx">
                    <span v-if="part.type !== 'added'" 
                      :class="part.type === 'removed' ? 'bg-red-100 text-red-800' : ''"
                      class="px-1 rounded">{{ part.value }}</span>
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs text-slate-500 mb-2">Modified</div>
                  <div v-for="(part, idx) in result.diff" :key="idx">
                    <span v-if="part.type !== 'removed'" 
                      :class="part.type === 'added' ? 'bg-green-100 text-green-800' : ''"
                      class="px-1 rounded">{{ part.value }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
        <i class="fas fa-not-equal text-4xl mb-2"></i>
        <p>Enter text in both fields to compare</p>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        Reset
      </button>
      <button @click="swapTexts" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        <i class="fas fa-exchange-alt mr-2"></i>Swap
      </button>
      <button @click="compare" :disabled="!text1 || !text2 || loading"
        class="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-code-compare mr-2"></i>
        Compare
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const text1 = ref('');
const text2 = ref('');
const ignoreCase = ref(false);
const ignoreWhitespace = ref(false);
const diffMode = ref('words');
const viewMode = ref<'unified' | 'split'>('unified');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const compare = async () => {
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/text/diff', {
      text1: text1.value,
      text2: text2.value,
      ignore_case: ignoreCase.value,
      ignore_whitespace: ignoreWhitespace.value,
      mode: diffMode.value
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to compare texts';
    }
  } catch (err: any) {
    error.value = err.message || 'Error comparing texts';
  } finally {
    loading.value = false;
  }
};

const getDiffClass = (type: string): string => {
  switch (type) {
    case 'added': return 'bg-green-100 text-green-800';
    case 'removed': return 'bg-red-100 text-red-800';
    default: return 'text-slate-600';
  }
};

const swapTexts = () => {
  const temp = text1.value;
  text1.value = text2.value;
  text2.value = temp;
};

const reset = () => {
  text1.value = '';
  text2.value = '';
  result.value = null;
  error.value = null;
};
</script>

