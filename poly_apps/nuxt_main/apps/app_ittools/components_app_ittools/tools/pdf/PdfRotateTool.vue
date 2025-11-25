<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-500 to-violet-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-sync-alt text-white"></i>
            <h2 class="text-2xl font-semibold text-white">PDF Rotate</h2>
          </div>
          <p class="text-sm text-purple-100">Rotate PDF pages</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-purple-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div 
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-purple-400 transition cursor-pointer"
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
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Rotation</label>
            <div class="grid grid-cols-4 gap-3">
              <button v-for="deg in [90, 180, 270, 0]" :key="deg" @click="rotation = deg"
                :class="rotation === deg ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg transition text-center">
                <i class="fas fa-redo mb-1" :style="{ transform: `rotate(${deg}deg)` }"></i>
                <div class="text-sm">{{ deg === 0 ? 'None' : deg + '/' }}</div>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Apply To</label>
            <select v-model="applyTo" class="w-full px-4 py-2 border border-slate-200 rounded-lg">
              <option value="all">All Pages</option>
              <option value="odd">Odd Pages Only</option>
              <option value="even">Even Pages Only</option>
              <option value="specific">Specific Pages</option>
            </select>
          </div>

          <div v-if="applyTo === 'specific'">
            <label class="block text-sm font-medium text-slate-700 mb-2">Pages (e.g., 1,3,5-8)</label>
            <input v-model="specificPages" type="text"
              class="w-full px-4 py-2 border border-slate-200 rounded-lg" placeholder="1,3,5-8" />
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-purple-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <i class="fas fa-check-circle text-green-600 text-2xl"></i>
              <span class="text-green-700 font-medium">PDF Rotated Successfully</span>
            </div>

            <button @click="downloadResult" class="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <i class="fas fa-download mr-2"></i>Download Rotated PDF
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-sync-alt text-4xl mb-2"></i>
            <p>Upload PDF to rotate</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="rotatePdf" :disabled="!pdfFile || loading"
        class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Rotate
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
const rotation = ref(90);
const applyTo = ref('all');
const specificPages = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    pdfFile.value = target.files[0];
  }
};

const rotatePdf = async () => {
  if (!pdfFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('pdf', pdfFile.value);
    formData.append('rotation', rotation.value.toString());
    formData.append('apply_to', applyTo.value);
    if (applyTo.value === 'specific') {
      formData.append('pages', specificPages.value);
    }

    const response = await fetch('/api/ittools/v1/advanced/pdf/rotate', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = data.data;
    } else {
      error.value = data.error || 'Failed to rotate PDF';
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
  a.download = 'rotated.pdf';
  a.click();
  URL.revokeObjectURL(url);
};

const reset = () => {
  pdfFile.value = null;
  result.value = null;
  error.value = null;
};
</script>

