<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-sync-alt text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Image Rotate & Flip</h2>
          </div>
          <p class="text-sm text-slate-600">Rotate and flip images</p>
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
            class="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-amber-400 transition cursor-pointer"
            @click="triggerFileInput"
          >
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
            <div v-if="!imagePreview">
              <i class="fas fa-cloud-upload-alt text-4xl text-slate-400 mb-3"></i>
              <p class="text-slate-600">Click to upload image</p>
            </div>
            <img v-else :src="imagePreview" class="max-h-48 mx-auto rounded-lg" :style="previewStyle" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Rotation</label>
            <div class="flex space-x-2">
              <button v-for="deg in [0, 90, 180, 270]" :key="deg" @click="rotation = deg"
                :class="rotation === deg ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="flex-1 px-4 py-3 rounded-lg font-medium transition">
                {{ deg }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Flip</label>
            <div class="flex space-x-2">
              <button @click="flipH = !flipH"
                :class="flipH ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="flex-1 px-4 py-3 rounded-lg font-medium transition">
                <i class="fas fa-arrows-alt-h mr-2"></i>Horizontal
              </button>
              <button @click="flipV = !flipV"
                :class="flipV ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="flex-1 px-4 py-3 rounded-lg font-medium transition">
                <i class="fas fa-arrows-alt-v mr-2"></i>Vertical
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Preview</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-amber-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <img :src="result.image" class="max-w-full max-h-64 mx-auto rounded-lg shadow" />

            <button @click="downloadResult" class="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
              <i class="fas fa-download mr-2"></i>Download
            </button>
          </div>

          <div v-else-if="imagePreview" class="border border-slate-200 rounded-xl bg-slate-50 p-4">
            <img :src="imagePreview" class="max-w-full max-h-64 mx-auto rounded-lg" :style="previewStyle" />
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-sync-alt text-4xl mb-2"></i>
            <p>Upload image to rotate</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="applyTransform" :disabled="!imageFile || loading"
        class="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Apply
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
const rotation = ref(0);
const flipH = ref(false);
const flipV = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const previewStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg) scaleX(${flipH.value ? -1 : 1}) scaleY(${flipV.value ? -1 : 1})`
}));

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

const applyTransform = async () => {
  if (!imageFile.value) return;
  loading.value = true;
  error.value = null;

  try {
    const formData = new FormData();
    formData.append('image', imageFile.value);
    formData.append('rotation', rotation.value.toString());
    formData.append('flip_horizontal', flipH.value.toString());
    formData.append('flip_vertical', flipV.value.toString());

    const response = await fetch('/api/ittools/v1/advanced/image/rotate', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success && data.data) {
      result.value = {
        image: `data:image/png;base64,${data.data.image}`
      };
    } else {
      error.value = data.error || 'Transform failed';
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
  a.download = 'rotated.png';
  a.click();
};

const reset = () => {
  imageFile.value = null;
  imagePreview.value = '';
  rotation.value = 0;
  flipH.value = false;
  flipV.value = false;
  result.value = null;
  error.value = null;
};
</script>

