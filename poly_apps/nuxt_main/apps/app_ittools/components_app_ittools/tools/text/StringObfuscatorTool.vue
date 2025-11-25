<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-700 to-slate-800">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-eye-slash text-slate-300"></i>
            <h2 class="text-2xl font-semibold text-white">String Obfuscator</h2>
          </div>
          <p class="text-sm text-slate-300">Obfuscate strings to protect sensitive data</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Sensitive Text</label>
            <input v-model="text" type="text" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 font-mono"
              placeholder="Enter sensitive text..." @input="obfuscate" />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Obfuscation Method</label>
            <select v-model="method" @change="obfuscate" class="w-full px-4 py-3 border border-slate-200 rounded-lg">
              <option value="asterisks">Asterisks (****)</option>
              <option value="dots">Dots (....)</option>
              <option value="hashes">Hashes (####)</option>
              <option value="x">X marks (xxxx)</option>
              <option value="partial">Partial (show first/last)</option>
            </select>
          </div>

          <div v-if="method === 'partial'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Show First N</label>
              <input v-model.number="showFirst" type="number" min="0" max="10"
                class="w-full px-4 py-3 border border-slate-200 rounded-lg" @input="obfuscate" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Show Last N</label>
              <input v-model.number="showLast" type="number" min="0" max="10"
                class="w-full px-4 py-3 border border-slate-200 rounded-lg" @input="obfuscate" />
            </div>
          </div>

          <!-- Presets -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Quick Presets</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="preset in presets" :key="preset.name" @click="applyPreset(preset)"
                class="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition">
                {{ preset.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="result" class="space-y-4">
            <!-- Obfuscated Output -->
            <div class="bg-slate-900 rounded-xl p-4 text-white font-mono text-lg">
              {{ result }}
            </div>

            <!-- Stats -->
            <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">Original Length</span>
                <span class="font-medium">{{ text.length }} chars</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Hidden Characters</span>
                <span class="font-medium">{{ hiddenCount }} chars</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Visible Characters</span>
                <span class="font-medium">{{ text.length - hiddenCount }} chars</span>
              </div>
            </div>

            <button @click="copyResult" 
              class="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition flex items-center justify-center space-x-2">
              <i :class="copied ? 'fas fa-check text-green-600' : 'fas fa-copy'"></i>
              <span>{{ copied ? 'Copied!' : 'Copy Obfuscated' }}</span>
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-eye-slash text-4xl mb-2"></i>
            <p>Enter text to obfuscate</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const text = ref('');
const method = ref('asterisks');
const showFirst = ref(2);
const showLast = ref(2);
const result = ref('');
const copied = ref(false);

const presets = [
  { name: 'Email', example: 'jo***@gmail.com', first: 2, last: 0 },
  { name: 'Phone', example: '***-***-1234', first: 0, last: 4 },
  { name: 'Credit Card', example: '****-****-****-1234', first: 0, last: 4 },
  { name: 'Password', example: '********', first: 0, last: 0 },
  { name: 'API Key', example: 'sk_***...abc', first: 3, last: 3 }
];

const hiddenCount = computed(() => {
  if (!text.value) return 0;
  if (method.value === 'partial') {
    return Math.max(0, text.value.length - showFirst.value - showLast.value);
  }
  return text.value.length;
});

const getObfuscationChar = (): string => {
  const chars: Record<string, string> = {
    asterisks: '*',
    dots: '.',
    hashes: '#',
    x: 'x'
  };
  return chars[method.value] || '*';
};

const obfuscate = () => {
  if (!text.value) {
    result.value = '';
    return;
  }

  if (method.value === 'partial') {
    const first = text.value.slice(0, showFirst.value);
    const last = text.value.slice(-showLast.value || undefined);
    const middleLen = Math.max(0, text.value.length - showFirst.value - showLast.value);
    const middle = '*'.repeat(middleLen);
    result.value = first + middle + (showLast.value > 0 ? last : '');
  } else {
    result.value = getObfuscationChar().repeat(text.value.length);
  }
};

const applyPreset = (preset: any) => {
  method.value = 'partial';
  showFirst.value = preset.first;
  showLast.value = preset.last;
  obfuscate();
};

const copyResult = async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {}
};
</script>

