<template>
  <div v-if="history.length > 0 && !currentResult" class="history-section">
    <h5 class="section-title">Recent Searches</h5>
    <div class="history-list">
      <div
        v-for="(item, index) in history"
        :key="index"
        class="history-item"
        @click="onHistoryClick(item.word)"
      >
        <span class="history-word">{{ item.word }}</span>
        <span class="history-time">{{ formatTime(item.timestamp) }}</span>
      </div>
    </div>
  </div>

  <div v-if="!currentResult && !isLoading && history.length === 0" class="empty-state">
    <p>Enter a word to start looking up definitions</p>
  </div>
</template>

<script lang="ts" setup>
import type { HistoryItem, WordResult } from '../../../composables/useBingDictionary';

interface Props {
  history: HistoryItem[];
  currentResult: WordResult | null;
  isLoading: boolean;
  formatTime: (timestamp: number) => string;
}

interface Emits {
  (e: 'lookup-word', word: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const onHistoryClick = (word: string) => {
  emit('lookup-word', word);
};
</script>
