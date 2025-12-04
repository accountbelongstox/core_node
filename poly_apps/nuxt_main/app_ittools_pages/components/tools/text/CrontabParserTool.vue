<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-clock text-teal-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Crontab Parser</h2>
          </div>
          <p class="text-sm text-slate-600">Parse and explain cron expressions</p>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Cron Expression</label>
            <input v-model="cronExpression" type="text" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-lg"
              placeholder="* * * * *" />
          </div>

          <!-- Cron Fields -->
          <div class="bg-slate-50 rounded-lg p-4">
            <div class="grid grid-cols-5 gap-2 text-center text-xs">
              <div>
                <div class="font-medium text-slate-700 mb-1">Minute</div>
                <div class="text-slate-400">0-59</div>
              </div>
              <div>
                <div class="font-medium text-slate-700 mb-1">Hour</div>
                <div class="text-slate-400">0-23</div>
              </div>
              <div>
                <div class="font-medium text-slate-700 mb-1">Day</div>
                <div class="text-slate-400">1-31</div>
              </div>
              <div>
                <div class="font-medium text-slate-700 mb-1">Month</div>
                <div class="text-slate-400">1-12</div>
              </div>
              <div>
                <div class="font-medium text-slate-700 mb-1">Weekday</div>
                <div class="text-slate-400">0-6</div>
              </div>
            </div>
          </div>

          <!-- Common Examples -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Common Examples</label>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="example in examples" :key="example.cron" @click="cronExpression = example.cron"
                class="px-3 py-2 bg-slate-100 hover:bg-teal-100 text-left rounded-lg text-sm transition">
                <div class="font-mono text-teal-600">{{ example.cron }}</div>
                <div class="text-xs text-slate-500">{{ example.desc }}</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Explanation</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-teal-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- Human Readable -->
            <div class="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-6 text-white">
              <div class="text-sm opacity-80 mb-1">Runs</div>
              <div class="text-lg font-medium">{{ result.description }}</div>
            </div>

            <!-- Field Breakdown -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <div class="bg-slate-100 px-4 py-2 border-b">
                <span class="text-sm font-medium text-slate-700">Field Breakdown</span>
              </div>
              <div class="divide-y">
                <div v-for="field in result.fields" :key="field.name" class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">{{ field.name }}</span>
                  <span class="font-mono text-teal-600">{{ field.value }} <span class="text-slate-400 text-sm">({{ field.meaning }})</span></span>
                </div>
              </div>
            </div>

            <!-- Next Runs -->
            <div v-if="result.nextRuns?.length" class="border border-slate-200 rounded-lg overflow-hidden">
              <div class="bg-slate-100 px-4 py-2 border-b">
                <span class="text-sm font-medium text-slate-700">Next 5 Runs</span>
              </div>
              <div class="divide-y">
                <div v-for="(run, idx) in result.nextRuns" :key="idx" class="px-4 py-2 flex items-center space-x-3">
                  <span class="w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-xs">{{ idx + 1 }}</span>
                  <span class="font-mono text-sm text-slate-700">{{ run }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-clock text-4xl mb-2"></i>
            <p>Enter a cron expression</p>
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
      <button @click="parseCron" :disabled="!cronExpression || loading"
        class="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-play mr-2"></i>
        Parse
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { httpClient } from '@/common/utils/http-client';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const cronExpression = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const examples = [
  { cron: '* * * * *', desc: 'Every minute' },
  { cron: '0 * * * *', desc: 'Every hour' },
  { cron: '0 0 * * *', desc: 'Every day at midnight' },
  { cron: '0 0 * * 0', desc: 'Every Sunday' },
  { cron: '0 0 1 * *', desc: 'First day of month' },
  { cron: '*/15 * * * *', desc: 'Every 15 minutes' }
];

let debounceTimer: any;
watch(cronExpression, () => {
  clearTimeout(debounceTimer);
  if (cronExpression.value) {
    debounceTimer = setTimeout(parseCron, 500);
  }
});

const parseCron = async () => {
  if (!cronExpression.value) return;
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/text/crontab/parse', {
      expression: cronExpression.value
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to parse cron expression';
    }
  } catch (err: any) {
    error.value = err.message || 'Error parsing cron expression';
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  cronExpression.value = '';
  result.value = null;
  error.value = null;
};
</script>

