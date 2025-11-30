<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-eye-dropper text-violet-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Color Extractor</h2>
          </div>
          <p class="text-sm text-slate-600">Extract color palette from images</p>
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
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-violet-400 transition cursor-pointer"
            @click="triggerFileInput"
          >
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
            <div v-if="!imagePreview">
              <i class="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-3"></i>
              <p class="text-slate-600">Click to upload image</p>
            </div>
            <img v-else :src="imagePreview" class="max-h-48 mx-auto rounded-lg" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Number of Colors: {{ colorCount }}</label>
            <input v-model.number="colorCount" type="range" min="3" max="12" class="w-full accent-violet-600" />
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Extracted Palette</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-violet-600 text-2xl"></i>
          </div>

          <div v-else-if="colors.length" class="space-y-4">
            <!-- Color Palette -->
            <div class="flex rounded-xl overflow-hidden h-24 shadow">
              <div v-for="color in colors" :key="color.hex" 
                :style="{ backgroundColor: color.hex, flex: color.percentage }"
                class="cursor-pointer hover:scale-y-110 transition-transform"
                @click="copyColor(color.hex)">
              </div>
            </div>

            <!-- Color List -->
            <div class="space-y-2">
              <div v-for="color in colors" :key="color.hex" 
                class="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                @click="copyColor(color.hex)">
                <div class="w-10 h-10 rounded-lg shadow-inner" :style="{ backgroundColor: color.hex }"></div>
                <div class="flex-1">
                  <div class="font-mono text-sm text-slate-800">{{ color.hex }}</div>
                  <div class="text-xs text-slate-500">{{ color.rgb }}</div>
                </div>
                <div class="text-xs text-slate-400">{{ color.percentage }}%</div>
                <i class="fas fa-copy text-slate-400"></i>
              </div>
            </div>

            <!-- Copy All -->
            <button @click="copyAllColors" 
              class="w-full px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition">
              <i class="fas fa-copy mr-2"></i>Copy All Colors
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-palette text-4xl mb-2"></i>
            <p>Upload image to extract colors</p>
          </div>
        </div>
      </div>

      <!-- Copied Toast -->
      <div v-if="copiedColor" class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg">
        <i class="fas fa-check mr-2"></i>Copied {{ copiedColor }}
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="extractColors" :disabled="!imageFile || loading"
        class="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Extract
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

interface ExtractedColor {
  hex: string;
  rgb: string;
  percentage: number;
}

const fileInput = ref<HTMLInputElement>();
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const colorCount = ref(6);
const loading = ref(false);
const error = ref<string | null>(null);
const colors = ref<ExtractedColor[]>([]);
const copiedColor = ref<string | null>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    imageFile.value = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => { imagePreview.value = e.target?.result as string; };
    reader.readAsDataURL(imageFile.value);
  }
};

const extractColors = async () => {
  if (!imageFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('image', imageFile.value);
    formData.append('count', colorCount.value.toString());

    const response = await fetch('/api/ittools/v1/advanced/image/extract-colors', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data?.colors) {
      colors.value = data.data.colors;
    } else {
      error.value = data.error || 'Extraction failed';
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const copyColor = async (hex: string) => {
  try {
    await navigator.clipboard.writeText(hex);
    copiedColor.value = hex;
    setTimeout(() => { copiedColor.value = null; }, 1500);
  } catch {}
};

const copyAllColors = async () => {
  try {
    const text = colors.value.map(c => c.hex).join('\n');
    await navigator.clipboard.writeText(text);
    copiedColor.value = 'all colors';
    setTimeout(() => { copiedColor.value = null; }, 1500);
  } catch {}
};

const reset = () => {
  imageFile.value = null;
  imagePreview.value = '';
  colors.value = [];
  error.value = null;
};
</script>

