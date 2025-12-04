<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-chart-bar text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Text Statistics</h2>
          </div>
          <p class="text-sm text-slate-600">Analyze text for word count, character count, reading time, etc.</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Enter Text</label>
          <textarea v-model="text" rows="15" @input="analyze"
            class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
            placeholder="Paste or type your text here..."></textarea>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Statistics</h3>

          <div v-if="stats" class="space-y-4">
            <!-- Main Stats Grid -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-blue-50 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-blue-700">{{ stats.characters }}</div>
                <div class="text-xs text-blue-600">Characters</div>
              </div>
              <div class="bg-indigo-50 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-indigo-700">{{ stats.charactersNoSpaces }}</div>
                <div class="text-xs text-indigo-600">No Spaces</div>
              </div>
              <div class="bg-purple-50 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-purple-700">{{ stats.words }}</div>
                <div class="text-xs text-purple-600">Words</div>
              </div>
              <div class="bg-pink-50 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-pink-700">{{ stats.sentences }}</div>
                <div class="text-xs text-pink-600">Sentences</div>
              </div>
              <div class="bg-rose-50 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-rose-700">{{ stats.paragraphs }}</div>
                <div class="text-xs text-rose-600">Paragraphs</div>
              </div>
              <div class="bg-orange-50 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-orange-700">{{ stats.lines }}</div>
                <div class="text-xs text-orange-600">Lines</div>
              </div>
            </div>

            <!-- Reading Time -->
            <div class="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm opacity-80">Reading Time</div>
                  <div class="text-2xl font-bold">{{ stats.readingTime }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm opacity-80">Speaking Time</div>
                  <div class="text-2xl font-bold">{{ stats.speakingTime }}</div>
                </div>
              </div>
            </div>

            <!-- Additional Stats -->
            <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">Average Word Length</span>
                <span class="font-medium text-slate-800">{{ stats.avgWordLength }} chars</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Average Sentence Length</span>
                <span class="font-medium text-slate-800">{{ stats.avgSentenceLength }} words</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Unique Words</span>
                <span class="font-medium text-slate-800">{{ stats.uniqueWords }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Longest Word</span>
                <span class="font-mono text-slate-800">{{ stats.longestWord }}</span>
              </div>
            </div>

            <!-- Top Words -->
            <div v-if="stats.topWords?.length" class="bg-slate-50 rounded-lg p-4">
              <div class="text-xs text-slate-500 mb-2">Most Used Words</div>
              <div class="flex flex-wrap gap-2">
                <span v-for="(word, idx) in stats.topWords" :key="idx" 
                  class="px-2 py-1 bg-white border border-slate-200 rounded text-xs">
                  {{ word.word }} <span class="text-slate-400">({{ word.count }})</span>
                </span>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-chart-bar text-4xl mb-2"></i>
            <p>Enter text to analyze</p>
          </div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        Clear
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const text = ref('');
const stats = ref<any>(null);

const analyze = () => {
  if (!text.value.trim()) {
    stats.value = null;
    return;
  }

  const content = text.value;
  const words = content.match(/\b\w+\b/g) || [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const lines = content.split('\n');
  
  const wordCounts: Record<string, number> = {};
  words.forEach(w => {
    const lower = w.toLowerCase();
    wordCounts[lower] = (wordCounts[lower] || 0) + 1;
  });
  
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const readingMinutes = Math.ceil(words.length / 200);
  const speakingMinutes = Math.ceil(words.length / 130);

  stats.value = {
    characters: content.length,
    charactersNoSpaces: content.replace(/\s/g, '').length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    lines: lines.length,
    uniqueWords: new Set(words.map(w => w.toLowerCase())).size,
    avgWordLength: words.length ? (words.join('').length / words.length).toFixed(1) : 0,
    avgSentenceLength: sentences.length ? (words.length / sentences.length).toFixed(1) : 0,
    longestWord: words.reduce((a, b) => a.length >= b.length ? a : b, ''),
    readingTime: readingMinutes < 1 ? '< 1 min' : `${readingMinutes} min`,
    speakingTime: speakingMinutes < 1 ? '< 1 min' : `${speakingMinutes} min`,
    topWords
  };
};

const reset = () => {
  text.value = '';
  stats.value = null;
};
</script>

