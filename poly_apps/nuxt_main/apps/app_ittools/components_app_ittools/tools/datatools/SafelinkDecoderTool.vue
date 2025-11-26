<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-500 to-blue-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-external-link-alt text-white"></i>
            <h2 class="text-2xl font-semibold text-white">Safelink Decoder</h2>
          </div>
          <p class="text-sm text-indigo-100">Decode safe links and redirects</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">Safelink URL</label>
        <textarea v-model="url" rows="3"
          class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
          placeholder="Paste the safelink URL here..."></textarea>
      </div>

      <div v-if="result" class="space-y-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="text-sm text-green-600 mb-1">Decoded URL</div>
          <div class="font-mono text-sm text-green-800 break-all flex items-start justify-between">
            <a :href="result" target="_blank" class="hover:underline">{{ result }}</a>
            <button @click="copy" class="ml-2 text-green-600 hover:text-green-800">
              <i :class="copied ? 'fas fa-check' : 'fas fa-copy'"></i>
            </button>
          </div>
        </div>

        <div class="flex space-x-3">
          <a :href="result" target="_blank" 
            class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-center">
            <i class="fas fa-external-link-alt mr-2"></i>Open URL
          </a>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">Reset</button>
      <button @click="decode" :disabled="!url || loading"
        class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>Decode
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const url = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<string>('');
const copied = ref(false);

const decode = async () => {
  if (!url.value) return;
  loading.value = true;
  error.value = null;

  try {
    const response = await httpClient.post('/api/ittools/v1/text/safelink/encode', {
      url: url.value,
      action: 'decode'
    });

    if (response.success && response.data?.decoded) {
      result.value = response.data.decoded;
    } else {
      // Try local decode
      result.value = decodeLocal(url.value);
    }
  } catch (err: any) {
    // Try local decode on error
    try {
      result.value = decodeLocal(url.value);
    } catch {
      error.value = 'Failed to decode URL';
    }
  } finally {
    loading.value = false;
  }
};

const decodeLocal = (input: string): string => {
  // Try to extract URL from common safelink patterns
  const patterns = [
    /[?&]url=([^&]+)/i,
    /[?&]u=([^&]+)/i,
    /[?&]q=([^&]+)/i,
    /[?&]redirect=([^&]+)/i,
    /[?&]destination=([^&]+)/i,
    /[?&]target=([^&]+)/i,
    /go\/([^?]+)/i,
    /link\/([^?]+)/i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }

  // If it's base64 encoded
  try {
    const decoded = atob(input.split('/').pop() || '');
    if (decoded.startsWith('http')) return decoded;
  } catch {}

  throw new Error('Could not decode URL');
};

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {}
};

const reset = () => {
  url.value = '';
  result.value = '';
  error.value = null;
};
</script>

