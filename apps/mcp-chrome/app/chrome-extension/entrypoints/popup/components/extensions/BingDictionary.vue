<template>
  <div class="bing-dictionary">
    <!-- Task Center Panel (Unified State Center) -->
    <TaskCenterPanel />

    <!-- Translation Assist (worker mode): pull untranslated words from
         laravel_main, translate via parallel Bing tabs, post results back. -->
    <ClientModePanel
      :clientConfig="clientConfig"
      :clientService="clientService"
      :formatTimestamp="formatTimestamp"
      @toggle-service="toggleClientService"
      @update-config="updateConfig"
    />

    <!-- Header -->
    <div class="dictionary-header">
      <h4 class="dictionary-title">Bing Dictionary</h4>
      <div class="header-actions">
        <button class="icon-button" @click="handleClearHistory" title="Clear history">
          [CLEAR]
        </button>
      </div>
    </div>

    <!-- Search Box -->
    <SearchBox
      v-model:searchQuery="searchQuery"
      :isLoading="isLoading"
      :error="error"
      @search="handleSearch"
    />

    <!-- Word Result -->
    <WordResult
      :result="currentResult"
      :isLoading="isLoading"
      @play-pronunciation="handlePlayPronunciation"
      @lookup-word="handleLookupWord"
    />

    <!-- History List -->
    <HistoryList
      :history="history"
      :currentResult="currentResult"
      :isLoading="isLoading"
      :formatTime="formatTime"
      @lookup-word="handleLookupWord"
    />
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useBingDictionary } from '../../composables/useBingDictionary';
import { useBingDictionaryClient } from '../../composables/useBingDictionaryClient';
import TaskCenterPanel from './TaskCenterPanel.vue';
import ClientModePanel from './bing-dictionary/ClientModePanel.vue';
import SearchBox from './bing-dictionary/SearchBox.vue';
import WordResult from './bing-dictionary/WordResult.vue';
import HistoryList from './bing-dictionary/HistoryList.vue';
import './bing-dictionary/base-styles.css';

// Dictionary composable
const {
  searchQuery,
  isLoading,
  error,
  currentResult,
  history,
  lookupWord,
  playPronunciation,
  clearHistory,
  formatTime,
  loadHistory,
} = useBingDictionary();

// Translation-assist (worker) composable
const {
  clientConfig,
  clientService,
  toggleClientService,
  updateConfig,
  formatTimestamp,
  initPanel,
} = useBingDictionaryClient();

// Event handlers
const handleSearch = () => {
  lookupWord();
};

const handleLookupWord = (word: string) => {
  lookupWord(word);
};

const handlePlayPronunciation = () => {
  playPronunciation();
};

const handleClearHistory = () => {
  clearHistory();
};

// Initialize on mount
onMounted(async () => {
  await loadHistory();
  await initPanel();
});
</script>

