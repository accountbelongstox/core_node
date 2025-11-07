<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-100 to-blue-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-key text-slate-700"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-200 text-slate-700">Crypto</span>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition"
            title="Close"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Key size</label>
            <select
              v-model.number="keySize"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
            >
              <option :value="1024">1024 bits</option>
              <option :value="2048">2048 bits</option>
              <option :value="4096">4096 bits</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Output format</label>
            <select
              v-model="format"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
            >
              <option value="pem">PEM</option>
              <option value="der">DER</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">PEM is readable text; DER is binary base64 encoded.</p>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
            <p class="font-semibold text-slate-700">Usage tips</p>
            <ul class="space-y-1 list-disc list-inside">
              <li>2048-bit keys are recommended for general use.</li>
              <li>Keep private keys secure; distribute public keys freely.</li>
            </ul>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-5">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Public key</h3>
                <p class="text-xs text-slate-500">Share this key with consumers.</p>
              </div>
              <button
                @click="copyPublicKey"
                :disabled="!publicKey"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy
              </button>
            </header>
            <div class="relative px-5 py-4">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-slate-500 text-xl"></i>
              </div>
              <pre class="bg-slate-900 text-emerald-300 text-xs font-mono leading-relaxed rounded-xl p-4 overflow-auto max-h-60">
{{ publicKey || 'Public key will appear here…' }}</pre>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Private key</h3>
                <p class="text-xs text-red-500">Keep private keys secret. Do not share.</p>
              </div>
              <div class="space-x-2">
                <button
                  @click="copyPrivateKey"
                  :disabled="!privateKey"
                  class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <i class="fas fa-copy mr-1"></i>
                  Copy
                </button>
                <button
                  @click="downloadPrivateKey"
                  :disabled="!privateKey"
                  class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <i class="fas fa-download mr-1"></i>
                  Download
                </button>
              </div>
            </header>
            <div class="relative px-5 py-4">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-slate-500 text-xl"></i>
              </div>
              <pre class="bg-slate-900 text-rose-300 text-xs font-mono leading-relaxed rounded-xl p-4 overflow-auto max-h-60">
{{ privateKey || 'Private key will appear here…' }}</pre>
            </div>
          </section>

          <div class="flex items-center justify-between text-xs text-slate-500">
            <div class="flex items-center space-x-2">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">Generated in {{ executionTime }} ms</span>
            </div>
            <div>
              Current format: <span class="font-semibold text-slate-600 uppercase">{{ format }}</span> &nbsp;|&nbsp; Size: <span class="font-semibold text-slate-600">{{ keySize }} bits</span>
            </div>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="generate"
        :disabled="loading"
        class="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium shadow hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-key mr-2"></i>
        Generate key pair
      </button>
      <div class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/crypto/rsa/generate</code></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const keySize = ref(2048);
const format = ref<'pem' | 'der'>('pem');
const publicKey = ref('');
const privateKey = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const generate = async () => {
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateRsaKeyPair(keySize.value, format.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      publicKey.value = response.data.publicKey || '';
      privateKey.value = response.data.privateKey || '';
      emit('executed', response.data);
    } else {
      publicKey.value = '';
      privateKey.value = '';
      error.value = response.error || response.message || 'Failed to generate key pair';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    publicKey.value = '';
    privateKey.value = '';
    error.value = err?.message || 'Unable to generate key pair right now';
  } finally {
    loading.value = false;
  }
};

const copyPublicKey = async () => {
  if (!publicKey.value) return;
  try {
    await navigator.clipboard.writeText(publicKey.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const copyPrivateKey = async () => {
  if (!privateKey.value) return;
  try {
    await navigator.clipboard.writeText(privateKey.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const downloadPrivateKey = () => {
  if (!privateKey.value) return;
  const blob = new Blob([privateKey.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rsa-private-key.${format.value === 'pem' ? 'pem' : 'key'}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

</script>
