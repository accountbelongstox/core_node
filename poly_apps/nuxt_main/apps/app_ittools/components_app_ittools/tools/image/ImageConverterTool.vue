<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-exchange-alt text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Image Converter</h2>
          </div>
          <p class="text-sm text-slate-600">Convert images between formats</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div 
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition cursor-pointer"
            @click="triggerFileInput"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
            <div v-if="!imagePreview">
              <i class="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-3"></i>
              <p class="text-slate-600">Click or drag image here</p>
            </div>
            <div v-else>
              <img :src="imagePreview" class="max-h-48 mx-auto rounded-lg" />
              <p class="text-sm text-slate-500 mt-2">{{ sourceFormat?.toUpperCase() }} - {{ formatBytes(imageFile?.size || 0) }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Convert To</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="fmt in formats" :key="fmt" @click="targetFormat = fmt"
                :class="targetFormat === fmt ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                class="px-4 py-3 rounded-lg font-medium text-sm transition">
                {{ fmt.toUpperCase() }}
              </button>
            </div>
          </div>

          <div v-if="targetFormat !== 'png'">
            <label class="block text-sm font-medium text-slate-700 mb-2">Quality: {{ quality }}%</label>
            <input v-model.number="quality" type="range" min="10" max="100" class="w-full accent-blue-600" />
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <img :src="result.image" class="max-w-full max-h-48 mx-auto rounded-lg shadow" />

            <div class="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">Format</span>
                <span class="font-bold text-blue-700">{{ targetFormat.toUpperCase() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Size</span>
                <span class="font-bold text-blue-700">{{ formatBytes(result.size) }}</span>
              </div>
            </div>

            <button @click="downloadResult" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-download mr-2"></i>Download {{ targetFormat.toUpperCase() }}
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-exchange-alt text-4xl mb-2"></i>
            <p>Upload image to convert</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="convert" :disabled="!imageFile || loading"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Convert
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const fileInput = ref<HTMLInputElement>();
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const sourceFormat = ref<string | null>(null);
const targetFormat = ref('webp');
const quality = ref(85);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const formats = ['jpeg', 'png', 'webp', 'gif'];

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) processFile(target.files[0]);
};

const handleDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) processFile(file);
};

const processFile = (file: File) => {
  imageFile.value = file;
  sourceFormat.value = file.type.split('/')[1] || 'unknown';
  const reader = new FileReader();
  reader.onload = (e) => { imagePreview.value = e.target?.result as string; };
  reader.readAsDataURL(file);
};

const convert = async () => {
  if (!imageFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('image', imageFile.value);
    formData.append('format', targetFormat.value);
    formData.append('quality', quality.value.toString());

    const response = await fetch('/api/ittools/v1/advanced/image/convert', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = {
        image: `data:image/${targetFormat.value};base64,${data.data.image}`,
        size: data.data.size
      };
    } else {
      error.value = data.error || 'Conversion failed';
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const downloadResult = () => {
  if (!result.value) return;
  const a = document.createElement('a');
  a.href = result.value.image;
  a.download = `converted.${targetFormat.value}`;
  a.click();
};

const reset = () => {
  imageFile.value = null;
  imagePreview.value = '';
  sourceFormat.value = null;
  result.value = null;
  error.value = null;
};
</script>

