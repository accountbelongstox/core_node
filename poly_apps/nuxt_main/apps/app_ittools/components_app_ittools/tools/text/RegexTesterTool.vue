<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-asterisk text-orange-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Regex Tester</h2>
          </div>
          <p class="text-sm text-slate-600">Test and debug regular expressions</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Pattern Input -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">Regular Expression</label>
        <div class="flex items-center space-x-2">
          <span class="text-slate-400 font-mono">/</span>
          <input v-model="pattern" type="text" 
            class="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono"
            placeholder="[a-zA-Z]+@[a-zA-Z]+\.[a-zA-Z]+" @input="testRegex" />
          <span class="text-slate-400 font-mono">/</span>
          <input v-model="flags" type="text" 
            class="w-20 px-3 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono text-center"
            placeholder="gim" @input="testRegex" />
        </div>
        <div class="flex flex-wrap gap-2 mt-2">
          <label v-for="flag in flagOptions" :key="flag.value" class="flex items-center space-x-1 text-sm">
            <input type="checkbox" :checked="flags.includes(flag.value)" @change="toggleFlag(flag.value)" 
              class="rounded text-orange-600" />
            <span class="text-slate-600">{{ flag.label }}</span>
          </label>
        </div>
      </div>

      <!-- Test String -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">Test String</label>
        <textarea v-model="testString" rows="6" 
          class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono text-sm"
          placeholder="Enter text to test against the regex..." @input="testRegex"></textarea>
      </div>

      <!-- Quick Patterns -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">Common Patterns</label>
        <div class="flex flex-wrap gap-2">
          <button v-for="preset in presets" :key="preset.pattern" @click="applyPreset(preset)"
            class="px-3 py-1 bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-700 rounded-lg text-xs transition">
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div v-if="result" class="space-y-4">
        <!-- Match Status -->
        <div :class="result.matches.length > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
          class="border rounded-lg p-4 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <i :class="result.matches.length > 0 ? 'fas fa-check-circle text-green-600' : 'fas fa-times-circle text-red-600'"></i>
            <span :class="result.matches.length > 0 ? 'text-green-700' : 'text-red-700'" class="font-medium">
              {{ result.matches.length > 0 ? `${result.matches.length} match(es) found` : 'No matches' }}
            </span>
          </div>
          <span v-if="executionTime" class="text-xs text-slate-400">{{ executionTime }}ms</span>
        </div>

        <!-- Highlighted Text -->
        <div v-if="result.highlighted" class="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <label class="block text-xs text-slate-500 mb-2">Highlighted Matches</label>
          <div class="font-mono text-sm whitespace-pre-wrap" v-html="result.highlighted"></div>
        </div>

        <!-- Match Details -->
        <div v-if="result.matches.length > 0" class="border border-slate-200 rounded-lg overflow-hidden">
          <div class="bg-slate-100 px-4 py-2 border-b">
            <span class="text-sm font-medium text-slate-700">Match Details</span>
          </div>
          <div class="max-h-[300px] overflow-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 sticky top-0">
                <tr>
                  <th class="px-4 py-2 text-left text-xs text-slate-500">#</th>
                  <th class="px-4 py-2 text-left text-xs text-slate-500">Match</th>
                  <th class="px-4 py-2 text-left text-xs text-slate-500">Index</th>
                  <th class="px-4 py-2 text-left text-xs text-slate-500">Groups</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(match, idx) in result.matches" :key="idx" class="hover:bg-slate-50">
                  <td class="px-4 py-2 text-slate-500">{{ idx + 1 }}</td>
                  <td class="px-4 py-2 font-mono text-orange-600">{{ match.value }}</td>
                  <td class="px-4 py-2 text-slate-500">{{ match.index }}</td>
                  <td class="px-4 py-2 text-slate-600">
                    <span v-if="match.groups && match.groups.length" class="text-xs">
                      {{ match.groups.join(', ') }}
                    </span>
                    <span v-else class="text-slate-400">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="regexError" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ regexError }}
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <i class="fas fa-exclamation-circle mr-2"></i>{{ error }}
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        Reset
      </button>
      <button @click="testRegex" :disabled="!pattern || !testString || loading"
        class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition">
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-play mr-2"></i>
        Test
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

const pattern = ref('');
const flags = ref('g');
const testString = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const regexError = ref<string | null>(null);
const result = ref<any>(null);
const executionTime = ref<number | null>(null);

const flagOptions = [
  { value: 'g', label: 'Global (g)' },
  { value: 'i', label: 'Case insensitive (i)' },
  { value: 'm', label: 'Multiline (m)' },
  { value: 's', label: 'Dotall (s)' },
  { value: 'u', label: 'Unicode (u)' }
];

const presets = [
  { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'gi' },
  { name: 'URL', pattern: 'https?:\\/\\/[^\\s]+', flags: 'gi' },
  { name: 'Phone', pattern: '\\+?[0-9]{1,3}[-.\\s]?\\(?[0-9]{1,4}\\)?[-.\\s]?[0-9]{1,4}[-.\\s]?[0-9]{1,9}', flags: 'g' },
  { name: 'IP Address', pattern: '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b', flags: 'g' },
  { name: 'Date', pattern: '\\d{4}[-/]\\d{2}[-/]\\d{2}', flags: 'g' },
  { name: 'Hex Color', pattern: '#[0-9A-Fa-f]{6}\\b|#[0-9A-Fa-f]{3}\\b', flags: 'gi' }
];

const toggleFlag = (flag: string) => {
  if (flags.value.includes(flag)) {
    flags.value = flags.value.replace(flag, '');
  } else {
    flags.value += flag;
  }
};

const applyPreset = (preset: { pattern: string; flags: string }) => {
  pattern.value = preset.pattern;
  flags.value = preset.flags;
  if (testString.value) testRegex();
};

let debounceTimer: any;
const testRegex = async () => {
  if (!pattern.value || !testString.value) return;
  
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    loading.value = true;
    error.value = null;
    regexError.value = null;
    const start = performance.now();

    try {
      const response = await httpClient.post('/api/ittools/v1/text/regex/test', {
        pattern: pattern.value,
        text: testString.value,
        flags: flags.value
      });

      executionTime.value = Math.round(performance.now() - start);

      if (response.success && response.data) {
        result.value = response.data;
      } else {
        if (response.error?.includes('regex') || response.error?.includes('pattern')) {
          regexError.value = response.error;
        } else {
          error.value = response.error || 'Failed to test regex';
        }
      }
    } catch (err: any) {
      error.value = err.message || 'Error testing regex';
    } finally {
      loading.value = false;
    }
  }, 300);
};

const reset = () => {
  pattern.value = '';
  flags.value = 'g';
  testString.value = '';
  result.value = null;
  error.value = null;
  regexError.value = null;
};
</script>

