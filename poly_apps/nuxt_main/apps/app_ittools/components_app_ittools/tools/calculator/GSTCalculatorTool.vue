<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-percent text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">GST/VAT Calculator</h2>
          </div>
          <p class="text-sm text-slate-600">Calculate GST/VAT inclusive and exclusive amounts</p>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Calculation Type</label>
            <div class="grid grid-cols-2 gap-3">
              <button @click="calcType = 'add'" 
                :class="calcType === 'add' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg font-medium transition">
                Add GST
              </button>
              <button @click="calcType = 'remove'" 
                :class="calcType === 'remove' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'"
                class="px-4 py-3 rounded-lg font-medium transition">
                Remove GST
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              {{ calcType === 'add' ? 'Amount (Excluding GST)' : 'Amount (Including GST)' }}
            </label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input v-model.number="amount" type="number" step="0.01" min="0"
                class="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" 
                placeholder="Enter amount" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">GST/VAT Rate (%)</label>
            <div class="flex space-x-3">
              <input v-model.number="gstRate" type="number" step="0.1" min="0" max="100"
                class="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" 
                placeholder="e.g., 18" />
              <div class="flex space-x-2">
                <button v-for="rate in commonRates" :key="rate" @click="gstRate = rate"
                  :class="gstRate === rate ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600'"
                  class="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-indigo-50 transition">
                  {{ rate }}%
                </button>
              </div>
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
            <i class="fas fa-spinner fa-spin text-indigo-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- Final Amount -->
            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white text-center">
              <div class="text-sm opacity-80 mb-1">
                {{ calcType === 'add' ? 'Total (Including GST)' : 'Net Amount (Excluding GST)' }}
              </div>
              <div class="text-4xl font-bold">${{ formatCurrency(result.finalAmount) }}</div>
            </div>

            <!-- Breakdown -->
            <div class="space-y-3">
              <div class="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <span class="text-slate-600">{{ calcType === 'add' ? 'Original Amount' : 'Net Amount' }}</span>
                <span class="text-lg font-bold text-slate-800">${{ formatCurrency(result.baseAmount) }}</span>
              </div>
              <div class="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                <span class="text-indigo-600">GST Amount ({{ gstRate }}%)</span>
                <span class="text-lg font-bold text-indigo-700">${{ formatCurrency(result.gstAmount) }}</span>
              </div>
              <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                <span class="text-purple-600 font-medium">{{ calcType === 'add' ? 'Final Amount' : 'Original (GST Inclusive)' }}</span>
                <span class="text-xl font-bold text-purple-700">${{ formatCurrency(result.finalAmount) }}</span>
              </div>
            </div>

            <!-- Formula Display -->
            <div class="bg-slate-100 rounded-lg p-4 text-center">
              <code class="text-sm text-slate-600">
                <template v-if="calcType === 'add'">
                  {{ formatCurrency(result.baseAmount) }} + {{ formatCurrency(result.gstAmount) }} = {{ formatCurrency(result.finalAmount) }}
                </template>
                <template v-else>
                  {{ formatCurrency(result.originalAmount) }} - {{ formatCurrency(result.gstAmount) }} = {{ formatCurrency(result.baseAmount) }}
                </template>
              </code>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-percent text-4xl mb-2"></i>
            <p>Enter amount and GST rate</p>
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
      <button @click="calculateGST" :disabled="!isValid || loading"
        class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-calculator mr-2"></i>
        Calculate
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const calcType = ref<'add' | 'remove'>('add');
const amount = ref<number | null>(null);
const gstRate = ref<number | null>(18);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const commonRates = [5, 12, 18, 28];

const isValid = computed(() => amount.value && amount.value > 0 && gstRate.value && gstRate.value > 0);

const formatCurrency = (value: number): string => {
  return value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
};

const calculateGST = async () => {
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/advanced/calculator/gst', {
      amount: amount.value,
      gst_rate: gstRate.value,
      calculation_type: calcType.value
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to calculate GST';
    }
  } catch (err: any) {
    error.value = err.message || 'Error calculating GST';
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  amount.value = null;
  gstRate.value = 18;
  calcType.value = 'add';
  result.value = null;
  error.value = null;
};
</script>

