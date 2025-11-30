<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-sky-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-wifi text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Web</span>
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
            <h3 class="text-sm font-semibold text-slate-700">WiFi credentials</h3>
            <p class="text-xs text-slate-500">Details are encoded locally within the QR response.</p>
          </header>
          <div class="px-5 py-4 space-y-4">
            <label class="space-y-1 text-sm text-slate-600">
              <span>Network name (SSID)</span>
              <input v-model="ssid" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-transparent" placeholder="MyWiFi">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Password</span>
              <input v-model="password" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-transparent" placeholder="Optional for open networks">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Encryption</span>
              <select v-model="encryption" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-transparent">
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Open network</option>
              </select>
            </label>
            <label class="inline-flex items-center space-x-2 text-sm text-slate-600">
              <input type="checkbox" v-model="hidden" class="rounded text-indigo-600 focus:ring-indigo-500">
              <span>SSID is hidden</span>
            </label>
            <button
              @click="generate"
              :disabled="!canGenerate"
              class="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-qrcode mr-2"></i>
              Generate WiFi QR
            </button>
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center min-h-[22rem]">
          <div v-if="loading" class="text-center text-indigo-600">
            <i class="fas fa-spinner fa-spin text-2xl"></i>
            <p class="mt-2 text-sm">Encoding credentials...</p>
          </div>
          <template v-else>
            <img v-if="qrCode" :src="qrCode" alt="WiFi QR" class="shadow rounded-xl border border-slate-100" width="288" height="288">
            <p v-else class="text-sm text-slate-500">Fill in SSID details to preview the QR code.</p>
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
      <span>Endpoint: <code class="text-slate-700">/web/wifi-qr-code/generate</code></span>
      <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const ssid = ref('DevNetwork');
const password = ref('strong-password');
const encryption = ref<'WPA' | 'WEP' | 'nopass'>('WPA');
const hidden = ref(false);
const qrCode = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canGenerate = computed(() => ssid.value.trim().length > 0 && !loading.value && (encryption.value === 'nopass' || password.value.trim().length > 0));

const generate = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateWifiQrCode({
      ssid: ssid.value.trim(),
      password: password.value.trim() || undefined,
      encryption: encryption.value,
      hidden: hidden.value
    });
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.qrCode) {
      qrCode.value = response.data.qrCode;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to generate WiFi QR code');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'WiFi QR service unavailable';
    qrCode.value = null;
  } finally {
    loading.value = false;
  }
};

const download = () => {
  if (!qrCode.value) return;
  const link = document.createElement('a');
  link.href = qrCode.value;
  link.download = 'wifi-qr.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyImage = async () => {
  if (!qrCode.value) return;
  try {
    const blob = await (await fetch(qrCode.value)).blob();
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
  } catch (err) {
    console.error('Copy image failed', err);
  }
};

generate();
</script>
