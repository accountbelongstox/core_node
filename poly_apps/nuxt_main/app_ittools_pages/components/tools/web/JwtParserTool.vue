<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-rose-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-key text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">JWT Token</h3>
              <p class="text-xs text-slate-500">Paste a JWT to decode header & payload.</p>
            </div>
            <button @click="useSample" class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Sample</button>
          </header>
          <textarea
            v-model="token"
            rows="10"
            class="w-full px-4 py-3 border-0 rounded-b-xl font-mono text-xs bg-slate-900 text-amber-100 focus:outline-none"
            spellcheck="false"
          ></textarea>
          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="decode"
              :disabled="!canDecode"
              class="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-50"
            >
              <i v-if="decodeLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-unlock mr-2"></i>
              Decode JWT
            </button>
            <span class="text-xs text-slate-500" v-if="decodeTime"><i class="fas fa-stopwatch mr-1"></i>{{ decodeTime }} ms</span>
          </footer>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Verification</h3>
            <p class="text-xs text-slate-500">Optional secret-based verification for HS* algorithms.</p>
          </header>
          <div class="px-5 py-4 space-y-3">
            <label class="space-y-1 text-sm text-slate-600">
              <span>Shared secret</span>
              <input v-model="secret" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-transparent" placeholder="your-secret-key">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Algorithm</span>
              <select v-model="algorithm" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-transparent">
                <option value="HS256">HS256</option>
                <option value="HS384">HS384</option>
                <option value="HS512">HS512</option>
              </select>
            </label>
          </div>
          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="verify"
              :disabled="!canVerify"
              class="px-5 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 disabled:opacity-50"
            >
              <i v-if="verifyLoading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-shield-check mr-2"></i>
              Verify Signature
            </button>
            <span class="text-xs text-slate-500" v-if="verifyTime"><i class="fas fa-stopwatch mr-1"></i>{{ verifyTime }} ms</span>
          </footer>
          <p v-if="verifyResult" class="px-5 pb-4 text-sm" :class="verifyResult.valid ? 'text-emerald-600' : 'text-rose-600'">
            {{ verifyResult.valid ? 'Token signature valid' : 'Token signature invalid' }}
            <span v-if="verifyResult.expired" class="text-rose-500 font-semibold">· expired</span>
          </p>
        </section>
        <p v-if="verifyError" class="px-5 pb-4 text-sm text-red-600">{{ verifyError }}</p>
      </div>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-700">Decoded contents</h3>
          <div class="flex items-center space-x-2 text-xs text-slate-400">
            <button @click="copyJson" :disabled="!decoded" class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <i class="fas fa-copy mr-1"></i>
              Copy JSON
            </button>
          </div>
        </header>
        <div class="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div class="p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Header</p>
            <pre class="mt-2 bg-slate-900 text-amber-200 rounded-lg p-3 text-xs min-h-[8rem]">{{ decoded?.header }}</pre>
          </div>
          <div class="p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Payload</p>
            <pre class="mt-2 bg-slate-900 text-emerald-200 rounded-lg p-3 text-xs min-h-[8rem]">{{ decoded?.payload }}</pre>
          </div>
          <div class="p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Signature</p>
            <div class="mt-2 bg-slate-900 text-rose-200 rounded-lg p-3 text-xs min-h-[8rem] break-words">{{ decoded?.signature }}</div>
          </div>
        </div>
        <p v-if="decodeError" class="px-5 py-4 text-sm text-red-600">{{ decodeError }}</p>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Decode: <code class="text-slate-700">/web/jwt/parse</code></span>
      <span>Verify: <code class="text-slate-700">/web/jwt/verify</code></span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJpdHRvb2xzIiwiYXVkIjoiZGV2ZWxvcGVycyIsImV4cCI6MTk5OTk5OTk5OSwicm9sZXMiOlsiYWRtaW4iXX0.dP71xO3cu6UytzszbmWzxubUoil58x2oyS9MhUlCT3E';

const token = ref(sampleToken);
const secret = ref('super-secret-key');
const algorithm = ref('HS256');
const decoded = ref<{ header: string; payload: string; signature: string } | null>(null);
const verifyResult = ref<{ valid: boolean; expired?: boolean } | null>(null);
const decodeLoading = ref(false);
const verifyLoading = ref(false);
const decodeError = ref<string | null>(null);
const verifyError = ref<string | null>(null);
const decodeTime = ref<number | null>(null);
const verifyTime = ref<number | null>(null);

const canDecode = computed(() => token.value.trim().length > 0 && !decodeLoading.value);
const canVerify = computed(() => canDecode.value && secret.value.trim().length > 0 && !verifyLoading.value);

const decode = async () => {
  if (!canDecode.value) return;
  decodeLoading.value = true;
  decodeError.value = null;
  decodeTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.parseJwt(token.value.trim());
    decodeTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      decoded.value = {
        header: JSON.stringify(response.data.header, null, 2),
        payload: JSON.stringify(response.data.payload, null, 2),
        signature: response.data.signature
      };
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to decode JWT');
    }
  } catch (err: any) {
    decodeTime.value = Math.round(performance.now() - start);
    decodeError.value = err?.message || 'JWT parse service unavailable';
    decoded.value = null;
  } finally {
    decodeLoading.value = false;
  }
};

const verify = async () => {
  if (!canVerify.value) return;
  verifyLoading.value = true;
  verifyError.value = null;
  verifyTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.verifyJwt(token.value.trim(), secret.value.trim(), algorithm.value);
    verifyTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      verifyResult.value = {
        valid: !!response.data.valid,
        expired: response.data.expired
      };
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to verify JWT');
    }
  } catch (err: any) {
    verifyTime.value = Math.round(performance.now() - start);
    verifyError.value = err?.message || 'JWT verify service unavailable';
    verifyResult.value = null;
  } finally {
    verifyLoading.value = false;
  }
};

const copyJson = async () => {
  if (!decoded.value) return;
  const payload = {
    header: decoded.value.header,
    payload: decoded.value.payload,
    signature: decoded.value.signature
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Copy failed', err);
  }
};

const useSample = () => {
  token.value = sampleToken;
};

decode();
</script>
