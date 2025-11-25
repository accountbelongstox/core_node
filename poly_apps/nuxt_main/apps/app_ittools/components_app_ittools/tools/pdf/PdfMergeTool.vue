<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-orange-500 to-amber-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-object-group text-white"></i>
            <h2 class="text-2xl font-semibold text-white">PDF Merger</h2>
          </div>
          <p class="text-sm text-orange-100">Merge multiple PDFs into one</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-orange-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div 
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-orange-400 transition cursor-pointer"
            @click="triggerFileInput"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <input ref="fileInput" type="file" accept=".pdf" multiple class="hidden" @change="handleFileChange" />
            <i class="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-3"></i>
            <p class="text-slate-600">Click or drag PDFs here</p>
            <p class="text-xs text-slate-400 mt-1">You can select multiple files</p>
          </div>

          <!-- File List -->
          <div v-if="pdfFiles.length" class="space-y-2">
            <div class="flex items-center justify-between text-sm text-slate-600">
              <span>{{ pdfFiles.length }} file(s) selected</span>
              <button @click="pdfFiles = []" class="text-red-500 hover:text-red-700">Clear all</button>
            </div>

            <draggable v-model="pdfFiles" item-key="name" class="space-y-2" handle=".drag-handle">
              <template #item="{ element, index }">
                <div class="bg-slate-50 rounded-lg p-3 flex items-center space-x-3">
                  <div class="drag-handle cursor-move text-slate-400 hover:text-slate-600">
                    <i class="fas fa-grip-vertical"></i>
                  </div>
                  <div class="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                    <i class="fas fa-file-pdf text-red-500"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-slate-700 truncate">{{ element.name }}</div>
                    <div class="text-xs text-slate-500">{{ formatBytes(element.size) }}</div>
                  </div>
                  <button @click="removeFile(index)" class="text-slate-400 hover:text-red-500">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </template>
            </draggable>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-orange-600 text-2xl"></i>
            <p class="text-sm text-slate-500 mt-2">Merging PDFs...</p>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <i class="fas fa-check-circle text-green-600 text-2xl"></i>
              <div>
                <div class="font-medium text-green-700">PDFs Merged Successfully</div>
                <div class="text-sm text-green-600">{{ formatBytes(result.size) }}</div>
              </div>
            </div>

            <button @click="downloadResult" class="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              <i class="fas fa-download mr-2"></i>Download Merged PDF
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-object-group text-4xl mb-2"></i>
            <p>Add PDFs to merge</p>
            <p class="text-xs mt-1">Drag to reorder</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="mergePdfs" :disabled="pdfFiles.length < 2 || loading"
        class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Merge PDFs
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

// Simple draggable replacement (without external dependency)
const draggable = {
  template: '<div><slot v-for="(item, index) in modelValue" :item="item" :index="index" name="item"></slot></div>',
  props: ['modelValue', 'itemKey', 'handle'],
  emits: ['update:modelValue']
};

const fileInput = ref<HTMLInputElement>();
const pdfFiles = ref<File[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    pdfFiles.value = [...pdfFiles.value, ...Array.from(target.files)];
  }
};

const handleDrop = (e: DragEvent) => {
  const files = e.dataTransfer?.files;
  if (files) {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    pdfFiles.value = [...pdfFiles.value, ...pdfs];
  }
};

const removeFile = (index: number) => {
  pdfFiles.value.splice(index, 1);
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const mergePdfs = async () => {
  if (pdfFiles.value.length < 2) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    pdfFiles.value.forEach((file, idx) => {
      formData.append(`pdf_${idx}`, file);
    });

    const response = await fetch('/api/ittools/v1/advanced/pdf/merge', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = data.data;
    } else {
      error.value = data.error || 'Failed to merge PDFs';
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
  a.download = 'merged.pdf';
  a.click();
  URL.revokeObjectURL(url);
};

const reset = () => {
  pdfFiles.value = [];
  result.value = null;
  error.value = null;
};
</script>

