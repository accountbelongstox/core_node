<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-money-bill-wave text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Loan EMI Calculator</h2>
          </div>
          <p class="text-sm text-slate-600">Calculate monthly EMI for loans</p>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Loan Amount</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input v-model.number="principal" type="number" min="1000"
                class="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500" 
                placeholder="e.g., 100000" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Interest Rate (% per year)</label>
            <input v-model.number="interestRate" type="number" step="0.1" min="0.1" max="50"
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500" 
              placeholder="e.g., 7.5" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Loan Tenure</label>
            <div class="flex space-x-4">
              <input v-model.number="tenure" type="number" min="1"
                class="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500" 
                placeholder="e.g., 20" />
              <select v-model="tenureType" class="px-4 py-3 border border-slate-200 rounded-lg">
                <option value="years">Years</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Start Date (optional)</label>
            <input v-model="startDate" type="date"
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">EMI Result</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-amber-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- Monthly EMI -->
            <div class="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white text-center">
              <div class="text-sm opacity-80 mb-1">Monthly EMI</div>
              <div class="text-4xl font-bold">${{ result.emi?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</div>
            </div>

            <!-- Payment Breakdown -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-xs text-blue-600 mb-1">Principal Amount</div>
                <div class="text-lg font-bold text-blue-700">${{ result.principal?.toLocaleString() }}</div>
              </div>
              <div class="bg-red-50 rounded-lg p-4">
                <div class="text-xs text-red-600 mb-1">Total Interest</div>
                <div class="text-lg font-bold text-red-700">${{ result.totalInterest?.toLocaleString(undefined, {maximumFractionDigits: 0}) }}</div>
              </div>
            </div>

            <div class="bg-green-50 rounded-lg p-4">
              <div class="text-xs text-green-600 mb-1">Total Payment</div>
              <div class="text-xl font-bold text-green-700">${{ result.totalPayment?.toLocaleString(undefined, {maximumFractionDigits: 0}) }}</div>
            </div>

            <!-- Visual Breakdown -->
            <div class="bg-slate-50 rounded-lg p-4">
              <div class="flex h-4 rounded-full overflow-hidden">
                <div class="bg-blue-500" :style="{ width: principalPercent + '%' }"></div>
                <div class="bg-red-500" :style="{ width: interestPercent + '%' }"></div>
              </div>
              <div class="flex justify-between text-xs text-slate-500 mt-2">
                <span><span class="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>Principal ({{ principalPercent?.toFixed(1) }}%)</span>
                <span><span class="inline-block w-3 h-3 bg-red-500 rounded-full mr-1"></span>Interest ({{ interestPercent?.toFixed(1) }}%)</span>
              </div>
            </div>

            <!-- Loan Details -->
            <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">Number of Payments</span>
                <span class="font-medium text-slate-800">{{ result.numberOfPayments }} months</span>
              </div>
              <div v-if="result.endDate" class="flex justify-between">
                <span class="text-slate-600">Payoff Date</span>
                <span class="font-medium text-slate-800">{{ result.endDate }}</span>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-money-bill-wave text-4xl mb-2"></i>
            <p>Enter loan details to calculate EMI</p>
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
      <button @click="calculateEMI" :disabled="!isValid || loading"
        class="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-calculator mr-2"></i>
        Calculate EMI
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

const principal = ref<number | null>(null);
const interestRate = ref<number | null>(null);
const tenure = ref<number | null>(null);
const tenureType = ref('years');
const startDate = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const isValid = computed(() => principal.value && principal.value > 0 && interestRate.value && interestRate.value > 0 && tenure.value && tenure.value > 0);

const principalPercent = computed(() => {
  if (!result.value?.totalPayment) return 0;
  return (result.value.principal / result.value.totalPayment) * 100;
});

const interestPercent = computed(() => {
  if (!result.value?.totalPayment) return 0;
  return (result.value.totalInterest / result.value.totalPayment) * 100;
});

const calculateEMI = async () => {
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/advanced/calculator/loan-emi', {
      principal: principal.value,
      interest_rate: interestRate.value,
      tenure: tenure.value,
      tenure_type: tenureType.value,
      start_date: startDate.value || undefined
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to calculate EMI';
    }
  } catch (err: any) {
    error.value = err.message || 'Error calculating EMI';
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  principal.value = null;
  interestRate.value = null;
  tenure.value = null;
  tenureType.value = 'years';
  startDate.value = '';
  result.value = null;
  error.value = null;
};
</script>

