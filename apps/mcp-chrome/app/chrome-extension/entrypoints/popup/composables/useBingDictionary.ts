/**
 * Bing Dictionary Composable
 * Handles word lookup and history management (under 200 lines)
 */

import { ref } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';

export interface Translation {
  type: string;
  text: string;
}

export interface Example {
  text: string;
  translation?: string;
}

export interface DetailedDefinition {
  cn: string;
  en: string;
}

export interface SynonymGroup {
  type: string;
  words: string;
}

export interface WebDefinition {
  type: string;
  content: string;
}

export interface WordResult {
  word: string;
  usPhonetic?: string;
  ukPhonetic?: string;
  // Pronunciation audio: a single fallback plus the two separate US/UK tracks
  // (Bing usually serves both), so each phonetic gets its own play button.
  pronunciation?: string;
  usAudioUrl?: string;
  ukAudioUrl?: string;
  // Short part-of-speech glosses.
  translations: Translation[];
  // Detailed Collins/Oxford definitions (Chinese gloss + English explanation).
  detailedDefinitions: DetailedDefinition[];
  // Example sentences (English + Chinese translation).
  examples: Example[];
  // Synonym / antonym groups.
  synonyms: SynonymGroup[];
  // Web definitions / advanced blocks.
  webDefinitions: WebDefinition[];
  // Sample image data URLs.
  images: string[];
}

export interface HistoryItem {
  word: string;
  timestamp: number;
}

export function useBingDictionary() {
  // searchQuery + currentResult are persisted so reopening the popup restores the
  // last lookup (the word box and its full result) without re-scraping Bing.
  const searchQuery = usePersistedRef('bingSearchQuery', '');
  const isLoading = ref(false);
  const error = ref('');
  const currentResult = usePersistedRef<WordResult | null>('bingLastResult', null);
  const history = ref<HistoryItem[]>([]);

  const lookupWord = async (word?: string) => {
    const query = word || searchQuery.value.trim();

    if (!query) return;

    isLoading.value = true;
    error.value = '';
    currentResult.value = null;

    try {
      // Look the word up by scraping Bing dictionary LOCALLY (same path the
      // worker uses) rather than calling a backend endpoint. laravel_main does
      // not expose a dictionary lookup API — only the worker task queue — so the
      // extension owns single-word lookups itself.
      const response = await chrome.runtime.sendMessage({
        type: 'bing_dictionary_worker_service',
        action: 'test_scrape',
        words: [query],
        mode: 'worker',
      });

      if (!response || !response.success) {
        throw new Error((response && response.error) || 'Failed to lookup word');
      }

      const r = (response.results || [])[0];
      if (!r || !r.ok) {
        throw new Error(r?.invalid ? 'No Bing dictionary entry for this word' : r?.error || 'No result');
      }

      currentResult.value = {
        word: r.word || query,
        usPhonetic: r.usPhonetic || undefined,
        ukPhonetic: r.ukPhonetic || undefined,
        pronunciation: r.audioUrl || r.usAudioUrl || r.ukAudioUrl || undefined,
        usAudioUrl: r.usAudioUrl || undefined,
        ukAudioUrl: r.ukAudioUrl || undefined,
        translations: (r.definitions || []).map((d: any) => ({
          type: d.partOfSpeech || '',
          text: d.definition,
        })),
        detailedDefinitions: r.detailedDefinitions || [],
        examples: (r.examples || []).map((e: any) => ({ text: e.en, translation: e.cn })),
        synonyms: r.synonyms || [],
        webDefinitions: r.webDefinitions || [],
        images: r.imageUrls || [],
      };

      addToHistory(query);

      if (!word) {
        searchQuery.value = '';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to lookup word';
      console.error('[Bing Dictionary] Lookup failed:', err);
    } finally {
      isLoading.value = false;
    }
  };

  // Play any pronunciation track (base64 data URL or remote mp3).
  const playAudio = (url?: string | null) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(err => {
      console.error('[Bing Dictionary] Failed to play audio:', err);
    });
  };

  const playPronunciation = () => {
    playAudio(currentResult.value?.pronunciation);
  };

  const addToHistory = (word: string) => {
    const existing = history.value.findIndex(item => item.word === word);

    if (existing !== -1) {
      history.value.splice(existing, 1);
    }

    history.value.unshift({
      word,
      timestamp: Date.now(),
    });

    if (history.value.length > 10) {
      history.value = history.value.slice(0, 10);
    }

    saveHistory();
  };

  const clearHistory = async () => {
    history.value = [];
    // Also reset the persisted current view so [CLEAR] fully empties the panel.
    currentResult.value = null;
    searchQuery.value = '';
    await chrome.storage.local.remove('bing_dictionary_history');
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
  };

  const saveHistory = async () => {
    try {
      await chrome.storage.local.set({ bing_dictionary_history: history.value });
    } catch (err) {
      console.error('[Bing Dictionary] Failed to save history:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const result = await chrome.storage.local.get('bing_dictionary_history');
      if (result.bing_dictionary_history) {
        history.value = result.bing_dictionary_history;
      }
    } catch (err) {
      console.error('[Bing Dictionary] Failed to load history:', err);
    }
  };

  return {
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
  };
}
