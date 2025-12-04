<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-pink-500 to-rose-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-compress text-white"></i>
            <h2 class="text-2xl font-semibold text-white">Numeronym Generator</h2>
          </div>
          <p class="text-sm text-pink-100">Convert words to numeronyms (like i18n)</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-pink-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Input Text</label>
            <input v-model="text" type="text"
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 text-lg"
              placeholder="internationalization" @input="generate" />
          </div>

          <div class="bg-pink-50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-pink-800 mb-2">What is a Numeronym?</h4>
            <p class="text-sm text-pink-700">
              A numeronym is a word where part of it is replaced by the number of letters. 
              For example, "internationalization" becomes "i18n" (i + 18 letters + n).
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Famous Numeronyms</label>
            <div class="grid grid-cols-2 gap-2">
              <div v-for="example in examples" :key="example.word"
                class="bg-slate-50 rounded-lg p-3 cursor-pointer hover:bg-pink-50 transition"
                @click="text = example.word; generate()">
                <div class="font-mono text-lg text-pink-600">{{ example.numeronym }}</div>
                <div class="text-xs text-slate-500">{{ example.word }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="result" class="space-y-4">
            <div class="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-8 text-center">
              <div class="text-5xl font-mono font-bold text-white">{{ result }}</div>
            </div>

            <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">Original Word</span>
                <span class="font-medium">{{ text }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Original Length</span>
                <span class="font-medium">{{ text.length }} chars</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Numeronym Length</span>
                <span class="font-medium">{{ result.length }} chars</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Letters Replaced</span>
                <span class="font-medium">{{ text.length - 2 }}</span>
              </div>
            </div>

            <button @click="copy"
              class="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition">
              <i :class="copied ? 'fas fa-check text-green-600' : 'fas fa-copy'" class="mr-2"></i>
              {{ copied ? 'Copied!' : 'Copy Numeronym' }}
            </button>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-compress text-4xl mb-2"></i>
            <p>Enter a word to convert</p>
            <p class="text-xs mt-1">Minimum 3 characters</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const text = ref('');
const result = ref('');
const copied = ref(false);

const examples = [
  { word: 'internationalization', numeronym: 'i18n' },
  { word: 'localization', numeronym: 'l10n' },
  { word: 'accessibility', numeronym: 'a11y' },
  { word: 'kubernetes', numeronym: 'k8s' },
  { word: 'globalization', numeronym: 'g11n' },
  { word: 'configuration', numeronym: 'c12n' }
];

const generate = () => {
  if (text.value.length < 3) {
    result.value = '';
    return;
  }
  
  const word = text.value.toLowerCase().trim();
  const first = word[0];
  const last = word[word.length - 1];
  const middle = word.length - 2;
  
  result.value = `${first}${middle}${last}`;
};

const copy = async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {}
};
</script>

