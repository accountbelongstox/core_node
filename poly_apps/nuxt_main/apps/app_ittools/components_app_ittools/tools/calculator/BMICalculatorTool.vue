<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-weight text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">BMI Calculator</h2>
          </div>
          <p class="text-sm text-slate-600">Calculate Body Mass Index</p>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Unit System</label>
            <div class="flex space-x-4">
              <label class="flex items-center">
                <input type="radio" v-model="unit" value="metric" class="mr-2 text-blue-600" />
                <span>Metric (kg/cm)</span>
              </label>
              <label class="flex items-center">
                <input type="radio" v-model="unit" value="imperial" class="mr-2 text-blue-600" />
                <span>Imperial (lb/ft)</span>
              </label>
            </div>
          </div>

          <div v-if="unit === 'metric'">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">Weight (kg)</label>
                <input v-model.number="weightKg" type="number" step="0.1" min="1" max="500"
                  class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  placeholder="e.g., 70" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                <input v-model.number="heightCm" type="number" min="50" max="300"
                  class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  placeholder="e.g., 175" />
              </div>
            </div>
          </div>

          <div v-else>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">Weight (lbs)</label>
                <input v-model.number="weightLbs" type="number" step="0.1" min="1" max="1000"
                  class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  placeholder="e.g., 154" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Height (feet)</label>
                  <input v-model.number="heightFt" type="number" min="1" max="9"
                    class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" 
                    placeholder="e.g., 5" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Height (inches)</label>
                  <input v-model.number="heightIn" type="number" min="0" max="11"
                    class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" 
                    placeholder="e.g., 9" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">BMI Result</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-blue-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- BMI Display -->
            <div :class="getBmiCardClass(result.category)" class="rounded-xl p-6 text-white text-center">
              <div class="text-5xl font-bold mb-2">{{ result.bmi?.toFixed(1) }}</div>
              <div class="text-lg font-medium opacity-90">{{ result.category }}</div>
            </div>

            <!-- BMI Scale -->
            <div class="bg-slate-50 rounded-lg p-4">
              <div class="relative h-4 bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-500 rounded-full">
                <div class="absolute top-0 h-4 w-1 bg-white border-2 border-slate-800 rounded-full transform -translate-x-1/2"
                  :style="{ left: getBmiPosition(result.bmi) }"></div>
              </div>
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span>Underweight</span>
                <span>Normal</span>
                <span>Overweight</span>
                <span>Obese</span>
              </div>
            </div>

            <!-- BMI Categories -->
            <div class="bg-slate-50 rounded-lg p-4 space-y-2">
              <div v-for="cat in bmiCategories" :key="cat.name" 
                class="flex justify-between text-sm" :class="result.category === cat.name ? 'font-bold' : ''">
                <span :class="result.category === cat.name ? 'text-blue-600' : 'text-slate-600'">{{ cat.name }}</span>
                <span class="text-slate-500">{{ cat.range }}</span>
              </div>
            </div>

            <!-- Health Info -->
            <div v-if="result.healthyWeightRange" class="bg-green-50 border border-green-200 rounded-lg p-4">
              <p class="text-sm text-green-700">
                <i class="fas fa-info-circle mr-2"></i>
                Healthy weight range for your height: <strong>{{ result.healthyWeightRange }}</strong>
              </p>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-weight text-4xl mb-2"></i>
            <p>Enter your weight and height</p>
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
      <button @click="calculateBMI" :disabled="!isValid || loading"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-calculator mr-2"></i>
        Calculate BMI
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

const unit = ref('metric');
const weightKg = ref<number | null>(null);
const heightCm = ref<number | null>(null);
const weightLbs = ref<number | null>(null);
const heightFt = ref<number | null>(null);
const heightIn = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const bmiCategories = [
  { name: 'Underweight', range: '< 18.5' },
  { name: 'Normal', range: '18.5 - 24.9' },
  { name: 'Overweight', range: '25.0 - 29.9' },
  { name: 'Obese', range: '>= 30.0' }
];

const isValid = computed(() => {
  if (unit.value === 'metric') {
    return weightKg.value && weightKg.value > 0 && heightCm.value && heightCm.value > 0;
  }
  return weightLbs.value && weightLbs.value > 0 && heightFt.value && heightFt.value > 0;
});

const calculateBMI = async () => {
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const payload: Record<string, any> = { unit: unit.value };
    if (unit.value === 'metric') {
      payload.weight_kg = weightKg.value;
      payload.height_cm = heightCm.value;
    } else {
      payload.weight_lbs = weightLbs.value;
      payload.height_ft = heightFt.value;
      payload.height_in = heightIn.value || 0;
    }

    const response = await httpClient.post('/api/ittools/v1/advanced/calculator/bmi', payload);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to calculate BMI';
    }
  } catch (err: any) {
    error.value = err.message || 'Error calculating BMI';
  } finally {
    loading.value = false;
  }
};

const getBmiCardClass = (category: string): string => {
  const classes: Record<string, string> = {
    'Underweight': 'bg-gradient-to-br from-blue-500 to-blue-600',
    'Normal': 'bg-gradient-to-br from-green-500 to-green-600',
    'Overweight': 'bg-gradient-to-br from-yellow-500 to-orange-500',
    'Obese': 'bg-gradient-to-br from-red-500 to-red-600'
  };
  return classes[category] || 'bg-gradient-to-br from-slate-500 to-slate-600';
};

const getBmiPosition = (bmi: number): string => {
  if (bmi < 18.5) return `${(bmi / 18.5) * 25}%`;
  if (bmi < 25) return `${25 + ((bmi - 18.5) / 6.5) * 25}%`;
  if (bmi < 30) return `${50 + ((bmi - 25) / 5) * 25}%`;
  return `${Math.min(75 + ((bmi - 30) / 10) * 25, 100)}%`;
};

const reset = () => {
  weightKg.value = null;
  heightCm.value = null;
  weightLbs.value = null;
  heightFt.value = null;
  heightIn.value = null;
  result.value = null;
  error.value = null;
};
</script>

