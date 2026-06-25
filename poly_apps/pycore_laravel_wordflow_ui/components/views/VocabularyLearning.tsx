
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TranslationResponse,
  TTSGenerateResponse,
  LanguageInfo,
  AsyncState,
  Language,
  VocabularyTask,
  VocabularyWord
} from '../../types';
// Note: This component now uses the new centralized api from core/api
import { api } from '../../core/api';
import { TRANSLATIONS } from '../../constants';
import { mediaUrl } from '../../config/constants';
import {
  Languages,
  RefreshCw,
  BookOpen,
  CheckCircle,
  ListChecks,
  Search
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import { extractArrayFromResponse } from '../../utils/arrayUtils';
import { useAppState } from '../../contexts/AppStateContext';
import { usePersistentTask } from '../../core/tasks/usePersistentTask';
import VocabularyWordListModal from '../vocabulary/VocabularyWordListModal';
import WordsManagerPanel from '../vocabulary/WordsManagerPanel';
import VocabularyLibraryDetail from '../vocabulary/VocabularyLibraryDetail';
import TtsLogsDock from '../vocabulary/TtsLogsDock';
import TtsQueueTab from '../vocabulary/tabs/TtsQueueTab';
import TranslateInputPanel from '../vocabulary/tabs/TranslateInputPanel';
import TtsPlayerPanel from '../vocabulary/tabs/TtsPlayerPanel';
import StatisticsTab from '../vocabulary/tabs/StatisticsTab';
import LibrariesTab from '../vocabulary/tabs/LibrariesTab';
import PaginatedListModal, { type PaginatedListColumn, type PaginatedListFetcher } from '../vocabulary/PaginatedListModal';
import { buildDictionaryColumns } from '../vocabulary/words/dictionaryColumns';
import WordDetail from '../vocabulary/words/WordDetail';
import InlineWordsList from '../vocabulary/words/InlineWordsList';
import type { VocabularyStatisticsWordRow, VocabularyWordsPagination } from '../../types';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';
import { ConfirmModal, useToast } from '../admin';
import { logError, logInfo, logSuccess } from '../../core/logstore/logStore';
import { LoadingBlock, InlineSpinner, EmptyState, AlertBox, StatusBadge } from '../common';
import { useClipboard } from '../../hooks';

/** Cross-fade/slide preset for swapping the active sub-tab panel. */
const SUBTAB_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

/** Sub-tab keys for the page. Active tab persists in localStorage. */
type VocabTab = 'translate' | 'words' | 'libraries' | 'statistics' | 'queue';
const VOCAB_TAB_KEY = 'vocab_active_tab';
const VOCAB_TABS: { key: VocabTab; label: string; Icon: React.FC<any> }[] = [
  { key: 'translate', label: 'Translate', Icon: Languages },
  { key: 'words', label: 'Words', Icon: Search },
  { key: 'libraries', label: 'Libraries', Icon: BookOpen },
  // 'statistics' merged into the Words tab (WordsManagerPanel shows the strip);
  // the tab is retired but the type/legacy block stay for back-compat.
  { key: 'queue', label: 'TTS Queue', Icon: ListChecks },
];

const VocabularyLearning: React.FC = () => {
  const { lang } = useAppState();
  // Active sub-tab — persisted so returning to the page restores the last view.
  const [activeTab, setActiveTab] = useState<VocabTab>(() => {
    try {
      const saved = localStorage.getItem(VOCAB_TAB_KEY) as VocabTab | null;
      // Statistics was merged into Words — redirect any persisted 'statistics'.
      if (saved === 'statistics') return 'words';
      if (saved && VOCAB_TABS.some((t) => t.key === saved)) return saved;
    } catch { /* ignore */ }
    return 'translate';
  });
  const switchTab = (key: VocabTab) => {
    setActiveTab(key);
    try { localStorage.setItem(VOCAB_TAB_KEY, key); } catch { /* ignore */ }
  };

  // Collapsible secondary-settings disclosures (per tab).
  const [translateSettingsOpen, setTranslateSettingsOpen] = useState(true);
  const [wordsSearchOpen, setWordsSearchOpen] = useState(true);
  const [statsFilterOpen, setStatsFilterOpen] = useState(false);
  const [librariesFilterOpen, setLibrariesFilterOpen] = useState(false);

  const [translation, setTranslation] = useState<AsyncState<TranslationResponse>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [tts, setTTS] = useState<AsyncState<TTSGenerateResponse>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string>('en');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh');
  const [inputText, setInputText] = useState<string>('');
  const [history, setHistory] = useState<TranslationResponse[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Learning Tasks State
  const [tasks, setTasks] = useState<AsyncState<VocabularyTask[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedTask, setSelectedTask] = useState<VocabularyTask | null>(null);
  const [vocabularyWords, setVocabularyWords] = useState<VocabularyWord[]>([]);

  // Vocabulary Libraries State
  const [libraries, setLibraries] = useState<any[]>([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('english');
  // Per-library cover-retry in flight (keyed by library id).
  const [retryingCovers, setRetryingCovers] = useState<Set<number | string>>(new Set());

  // Library Words Viewer State — the open flag + active library; all paging,
  // stats and word data now live inside <VocabularyLibraryDetail>.
  const [libraryWordsModalOpen, setLibraryWordsModalOpen] = useState(false);
  const [activeLibrary, setActiveLibrary] = useState<any | null>(null);

  // Statistics State
  const [statistics, setStatistics] = useState<any>(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [statsLanguageFilter, setStatsLanguageFilter] = useState<string>('all');

  // Word List Modal State (reuse cache for page/perPage per language)
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [wordModalLanguage, setWordModalLanguage] = useState<string>('english');
  const [wordModalCache, setWordModalCache] = useState<Record<string, { page: number; perPage: number }>>({});

  // TTS Queue State — backed by the global task layer (`laravel.tts-queue`).
  // The polled stats snapshot + its poll loop live in <TaskPersistenceProvider>
  // above the router, so the live queue view survives leaving and returning to
  // this page and a full reload re-polls. `loadingQueueStats` is page-local UI.
  const [loadingQueueStats, setLoadingQueueStats] = useState(false);
  const [autoRefreshQueue, setAutoRefreshQueue] = useState(false);
  // Floating Recent-Logs dock (bottom-left). Collapsed by default.
  const [logsDockOpen, setLogsDockOpen] = useState(false);

  // Library deletion confirm state
  const [libraryToDelete, setLibraryToDelete] = useState<any | null>(null);
  const [deletingLibrary, setDeletingLibrary] = useState(false);

  // Generic stat drill-down modal (TTS queue items / dictionary words /
  // language breakdown / libraries). `fetchPage`/`columns` are supplied per
  // stat so one PaginatedListModal serves every clickable number on the page.
  const [statDrill, setStatDrill] = useState<{
    title: string;
    subtitle?: string;
    fetchPage: PaginatedListFetcher;
    columns?: PaginatedListColumn[];
    renderDetail?: (row: any, absoluteIndex: number) => React.ReactNode;
    wide?: boolean;
    reloadKey: string;
  } | null>(null);

  // ----- "Words" tab: inline dictionary search + filter + lazy detail -----
  const [wordsLanguage, setWordsLanguage] = useState<string>('english');
  const [wordsFilter, setWordsFilter] = useState<
    'all' | 'with_translation' | 'without_translation' | 'invalid' | 'with_audio' | 'without_audio'
  >('all');
  // When filter=invalid, optionally narrow to one cause (validity_source):
  // 'region-redirect' (Bing region/redirect) or 'bing-assist' (confirmed no entry).
  const [wordsValiditySource, setWordsValiditySource] = useState<string>('');
  const [wordsQuery, setWordsQuery] = useState<string>('');
  // Applied search term (committed on submit) — drives the drill-down reloadKey.
  const [wordsQueryApplied, setWordsQueryApplied] = useState<string>('');

  // Per-row lazy example-sentence cache: word-content → load state + rows.
  const [sentenceCache, setSentenceCache] = useState<
    Record<string, { loading: boolean; error: string | null; sentences: any[] }>
  >({});
  // Per-row one-click action pending flags: `${action}:${content}`.
  const [wordActionPending, setWordActionPending] = useState<Set<string>>(new Set());
  // Per-sentence audio-resolve state (keyed by `${language}|${text}`) for the
  // play button on example sentences whose row carries no ready `audio` yet:
  // resolving → loading; queued → "generating…"; url → just play it.
  const [sentenceAudioState, setSentenceAudioState] = useState<
    Record<string, { resolving: boolean; queued: boolean; url: string | null }>
  >({});
  // Bumped to force the Words-tab drill list to re-fetch a row after an action.
  const [wordsReloadTick, setWordsReloadTick] = useState(0);

  const toast = useToast();
  const { copy } = useClipboard();
  const t = TRANSLATIONS[lang].vocabulary;

  // No try/catch — guard with `.catch`. Returns null on failure (settles the
  // loop, keeping the last good stats) which mirrors the original behaviour.
  const fetchQueueStats = (): Promise<any | null> =>
    api.appQyV1.getTTSQueueStats()
      .then((response: any) => {
        setLoadingQueueStats(false);
        return (response.success && response.data) ? response.data : null;
      })
      .catch((error: any) => {
        console.error('Failed to load queue stats:', error);
        setLoadingQueueStats(false);
        return null;
      });

  const queueTask = usePersistentTask<any>('laravel.tts-queue', {
    intervalMs: 5000,
    poll: fetchQueueStats,
    reattach: fetchQueueStats,
  });
  const queueStats = queueTask.data;

  useEffect(() => {
    loadLanguages();
    loadTasks();
    loadLibraries();
    loadQueueStats();
  }, []);

  useEffect(() => {
    loadStatistics(statsLanguageFilter);
  }, [statsLanguageFilter]);

  useEffect(() => {
    loadLibraries();
  }, [selectedLanguage]);

  useEffect(() => {
    if (selectedTask) {
      setVocabularyWords(selectedTask.words);
    }
  }, [selectedTask]);

  // Auto-refresh toggle drives the persistent poll loop on/off.
  useEffect(() => {
    if (autoRefreshQueue) {
      if (!queueTask.running) queueTask.begin();
    } else if (queueTask.running) {
      queueTask.end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshQueue]);

  useEffect(() => {
    if (tts.data?.audio_url && audioRef.current) {
      audioRef.current.src = mediaUrl(tts.data.audio_url);
      audioRef.current.load();
    }
  }, [tts.data]);

  const loadLanguages = async () => {
    try {
      const response = await api.appQyV1.getTranslationLanguages();

      const defaultLanguages = [
        { code: 'en', name: 'English', native_name: 'English' },
        { code: 'zh', name: 'Chinese', native_name: '中文' },
        { code: 'ja', name: 'Japanese', native_name: '日本語' },
        { code: 'ko', name: 'Korean', native_name: '한국어' },
        { code: 'fr', name: 'French', native_name: 'Français' },
        { code: 'de', name: 'German', native_name: 'Deutsch' },
        { code: 'es', name: 'Spanish', native_name: 'Español' }
      ];

      const languageData = extractArrayFromResponse(response, defaultLanguages);

      setLanguages(languageData);
    } catch (error) {
      console.error('Failed to load languages:', error);
      setLanguages([
        { code: 'en', name: 'English', native_name: 'English' },
        { code: 'zh', name: 'Chinese', native_name: '中文' },
        { code: 'ja', name: 'Japanese', native_name: '日本語' },
        { code: 'ko', name: 'Korean', native_name: '한국어' }
      ]);
    }
  };

  const loadTasks = async () => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      // Mock data for now - replace with actual API call when available
      const mockTasks: VocabularyTask[] = [
        {
          id: 'task_1',
          title: 'Daily Vocabulary - Day 1',
          description: 'Learn 10 common English words',
          words: [
            {
              id: 'word_1',
              word: 'apple',
              translation: '苹果',
              phonetic: 'ˈæpl',
              part_of_speech: 'noun',
              definition: 'A round fruit with red, green, or yellow skin',
              example_sentences: ['I eat an apple every day.'],
              learned: false,
              proficiency: 0
            },
            {
              id: 'word_2',
              word: 'book',
              translation: '书',
              phonetic: 'bʊk',
              part_of_speech: 'noun',
              definition: 'A written or printed work',
              example_sentences: ['I love reading books.'],
              learned: false,
              proficiency: 0
            }
          ],
          status: 'in_progress',
          progress: 20,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      setTasks({
        data: mockTasks,
        loading: false,
        error: null,
        status: 'success'
      });
      
      if (mockTasks.length > 0 && !selectedTask) {
        setSelectedTask(mockTasks[0]);
      }
    } catch (error) {
      setTasks({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load tasks',
        status: 'error'
      });
    }
  };

  const loadLibraries = async () => {
    setLoadingLibraries(true);
    try {
      const response = await api.appQyV1.getLibraries({
        language: selectedLanguage,
        page: 1,
        per_page: 20
      });

      if (response.success && response.data) {
        const librariesData = response.data.libraries || response.data || [];
        setLibraries(Array.isArray(librariesData) ? librariesData : []);
      } else {
        setLibraries([]);
      }
    } catch (error: any) {
      console.error('Failed to load libraries:', error);
      logError('vocab', `Failed to load libraries: ${error?.message || 'unknown error'}`);
      setLibraries([]);
    } finally {
      setLoadingLibraries(false);
    }
  };

  /**
   * Retry a single library's FAILED cover. Resets that row to `pending` so
   * pycore re-claims and regenerates it (pull-only cover architecture), then
   * reloads the list so the new cover/status surfaces.
   */
  const handleRetryCover = async (library: any) => {
    const id = library?.id;
    if (id == null) return;
    setRetryingCovers((prev) => { const n = new Set(prev); n.add(id); return n; });
    logInfo('covers', `Retrying failed cover for library #${id} (${library?.name ?? ''})...`);
    try {
      const response = await api.appQyV1.retryCover({ ids: [Number(id)] });
      if (response.success) {
        toast.success('Cover queued for regeneration.');
        logSuccess('covers', `Cover retry queued for library #${id}`);
        await loadLibraries();
      } else {
        toast.error(response.error || 'Failed to retry cover');
        logError('covers', `Cover retry failed for library #${id}: ${response.error || 'unknown error'}`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to retry cover');
      logError('covers', `Cover retry failed for library #${id}: ${error?.message || error}`);
    } finally {
      setRetryingCovers((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  /**
   * Delete a user-created learning library (confirmed via modal).
   * The endpoint is auth:sanctum — a 401/403 surfaces a "please log in" toast.
   */
  const handleDeleteLibrary = async () => {
    if (!libraryToDelete) return;
    const name: string = libraryToDelete.name || `#${libraryToDelete.id}`;
    setDeletingLibrary(true);
    logInfo('vocab', `Deleting library "${name}" (id=${libraryToDelete.id})...`);
    try {
      const response = await api.appQyV1.deleteLearningLibrary(libraryToDelete.id);
      if (response.success) {
        toast.success(t.delete_library_success.replace('{name}', name));
        logSuccess('vocab', `Library "${name}" deleted`);
        setLibraryToDelete(null);
        loadLibraries();
      } else if (response.status === 401 || response.status === 403) {
        toast.error(t.login_required);
        logError('vocab', `Delete library "${name}" failed: authentication required (HTTP ${response.status})`);
      } else {
        throw new Error(response.error || t.delete_library_failed);
      }
    } catch (error: any) {
      toast.error(error?.message || t.delete_library_failed);
      logError('vocab', `Delete library "${name}" failed: ${error?.message || 'unknown error'}`);
    } finally {
      setDeletingLibrary(false);
    }
  };

  // Cache last page per language+library in localStorage
  const getLibraryPageCacheKey = (language: string, libraryId: number | string) =>
    `vocab_library_page_${language}_${libraryId}`;

  // Open the library detail view. Fetching/paging/stats now live inside
  // <VocabularyLibraryDetail> (virtualized + dashboard + fullscreen); this just
  // sets the active library and opens the modal. The per-library page cache key
  // is passed to the detail component so paging still survives reopen.
  const loadLibraryWords = (library: any) => {
    if (!library) return;
    setActiveLibrary(library);
    setLibraryWordsModalOpen(true);
  };

  const loadStatistics = async (filter?: string) => {
    const lang = filter !== undefined ? filter : statsLanguageFilter;
    setLoadingStatistics(true);
    try {
      const params = lang === 'all' ? undefined : { language: lang };
      const response = await api.appQyV1.getVocabularyStatistics(params);
      if (response.success && response.data) {
        const d = response.data as any;
        if (d.summary && (Array.isArray(d.languages) || d.summary.total_libraries != null)) {
          setStatistics({ summary: d.summary, languages: Array.isArray(d.languages) ? d.languages : [] });
        } else if (d.total_libraries != null || d.total_words != null) {
          setStatistics({
            summary: {
              total_languages: d.total_languages ?? ((d.total_libraries > 0) ? 1 : 0),
              total_libraries: Number(d.total_libraries) || 0,
              total_words: Number(d.total_words) || 0,
              tts_percentage: Number(d.tts_percentage) || 0,
            },
            languages: Array.isArray(d.languages) ? d.languages : [],
          });
        } else {
          setStatistics(null);
        }
      } else {
        setStatistics(null);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
      setStatistics(null);
    } finally {
      setLoadingStatistics(false);
    }
  };

  // Manual refresh = one immediate fetch pushed into the shared session.
  const loadQueueStats = () => {
    setLoadingQueueStats(true);
    fetchQueueStats().then((s) => { if (s) queueTask.set(s); });
  };

  const loadWordModal = async (language: string, page: number, perPage: number): Promise<{ words: VocabularyStatisticsWordRow[]; pagination: VocabularyWordsPagination | null }> => {
    const response = await api.appQyV1.getVocabularyStatistics({
      language,
      include_words: 1,
      page,
      per_page: perPage,
    });
    if (response.success && response.data) {
      const d = response.data as any;
      const words = Array.isArray(d.words) ? d.words : [];
      const pagination = d.words_pagination || d.pagination || null;
      return { words, pagination };
    }
    return { words: [], pagination: null };
  };

  const toggleWordLearned = (wordId: string) => {
    setVocabularyWords(prev => 
      prev.map(word => 
        word.id === wordId 
          ? { ...word, learned: !word.learned, proficiency: word.learned ? 0 : 50 }
          : word
      )
    );
    
    if (selectedTask) {
      const updatedTask = {
        ...selectedTask,
        words: selectedTask.words.map(word =>
          word.id === wordId
            ? { ...word, learned: !word.learned, proficiency: word.learned ? 0 : 50 }
            : word
        ),
        progress: calculateProgress(selectedTask.words.map(word =>
          word.id === wordId
            ? { ...word, learned: !word.learned, proficiency: word.learned ? 0 : 50 }
            : word
        ))
      };
      setSelectedTask(updatedTask);
      setTasks(prev => ({
        ...prev,
        data: prev.data?.map(task =>
          task.id === selectedTask.id ? updatedTask : task
        ) || null
      }));
    }
  };

  const calculateProgress = (words: VocabularyWord[]): number => {
    if (words.length === 0) return 0;
    const learnedCount = words.filter(w => w.learned).length;
    return Math.round((learnedCount / words.length) * 100);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setTranslation(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.appQyV1.translate({
        text: inputText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        type: 'learning'
      });

      if (response.success && response.data) {
        setTranslation({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setHistory(prev => [response.data!, ...prev.slice(0, 9)]);
        logSuccess('vocab', `Translated ${sourceLanguage}→${targetLanguage} (${inputText.trim().length} chars)`);
      } else {
        throw new Error(response.error || 'Translation failed');
      }
    } catch (error: any) {
      setTranslation({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
      toast.error(`${t.translate_failed}: ${error.message}`);
      logError('vocab', `Translate ${sourceLanguage}→${targetLanguage} failed: ${error.message}`);
    }
  };

  const handleDetectAndTranslate = async () => {
    if (!inputText.trim()) return;

    setTranslation(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.appQyV1.detectAndTranslate(inputText, targetLanguage);
      if (response.success && response.data) {
        setTranslation({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        if (response.data.detected_language) {
          setSourceLanguage(response.data.detected_language);
        }
        setHistory(prev => [response.data!, ...prev.slice(0, 9)]);
        logSuccess('vocab', `Detect+translate →${targetLanguage} succeeded (detected: ${response.data.detected_language || 'unknown'})`);
      } else {
        throw new Error(response.error || 'Translation failed');
      }
    } catch (error: any) {
      setTranslation({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
      toast.error(`${t.translate_failed}: ${error.message}`);
      logError('vocab', `Detect+translate →${targetLanguage} failed: ${error.message}`);
    }
  };

  const handleGenerateTTS = async () => {
    if (!translation.data?.translated_text) return;

    setTTS(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.appQyV1.generateTTS({
        text: translation.data.translated_text,
        language: targetLanguage,
        voice_type: 'female',
        speed: 1.0
      });

      if (response.success && response.data) {
        setTTS({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        toast.success(t.tts_success);
        logSuccess('vocab', `TTS generated (${targetLanguage}, ${translation.data.translated_text.length} chars)`);
      } else {
        throw new Error(response.error || 'TTS generation failed');
      }
    } catch (error: any) {
      setTTS({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
      toast.error(`${t.tts_failed}: ${error.message}`);
      logError('vocab', `TTS generation failed: ${error.message}`);
    }
  };

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseFloat(e.target.value);
      setCurrentTime(parseFloat(e.target.value));
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadHistoryItem = (item: TranslationResponse) => {
    setInputText(item.original_text);
    setSourceLanguage(item.source_language);
    setTargetLanguage(item.target_language);
    setTranslation({
      data: item,
      loading: false,
      error: null,
      status: 'success'
    });
  };

  // ===== Clickable-stat drill-downs (open the shared PaginatedListModal) ===== #
  const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');

  /** Resolve the dictionary-language for a drill-down (filter 'all' → English). */
  const drillLanguage = (): string => (statsLanguageFilter === 'all' ? 'english' : statsLanguageFilter);

  /** Inline play of a word's pre-rendered audio (drill-down ▶ button + detail panel).
   *  Rebases relative backend URLs onto the API origin (:9000) since the page is
   *  served cross-origin (:13054); absolute URLs (e.g. resolved sentence audio,
   *  cached urls) pass through mediaUrl unchanged. Covers every caller. */
  const playWordAudio = (url: string, label?: string) => {
    try {
      const a = new Audio(mediaUrl(url));
      a.play().catch((e) => {
        logError('vocab', `Audio play failed${label ? ` for "${label}"` : ''}: ${e?.message || e}`);
        toast.error('Could not play audio');
      });
    } catch (e: any) {
      logError('vocab', `Audio play error: ${e?.message || e}`);
      toast.error('Could not play audio');
    }
  };

  /**
   * Play an example sentence's audio file-first. If the row already carries a
   * ready `audio` URL, play it directly. Otherwise resolve it through
   * GET …/tts/sentence/audio (api.appQyV1): `exists` → play the returned url;
   * `queued` → surface a "generating…" state (the pycore worker will render it).
   * Keyed by `${language}|${text}` so re-clicks reuse a resolved url.
   */
  const sentenceAudioKey = (text: string, language: string) => `${language}|${text}`;

  const playSentenceAudio = async (sentence: any, language: string) => {
    const text: string = sentence?.text || '';
    if (!text) return;
    // Ready audio on the row — just play it.
    if (sentence?.audio) {
      playWordAudio(sentence.audio, text);
      return;
    }
    const key = sentenceAudioKey(text, language);
    const cached = sentenceAudioState[key];
    if (cached?.resolving) return;
    if (cached?.url) {
      playWordAudio(cached.url, text);
      return;
    }
    setSentenceAudioState((prev) => ({ ...prev, [key]: { resolving: true, queued: false, url: null } }));
    try {
      const response = await api.appQyV1.getSentenceAudio({ text, language });
      const data: any = response?.data;
      if (response?.success && data?.exists && data.url) {
        setSentenceAudioState((prev) => ({ ...prev, [key]: { resolving: false, queued: false, url: data.url } }));
        playWordAudio(data.url, text);
        logSuccess('vocab', `Sentence audio resolved (${language})`);
      } else if (response?.success && data && data.exists === false) {
        setSentenceAudioState((prev) => ({ ...prev, [key]: { resolving: false, queued: !!data.queued, url: null } }));
        if (data.queued) {
          toast.success('Audio generation queued — try again shortly');
          logInfo('vocab', `Sentence audio queued for generation (${language})`);
        } else {
          toast.error('No audio available for this sentence');
        }
      } else {
        throw new Error(response?.error || 'Failed to resolve sentence audio');
      }
    } catch (e: any) {
      setSentenceAudioState((prev) => ({ ...prev, [key]: { resolving: false, queued: false, url: null } }));
      toast.error(e?.message || 'Could not resolve sentence audio');
      logError('vocab', `Sentence audio resolve failed: ${e?.message || e}`);
    }
  };

  /**
   * Lazy-load the example sentences for a word when its detail panel expands.
   * Cached by word content so re-expanding the same row is instant. Resolves the
   * dictionary language from the row (falls back to the active drill language).
   */
  const loadWordSentences = (content: string, language?: string) => {
    if (!content) return;
    const cached = sentenceCache[content];
    if (cached && (cached.loading || cached.sentences.length > 0 || cached.error)) return;
    const lng = language || drillLanguage();
    setSentenceCache((prev) => ({ ...prev, [content]: { loading: true, error: null, sentences: [] } }));
    api.books
      .getWordSentences({ word: content, language: lng, limit: 10 })
      .then((r: any) => {
        if (r.success && r.data) {
          const sentences = Array.isArray(r.data.sentences) ? r.data.sentences : [];
          setSentenceCache((prev) => ({ ...prev, [content]: { loading: false, error: null, sentences } }));
        } else {
          throw new Error(r.error || 'Failed to load sentences');
        }
      })
      .catch((e: any) => {
        logError('vocab', `Load example sentences for "${content}" failed: ${e?.message || e}`);
        setSentenceCache((prev) => ({
          ...prev,
          [content]: { loading: false, error: e?.message || 'Failed to load sentences', sentences: [] },
        }));
      });
  };

  /** True while the given one-click action is in flight for the given word. */
  const isWordActionPending = (action: 'translate' | 'audio' | 'revalidate', content: string) =>
    wordActionPending.has(`${action}:${content}`);

  const setWordActionFlag = (key: string, on: boolean) =>
    setWordActionPending((prev) => {
      const n = new Set(prev);
      if (on) n.add(key); else n.delete(key);
      return n;
    });

  /**
   * One-click "Re-translate" — queue the word for (re)translation. Targets the
   * page's tracked target language when available, else 'zh'. Refreshes the word
   * list afterwards so the Translated column reflects the new state.
   */
  const handleReTranslateWord = async (content: string, language?: string) => {
    if (!content) return;
    const lng = language || drillLanguage();
    const key = `translate:${content}`;
    setWordActionFlag(key, true);
    logInfo('vocab', `Queueing "${content}" (${lng}) for re-translation...`);
    try {
      const response = await api.appQyV1.queueTranslationBatch({
        words: [content],
        language: lng,
        target_language: targetLanguage || 'zh',
      });
      if (response.success) {
        toast.success('Queued for translation');
        logSuccess('vocab', `Re-translate queued for "${content}"`);
        setWordsReloadTick((v) => v + 1);
      } else {
        throw new Error(response.error || 'Failed to queue translation');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to queue translation');
      logError('vocab', `Re-translate "${content}" failed: ${e?.message || e}`);
    } finally {
      setWordActionFlag(key, false);
    }
  };

  /**
   * One-click "Add / refresh audio" — request TTS for the word. If the response
   * carries an audio_url, patch the in-memory row so the Audio column updates
   * immediately; otherwise refresh the list so the queued state surfaces.
   */
  const handleAddAudioWord = async (row: any, language?: string) => {
    const content: string = row?.content;
    if (!content) return;
    const lng = language || row?.language || drillLanguage();
    const key = `audio:${content}`;
    setWordActionFlag(key, true);
    logInfo('vocab', `Requesting audio for "${content}" (${lng})...`);
    try {
      const response = await api.appQyV1.queueTTSBatchQuery([
        { content, language: lng, type: 'word' },
      ]);
      if (response.success) {
        toast.success('Audio requested');
        logSuccess('vocab', `Audio requested for "${content}"`);
        // Some backends return a ready audio_url synchronously — patch the row.
        const data: any = response.data;
        const audioUrl =
          data?.audio_url ||
          (Array.isArray(data?.results) ? data.results.find((x: any) => x?.content === content)?.audio_url : null) ||
          (Array.isArray(data) ? data.find((x: any) => x?.content === content)?.audio_url : null);
        if (audioUrl) {
          row.audio_url = audioUrl;
        }
        setWordsReloadTick((v) => v + 1);
      } else {
        throw new Error(response.error || 'Failed to request audio');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to request audio');
      logError('vocab', `Add audio "${content}" failed: ${e?.message || e}`);
    } finally {
      setWordActionFlag(key, false);
    }
  };

  /**
   * One-click "Revalidate" — re-enable a word the assist worker marked invalid
   * (is_valid=false; validity_source 'region-redirect' = Bing region/redirect,
   * 'bing-assist' = confirmed no entry). Reports is_valid=true so the enqueue
   * side picks it up for translation again. Recovers words that a transient
   * region redirect wrongly invalidated.
   */
  const handleRevalidateWord = async (r: any, language?: string) => {
    const content: string = r?.content;
    if (!content) return;
    const lng = language || r?.language || drillLanguage();
    const key = `revalidate:${content}`;
    setWordActionFlag(key, true);
    logInfo('vocab', `Revalidating "${content}" (${lng})...`);
    try {
      const response = await api.appQyV1.reportValidity({
        language: lng,
        source: 'dashboard-revalidate',
        results: [{ md5: r?.md5, word: content, is_valid: true, note: 'Re-enabled from dashboard' }],
      });
      if (response.success) {
        toast.success(`"${content}" re-enabled — it will be re-queued for translation`);
        logSuccess('vocab', `Revalidated "${content}"`);
        r.is_valid = true;
        setWordsReloadTick((v) => v + 1);
      } else {
        throw new Error(response.error || 'Failed to revalidate');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to revalidate');
      logError('vocab', `Revalidate "${content}" failed: ${e?.message || e}`);
    } finally {
      setWordActionFlag(key, false);
    }
  };

  /**
   * Full per-word detail panel shown under an expanded dictionary-word row.
   * Render logic lives in the presentational <WordDetail>; all state and
   * handlers stay here and arrive as props. The `(r) => ReactNode` signature is
   * preserved verbatim because the same factory is passed to both
   * <VocabularyLibraryDetail> and PaginatedListModal.renderDetail.
   */
  const renderWordDetail = (r: any): React.ReactNode => (
    <WordDetail
      row={r}
      sentenceCache={sentenceCache}
      sentenceAudioState={sentenceAudioState}
      wordActionPending={wordActionPending}
      loadWordSentences={loadWordSentences}
      playSentenceAudio={playSentenceAudio}
      playWordAudio={playWordAudio}
      sentenceAudioKey={sentenceAudioKey}
      isWordActionPending={isWordActionPending}
      handleReTranslateWord={handleReTranslateWord}
      handleAddAudioWord={handleAddAudioWord}
      handleRevalidateWord={handleRevalidateWord}
      drillLanguage={drillLanguage}
      nf={nf}
    />
  );

  /** TTS queue items by status or type (GET /tts/queue/items). */
  const openTtsQueueDrill = (
    label: string,
    params: { status?: 'pending' | 'processing' | 'completed' | 'failed'; type?: 'word' | 'sentence' | 'article' }
  ) => {
    const columns: PaginatedListColumn[] = [
      { key: 'content_text', header: 'Content', className: 'text-slate-900 dark:text-slate-100 max-w-xs truncate', render: (r) => r.content_text || r.content || r.text || '-' },
      { key: 'task_type', header: 'Type', render: (r) => r.task_type || r.type || '-' },
      { key: 'language', header: 'Lang', className: 'uppercase', render: (r) => r.language || '-' },
      { key: 'status', header: 'Status', render: (r) => r.status || '-' },
    ];
    const fetchPage: PaginatedListFetcher = async (start, limit) => {
      const r = await api.books.getTtsQueueItems({ ...params, start, limit });
      if (!r.success || !r.data) throw new Error(r.error || 'Failed to load queue items');
      return { items: r.data.items || [], total: r.data.total || 0 };
    };
    logInfo('vocab', `Drill-down: TTS queue "${label}"`);
    setStatDrill({ title: `TTS Queue — ${label}`, fetchPage, columns, reloadKey: `tts:${JSON.stringify(params)}` });
  };

  /** Dictionary words by filter (GET /dictionary/words). */
  const openDictionaryDrill = (
    label: string,
    filter: 'all' | 'with_translation' | 'without_translation' | 'invalid' | 'with_audio' | 'without_audio',
    language?: string
  ) => {
    const lang = language ?? drillLanguage();
    const columns = dictionaryColumns();
    const fetchPage: PaginatedListFetcher = async (start, limit) => {
      const r = await api.books.getDictionaryWords({ language: lang, filter, start, limit });
      if (!r.success || !r.data) throw new Error(r.error || 'Failed to load words');
      // Stamp the language so detail-panel lazy loads resolve the right dictionary.
      const items = (r.data.items || []).map((it: any) => ({ language: lang, ...it }));
      return { items, total: r.data.total || 0 };
    };
    logInfo('vocab', `Drill-down: dictionary "${label}" (${lang}/${filter})`);
    setStatDrill({
      title: `${label} — ${lang}`,
      subtitle: `filter: ${filter}`,
      fetchPage,
      columns,
      renderDetail: (r) => renderWordDetail(r),
      wide: true,
      reloadKey: `dict:${lang}:${filter}`,
    });
  };

  /** Total Libraries → the libraries list (GET /vocabulary/libraries, paged). */
  const openLibrariesDrill = () => {
    const columns: PaginatedListColumn[] = [
      { key: 'name', header: 'Library', className: 'font-medium text-slate-900 dark:text-slate-100' },
      { key: 'language', header: 'Language', className: 'capitalize' },
      { key: 'word_count', header: 'Words', className: 'text-right', render: (r) => nf(r.word_count) },
    ];
    const fetchPage: PaginatedListFetcher = async (start, limit) => {
      const perPage = limit;
      const page = Math.floor(start / perPage) + 1;
      const r = await api.appQyV1.getLibraries({ language: drillLanguage(), page, per_page: perPage });
      if (!r.success || !r.data) throw new Error(r.error || 'Failed to load libraries');
      const d = r.data as any;
      const items = Array.isArray(d.libraries) ? d.libraries : Array.isArray(d) ? d : [];
      const total = Number(d.pagination?.total ?? d.total ?? items.length) || items.length;
      return { items, total };
    };
    logInfo('vocab', 'Drill-down: libraries list');
    setStatDrill({ title: `Total Libraries — ${drillLanguage()}`, fetchPage, columns, reloadKey: `libs:${drillLanguage()}` });
  };

  /** Language Breakdown → dictionary words for that language (GET /dictionary/words). */
  const openLanguageRowDrill = (languageName: string) => {
    openDictionaryDrill(`Language: ${languageName}`, 'all', languageName);
  };

  /** Shared column set for dictionary-word lists (drill modal + Words tab). */
  const dictionaryColumns = (): PaginatedListColumn[] => buildDictionaryColumns({ playWordAudio, nf });

  /**
   * Back-compat helper: render the extracted InlineWordsList leaf list, wiring
   * the container-owned props (shared columns + renderWordDetail factory +
   * validity-source setter) through. The "Words" tab currently mounts
   * <WordsManagerPanel> instead, so this is preserved for the legacy path.
   */
  const renderInlineWordsList = (props: {
    language: string;
    filter: string;
    validitySource?: string;
    q: string;
    reloadKey: string | number;
  }): React.ReactNode => (
    <InlineWordsList
      language={props.language}
      filter={props.filter}
      validitySource={props.validitySource}
      q={props.q}
      reloadKey={props.reloadKey}
      columns={dictionaryColumns()}
      renderWordDetail={renderWordDetail}
      setWordsValiditySource={setWordsValiditySource}
    />
  );

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Translate, learn, and practice vocabulary</p>
      </div>

      {/* Sub-tab bar — only the active tab's content mounts. Persisted in localStorage. */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
        {VOCAB_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`relative px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === key
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
            {activeTab === key && (
              <motion.span
                layoutId="vocab-subtab"
                className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-500"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Animated active-tab content (scrollable region). */}
      <div className="flex-1 overflow-auto">
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...SUBTAB_MOTION} className="h-full flex flex-col">

      {/* ===================== TTS QUEUE TAB ===================== */}
      {activeTab === 'queue' && (
        <TtsQueueTab
          queueStats={queueStats}
          loadingQueueStats={loadingQueueStats}
          autoRefreshQueue={autoRefreshQueue}
          setAutoRefreshQueue={setAutoRefreshQueue}
          loadQueueStats={loadQueueStats}
          openTtsQueueDrill={openTtsQueueDrill}
          setLogsDockOpen={setLogsDockOpen}
          t={t}
        />
      )}

      {/* ===================== STATISTICS TAB ===================== */}
      {activeTab === 'statistics' && (
        <StatisticsTab
          statistics={statistics}
          loadingStatistics={loadingStatistics}
          statsLanguageFilter={statsLanguageFilter}
          setStatsLanguageFilter={setStatsLanguageFilter}
          statsFilterOpen={statsFilterOpen}
          setStatsFilterOpen={setStatsFilterOpen}
          loadStatistics={loadStatistics}
          openLibrariesDrill={openLibrariesDrill}
          openDictionaryDrill={openDictionaryDrill}
          openLanguageRowDrill={openLanguageRowDrill}
          setWordModalLanguage={setWordModalLanguage}
          setWordModalOpen={setWordModalOpen}
        />
      )}

      {/* ===================== LIBRARIES TAB ===================== */}
      {activeTab === 'libraries' && (
        <LibrariesTab
          libraries={libraries}
          loadingLibraries={loadingLibraries}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          librariesFilterOpen={librariesFilterOpen}
          setLibrariesFilterOpen={setLibrariesFilterOpen}
          loadLibraries={loadLibraries}
          loadLibraryWords={loadLibraryWords}
          handleRetryCover={handleRetryCover}
          retryingCovers={retryingCovers}
          setLibraryToDelete={setLibraryToDelete}
          t={t}
        />
      )}

      {/* ===================== WORDS TAB ===================== */}
      {activeTab === 'words' && (
        <div className={`${commonClasses.card} p-4`}>
          {/* Full word-management surface: merged statistics + search/filter +
              add + batch + per-row edit/delete + view/edit modal. */}
          <WordsManagerPanel />
        </div>
      )}

      {/* ===================== TRANSLATE TAB ===================== */}
      {activeTab === 'translate' && (
      <>
      {/* Main Content - Three Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[28rem]">
        {/* Left Panel - Translation */}
        <TranslateInputPanel
          translation={translation}
          tts={tts}
          languages={languages}
          sourceLanguage={sourceLanguage}
          setSourceLanguage={setSourceLanguage}
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          inputText={inputText}
          setInputText={setInputText}
          translateSettingsOpen={translateSettingsOpen}
          setTranslateSettingsOpen={setTranslateSettingsOpen}
          swapLanguages={swapLanguages}
          handleTranslate={handleTranslate}
          handleDetectAndTranslate={handleDetectAndTranslate}
          handleGenerateTTS={handleGenerateTTS}
          copy={copy}
          setTranslation={setTranslation}
          t={t}
        />

        {/* Center Panel - TTS Player */}
        <TtsPlayerPanel
          audioRef={audioRef}
          tts={tts}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          handlePlayPause={handlePlayPause}
          handleTimeUpdate={handleTimeUpdate}
          handleSeek={handleSeek}
          formatTime={formatTime}
          setIsPlaying={setIsPlaying}
          setDuration={setDuration}
        />

        {/* Right Panel - Learning Tasks */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t.learning_tasks || 'Learning Tasks'}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={loadTasks}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                title="Refresh tasks"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
              </button>
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
          </div>

          {tasks.loading ? (
            <LoadingBlock full />
          ) : tasks.error ? (
            <AlertBox variant="error" className="flex-1">{tasks.error}</AlertBox>
          ) : tasks.data && tasks.data.length > 0 ? (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Task List */}
              <div className="flex-shrink-0">
                <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">Tasks</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {tasks.data.map(task => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`w-full text-left p-2 rounded-lg border transition-colors ${
                        selectedTask?.id === task.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{task.title}</span>
                        <StatusBadge status={task.status} withDot={false} />
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 mb-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{task.progress}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vocabulary Words */}
              {selectedTask && vocabularyWords.length > 0 && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">
                    Vocabulary ({vocabularyWords.filter(w => w.learned).length}/{vocabularyWords.length})
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {vocabularyWords.map(word => (
                      <div
                        key={word.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          word.learned
                            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-base">{word.word}</span>
                              {word.phonetic && (
                                <span className="text-xs text-slate-500">[{word.phonetic}]</span>
                              )}
                              {word.part_of_speech && (
                                <span className="text-xs px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400">
                                  {word.part_of_speech}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {word.translation}
                            </p>
                            {word.definition && (
                              <p className="text-xs text-slate-500 mt-1">{word.definition}</p>
                            )}
                            {word.example_sentences && word.example_sentences.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {word.example_sentences.map((sentence, idx) => (
                                  <p key={idx} className="text-xs italic text-slate-600 dark:text-slate-400">
                                    "{sentence}"
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => toggleWordLearned(word.id)}
                            className={`ml-2 p-1.5 rounded transition-colors ${
                              word.learned
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'
                            }`}
                            title={word.learned ? 'Mark as unlearned' : 'Mark as learned'}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                        {word.proficiency !== undefined && word.proficiency > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${word.proficiency}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">{word.proficiency}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask && vocabularyWords.length === 0 && (
                <EmptyState message="No vocabulary words in this task" className="flex-1" />
              )}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              message="No tasks available"
              className="flex-1"
              action={
                <button
                  onClick={loadTasks}
                  className="text-xs text-indigo-500 hover:text-indigo-400"
                >
                  Refresh
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* History Bar (translate tab) */}
      {history.length > 0 && (
        <div className={`mt-4 ${commonClasses.card} overflow-hidden`}>
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setHistoryCollapsed(!historyCollapsed)}
          >
            <h4 className="font-semibold text-sm">{t.history} ({history.length})</h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHistory([]);
              }}
              className="text-xs text-slate-500 hover:text-red-500"
            >
              Clear
            </button>
          </div>
          {!historyCollapsed && (
            <div className="max-h-32 overflow-y-auto p-3 space-y-2">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => loadHistoryItem(item)}
                  className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">{item.original_text}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-800 dark:text-slate-200">{item.translated_text}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.source_language} → {item.target_language}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </>
      )}

        </motion.div>
      </AnimatePresence>
      </div>

      {/* ===================== GLOBAL MODALS / DOCKS (outside tabs) ===================== */}

      {/* Word List Modal – requests paginated words by language when opened */}
      <VocabularyWordListModal
        open={wordModalOpen}
        onClose={() => setWordModalOpen(false)}
        language={wordModalLanguage}
        fetchWords={loadWordModal}
        initialPage={wordModalCache[wordModalLanguage]?.page ?? 1}
        initialPerPage={wordModalCache[wordModalLanguage]?.perPage ?? 100}
        onPageChange={(lang, page, perPage) => {
          setWordModalCache((prev) => ({ ...prev, [lang]: { page, perPage } }));
        }}
      />

      {/* Library Words Modal — upgraded detail view (dashboard + virtualized
          list + per-row expand + fullscreen). The detail component owns its own
          fetching/paging/stats; it can go full-viewport (Esc restores/closes). */}
      {libraryWordsModalOpen && activeLibrary && (
        <Portal>
          <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
            <VocabularyLibraryDetail
              library={activeLibrary}
              onClose={() => setLibraryWordsModalOpen(false)}
              playWordAudio={playWordAudio}
              renderWordDetail={renderWordDetail}
              pageCacheKey={getLibraryPageCacheKey(selectedLanguage || 'default', activeLibrary.id)}
            />
          </div>
        </Portal>
      )}

      {/* Floating Recent-Logs dock (bottom-left; the global log dock owns bottom-right).
          Rendered unconditionally so the pill badges stay live while collapsed. */}
      <TtsLogsDock
        open={logsDockOpen}
        onToggle={() => setLogsDockOpen((v) => !v)}
        queueStats={queueStats}
        loading={loadingQueueStats}
        autoRefresh={autoRefreshQueue}
        onAutoRefreshChange={setAutoRefreshQueue}
        onRefresh={loadQueueStats}
        t={t}
      />

      {/* Clickable-stat drill-down (TTS queue / dictionary words / libraries / language) */}
      {statDrill && (
        <PaginatedListModal
          open={!!statDrill}
          onClose={() => setStatDrill(null)}
          title={statDrill.title}
          subtitle={statDrill.subtitle}
          fetchPage={statDrill.fetchPage}
          columns={statDrill.columns}
          renderDetail={statDrill.renderDetail}
          wide={statDrill.wide}
          reloadKey={statDrill.reloadKey}
        />
      )}

      {/* Library deletion confirm */}
      <ConfirmModal
        isOpen={!!libraryToDelete}
        onClose={() => {
          if (!deletingLibrary) setLibraryToDelete(null);
        }}
        onConfirm={handleDeleteLibrary}
        title={t.delete_library}
        message={t.delete_library_confirm.replace('{name}', libraryToDelete?.name || `#${libraryToDelete?.id ?? ''}`)}
        confirmText={t.delete_library}
        cancelText={t.cancel}
        variant="danger"
        loading={deletingLibrary}
      />
    </div>
  );
};

export default VocabularyLearning;
