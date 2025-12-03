<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-amber-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-id-badge text-slate-600"></i>
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
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Username</label>
            <input
              v-model="username"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                placeholder="Enter password"
              />
              <button
                @click="showPassword = !showPassword"
                type="button"
                class="absolute inset-y-0 right-3 text-slate-400 hover:text-slate-600"
              >
                <i class="fas" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
              </button>
            </div>
          </div>

          <p class="text-xs text-slate-500">Generate HTTP Basic Auth header and token using Base64 encoding.</p>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Authorization header</h3>
                <p class="text-xs text-slate-500">Use this value in HTTP requests (e.g., `Authorization: Basic ...`).</p>
              </div>
              <button
                @click="copy(header)"
                :disabled="!header"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy header
              </button>
            </header>
            <div class="px-5 py-4">
              <pre class="bg-slate-900 text-emerald-300 text-xs font-mono leading-relaxed rounded-xl p-4 overflow-auto">{{ header || 'Authorization header will appear here…' }}</pre>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Base64 token</h3>
                <p class="text-xs text-slate-500">Credentials encoded as `username:password`.</p>
              </div>
              <button
                @click="copy(token)"
                :disabled="!token"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy token
              </button>
            </header>
            <div class="px-5 py-4">
              <pre class="bg-slate-900 text-blue-300 text-xs font-mono leading-relaxed rounded-xl p-4 overflow-auto">{{ token || 'Base64 token will appear here…' }}</pre>
            </div>
          </section>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="generate"
        :disabled="!username.trim() || !password || loading"
        class="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium shadow hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-wand-magic mr-2"></i>
        Generate header
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/crypto/basic-auth</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const header = ref('');
const token = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const generate = async () => {
  if (!username.value.trim() || !password.value || loading.value) return;

  loading.value = true;
  error.value = null;

  try {
    const response = await props.api.generateBasicAuth(username.value, password.value);
    if (response.success && response.data) {
      header.value = response.data.header;
      token.value = response.data.token;
      emit('executed', response.data);
    } else {
      header.value = '';
      token.value = '';
      error.value = response.error || response.message || 'Failed to generate header';
    }
  } catch (err: any) {
    header.value = '';
    token.value = '';
    error.value = err?.message || 'Unable to generate header right now';
  } finally {
    loading.value = false;
  }
};

const copy = async (value: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
