<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-birthday-cake text-emerald-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Age Calculator</h2>
          </div>
          <p class="text-sm text-slate-600">Calculate exact age from birth date</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
            <input v-model="birthDate" type="date" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Calculate Age As Of</label>
            <input v-model="asOfDate" type="date"
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Age Result</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-emerald-600 text-2xl"></i>
            <p class="text-sm text-slate-500 mt-2">Calculating...</p>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- Main Age Display -->
            <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white text-center">
              <div class="text-5xl font-bold mb-2">{{ result.years }}</div>
              <div class="text-emerald-100">Years Old</div>
            </div>

            <!-- Detailed Breakdown -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-emerald-50 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-emerald-700">{{ result.years }}</div>
                <div class="text-xs text-emerald-600">Years</div>
              </div>
              <div class="bg-teal-50 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-teal-700">{{ result.months }}</div>
                <div class="text-xs text-teal-600">Months</div>
              </div>
              <div class="bg-cyan-50 rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-cyan-700">{{ result.days }}</div>
                <div class="text-xs text-cyan-600">Days</div>
              </div>
            </div>

            <!-- Additional Info -->
            <div class="bg-slate-50 rounded-lg p-4 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-slate-600">Total Days</span>
                <span class="font-medium text-slate-800">{{ result.totalDays?.toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-slate-600">Total Weeks</span>
                <span class="font-medium text-slate-800">{{ result.totalWeeks?.toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-slate-600">Total Months</span>
                <span class="font-medium text-slate-800">{{ result.totalMonths?.toLocaleString() }}</span>
              </div>
              <div v-if="result.nextBirthday" class="flex justify-between text-sm">
                <span class="text-slate-600">Next Birthday</span>
                <span class="font-medium text-slate-800">{{ result.nextBirthday }}</span>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-calendar-day text-4xl mb-2"></i>
            <p>Enter a date to calculate age</p>
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
      <button @click="calculateAge" :disabled="!birthDate || loading"
        class="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-calculator mr-2"></i>
        Calculate Age
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const birthDate = ref('');
const asOfDate = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

onMounted(() => {
  asOfDate.value = new Date().toISOString().split('T')[0];
});

const calculateAge = async () => {
  if (!birthDate.value) return;
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/advanced/calculator/age', {
      birth_date: birthDate.value,
      as_of_date: asOfDate.value || undefined
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to calculate age';
    }
  } catch (err: any) {
    error.value = err.message || 'Error calculating age';
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  birthDate.value = '';
  asOfDate.value = new Date().toISOString().split('T')[0];
  result.value = null;
  error.value = null;
};
</script>

