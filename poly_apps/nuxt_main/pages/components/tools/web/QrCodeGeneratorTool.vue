<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-cyan-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-qrcode text-emerald-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Content</h3>
            <p class="text-xs text-slate-500">Any text, URL, or JSON will be encoded.</p>
          </header>
          <div class="px-5 py-4 space-y-3">
            <textarea
              v-model="text"
              rows="8"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="https://example.com"
            ></textarea>
            <div class="flex items-center justify-between text-sm text-slate-600">
              <label class="flex items-center space-x-2">
                <span>Size</span>
                <input v-model.number="size" type="range" min="128" max="512" step="32" class="w-40">
                <span class="font-semibold">{{ size }}px</span>
              </label>
              <label class="flex items-center space-x-2">
                <span>Error correction</span>
                <select v-model="ecc" class="px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-transparent text-sm">
                  <option value="L">L (7%)</option>
                  <option value="M">M (15%)</option>
                  <option value="Q">Q (25%)</option>
                  <option value="H">H (30%)</option>
                </select>
              </label>
            </div>
            <button
              @click="generate"
              :disabled="!canGenerate"
              class="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-qrcode mr-2"></i>
              Generate QR Code
            </button>
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center min-h-[22rem]">
          <div v-if="loading" class="text-center text-emerald-600">
            <i class="fas fa-spinner fa-spin text-2xl"></i>
            <p class="mt-2 text-sm">Rendering QR...</p>
          </div>
          <template v-else>
            <img v-if="qrCode" :src="qrCode" :alt="'QR code for ' + text" class="shadow rounded-xl border border-slate-100" :style="{ width: size + 'px', height: size + 'px' }">
            <p v-else class="text-sm text-slate-500">Enter content and press generate to see the QR code.</p>
            <div v-if="qrCode" class="mt-4 flex items-center space-x-3">
              <button @click="download" class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                <i class="fas fa-download mr-1"></i>
                Download PNG
              </button>
              <button @click="copyImage" class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                <i class="fas fa-copy mr-1"></i>
                Copy image
              </button>
            </div>
          </template>
        </section>
      </div>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/web/qr-code/generate</code></span>
      <span v-if="qrCode && executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const text = ref('https://it-tools.dev');
const size = ref(256);
const ecc = ref<'L' | 'M' | 'Q' | 'H'>('M');
const qrCode = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canGenerate = computed(() => text.value.trim().length > 0 && !loading.value);

const generate = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateQrCode(text.value.trim(), size.value, ecc.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.qrCode) {
      qrCode.value = response.data.qrCode;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to generate QR code');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'QR code service unavailable';
    qrCode.value = null;
  } finally {
    loading.value = false;
  }
};

const download = () => {
  if (!qrCode.value) return;
  const link = document.createElement('a');
  link.href = qrCode.value;
  link.download = 'qr-code.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyImage = async () => {
  if (!qrCode.value || !navigator.clipboard?.write) return;
  try {
    const data = await fetch(qrCode.value);
    const blob = await data.blob();
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
  } catch (err) {
    console.error('Copy image failed', err);
  }
};

generate();
</script>
