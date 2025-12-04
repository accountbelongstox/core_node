<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-lock text-slate-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-200 text-slate-700">Crypto</span>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition"
            title="Close"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Hash creator -->
        <section class="border border-slate-200 rounded-xl shadow-sm bg-white">
          <header class="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Generate bcrypt hash</h3>
              <p class="text-xs text-slate-500">Use for storing passwords securely.</p>
            </div>
            <span class="text-xs font-medium text-slate-400">POST /crypto/bcrypt/hash</span>
          </header>

          <div class="px-5 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                v-model="hashPassword"
                type="text"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
                placeholder="Enter password to hash"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Salt rounds</label>
              <div class="flex items-center space-x-3">
                <input
                  v-model.number="hashRounds"
                  type="number"
                  min="4"
                  max="31"
                  class="w-32 px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent transition text-center"
                />
                <span class="text-xs text-slate-500">Higher rounds increase security and execution time.</span>
              </div>
            </div>
          </div>

          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="resetHash"
              class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Reset
            </button>
            <button
              @click="executeHash"
              :disabled="hashPassword.trim().length === 0 || hashLoading"
              class="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium shadow hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="hashLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-lock mr-2"></i>
              Generate hash
            </button>
          </footer>

          <div class="px-5 pb-5">
            <div class="text-xs text-slate-500 flex items-center justify-between mb-2">
              <span>Result</span>
              <div class="flex items-center space-x-3">
                <div v-if="hashExecutionTime" class="flex items-center space-x-1 text-slate-400">
                  <i class="fas fa-stopwatch"></i>
                  <span>{{ hashExecutionTime }} ms</span>
                </div>
                <button
                  @click="copyHash"
                  :disabled="!hashResult"
                  class="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i class="fas fa-copy mr-1"></i>
                  {{ copiedHash ? 'Copied!' : 'Copy hash' }}
                </button>
              </div>
            </div>
            <div class="min-h-[120px] border border-slate-200 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs p-3">
              <div v-if="hashError" class="text-red-300">{{ hashError }}</div>
              <div v-else-if="hashResult" class="break-all leading-relaxed">{{ hashResult }}</div>
              <div v-else class="text-slate-500">Hash output will appear here…</div>
            </div>
          </div>
        </section>

        <!-- Verifier -->
        <section class="border border-slate-200 rounded-xl shadow-sm bg-white">
          <header class="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Verify password against hash</h3>
              <p class="text-xs text-slate-500">Validate user input using stored bcrypt hash.</p>
            </div>
            <span class="text-xs font-medium text-slate-400">POST /crypto/bcrypt/verify</span>
          </header>

          <div class="px-5 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                v-model="verifyPassword"
                type="text"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
                placeholder="Enter password to verify"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Existing bcrypt hash</label>
              <textarea
                v-model="verifyHash"
                rows="4"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent transition font-mono text-xs"
                placeholder="$2b$10$..."
              ></textarea>
            </div>
          </div>

          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="resetVerify"
              class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Reset
            </button>
            <button
              @click="executeVerify"
              :disabled="verifyDisabled"
              class="px-5 py-2 rounded-lg bg-emerald-500 text-white font-medium shadow hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="verifyLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-check-circle mr-2"></i>
              Verify password
            </button>
          </footer>

          <div class="px-5 pb-5">
            <div class="flex items-center justify-between text-xs mb-2">
              <span class="text-slate-500">Verification result</span>
              <div v-if="verifyExecutionTime" class="flex items-center space-x-1 text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span>{{ verifyExecutionTime }} ms</span>
              </div>
            </div>

            <div class="border border-slate-200 rounded-xl p-4 min-h-[80px] flex items-center"
              :class="{
                'bg-emerald-50 border-emerald-200': verifyResult === true,
                'bg-red-50 border-red-200': verifyResult === false,
                'bg-slate-50': verifyResult === null
              }"
            >
              <div class="flex items-center space-x-3">
                <i
                  v-if="verifyResult === true"
                  class="fas fa-shield-alt text-emerald-500 text-lg"
                ></i>
                <i
                  v-else-if="verifyResult === false"
                  class="fas fa-exclamation-triangle text-red-500 text-lg"
                ></i>
                <i v-else class="fas fa-info-circle text-slate-400 text-lg"></i>
                <div>
                  <p v-if="verifyResult === true" class="text-sm font-semibold text-emerald-600">Password is valid</p>
                  <p v-else-if="verifyResult === false" class="text-sm font-semibold text-red-600">Password does not match</p>
                  <p v-else class="text-sm text-slate-500">Awaiting verification…</p>
                  <p v-if="verifyError" class="text-xs text-red-500 mt-1">{{ verifyError }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Bcrypt cost factor range: 4-31</span>
      <span>Salts generated server-side for each request</span>
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

// Hash states
const hashPassword = ref('');
const hashRounds = ref(10);
const hashLoading = ref(false);
const hashResult = ref('');
const hashError = ref<string | null>(null);
const hashExecutionTime = ref<number | null>(null);
const copiedHash = ref(false);

// Verify states
const verifyPassword = ref('');
const verifyHash = ref('');
const verifyLoading = ref(false);
const verifyResult = ref<boolean | null>(null);
const verifyError = ref<string | null>(null);
const verifyExecutionTime = ref<number | null>(null);

const verifyDisabled = computed(() => {
  return verifyPassword.value.trim().length === 0 || verifyHash.value.trim().length === 0 || verifyLoading.value;
});

watch(hashRounds, (value) => {
  if (value < 4) hashRounds.value = 4;
  if (value > 31) hashRounds.value = 31;
});

const executeHash = async () => {
  hashLoading.value = true;
  hashError.value = null;
  hashExecutionTime.value = null;
  copiedHash.value = false;

  const start = performance.now();

  try {
    const response = await props.api.bcryptHash(hashPassword.value, hashRounds.value);
    hashExecutionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.hash) {
      hashResult.value = response.data.hash;
      emit('executed', response.data);
    } else {
      hashError.value = response.error || response.message || 'Failed to generate bcrypt hash';
      hashResult.value = '';
    }
  } catch (err: any) {
    hashExecutionTime.value = Math.round(performance.now() - start);
    hashError.value = err?.message || 'Unable to complete hash request';
    hashResult.value = '';
  } finally {
    hashLoading.value = false;
  }
};

const executeVerify = async () => {
  verifyLoading.value = true;
  verifyError.value = null;
  verifyExecutionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.bcryptVerify(verifyPassword.value, verifyHash.value);
    verifyExecutionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      verifyResult.value = Boolean(response.data.valid);
      emit('executed', response.data);
    } else {
      verifyResult.value = null;
      verifyError.value = response.error || response.message || 'Verification failed';
    }
  } catch (err: any) {
    verifyExecutionTime.value = Math.round(performance.now() - start);
    verifyResult.value = null;
    verifyError.value = err?.message || 'Unable to verify hash right now';
  } finally {
    verifyLoading.value = false;
  }
};

const copyHash = async () => {
  if (!hashResult.value) return;
  try {
    await navigator.clipboard.writeText(hashResult.value);
    copiedHash.value = true;
    setTimeout(() => (copiedHash.value = false), 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const resetHash = () => {
  hashPassword.value = '';
  hashRounds.value = 10;
  hashResult.value = '';
  hashError.value = null;
  hashExecutionTime.value = null;
  copiedHash.value = false;
};

const resetVerify = () => {
  verifyPassword.value = '';
  verifyHash.value = '';
  verifyResult.value = null;
  verifyError.value = null;
  verifyExecutionTime.value = null;
};

</script>
