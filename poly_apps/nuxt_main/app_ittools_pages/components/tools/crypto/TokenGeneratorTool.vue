<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-key text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Crypto</span>
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
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Token length</label>
              <input
                v-model.number="length"
                type="number"
                min="8"
                max="256"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
              <p class="mt-1 text-xs text-slate-400">Between 8 and 256 characters.</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Character set</label>
              <select
                v-model="charset"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              >
                <option value="alphanumeric">Alphanumeric (a-z, A-Z, 0-9)</option>
                <option value="alphabetic">Alphabetic (a-z, A-Z)</option>
                <option value="lowercase">Lowercase (a-z)</option>
                <option value="uppercase">Uppercase (A-Z)</option>
                <option value="numeric">Numeric (0-9)</option>
                <option value="hex">Hexadecimal (0-9, a-f)</option>
              </select>
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-4 items-center">
            <div class="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <input
                id="includeSymbols"
                v-model="includeSymbols"
                type="checkbox"
                class="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300 rounded"
              />
              <label for="includeSymbols" class="ml-3 text-sm text-slate-700">Include symbols (!@#$%^&*)</label>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Number of tokens</label>
              <input
                v-model.number="count"
                type="number"
                min="1"
                max="50"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
              <p class="mt-1 text-xs text-slate-400">Generate up to 50 tokens per request.</p>
            </div>
          </div>

          <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            <i class="fas fa-info-circle mr-2"></i>
            Tokens are generated server-side for cryptographic-grade randomness. Symbols include: <code>!@#$%^&*()-_=+</code>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700">Generated Tokens</h3>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">{{ executionTime }} ms</span>
            </div>
          </div>

          <div class="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            <div
              v-if="tokens.length === 0 && !loading"
              class="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400"
            >
              Generate tokens to see them here.
            </div>
            <div
              v-for="token in tokens"
              :key="token"
              class="group flex items-center justify-between px-4 py-2.5 border border-slate-200 rounded-xl bg-white shadow-sm"
            >
              <span class="font-mono text-sm text-slate-700 break-all">{{ token }}</span>
              <button
                class="opacity-0 group-hover:opacity-100 transition text-amber-600 hover:text-amber-700"
                @click="copySingle(token)"
                title="Copy token"
              >
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <div v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <div class="text-xs text-slate-500">
        Endpoint: <code class="text-slate-700">/crypto/token/generate</code>
      </div>
      <div class="flex items-center space-x-3">
        <button
          @click="copyAll"
          :disabled="tokens.length === 0"
          class="px-4 py-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Copy all
        </button>
        <button
          @click="generate"
          :disabled="loading"
          class="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-bolt mr-2"></i>
          Generate tokens
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const SYMBOLS = '!@#$%^&*()-_=+';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const length = ref(32);
const charset = ref<'alphanumeric' | 'alphabetic' | 'numeric' | 'lowercase' | 'uppercase' | 'hex'>('alphanumeric');
const includeSymbols = ref(false);
const count = ref(1);
const tokens = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const generate = async () => {
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateToken(length.value, charset.value, includeSymbols.value, count.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.tokens) {
      tokens.value = response.data.tokens;
      emit('executed', response.data);
    } else {
      error.value = response.error || response.message || 'Token generation failed';
      tokens.value = [];
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Unable to generate tokens right now';
    tokens.value = [];
  } finally {
    loading.value = false;
  }
};

const copySingle = async (token: string) => {
  try {
    await navigator.clipboard.writeText(token);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const copyAll = async () => {
  if (tokens.value.length === 0) return;
  try {
    await navigator.clipboard.writeText(tokens.value.join('\n'));
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
