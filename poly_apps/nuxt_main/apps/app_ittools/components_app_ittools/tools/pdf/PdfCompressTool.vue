<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-green-500 to-emerald-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-compress-arrows-alt text-white"></i>
            <h2 class="text-2xl font-semibold text-white">PDF Compressor</h2>
          </div>
          <p class="text-sm text-green-100">Reduce PDF file size</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-green-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div 
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-green-400 transition cursor-pointer"
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

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Compression Level</label>
            <div class="grid grid-cols-3 gap-3">
              <button v-for="level in levels" :key="level.value" @click="compressionLevel = level.value"
                :class="compressionLevel === level.value ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg transition text-center">
                <div class="font-medium">{{ level.name }}</div>
                <div class="text-xs opacity-75">{{ level.desc }}</div>
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-green-600 text-2xl"></i>
            <p class="text-sm text-slate-500 mt-2">Compressing PDF...</p>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm text-slate-600">Original Size</span>
                <span class="font-medium text-slate-800">{{ formatBytes(result.originalSize) }}</span>
              </div>
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm text-slate-600">Compressed Size</span>
                <span class="font-bold text-green-700">{{ formatBytes(result.compressedSize) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-slate-600">Reduction</span>
                <span class="font-bold text-green-700">{{ result.reduction }}%</span>
              </div>
              <div class="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full bg-green-500" :style="{ width: (100 - result.reduction) + '%' }"></div>
              </div>
            </div>

            <button @click="downloadResult" class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <i class="fas fa-download mr-2"></i>Download Compressed PDF
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-compress-arrows-alt text-4xl mb-2"></i>
            <p>Upload PDF to compress</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="compressPdf" :disabled="!pdfFile || loading"
        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Compress
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
const compressionLevel = ref('medium');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const levels = [
  { value: 'low', name: 'Low', desc: 'Best quality' },
  { value: 'medium', name: 'Medium', desc: 'Balanced' },
  { value: 'high', name: 'High', desc: 'Smallest size' }
];

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    pdfFile.value = target.files[0];
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const compressPdf = async () => {
  if (!pdfFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('pdf', pdfFile.value);
    formData.append('level', compressionLevel.value);

    const response = await fetch('/api/ittools/v1/advanced/pdf/compress', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = {
        ...data.data,
        originalSize: pdfFile.value.size,
        reduction: Math.round((1 - data.data.compressedSize / pdfFile.value.size) * 100)
      };
    } else {
      error.value = data.error || 'Failed to compress PDF';
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const downloadResult = () => {
  if (!result.value?.data) return;
  const blob = new Blob([Uint8Array.from(atob(result.value.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compressed.pdf';
  a.click();
  URL.revokeObjectURL(url);
};

const reset = () => {
  pdfFile.value = null;
  result.value = null;
  error.value = null;
};
</script>

