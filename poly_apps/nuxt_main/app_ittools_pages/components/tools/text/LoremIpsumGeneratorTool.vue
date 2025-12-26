<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-rose-50 to-pink-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-paragraph text-rose-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Lorem Ipsum Generator</h2>
          </div>
          <p class="text-sm text-slate-600">Generate placeholder text for your designs</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Type</label>
            <div class="grid grid-cols-3 gap-3">
              <button v-for="t in types" :key="t.value" @click="type = t.value" 
                :class="type === t.value ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg font-medium transition text-center">
                <i :class="t.icon" class="block mb-1"></i>
                {{ t.label }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Count: {{ count }}</label>
            <input v-model.number="count" type="range" min="1" :max="maxCount" class="w-full accent-rose-600" />
            <div class="flex justify-between text-xs text-slate-400 mt-1">
              <span>1</span>
              <span>{{ maxCount }} {{ type }}</span>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-slate-700">Options</label>
            </div>
            <label class="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input v-model="startWithLorem" type="checkbox" class="rounded text-rose-600" />
              <span class="text-sm text-slate-700">Start with "Lorem ipsum..."</span>
            </label>
            <label class="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
              <input v-model="includeHtml" type="checkbox" class="rounded text-rose-600" />
              <span class="text-sm text-slate-700">Wrap in HTML tags (p, ul, etc.)</span>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Variant</label>
            <select v-model="variant" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
              <option value="classic">Classic Lorem Ipsum</option>
              <option value="hipster">Hipster Ipsum</option>
              <option value="corporate">Corporate Ipsum</option>
              <option value="tech">Tech Ipsum</option>
            </select>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Generated Text</h3>
            <div class="flex items-center space-x-2">
              <span v-if="wordCount" class="text-xs text-slate-400">{{ wordCount }} words</span>
              <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
            </div>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-rose-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="border border-slate-200 rounded-xl bg-slate-50 p-4 max-h-[400px] overflow-y-auto">
              <div v-if="includeHtml" v-html="result" class="prose prose-sm max-w-none"></div>
              <p v-else class="text-slate-700 whitespace-pre-wrap leading-relaxed">{{ result }}</p>
            </div>

            <div class="flex space-x-3">
              <button @click="copyResult" 
                class="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition flex items-center justify-center space-x-2">
                <i :class="copied ? 'fas fa-check text-green-600' : 'fas fa-copy'"></i>
                <span>{{ copied ? 'Copied!' : 'Copy Text' }}</span>
              </button>
              <button @click="generate" 
                class="px-4 py-3 bg-rose-100 hover:bg-rose-200 rounded-lg text-rose-700 transition">
                <i class="fas fa-redo"></i>
              </button>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-paragraph text-4xl mb-2"></i>
            <p>Click generate to create text</p>
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
      <button @click="generate" :disabled="loading"
        class="px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-magic mr-2"></i>
        Generate
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const types = [
  { value: 'paragraphs', label: 'Paragraphs', icon: 'fas fa-align-left' },
  { value: 'sentences', label: 'Sentences', icon: 'fas fa-grip-lines' },
  { value: 'words', label: 'Words', icon: 'fas fa-font' }
];

const type = ref('paragraphs');
const count = ref(3);
const startWithLorem = ref(true);
const includeHtml = ref(false);
const variant = ref('classic');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<string>('');
const executionTime = ref<number | null>(null);
const copied = ref(false);
const wordCount = ref<number | null>(null);

const maxCount = computed(() => {
  switch (type.value) {
    case 'paragraphs': return 20;
    case 'sentences': return 50;
    case 'words': return 500;
    default: return 10;
  }
});

const generate = async () => {
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/text/lorem-ipsum', {
      type: type.value,
      count: count.value,
      start_with_lorem: startWithLorem.value,
      include_html: includeHtml.value,
      variant: variant.value
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data.text;
      wordCount.value = response.data.wordCount;
    } else {
      error.value = response.error || 'Failed to generate text';
    }
  } catch (err: any) {
    error.value = err.message || 'Error generating text';
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

const reset = () => {
  type.value = 'paragraphs';
  count.value = 3;
  result.value = '';
  error.value = null;
};
</script>

