<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-rose-50">
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
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                placeholder="Enter password to analyze"
              />
              <button
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-3 text-slate-400 hover:text-slate-600"
                type="button"
              >
                <i class="fas" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
              </button>
            </div>
            <p class="mt-1 text-xs text-slate-400">Password is processed securely via backend scoring.</p>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <div class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Strength analysis</h3>
                <p class="text-xs text-slate-500">Score ranges from 0 (Very Weak) to 4 (Strong).</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>

            <div class="px-5 py-4 space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium text-slate-700">Overall strength</span>
                  <span v-if="result" class="font-semibold" :class="strengthColor">
                    {{ result.strength }} ({{ result.score }}/4)
                  </span>
                  <span v-else class="text-slate-400">Not analyzed</span>
                </div>
                <div class="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    class="h-full transition-all"
                    :class="barColor"
                    :style="{ width: result ? ((result.score + 1) * 20) + '%' : '0%' }"
                  ></div>
                </div>
              </div>

              <div class="grid sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p class="font-semibold text-slate-700">Crack time estimate</p>
                  <p class="mt-1 text-slate-500">{{ result?.crackTime || '—' }}</p>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p class="font-semibold text-slate-700">Entropy</p>
                  <p class="mt-1 text-slate-500">{{ result?.entropy ? result.entropy.toFixed(2) + ' bits' : '—' }}</p>
                </div>
              </div>

              <div class="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p class="font-semibold text-slate-700 mb-2">Suggestions</p>
                  <ul class="space-y-1">
                    <li v-if="!result || result.suggestions.length === 0" class="text-slate-400">No suggestions</li>
                    <li
                      v-for="suggestion in result?.suggestions || []"
                      :key="suggestion"
                      class="flex items-start space-x-2 text-slate-600"
                    >
                      <i class="fas fa-plus text-emerald-500 mt-0.5"></i>
                      <span>{{ suggestion }}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <p class="font-semibold text-slate-700 mb-2">Warnings</p>
                  <ul class="space-y-1">
                    <li v-if="!result || result.warnings.length === 0" class="text-slate-400">No warnings</li>
                    <li
                      v-for="warning in result?.warnings || []"
                      :key="warning"
                      class="flex items-start space-x-2 text-slate-600"
                    >
                      <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
                      <span>{{ warning }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="analyze"
        :disabled="!password.trim() || loading"
        class="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-magic mr-2"></i>
        Analyze password
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/crypto/password/analyze</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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

const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const result = ref<{ score: number; strength: string; crackTime: string; suggestions: string[]; warnings: string[]; entropy: number } | null>(null);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const strengthColor = computed(() => {
  if (!result.value) return 'text-slate-400';
  const score = result.value.score;
  if (score <= 1) return 'text-red-600';
  if (score === 2) return 'text-amber-600';
  if (score === 3) return 'text-emerald-600';
  return 'text-blue-600';
});

const barColor = computed(() => {
  if (!result.value) return 'bg-slate-400';
  const score = result.value.score;
  if (score <= 1) return 'bg-red-500';
  if (score === 2) return 'bg-amber-500';
  if (score === 3) return 'bg-emerald-500';
  return 'bg-blue-500';
});

const analyze = async () => {
  if (!password.value.trim() || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.analyzePassword(password.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      result.value = null;
      error.value = response.error || response.message || 'Failed to analyze password';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    result.value = null;
    error.value = err?.message || 'Password analyzer unavailable';
  } finally {
    loading.value = false;
  }
};

</script>
