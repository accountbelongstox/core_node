<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-expand-arrows-alt text-purple-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Image Resizer</h2>
          </div>
          <p class="text-sm text-slate-600">Resize images to specific dimensions</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Upload Image</label>
            <div 
              class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-purple-400 transition cursor-pointer"
              @click="triggerFileInput"
              @dragover.prevent
              @drop.prevent="handleDrop"
            >
              <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
              <div v-if="!imagePreview">
                <i class="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-3"></i>
                <p class="text-slate-600">Click or drag image here</p>
                <p class="text-xs text-slate-400 mt-1">Supports JPG, PNG, WebP, GIF</p>
              </div>
              <img v-else :src="imagePreview" class="max-h-48 mx-auto rounded-lg" />
            </div>
          </div>

          <div v-if="originalDimensions" class="text-sm text-slate-500">
            Original: {{ originalDimensions.width }} x {{ originalDimensions.height }}px
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Width (px)</label>
              <input v-model.number="width" type="number" min="1" max="10000"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Height (px)</label>
              <input v-model.number="height" type="number" min="1" max="10000"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <input id="keepAspect" v-model="keepAspectRatio" type="checkbox" class="rounded text-purple-600" />
            <label for="keepAspect" class="text-sm text-slate-700">Keep aspect ratio</label>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Output Format</label>
            <select v-model="outputFormat" class="w-full px-4 py-2 border border-slate-200 rounded-lg">
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Quality: {{ quality }}%</label>
            <input v-model.number="quality" type="range" min="10" max="100" class="w-full" />
          </div>
        </div>

        <!-- Output Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Result</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div class="border border-slate-200 rounded-xl bg-slate-50 min-h-[300px] flex items-center justify-center p-4">
            <div v-if="loading" class="text-center">
              <i class="fas fa-spinner fa-spin text-purple-600 text-2xl"></i>
              <p class="text-sm text-slate-500 mt-2">Processing...</p>
            </div>
            <img v-else-if="resultImage" :src="resultImage" class="max-w-full max-h-64 rounded-lg shadow" />
            <div v-else class="text-slate-400 text-center">
              <i class="fas fa-image text-4xl mb-2"></i>
              <p>Resized image will appear here</p>
            </div>
          </div>

          <div v-if="resultInfo" class="text-sm text-slate-500">
            New size: {{ resultInfo.width }} x {{ resultInfo.height }}px ({{ resultInfo.size }})
          </div>

          <button v-if="resultImage" @click="downloadResult"
            class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
            <i class="fas fa-download mr-2"></i>Download Resized Image
          </button>
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
      <button @click="resizeImage" :disabled="!imageFile || loading"
        class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-expand-arrows-alt mr-2"></i>
        Resize Image
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { itToolsApi } from '../../../services_app_ittools/ittools-api';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const fileInput = ref<HTMLInputElement>();
const imageFile = ref<File | null>(null);
const imagePreview = ref<string>('');
const originalDimensions = ref<{ width: number; height: number } | null>(null);
const width = ref(800);
const height = ref(600);
const keepAspectRatio = ref(true);
const outputFormat = ref('jpeg');
const quality = ref(85);
const loading = ref(false);
const error = ref<string | null>(null);
const resultImage = ref<string>('');
const resultInfo = ref<{ width: number; height: number; size: string } | null>(null);
const executionTime = ref<number | null>(null);

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
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string;
    const img = new Image();
    img.onload = () => {
      originalDimensions.value = { width: img.width, height: img.height };
      width.value = img.width;
      height.value = img.height;
    };
    img.src = imagePreview.value;
  };
  reader.readAsDataURL(file);
};

watch(width, (newWidth) => {
  if (keepAspectRatio.value && originalDimensions.value) {
    const ratio = originalDimensions.value.height / originalDimensions.value.width;
    height.value = Math.round(newWidth * ratio);
  }
});

const resizeImage = async () => {
  if (!imageFile.value) return;
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const formData = new FormData();
    formData.append('image', imageFile.value);
    formData.append('width', width.value.toString());
    formData.append('height', height.value.toString());
    formData.append('format', outputFormat.value);
    formData.append('quality', quality.value.toString());

    const response = await fetch('/api/ittools/v1/advanced/image/resize', {
      method: 'POST',
      body: formData,
      headers: { 'X-App-Namespace': 'ittools' }
    });

    const result = await response.json();
    executionTime.value = Math.round(performance.now() - start);

    if (result.success && result.data) {
      resultImage.value = `data:image/${outputFormat.value};base64,${result.data.image}`;
      resultInfo.value = {
        width: result.data.width,
        height: result.data.height,
        size: formatBytes(result.data.size)
      };
    } else {
      error.value = result.error || 'Failed to resize image';
    }
  } catch (err: any) {
    error.value = err.message || 'Error resizing image';
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
  if (!resultImage.value) return;
  const a = document.createElement('a');
  a.href = resultImage.value;
  a.download = `resized_${width.value}x${height.value}.${outputFormat.value}`;
  a.click();
};

const reset = () => {
  imageFile.value = null;
  imagePreview.value = '';
  originalDimensions.value = null;
  resultImage.value = '';
  resultInfo.value = null;
  error.value = null;
};
</script>

