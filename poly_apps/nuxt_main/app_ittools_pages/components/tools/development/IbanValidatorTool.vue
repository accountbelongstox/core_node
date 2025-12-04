<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-emerald-500 to-green-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-university text-white"></i>
            <h2 class="text-2xl font-semibold text-white">IBAN Validator</h2>
          </div>
          <p class="text-sm text-emerald-100">Validate and parse IBAN numbers</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">IBAN Number</label>
            <input v-model="iban" type="text" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-lg uppercase"
              placeholder="DE89 3704 0044 0532 0130 00" @input="validate" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Example IBANs</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="example in examples" :key="example.iban" @click="iban = example.iban; validate()"
                class="px-3 py-2 bg-slate-100 hover:bg-emerald-100 rounded-lg text-sm transition">
                <div class="font-mono text-xs">{{ example.iban.slice(0, 8) }}...</div>
                <div class="text-xs text-slate-500">{{ example.country }}</div>
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Validation Result</h3>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-emerald-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <div :class="result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
              class="border rounded-xl p-4 flex items-center space-x-3">
              <i :class="result.valid ? 'fas fa-check-circle text-green-600' : 'fas fa-times-circle text-red-600'" class="text-3xl"></i>
              <div>
                <div :class="result.valid ? 'text-green-700' : 'text-red-700'" class="font-medium text-lg">
                  {{ result.valid ? 'Valid IBAN' : 'Invalid IBAN' }}
                </div>
                <div v-if="result.error" class="text-sm text-red-600">{{ result.error }}</div>
              </div>
            </div>

            <div v-if="result.valid" class="border border-slate-200 rounded-lg overflow-hidden divide-y">
              <div class="px-4 py-3 flex justify-between">
                <span class="text-slate-600">Country</span>
                <span class="font-medium">{{ result.country }} ({{ result.countryCode }})</span>
              </div>
              <div class="px-4 py-3 flex justify-between">
                <span class="text-slate-600">Check Digits</span>
                <span class="font-mono">{{ result.checkDigits }}</span>
              </div>
              <div class="px-4 py-3 flex justify-between">
                <span class="text-slate-600">BBAN</span>
                <span class="font-mono text-sm">{{ result.bban }}</span>
              </div>
              <div v-if="result.bankCode" class="px-4 py-3 flex justify-between">
                <span class="text-slate-600">Bank Code</span>
                <span class="font-mono">{{ result.bankCode }}</span>
              </div>
              <div v-if="result.accountNumber" class="px-4 py-3 flex justify-between">
                <span class="text-slate-600">Account Number</span>
                <span class="font-mono">{{ result.accountNumber }}</span>
              </div>
            </div>

            <div v-if="result.valid" class="bg-slate-50 rounded-lg p-4">
              <div class="text-xs text-slate-500 mb-2">Formatted IBAN</div>
              <div class="font-mono text-lg text-emerald-700 flex items-center justify-between">
                <span>{{ result.formatted }}</span>
                <button @click="copy(result.formatted)" class="text-slate-400 hover:text-emerald-600">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-university text-4xl mb-2"></i>
            <p>Enter an IBAN to validate</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const iban = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const examples = [
  { iban: 'DE89370400440532013000', country: 'Germany' },
  { iban: 'GB29NWBK60161331926819', country: 'UK' },
  { iban: 'FR1420041010050500013M02606', country: 'France' },
  { iban: 'ES9121000418450200051332', country: 'Spain' }
];

let debounceTimer: any;

const validate = async () => {
  if (!iban.value.trim()) {
    result.value = null;
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await httpClient.post('/api/ittools/v1/text/iban/validate', {
        iban: iban.value.replace(/\s/g, '')
      });

      if (response.success && response.data) {
        result.value = response.data;
      } else {
        result.value = { valid: false, error: response.error || 'Validation failed' };
      }
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }, 300);
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text.replace(/\s/g, ''));
  } catch {}
};
</script>

