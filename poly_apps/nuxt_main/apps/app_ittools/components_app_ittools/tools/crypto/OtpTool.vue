<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-cyan-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-mobile-alt text-cyan-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-700">Crypto</span>
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
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Base32 secret</label>
            <input
              v-model="secret"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="JBSWY3DPEHPK3PXP"
            />
            <p class="mt-1 text-xs text-slate-400">Compatible with Google Authenticator, Authy, etc.</p>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Mode</label>
              <select
                v-model="mode"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              >
                <option value="generate">Generate code</option>
                <option value="verify">Verify code</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Type</label>
              <select
                v-model="otpType"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              >
                <option value="totp">TOTP (Time-based)</option>
                <option value="hotp">HOTP (Counter-based)</option>
              </select>
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Digits</label>
              <input
                v-model.number="digits"
                type="number"
                min="4"
                max="8"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Period (seconds)</label>
              <input
                v-model.number="period"
                type="number"
                min="15"
                max="300"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div v-if="otpType === 'hotp'" class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Counter</label>
              <input
                v-model.number="counter"
                type="number"
                min="0"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div v-if="mode === 'verify'">
            <label class="block text-sm font-medium text-slate-700 mb-2">OTP code</label>
            <input
              v-model="code"
              type="text"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              placeholder="123456"
            />
          </div>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <div class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">{{ mode === 'generate' ? 'Generated code' : 'Verification result' }}</h3>
                <p class="text-xs text-slate-500">
                  {{ mode === 'generate' ? 'Time remaining updates every request for TOTP.' : 'Validation result for the provided code.' }}
                </p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>

            <div class="px-5 py-4">
              <div v-if="mode === 'generate'" class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-4xl font-semibold tracking-widest text-slate-800">
                    {{ result?.code || '———' }}
                  </div>
                  <button
                    @click="copyCode"
                    :disabled="!result?.code"
                    class="text-xs px-3 py-2 rounded-lg border border-cyan-200 text-cyan-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <i class="fas fa-copy mr-1"></i>
                    Copy code
                  </button>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-500">
                  <span>Digits: {{ digits }}</span>
                  <span v-if="result?.remainingTime !== undefined">Expires in {{ result.remainingTime }}s</span>
                </div>
              </div>

              <div v-else class="flex items-center justify-between rounded-xl border px-4 py-3"
                :class="{
                  'bg-emerald-50 border-emerald-200 text-emerald-600': verifyStatus === true,
                  'bg-red-50 border-red-200 text-red-600': verifyStatus === false,
                  'bg-slate-50 border-slate-200 text-slate-500': verifyStatus === null
                }"
              >
                <div class="flex items-center space-x-3">
                  <i
                    v-if="verifyStatus === true"
                    class="fas fa-check-circle text-lg"
                  ></i>
                  <i
                    v-else-if="verifyStatus === false"
                    class="fas fa-times-circle text-lg"
                  ></i>
                  <i v-else class="fas fa-info-circle text-lg"></i>
                  <div>
                    <p class="text-sm font-semibold">
                      <span v-if="verifyStatus === true">OTP is valid</span>
                      <span v-else-if="verifyStatus === false">OTP is invalid</span>
                      <span v-else>Awaiting verification…</span>
                    </p>
                    <p v-if="error" class="text-xs text-red-500 mt-1">{{ error }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p class="text-xs text-slate-500">
            TOTP (RFC 6238) uses the current Unix time divided by the period. HOTP (RFC 4226) increments a counter. Ensure client/server secrets match.
          </p>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="handleAction"
        :disabled="!canSubmit || loading"
        class="px-5 py-2 rounded-lg bg-cyan-500 text-white font-medium shadow hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas mr-2" :class="mode === 'generate' ? 'fa-bolt' : 'fa-check-circle'"></i>
        {{ mode === 'generate' ? 'Generate code' : 'Verify code' }}
      </button>
      <div class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/crypto/otp/{{ mode === 'generate' ? 'generate' : 'verify' }}</code></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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

const secret = ref('');
const mode = ref<'generate' | 'verify'>('generate');
const otpType = ref<'totp' | 'hotp'>('totp');
const digits = ref(6);
const period = ref(30);
const counter = ref(0);
const code = ref('');
const loading = ref(false);
const result = ref<{ code?: string; remainingTime?: number } | null>(null);
const verifyStatus = ref<boolean | null>(null);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canSubmit = computed(() => {
  if (!secret.value.trim()) return false;
  if (mode.value === 'verify' && !code.value.trim()) return false;
  return true;
});

watch(digits, (value) => {
  if (value < 4) digits.value = 4;
  if (value > 8) digits.value = 8;
});

watch(period, (value) => {
  if (value < 15) period.value = 15;
  if (value > 300) period.value = 300;
});

watch(counter, (value) => {
  if (value < 0) counter.value = 0;
});

watch(mode, () => {
  result.value = null;
  verifyStatus.value = null;
  error.value = null;
});

watch(otpType, () => {
  verifyStatus.value = null;
  result.value = null;
});

const handleAction = async () => {
  if (!canSubmit.value || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    if (mode.value === 'generate') {
      const response = await props.api.generateOtp(
        secret.value,
        otpType.value,
        digits.value,
        period.value,
        otpType.value === 'hotp' ? counter.value : undefined
      );
      executionTime.value = Math.round(performance.now() - start);

      if (response.success && response.data) {
        result.value = response.data;
        verifyStatus.value = null;
        emit('executed', response.data);
      } else {
        result.value = null;
        error.value = response.error || response.message || 'Failed to generate OTP';
      }
    } else {
      const response = await props.api.verifyOtp(secret.value, code.value, otpType.value);
      executionTime.value = Math.round(performance.now() - start);

      if (response.success && response.data) {
        verifyStatus.value = Boolean(response.data.valid);
        result.value = null;
        emit('executed', response.data);
      } else {
        verifyStatus.value = null;
        error.value = response.error || response.message || 'Failed to verify OTP';
      }
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    if (mode.value === 'generate') {
      result.value = null;
    } else {
      verifyStatus.value = null;
    }
    error.value = err?.message || 'OTP request failed';
  } finally {
    loading.value = false;
  }
};

const copyCode = async () => {
  if (!result.value?.code) return;
  try {
    await navigator.clipboard.writeText(result.value.code);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};
</script>
