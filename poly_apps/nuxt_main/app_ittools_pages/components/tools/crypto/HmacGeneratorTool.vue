<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-fingerprint text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Crypto</span>
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
      <div class="grid gap-5 lg:grid-cols-5">
        <div class="lg:col-span-3 space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Message</label>
            <textarea
              v-model="message"
              rows="6"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono text-sm"
              placeholder="Enter message to sign..."
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Secret key</label>
            <input
              v-model="secret"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="Enter secret key"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Algorithm</label>
            <select
              v-model="algorithm"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              <option value="sha256">SHA-256</option>
              <option value="sha512">SHA-512</option>
              <option value="sha1">SHA-1</option>
              <option value="md5">MD5</option>
            </select>
          </div>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">HMAC Signature</h3>
            <div class="flex items-center space-x-3">
              <button
                @click="copySignature"
                :disabled="!result"
                class="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy signature
              </button>
              <div class="flex items-center space-x-1 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </div>
          </div>

          <div class="relative border border-slate-200 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs p-4 min-h-[160px] shadow-inner">
            <div v-if="loading" class="absolute inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-indigo-300 text-xl"></i>
            </div>
            <div v-if="error" class="text-red-300">{{ error }}</div>
            <div v-else-if="result" class="break-all leading-relaxed">{{ result }}</div>
            <div v-else class="text-slate-500">HMAC signature will appear here…</div>
          </div>

          <div class="text-xs text-slate-500">
            <p><span class="font-semibold text-slate-600">Algorithm:</span> {{ algorithm.toUpperCase() }}</p>
            <p class="mt-1">Ensure your secret key remains confidential. HMAC provides message integrity and authenticity.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="generate"
        :disabled="!canGenerate || loading"
        class="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-shield-alt mr-2"></i>
        Generate HMAC
      </button>
      <div class="text-xs text-slate-500">
        Endpoint: <code class="text-slate-700">/crypto/hmac</code>
      </div>
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

const message = ref('');
const secret = ref('');
const algorithm = ref<'sha256' | 'sha512' | 'sha1' | 'md5'>('sha256');
const loading = ref(false);
const result = ref('');
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canGenerate = computed(() => message.value.trim().length > 0 && secret.value.trim().length > 0);

const generate = async () => {
  if (!canGenerate.value || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateHmac(message.value, secret.value, algorithm.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.hmac) {
      result.value = response.data.hmac;
      emit('executed', response.data);
    } else {
      result.value = '';
      error.value = response.error || response.message || 'Failed to generate HMAC signature';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    result.value = '';
    error.value = err?.message || 'Unable to generate HMAC right now';
  } finally {
    loading.value = false;
  }
};

const copySignature = async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
