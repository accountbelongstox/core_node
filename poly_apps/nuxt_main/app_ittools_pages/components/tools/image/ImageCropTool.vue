<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-rose-50 to-pink-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-crop-alt text-rose-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Image Cropper</h2>
          </div>
          <p class="text-sm text-slate-600">Crop images to specific dimensions</p>
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
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-rose-400 transition cursor-pointer"
            @click="triggerFileInput"
          >
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
            <div v-if="!imagePreview">
              <i class="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-3"></i>
              <p class="text-slate-600">Click to upload image</p>
            </div>
            <img v-else :src="imagePreview" class="max-h-48 mx-auto rounded-lg" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">X Position</label>
              <input v-model.number="cropX" type="number" min="0"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Y Position</label>
              <input v-model.number="cropY" type="number" min="0"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Width</label>
              <input v-model.number="cropWidth" type="number" min="1"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Height</label>
              <input v-model.number="cropHeight" type="number" min="1"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Preset Ratios</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="ratio in ratioPresets" :key="ratio.name" @click="applyRatio(ratio)"
                class="px-3 py-2 bg-slate-100 hover:bg-rose-100 rounded-lg text-sm transition">
                {{ ratio.name }}
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-rose-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <img :src="result.image" class="max-w-full max-h-64 mx-auto rounded-lg shadow" />

            <div class="bg-rose-50 rounded-lg p-4 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">Dimensions</span>
                <span class="font-bold text-rose-700">{{ result.width }} x {{ result.height }}</span>
              </div>
            </div>

            <button @click="downloadResult" class="w-full px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">
              <i class="fas fa-download mr-2"></i>Download
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-crop-alt text-4xl mb-2"></i>
            <p>Upload image to crop</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="crop" :disabled="!imageFile || loading"
        class="px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Crop
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
const imageFile = ref<File | null>(null);
const imagePreview = ref('');
const imageDimensions = ref({ width: 0, height: 0 });
const cropX = ref(0);
const cropY = ref(0);
const cropWidth = ref(200);
const cropHeight = ref(200);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const ratioPresets = [
  { name: '1:1 Square', ratio: 1 },
  { name: '4:3', ratio: 4/3 },
  { name: '16:9', ratio: 16/9 },
  { name: '3:2', ratio: 3/2 },
  { name: '2:3', ratio: 2/3 }
];

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    imageFile.value = target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        imageDimensions.value = { width: img.width, height: img.height };
        cropWidth.value = Math.min(200, img.width);
        cropHeight.value = Math.min(200, img.height);
      };
      img.src = imagePreview.value;
    };
    reader.readAsDataURL(imageFile.value);
  }
};

const applyRatio = (preset: { ratio: number }) => {
  const maxWidth = imageDimensions.value.width - cropX.value;
  const maxHeight = imageDimensions.value.height - cropY.value;
  
  if (preset.ratio > 1) {
    cropWidth.value = Math.min(maxWidth, 400);
    cropHeight.value = Math.round(cropWidth.value / preset.ratio);
  } else {
    cropHeight.value = Math.min(maxHeight, 400);
    cropWidth.value = Math.round(cropHeight.value * preset.ratio);
  }
};

const crop = async () => {
  if (!imageFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('image', imageFile.value);
    formData.append('x', cropX.value.toString());
    formData.append('y', cropY.value.toString());
    formData.append('width', cropWidth.value.toString());
    formData.append('height', cropHeight.value.toString());

    const response = await fetch('/api/ittools/v1/advanced/image/crop', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = {
        image: `data:image/png;base64,${data.data.image}`,
        width: data.data.width,
        height: data.data.height
      };
    } else {
      error.value = data.error || 'Crop failed';
    }
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const downloadResult = () => {
  if (!result.value) return;
  const a = document.createElement('a');
  a.href = result.value.image;
  a.download = 'cropped.png';
  a.click();
};

const reset = () => {
  imageFile.value = null;
  imagePreview.value = '';
  cropX.value = 0;
  cropY.value = 0;
  result.value = null;
  error.value = null;
};
</script>

