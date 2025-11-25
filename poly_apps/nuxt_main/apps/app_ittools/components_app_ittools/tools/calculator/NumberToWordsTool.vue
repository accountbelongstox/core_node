<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-spell-check text-cyan-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Number to Words</h2>
          </div>
          <p class="text-sm text-slate-600">Convert numbers to written words</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Number</label>
            <input v-model="inputNumber" type="text" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 font-mono text-lg" 
              placeholder="e.g., 12345.67" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Language</label>
            <select v-model="language" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
              <option value="en">English</option>
              <option value="zh">Chinese</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Format</label>
            <div class="grid grid-cols-2 gap-3">
              <button @click="format = 'standard'" 
                :class="format === 'standard' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg font-medium transition">
                Standard
              </button>
              <button @click="format = 'currency'" 
                :class="format === 'currency' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg font-medium transition">
                Currency
              </button>
            </div>
          </div>

          <div v-if="format === 'currency'">
            <label class="block text-sm font-medium text-slate-700 mb-2">Currency</label>
            <select v-model="currency" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="GBP">British Pound (GBP)</option>
              <option value="CNY">Chinese Yuan (CNY)</option>
              <option value="JPY">Japanese Yen (JPY)</option>
              <option value="INR">Indian Rupee (INR)</option>
            </select>
          </div>

          <!-- Quick Examples -->
          <div class="pt-4 border-t">
            <label class="block text-sm font-medium text-slate-700 mb-2">Quick Examples</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="example in examples" :key="example" @click="inputNumber = example"
                class="px-3 py-1 bg-slate-100 hover:bg-cyan-100 text-slate-600 rounded-lg text-sm transition">
                {{ example }}
              </button>
            </div>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Result</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-cyan-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- Main Result -->
            <div class="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-6 text-white">
              <div class="text-sm opacity-80 mb-2">Written Form</div>
              <div class="text-xl font-medium leading-relaxed">{{ result.words }}</div>
            </div>

            <!-- Formatted Number -->
            <div class="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
              <span class="text-slate-600">Formatted Number</span>
              <span class="font-mono text-lg text-slate-800">{{ result.formatted }}</span>
            </div>

            <!-- Additional Info -->
            <div v-if="result.ordinal" class="bg-cyan-50 rounded-lg p-4">
              <div class="text-xs text-cyan-600 mb-1">Ordinal Form</div>
              <div class="font-medium text-cyan-800">{{ result.ordinal }}</div>
            </div>

            <!-- Copy Button -->
            <button @click="copyResult" 
              class="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition flex items-center justify-center space-x-2">
              <i :class="copied ? 'fas fa-check text-green-600' : 'fas fa-copy'"></i>
              <span>{{ copied ? 'Copied!' : 'Copy to Clipboard' }}</span>
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-spell-check text-4xl mb-2"></i>
            <p>Enter a number to convert</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        Reset
      </button>
      <button @click="convertNumber" :disabled="!inputNumber || loading"
        class="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-exchange-alt mr-2"></i>
        Convert
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

const inputNumber = ref('');
const language = ref('en');
const format = ref<'standard' | 'currency'>('standard');
const currency = ref('USD');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);
const copied = ref(false);

const examples = ['123', '1000', '12345', '1000000', '123.45', '999999999'];

const convertNumber = async () => {
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/advanced/calculator/number-to-words', {
      number: inputNumber.value,
      language: language.value,
      format: format.value,
      currency: format.value === 'currency' ? currency.value : undefined
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to convert number';
    }
  } catch (err: any) {
    error.value = err.message || 'Error converting number';
  } finally {
    loading.value = false;
  }
};

const copyResult = async () => {
  if (!result.value?.words) return;
  try {
    await navigator.clipboard.writeText(result.value.words);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    error.value = 'Failed to copy to clipboard';
  }
};

const reset = () => {
  inputNumber.value = '';
  result.value = null;
  error.value = null;
};
</script>

