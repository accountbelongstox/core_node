<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-gray-100">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-image text-slate-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">SVG Placeholder Generator</h2>
          </div>
          <p class="text-sm text-slate-600">Generate SVG placeholder images</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Width</label>
              <input v-model.number="width" type="number" min="10" max="2000"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" @input="generate" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Height</label>
              <input v-model.number="height" type="number" min="10" max="2000"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg" @input="generate" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Text</label>
            <input v-model="text" type="text" placeholder="Leave empty for WxH"
              class="w-full px-4 py-2 border border-slate-200 rounded-lg" @input="generate" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Background</label>
              <div class="flex space-x-2">
                <input v-model="bgColor" type="color" class="w-12 h-10 rounded cursor-pointer" @input="generate" />
                <input v-model="bgColor" type="text" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm" @input="generate" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Text Color</label>
              <div class="flex space-x-2">
                <input v-model="textColor" type="color" class="w-12 h-10 rounded cursor-pointer" @input="generate" />
                <input v-model="textColor" type="text" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm" @input="generate" />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Presets</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="preset in presets" :key="preset.name" @click="applyPreset(preset)"
                class="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition">
                {{ preset.name }}
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Preview</h3>

          <div class="border border-slate-200 rounded-xl bg-slate-50 p-4 min-h-[200px] flex items-center justify-center">
            <div v-html="svgCode" class="max-w-full"></div>
          </div>

          <div class="space-y-3">
            <button @click="copySvg" 
              class="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition">
              <i :class="copied === 'svg' ? 'fas fa-check text-green-600' : 'fas fa-copy'" class="mr-2"></i>
              {{ copied === 'svg' ? 'Copied!' : 'Copy SVG Code' }}
            </button>
            <button @click="copyDataUri" 
              class="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition">
              <i :class="copied === 'uri' ? 'fas fa-check text-green-600' : 'fas fa-link'" class="mr-2"></i>
              {{ copied === 'uri' ? 'Copied!' : 'Copy Data URI' }}
            </button>
            <button @click="downloadSvg" 
              class="w-full px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition">
              <i class="fas fa-download mr-2"></i>Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const width = ref(300);
const height = ref(200);
const text = ref('');
const bgColor = ref('#cccccc');
const textColor = ref('#888888');
const svgCode = ref('');
const copied = ref<string | null>(null);

const presets = [
  { name: 'Thumbnail', width: 150, height: 150, bg: '#e2e8f0', text: '#94a3b8' },
  { name: 'Banner', width: 728, height: 90, bg: '#dbeafe', text: '#3b82f6' },
  { name: 'Card', width: 300, height: 200, bg: '#fef3c7', text: '#f59e0b' },
  { name: 'Avatar', width: 64, height: 64, bg: '#ede9fe', text: '#8b5cf6' },
  { name: 'Hero', width: 1200, height: 400, bg: '#fee2e2', text: '#ef4444' }
];

const generate = () => {
  const displayText = text.value || `${width.value}x${height.value}`;
  const fontSize = Math.min(width.value, height.value) / 8;
  
  svgCode.value = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.value}" height="${height.value}" viewBox="0 0 ${width.value} ${height.value}">
  <rect fill="${bgColor.value}" width="${width.value}" height="${height.value}"/>
  <text fill="${textColor.value}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" 
    x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${displayText}</text>
</svg>`;
};

const applyPreset = (preset: any) => {
  width.value = preset.width;
  height.value = preset.height;
  bgColor.value = preset.bg;
  textColor.value = preset.text;
  generate();
};

const copySvg = async () => {
  try {
    await navigator.clipboard.writeText(svgCode.value);
    copied.value = 'svg';
    setTimeout(() => { copied.value = null; }, 2000);
  } catch {}
};

const copyDataUri = async () => {
  try {
    const uri = `data:image/svg+xml,${encodeURIComponent(svgCode.value)}`;
    await navigator.clipboard.writeText(uri);
    copied.value = 'uri';
    setTimeout(() => { copied.value = null; }, 2000);
  } catch {}
};

const downloadSvg = () => {
  const blob = new Blob([svgCode.value], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `placeholder-${width.value}x${height.value}.svg`;
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(generate);
</script>

