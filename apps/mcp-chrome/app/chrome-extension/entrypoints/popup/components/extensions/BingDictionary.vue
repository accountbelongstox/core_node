<template>
  <div class="bing-dictionary">
    <!-- Translation Assist (worker mode): pull untranslated words from
         laravel_main, translate via parallel Bing tabs, post results back. -->
    <ClientModePanel
      :clientConfig="clientConfig"
      :clientService="clientService"
      :formatTimestamp="formatTimestamp"
      :error="assistError"
      :connectionStatus="connectionStatus"
      :currentEndpoint="currentEndpoint"
      :testWords="testWords"
      :testResults="testResults"
      :testing="testing"
      :queueOverview="queueOverview"
      :prepared="prepared"
      @toggle-service="toggleClientService"
      @test-connection="testConnection"
      @run-scrape-test="runScrapeTest"
      @update-test-words="(v) => (testWords = v)"
      @refresh-queue="loadQueueOverview"
      @set-queue-page="setQueuePage"
    />

    <!-- Search + clear -->
    <div class="dictionary-toolbar">
      <button class="icon-button" @click="handleClearHistory" title="Clear history">[CLEAR]</button>
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
      @play-audio="handlePlayAudio"
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
  playAudio,
  clearHistory,
  formatTime,
  loadHistory,
} = useBingDictionary();

// Translation-assist (worker) composable
const {
  clientConfig,
  clientService,
  error: assistError,
  connectionStatus,
  currentEndpoint,
  testWords,
  testResults,
  testing,
  queueOverview,
  loadQueueOverview,
  setQueuePage,
  prepared,
  toggleClientService,
  testConnection,
  runScrapeTest,
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

const handlePlayAudio = (url: string) => {
  playAudio(url);
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
