<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-blue-50/60">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-shield-alt text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Crypto</span>
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

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Controls -->
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Mode</label>
            <select
              v-model="mode"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="encrypt">Encrypt</option>
              <option value="decrypt">Decrypt</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Algorithm</label>
            <select
              v-model="algorithm"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="aes-256-cbc">AES-256-CBC</option>
              <option value="aes-192-cbc">AES-192-CBC</option>
              <option value="aes-128-cbc">AES-128-CBC</option>
              <option value="des-ede3">Triple DES (EDE3)</option>
              <option value="rc4">RC4</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">CBC modes require IV of matching block size.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Key</label>
            <input
              v-model="key"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Secret key"
            />
            <p class="mt-1 text-xs text-slate-400">Use appropriate length (16/24/32 bytes for AES).</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Initialization Vector (optional)</label>
            <input
              v-model="iv"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="IV for CBC modes"
            />
          </div>
        </div>

        <!-- Inputs / Outputs -->
        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ mode === 'encrypt' ? 'Plain text' : 'Encrypted payload' }}</h3>
                <p class="text-xs text-slate-500">{{ mode === 'encrypt' ? 'Enter the text you want to encrypt.' : 'Enter base64 encoded ciphertext.' }}</p>
              </div>
              <button
                @click="input = ''"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                Clear
              </button>
            </header>
            <div class="px-5 py-4">
              <textarea
                v-model="input"
                rows="7"
                class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm"
                :placeholder="mode === 'encrypt' ? 'Text to encrypt…' : 'Base64 encrypted payload…'"
              ></textarea>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ mode === 'encrypt' ? 'Encrypted output' : 'Decrypted text' }}</h3>
                <p class="text-xs text-slate-500">{{ mode === 'encrypt' ? 'Base64 encoded ciphertext result.' : 'Recovered plain text.' }}</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="relative px-5 py-4">
              <div v-if="loading" class="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
              </div>
              <textarea
                v-model="output"
                rows="7"
                readonly
                class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-slate-900 text-emerald-300 font-mono text-sm"
              ></textarea>
              <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{{ output ? 'Length: ' + output.length + ' chars' : 'No output yet' }}</span>
                <button
                  @click="copyOutput"
                  :disabled="!output"
                  class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <i class="fas fa-copy mr-1"></i>
                  Copy
                </button>
              </div>
              <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
            </div>
          </section>

          <p class="text-xs text-slate-500">Ensure key and IV sizes match the selected algorithm. Output is base64 encoded for easy transport.</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="handleAction"
        :disabled="!canSubmit || loading"
        class="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas mr-2" :class="mode === 'encrypt' ? 'fa-lock' : 'fa-unlock-alt'"></i>
        {{ mode === 'encrypt' ? 'Encrypt text' : 'Decrypt text' }}
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/crypto/{{ mode === 'encrypt' ? 'encrypt' : 'decrypt' }}</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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

const mode = ref<'encrypt' | 'decrypt'>('encrypt');
const algorithm = ref('aes-256-cbc');
const key = ref('');
const iv = ref('');
const input = ref('');
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canSubmit = computed(() => input.value.trim().length > 0 && key.value.trim().length > 0);

const handleAction = async () => {
  if (!canSubmit.value || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    if (mode.value === 'encrypt') {
      const response = await props.api.encryptText(input.value, algorithm.value, key.value, iv.value || undefined);
      executionTime.value = Math.round(performance.now() - start);
      if (response.success && response.data?.encrypted) {
        output.value = response.data.encrypted;
        emit('executed', response.data);
      } else {
        output.value = '';
        error.value = response.error || response.message || 'Encryption failed';
      }
    } else {
      const response = await props.api.decryptText(input.value, algorithm.value, key.value, iv.value || undefined);
      executionTime.value = Math.round(performance.now() - start);
      if (response.success && response.data?.decrypted !== undefined) {
        output.value = response.data.decrypted;
        emit('executed', response.data);
      } else {
        output.value = '';
        error.value = response.error || response.message || 'Decryption failed';
      }
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    output.value = '';
    error.value = err?.message || 'Encryption service unavailable';
  } finally {
    loading.value = false;
  }
};

const copyOutput = async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
