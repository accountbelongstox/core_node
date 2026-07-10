/**
 * AI Translate Hub Composable
 *
 * Manages Puter AI translate worker control + Free Dictionary API lookups.
 * Follows useBingDictionaryClient pattern for worker control; adds direct
 * client-side dictionary lookup with audio playback.
 */

import { ref, onUnmounted, watch } from 'vue';
import { apiManager } from '@/services/ApiManager';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { logger } from '@/utils/logger';
import { formatTimestamp } from '@/utils/time-helpers';

const LOG = 'AI Translate Hub';

// ── Free Dictionary API types ──────────────────────────────────────────

interface Phonetic {
  text?: string;
  audio?: string;
}

interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

// ── Worker control types ───────────────────────────────────────────────

interface WorkerStats {
  pending: number;
  translated: number;
  failed: number;
  lastRun: number | null;
  workerId: string | null;
  isOnline: boolean;
  pendingFast: number;
  currentTaskId: string | null;
}

interface WorkerState {
  isRunning: boolean;
  stats: WorkerStats | null;
}

// ── Free Dictionary API ────────────────────────────────────────────────

const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// ── Composable ─────────────────────────────────────────────────────────

export function useAiTranslateHub() {
  // Worker state
  const workerState = ref<WorkerState>({ isRunning: false, stats: null });
  const { apiBaseUrl: currentEndpoint } = useApiEndpoint();
  const connectionStatus = ref<{ state: 'idle' | 'testing' | 'ok' | 'fail'; message: string }>({
    state: 'idle',
    message: '',
  });
  const error = ref('');

  // Dictionary lookup state
  const searchQuery = ref('');
  const dictionaryResult = ref<DictionaryEntry | null>(null);
  const dictionaryLoading = ref(false);
  const dictionaryError = ref('');
  const currentAudio = ref<HTMLAudioElement | null>(null);

  // Queue overview (shared with Bing via Task Center)
  const queueOverview = ref<{
    summary: { pending: number; processing: number; completed: number; failed: number; total: number } | null;
    items: any[];
    loading: boolean;
    error: string;
  }>({
    summary: null,
    items: [],
    loading: false,
    error: '',
  });

  const prepared = ref(false);

  // ── Worker control ─────────────────────────────────────────────────

  const toggleWorker = async () => {
    if (!currentEndpoint.value) {
      error.value = 'No endpoint configured in Settings';
      return;
    }

    const action = workerState.value.isRunning ? 'stop' : 'start';
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'puter_translate_worker_service',
        action,
        config: {
          apiUrl: currentEndpoint.value,
          workerName: 'MCP Chrome Puter AI Translate Worker',
          batchSize: 3,
        },
      });
      if (resp?.success) {
        workerState.value.isRunning = !workerState.value.isRunning;
        if (!workerState.value.isRunning) {
          stopStatsPolling();
        } else {
          startStatsPolling();
        }
      } else {
        error.value = resp?.error || `Failed to ${action} worker`;
      }
    } catch (err: any) {
      error.value = err?.message || `Failed to ${action} worker`;
    }
  };

  // ── Stats polling ──────────────────────────────────────────────────

  let statsTimer: ReturnType<typeof setInterval> | null = null;

  const loadStats = async () => {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'puter_translate_worker_service',
        action: 'get_status',
      });
      if (resp?.success && resp.status) {
        workerState.value.stats = resp.status.stats || null;
        if (typeof resp.status.isRunning === 'boolean') {
          workerState.value.isRunning = resp.status.isRunning;
        }
      }
    } catch {
      // Worker may not be running yet
    }
  };

  const startStatsPolling = () => {
    stopStatsPolling();
    loadStats();
    statsTimer = setInterval(loadStats, 3000);
  };

  const stopStatsPolling = () => {
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
  };

  // ── Free Dictionary API ────────────────────────────────────────────

  const lookupDictionary = async () => {
    const word = searchQuery.value.trim();
    if (!word) return;

    dictionaryLoading.value = true;
    dictionaryError.value = '';
    dictionaryResult.value = null;

    try {
      const resp = await fetch(`${DICT_API_BASE}/${encodeURIComponent(word)}`);
      if (resp.status === 404) {
        dictionaryError.value = `"${word}" not found in dictionary`;
        return;
      }
      if (!resp.ok) {
        dictionaryError.value = `Dictionary API error (${resp.status})`;
        return;
      }
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        dictionaryResult.value = data[0] as DictionaryEntry;
      } else {
        dictionaryError.value = 'No results found';
      }
    } catch (err: any) {
      dictionaryError.value = err?.message || 'Network error';
    } finally {
      dictionaryLoading.value = false;
    }
  };

  // ── Audio playback ─────────────────────────────────────────────────

  const playAudio = (url: string) => {
    if (!url) return;
    // Stop any currently playing audio
    if (currentAudio.value) {
      currentAudio.value.pause();
      currentAudio.value = null;
    }
    // Ensure protocol
    const audioUrl = url.startsWith('//') ? `https:${url}` : url;
    const audio = new Audio(audioUrl);
    currentAudio.value = audio;
    audio.play().catch(() => {
      dictionaryError.value = 'Audio playback failed';
    });
    audio.onended = () => {
      if (currentAudio.value === audio) currentAudio.value = null;
    };
  };

  const getBestAudioUrl = (entry: DictionaryEntry | null): string => {
    if (!entry?.phonetics) return '';
    for (const p of entry.phonetics) {
      if (p.audio && p.audio.length > 0) return p.audio;
    }
    return '';
  };

  // ── Queue overview (via Task Center) ───────────────────────────────

  const loadQueueOverview = async () => {
    if (!currentEndpoint.value) {
      queueOverview.value.error = 'No endpoint configured';
      return;
    }
    queueOverview.value.loading = true;
    queueOverview.value.error = '';
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'task_center',
        action: 'get_status',
      });
      if (resp?.success) {
        // Extract puter_translate processor stats
        const puterStats = resp.processors?.puter_translate;
        if (puterStats?.stats) {
          queueOverview.value.summary = {
            pending: puterStats.stats.pending || 0,
            processing: puterStats.stats.processing || 0,
            completed: puterStats.stats.translated || 0,
            failed: puterStats.stats.failed || 0,
            total: (puterStats.stats.pending || 0) + (puterStats.stats.translated || 0) + (puterStats.stats.failed || 0),
          };
        }
        connectionStatus.value = { state: 'ok', message: 'Connected' };
        prepared.value = true;
      } else {
        queueOverview.value.error = resp?.error || 'Failed to load status';
        connectionStatus.value = { state: 'fail', message: queueOverview.value.error };
      }
    } catch (err: any) {
      queueOverview.value.error = err?.message || 'Failed to load status';
      connectionStatus.value = { state: 'fail', message: queueOverview.value.error };
    } finally {
      queueOverview.value.loading = false;
    }
  };

  // ── Init ───────────────────────────────────────────────────────────

  const initPanel = async () => {
    await logger.init();
    await apiManager.initialize({ autoDetect: false });
    await loadStats();
    startStatsPolling();
  };

  onUnmounted(() => {
    stopStatsPolling();
    if (currentAudio.value) {
      currentAudio.value.pause();
      currentAudio.value = null;
    }
  });

  return {
    // Worker control
    workerState,
    currentEndpoint,
    connectionStatus,
    error,
    toggleWorker,
    loadStats,

    // Dictionary lookup
    searchQuery,
    dictionaryResult,
    dictionaryLoading,
    dictionaryError,
    lookupDictionary,
    playAudio,
    getBestAudioUrl,

    // Queue
    queueOverview,
    prepared,
    loadQueueOverview,

    // Init
    initPanel,
    formatTimestamp,
  };
}
