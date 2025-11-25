<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-red-500 to-rose-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-file-pdf text-white"></i>
            <h2 class="text-2xl font-semibold text-white">PDF Splitter</h2>
          </div>
          <p class="text-sm text-red-100">Split PDF into multiple files</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-red-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div 
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-red-400 transition cursor-pointer"
            @click="triggerFileInput"
          >
            <input ref="fileInput" type="file" accept=".pdf" class="hidden" @change="handleFileChange" />
            <div v-if="!pdfFile">
              <i class="fas fa-file-pdf text-4xl text-slate-400 mb-3"></i>
              <p class="text-slate-600">Click to upload PDF</p>
            </div>
            <div v-else class="text-center">
              <i class="fas fa-file-pdf text-4xl text-red-500 mb-2"></i>
              <p class="font-medium text-slate-700">{{ pdfFile.name }}</p>
              <p class="text-sm text-slate-500">{{ formatBytes(pdfFile.size) }}</p>
            </div>
          </div>

          <div v-if="pageCount">
            <label class="block text-sm font-medium text-slate-700 mb-2">Total Pages: {{ pageCount }}</label>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Split Method</label>
            <select v-model="splitMethod" class="w-full px-4 py-2 border border-slate-200 rounded-lg">
              <option value="range">Page Range</option>
              <option value="every">Every N Pages</option>
              <option value="extract">Extract Specific Pages</option>
            </select>
          </div>

          <div v-if="splitMethod === 'range'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">From Page</label>
              <input v-model.number="fromPage" type="number" min="1" :max="pageCount"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">To Page</label>
              <input v-model.number="toPage" type="number" min="1" :max="pageCount"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
            </div>
          </div>

          <div v-else-if="splitMethod === 'every'">
            <label class="block text-sm font-medium text-slate-700 mb-2">Split Every N Pages</label>
            <input v-model.number="everyN" type="number" min="1"
              class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
          </div>

          <div v-else>
            <label class="block text-sm font-medium text-slate-700 mb-2">Pages (e.g., 1,3,5-8)</label>
            <input v-model="extractPages" type="text"
              class="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="1,3,5-8,10" />
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-red-600 text-2xl"></i>
            <p class="text-sm text-slate-500 mt-2">Processing PDF...</p>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <i class="fas fa-check-circle text-green-600 text-2xl"></i>
              <div>
                <div class="font-medium text-green-700">PDF Split Successfully</div>
                <div class="text-sm text-green-600">{{ result.files?.length || 1 }} file(s) created</div>
              </div>
            </div>

            <div v-for="(file, idx) in result.files" :key="idx"
              class="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <i class="fas fa-file-pdf text-red-500 text-2xl"></i>
                <div>
                  <div class="font-medium text-slate-700">{{ file.name }}</div>
                  <div class="text-sm text-slate-500">{{ file.pages }} pages</div>
                </div>
              </div>
              <button @click="downloadFile(file)" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-cut text-4xl mb-2"></i>
            <p>Upload PDF and configure split options</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="splitPdf" :disabled="!pdfFile || loading"
        class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Split PDF
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const fileInput = ref<HTMLInputElement>();
const pdfFile = ref<File | null>(null);
const pageCount = ref<number | null>(null);
const splitMethod = ref('range');
const fromPage = ref(1);
const toPage = ref(1);
const everyN = ref(1);
const extractPages = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    pdfFile.value = target.files[0];
    pageCount.value = null; // Would need pdf.js to get actual count
    toPage.value = 1;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const splitPdf = async () => {
  if (!pdfFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('pdf', pdfFile.value);
    formData.append('method', splitMethod.value);
    
    if (splitMethod.value === 'range') {
      formData.append('from_page', fromPage.value.toString());
      formData.append('to_page', toPage.value.toString());
    } else if (splitMethod.value === 'every') {
      formData.append('every_n', everyN.value.toString());
    } else {
      formData.append('pages', extractPages.value);
    }

    const response = await fetch('/api/ittools/v1/advanced/pdf/split', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = data.data;
    } else {
      error.value = data.error || 'Failed to split PDF';
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const downloadFile = (file: any) => {
  if (file.data) {
    const blob = new Blob([Uint8Array.from(atob(file.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const reset = () => {
  pdfFile.value = null;
  pageCount.value = null;
  result.value = null;
  error.value = null;
};
</script>

