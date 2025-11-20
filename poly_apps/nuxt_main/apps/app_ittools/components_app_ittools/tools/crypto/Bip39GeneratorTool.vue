<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-rose-50 to-orange-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-seedling text-rose-500"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">Crypto</span>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Entropy strength</label>
            <select
              v-model.number="strength"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
            >
              <option :value="128">128 bits (12 words)</option>
              <option :value="160">160 bits (15 words)</option>
              <option :value="192">192 bits (18 words)</option>
              <option :value="224">224 bits (21 words)</option>
              <option :value="256">256 bits (24 words)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Language</label>
            <select
              v-model="language"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
            >
              <option value="english">English</option>
              <option value="chinese_simplified">Chinese (Simplified)</option>
              <option value="chinese_traditional">Chinese (Traditional)</option>
              <option value="french">French</option>
              <option value="italian">Italian</option>
              <option value="japanese">Japanese</option>
              <option value="korean">Korean</option>
              <option value="spanish">Spanish</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Mnemonic wordlist will be generated using the selected language.</p>
          </div>
        </div>

        <div class="lg:col-span-3 flex flex-col space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Mnemonic</h3>
            <div class="flex items-center space-x-3">
              <button
                @click="copyMnemonic"
                :disabled="!mnemonic"
                class="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition text-xs"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy mnemonic
              </button>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </div>
          </div>

          <div class="relative border border-slate-200 rounded-xl bg-slate-900 text-slate-100 shadow-inner p-4 min-h-[160px]">
            <div v-if="loading" class="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-rose-400 text-xl"></i>
            </div>
            <div v-if="error" class="text-red-300 text-sm">{{ error }}</div>
            <div v-else-if="mnemonic" class="text-base leading-relaxed">
              <span class="font-mono select-all">{{ mnemonic }}</span>
            </div>
            <div v-else class="text-slate-400 text-sm">Mnemonic phrase will appear here…</div>
          </div>

          <div class="border border-slate-200 rounded-xl bg-white p-4 text-sm text-slate-600 flex items-center justify-between">
            <div>
              <p class="font-semibold text-slate-700">Entropy</p>
              <p class="mt-1 font-mono text-xs break-all">{{ entropy || '—' }}</p>
            </div>
            <button
              @click="copyEntropy"
              :disabled="!entropy"
              class="text-xs text-rose-500 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i class="fas fa-copy mr-1"></i>
              Copy entropy
            </button>
          </div>

          <p class="text-xs text-slate-500">
            Store mnemonic phrases securely. Anyone with access can recover the associated wallet or keys.
          </p>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="generate"
        :disabled="loading"
        class="px-5 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-feather mr-2"></i>
        Generate mnemonic
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/crypto/bip39/generate</code></span>
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

const strength = ref(128);
const language = ref('english');
const mnemonic = ref('');
const entropy = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const generate = async () => {
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateBip39(strength.value, language.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.mnemonic) {
      mnemonic.value = response.data.mnemonic;
      entropy.value = response.data.entropy;
      emit('executed', response.data);
    } else {
      mnemonic.value = '';
      entropy.value = '';
      error.value = response.error || response.message || 'Mnemonic generation failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    mnemonic.value = '';
    entropy.value = '';
    error.value = err?.message || 'Unable to generate mnemonic right now';
  } finally {
    loading.value = false;
  }
};

const copyMnemonic = async () => {
  if (!mnemonic.value) return;
  try {
    await navigator.clipboard.writeText(mnemonic.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const copyEntropy = async () => {
  if (!entropy.value) return;
  try {
    await navigator.clipboard.writeText(entropy.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
