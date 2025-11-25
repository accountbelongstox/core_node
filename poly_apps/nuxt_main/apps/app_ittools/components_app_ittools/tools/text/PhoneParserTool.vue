<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-phone text-green-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Phone Parser</h2>
          </div>
          <p class="text-sm text-slate-600">Parse and validate phone numbers</p>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
            <input v-model="phoneNumber" type="text" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 text-lg"
              placeholder="+1 (555) 123-4567" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Default Country (optional)</label>
            <select v-model="defaultCountry" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
              <option value="">Auto-detect</option>
              <option value="US">United States (+1)</option>
              <option value="CN">China (+86)</option>
              <option value="GB">United Kingdom (+44)</option>
              <option value="JP">Japan (+81)</option>
              <option value="DE">Germany (+49)</option>
              <option value="FR">France (+33)</option>
              <option value="IN">India (+91)</option>
              <option value="AU">Australia (+61)</option>
              <option value="BR">Brazil (+55)</option>
              <option value="CA">Canada (+1)</option>
            </select>
          </div>

          <!-- Example Numbers -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Examples</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="example in examples" :key="example" @click="phoneNumber = example"
                class="px-3 py-1 bg-slate-100 hover:bg-green-100 text-slate-600 rounded-lg text-sm transition">
                {{ example }}
              </button>
            </div>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700">Parsed Result</h3>
            <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
          </div>

          <div v-if="loading" class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center">
            <i class="fas fa-spinner fa-spin text-green-600 text-2xl"></i>
          </div>

          <div v-else-if="result" class="space-y-4">
            <!-- Validation Status -->
            <div :class="result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
              class="border rounded-xl p-4 flex items-center space-x-3">
              <i :class="result.valid ? 'fas fa-check-circle text-green-600' : 'fas fa-times-circle text-red-600'" class="text-2xl"></i>
              <div>
                <div :class="result.valid ? 'text-green-700' : 'text-red-700'" class="font-medium">
                  {{ result.valid ? 'Valid Phone Number' : 'Invalid Phone Number' }}
                </div>
                <div v-if="result.type" class="text-sm text-slate-500">Type: {{ result.type }}</div>
              </div>
            </div>

            <!-- Phone Details -->
            <div v-if="result.valid" class="border border-slate-200 rounded-lg overflow-hidden">
              <div class="divide-y">
                <div class="px-4 py-3 flex justify-between bg-slate-50">
                  <span class="text-slate-600">International</span>
                  <span class="font-mono text-green-600">{{ result.international }}</span>
                </div>
                <div class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">National</span>
                  <span class="font-mono text-slate-800">{{ result.national }}</span>
                </div>
                <div class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">E.164 Format</span>
                  <span class="font-mono text-slate-800">{{ result.e164 }}</span>
                </div>
                <div class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">Country</span>
                  <span class="text-slate-800">{{ result.country }} ({{ result.countryCode }})</span>
                </div>
                <div v-if="result.carrier" class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">Carrier</span>
                  <span class="text-slate-800">{{ result.carrier }}</span>
                </div>
                <div v-if="result.timezone" class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">Timezone</span>
                  <span class="text-slate-800">{{ result.timezone }}</span>
                </div>
              </div>
            </div>

            <!-- Copy Buttons -->
            <div v-if="result.valid" class="flex space-x-3">
              <button @click="copy(result.international)" 
                class="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition">
                <i class="fas fa-copy mr-1"></i>International
              </button>
              <button @click="copy(result.e164)" 
                class="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition">
                <i class="fas fa-copy mr-1"></i>E.164
              </button>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-phone text-4xl mb-2"></i>
            <p>Enter a phone number</p>
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
      <button @click="parsePhone" :disabled="!phoneNumber || loading"
        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-search mr-2"></i>
        Parse
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

const phoneNumber = ref('');
const defaultCountry = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const examples = ['+1 555 123 4567', '+44 20 7946 0958', '+86 138 0013 8000', '+81 3 1234 5678'];

const parsePhone = async () => {
  if (!phoneNumber.value) return;
  loading.value = true;
  error.value = null;
  const start = performance.now();

  try {
    const response = await httpClient.post('/api/ittools/v1/text/phone/parse', {
      phone: phoneNumber.value,
      default_country: defaultCountry.value || undefined
    });

    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      result.value = response.data;
    } else {
      error.value = response.error || 'Failed to parse phone number';
    }
  } catch (err: any) {
    error.value = err.message || 'Error parsing phone number';
  } finally {
    loading.value = false;
  }
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    error.value = 'Failed to copy';
  }
};

const reset = () => {
  phoneNumber.value = '';
  defaultCountry.value = '';
  result.value = null;
  error.value = null;
};
</script>

