
import React, { useState, useEffect, useRef } from 'react';
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
import {
  Languages,
  ArrowLeftRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Copy,
  RefreshCw,
  X,
  BookOpen,
  CheckCircle,
  ChevronDown,
  CircleAlert,
  ListChecks,
  Trash2
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import { extractArrayFromResponse } from '../../utils/arrayUtils';
import { useAppState } from '../../contexts/AppStateContext';
import { usePersistentTask } from '../../core/tasks/usePersistentTask';
import VocabularyWordListModal from '../vocabulary/VocabularyWordListModal';
import type { VocabularyStatisticsWordRow, VocabularyWordsPagination } from '../../types';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';
import { ConfirmModal, useToast } from '../admin';
import { logError, logInfo, logSuccess } from '../../core/logs/logStore';

/** Status → text colour for the collapsed-pill latest-entry one-liner. */
const ttsLogStatusText = (status: string | undefined): string =>
  status === 'failed' ? 'text-red-600 dark:text-red-400' :
  status === 'completed' ? 'text-green-600 dark:text-green-400' :
  status === 'processing' ? 'text-blue-600 dark:text-blue-400' :
  'text-yellow-600 dark:text-yellow-400';

interface TtsLogsDockProps {
  open: boolean;
  onToggle: () => void;
  /** Polled queue-stats snapshot (shape comes from the backend, kept loose). */
  queueStats: any;
  loading: boolean;
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  onRefresh: () => void;
  /** i18n strings (vocabulary section). */
  t: {
    recent_logs_dock: string;
    auto_refresh: string;
    refresh: string;
    failed: string;
    no_logs: string;
  };
}

/**
 * TtsLogsDock — page-local floating dock for the TTS queue "Recent Logs"
 * table, anchored bottom-LEFT (the global operation-log dock owns
 * bottom-right). Collapsed: a pill with live count / failed badges + the
 * latest entry. Expanded: the full 8-column log table in a scrollable panel.
 * `left-16 md:left-20` clears the fixed app sidebar (z-50, ~3.5–4rem wide);
 * z-[150] matches the global dock — above app chrome, below Portal overlays.
 */
const TtsLogsDock: React.FC<TtsLogsDockProps> = ({
  open,
  onToggle,
  queueStats,
  loading,
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  t
}) => {
  const recentLogs: any[] = Array.isArray(queueStats?.recent_logs) ? queueStats.recent_logs : [];
  const logsCount: number = Number(queueStats?.logs_count) || recentLogs.length;
  const failedCount = recentLogs.filter((log: any) => log?.status === 'failed').length;
  const latest: any | null = recentLogs.length > 0 ? recentLogs[0] : null;

  return (
    <Portal lockScroll={false}>
      <div className="fixed bottom-3 left-16 md:left-20 z-[150] flex flex-col items-start pointer-events-none">
        {open && (
          <div className="pointer-events-auto mb-2 w-[min(960px,calc(100vw-6rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Header: title + auto-refresh + manual refresh + collapse */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <ListChecks className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {t.recent_logs_dock}{logsCount > 0 ? ` (${logsCount})` : ''}
              </span>
              <span className="flex-1" />
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => onAutoRefreshChange(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                {t.auto_refresh}
              </label>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                {t.refresh}
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t.recent_logs_dock}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body: the 8-column queue-log table (moved from the TTS Queue card) */}
            <div className="max-h-80 overflow-auto">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-4">{t.no_logs}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Content</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Language</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Priority</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Retries</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {recentLogs.map((log: any, index: number) => (
                      <React.Fragment key={log.id || index}>
                        <tr
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            log.status === 'failed' ? 'bg-red-50/50 dark:bg-red-900/10' :
                            log.status === 'completed' ? 'bg-green-50/50 dark:bg-green-900/10' :
                            log.status === 'processing' ? 'bg-blue-50/50 dark:bg-blue-900/10' :
                            ''
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
                            {log.id}
                          </td>
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100 max-w-xs truncate" title={log.content_text}>
                            {log.content_text || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              log.task_type === 'word' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' :
                              log.task_type === 'sentence' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                              'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400'
                            }`}>
                              {log.task_type || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 uppercase">
                            {log.language || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              log.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              log.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            }`}>
                              {log.status || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {log.priority ? log.priority.toLocaleString() : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {log.retry_count !== undefined && log.retry_count > 0 ? (
                              <span className="px-2 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                {log.retry_count}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {log.completed_at ? (
                              <span className="text-green-600 dark:text-green-400" title={log.completed_at}>
                                {new Date(log.completed_at).toLocaleString()}
                              </span>
                            ) : log.started_at ? (
                              <span className="text-blue-600 dark:text-blue-400" title={log.started_at}>
                                {new Date(log.started_at).toLocaleString()}
                              </span>
                            ) : log.requested_at ? (
                              <span className="text-yellow-600 dark:text-yellow-400" title={log.requested_at}>
                                {new Date(log.requested_at).toLocaleString()}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                        {log.error_message && (
                          <tr className="bg-red-50/30 dark:bg-red-900/10">
                            <td colSpan={8} className="px-3 py-2">
                              <p className="text-xs text-red-700 dark:text-red-400">
                                <strong>Error:</strong> {log.error_message}
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Collapsed pill — always visible; badges stay live via the parent's poll. */}
        <button
          type="button"
          onClick={onToggle}
          title={t.recent_logs_dock}
          className="pointer-events-auto flex items-center gap-2 max-w-[min(560px,calc(100vw-8rem))] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
        >
          <ListChecks className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-200 flex-shrink-0">{t.recent_logs_dock}</span>
          <span className="px-1.5 py-px rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0">
            {logsCount}
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-px rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex-shrink-0">
              <CircleAlert className="w-3 h-3" />
              {failedCount} {t.failed}
            </span>
          )}
          {!open && latest && (
            <span className={`truncate font-mono ${ttsLogStatusText(latest.status)}`}>
              {latest.content_text || latest.status || '-'}
            </span>
          )}
        </button>
      </div>
    </Portal>
  );
};

const VocabularyLearning: React.FC = () => {
  const { lang } = useAppState();
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

  // Library Words Viewer State
  const [libraryWordsModalOpen, setLibraryWordsModalOpen] = useState(false);
  const [activeLibrary, setActiveLibrary] = useState<any | null>(null);
  const [libraryWords, setLibraryWords] = useState<any[]>([]);
  const [libraryWordsLoading, setLibraryWordsLoading] = useState(false);
  const [libraryWordsPage, setLibraryWordsPage] = useState(1);
  const [libraryWordsPerPage, setLibraryWordsPerPage] = useState(100);
  const [libraryWordsTotal, setLibraryWordsTotal] = useState(0);

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

  const toast = useToast();
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
      audioRef.current.src = tts.data.audio_url;
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

  const loadLibraryWords = async (
    library: any,
    page?: number,
    overridePerPage?: number
  ) => {
    if (!library) return;
    const libraryId = library.id;
    const langKey = selectedLanguage || 'default';

    // Resolve page: prefer explicit param, then cache, then 1
    let targetPage = page;
    if (!targetPage) {
      try {
        const cacheKey = getLibraryPageCacheKey(langKey, libraryId);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = parseInt(cached, 10);
          if (!isNaN(parsed) && parsed > 0) {
            targetPage = parsed;
          }
        }
      } catch {
        // ignore cache errors
      }
    }
    if (!targetPage || targetPage < 1) {
      targetPage = 1;
    }

    const perPage = overridePerPage && overridePerPage > 0 ? overridePerPage : libraryWordsPerPage;

    setActiveLibrary(library);
    setLibraryWordsModalOpen(true);
    setLibraryWordsLoading(true);

    try {
      const response = await api.appQyV1.getLibraryWords(libraryId, {
        page: targetPage,
        per_page: perPage,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        const words = Array.isArray(data.words)
          ? data.words
          : Array.isArray(data.items)
          ? data.items
          : [];

        const pagination = data.pagination || {};
        const currentPage = Number(pagination.current_page) || targetPage || 1;
        const perPageNum = Number(pagination.per_page) || perPage;
        const totalNum = Number(pagination.total) || 0;

        setLibraryWords(words);
        setLibraryWordsPage(currentPage);
        setLibraryWordsPerPage(perPageNum);
        setLibraryWordsTotal(totalNum);

        try {
          const cacheKey = getLibraryPageCacheKey(langKey, libraryId);
          localStorage.setItem(cacheKey, String(currentPage));
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('Failed to load library words:', error);
    } finally {
      setLibraryWordsLoading(false);
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Translate, learn, and practice vocabulary</p>
      </div>

      {/* TTS Queue Management Section */}
      <div className={`${commonClasses.card} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">TTS Queue Management</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefreshQueue}
                onChange={(e) => setAutoRefreshQueue(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <label htmlFor="auto-refresh" className="text-xs text-slate-600 dark:text-slate-400">
                Auto-refresh (5s)
              </label>
            </div>
          </div>
          <button
            onClick={loadQueueStats}
            disabled={loadingQueueStats}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingQueueStats ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {queueStats ? (
          <div className="space-y-4">
            {/* Status Statistics */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Status Statistics</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {queueStats.by_status?.pending || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Pending</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {queueStats.by_status?.processing || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Processing</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {queueStats.by_status?.completed || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Completed</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {queueStats.by_status?.failed || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Failed</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                    {queueStats.total || 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
                </div>
              </div>
            </div>

            {/* Type Statistics */}
            {queueStats.by_type && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Type Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                      {queueStats.by_type.word || 0}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Word</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                      {queueStats.by_type.sentence || 0}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Sentence</div>
                  </div>
                  <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
                    <div className="text-2xl font-bold text-pink-700 dark:text-pink-400">
                      {queueStats.by_type.article || 0}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Article</div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Stats - Always show if data exists */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Additional Information</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
                    {queueStats.current_concurrent ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Current Concurrent</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {queueStats.total_success ?? queueStats.by_status?.completed ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total Success</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {queueStats.total_retries ?? 0}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total Retries</div>
                </div>
              </div>
            </div>

            {/* Recent Logs — moved to the floating bottom-left dock (<TtsLogsDock/>) */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ListChecks className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                {t.logs_moved_hint}
              </p>
              <button
                type="button"
                onClick={() => setLogsDockOpen(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0"
              >
                {t.open_logs_dock}
              </button>
            </div>
          </div>
        ) : loadingQueueStats ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <p className="text-sm">No queue statistics available</p>
          </div>
        )}
      </div>

      {/* Statistics Section */}
      {(statistics || loadingStatistics) && (
        <div className={`${commonClasses.card} p-4 mb-4`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-lg">Vocabulary Statistics</h3>
            <div className="flex items-center gap-2">
              <select
                value={statsLanguageFilter}
                onChange={(e) => setStatsLanguageFilter(e.target.value)}
                className={`${commonClasses.input} text-sm`}
              >
                <option value="all">All languages</option>
                <option value="english">English</option>
                <option value="chinese">Chinese</option>
                <option value="japanese">Japanese</option>
                <option value="korean">Korean</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="spanish">Spanish</option>
              </select>
              <button
                onClick={() => loadStatistics(statsLanguageFilter)}
                disabled={loadingStatistics}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingStatistics ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loadingStatistics && !statistics ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : statistics ? (
            <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {statistics.summary?.total_languages || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Languages Supported</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {(statistics.summary?.total_libraries || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Total Libraries</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  const lang = statsLanguageFilter === 'all' ? 'english' : statsLanguageFilter;
                  setWordModalLanguage(lang);
                  setWordModalOpen(true);
                }}
              >
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 underline decoration-dotted">
                  {(statistics.summary?.total_words || 0).toLocaleString()}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Total Words</div>
              </button>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {statistics.summary?.tts_percentage || 0}%
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">TTS Coverage</div>
            </div>
          </div>

          {/* Dictionary-level totals: distinct words, translation coverage, validity */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4">
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                {(statistics.summary?.total_dictionary_words || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Dictionary Words</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {(statistics.summary?.total_with_translation || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">With Translation</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {(statistics.summary?.total_without_translation || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Without Translation</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {(statistics.summary?.total_invalid_words || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Invalid Words
                {statistics.summary?.total_validity_checked != null && (
                  <span className="ml-1 text-slate-400">
                    ({(statistics.summary?.total_validity_checked || 0).toLocaleString()} checked)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Language Breakdown - total table */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Language Breakdown</h4>
            {statistics.languages && statistics.languages.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Language</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Words</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Translated</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">No Translation</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Valid</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Invalid</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Libraries</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">TTS</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Translation %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.languages.map((lang: any, idx: number) => {
                      const words = (lang.dictionary_words ?? 0) > 0 ? lang.dictionary_words : (lang.total_words || 0);
                      return (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{lang.language}</td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300 font-medium">{(words || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">{(lang.with_translation || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">{(lang.without_translation || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{(lang.valid_words ?? words ?? 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400">{(lang.invalid_words || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-500">{(lang.libraries_count || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">{lang.tts_percentage ?? 0}%</td>
                        <td className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">{lang.review_percentage ?? 0}%</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">No language data for the selected filter.</p>
            )}
          </div>
            </>
          ) : null}
        </div>
      )}

      {/* Vocabulary Libraries Section */}
      <div className={`${commonClasses.card} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Vocabulary Libraries
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className={`${commonClasses.input} text-sm`}
            >
              <option value="english">English</option>
              <option value="chinese">Chinese</option>
              <option value="japanese">Japanese</option>
              <option value="korean">Korean</option>
              <option value="french">French</option>
              <option value="german">German</option>
              <option value="spanish">Spanish</option>
            </select>
            <button
              onClick={loadLibraries}
              disabled={loadingLibraries}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <RefreshCw className={`w-4 h-4 ${loadingLibraries ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {loadingLibraries ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : libraries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {libraries.map((library: any) => (
              <div
                key={library.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => loadLibraryWords(library)}
              >
                {library.image_url && (
                  <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={library.image_url}
                      alt={library.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {/* Failed cover: show WHY (error_message + attempts) and a per-
                    library Retry that re-queues it for pycore (pull-only). */}
                {library.cover?.status === 'failed' && (
                  <div
                    className="mb-3 px-2.5 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
                      <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span
                        className="flex-1 line-clamp-2 break-words"
                        title={library.cover.error_message || 'Cover generation failed.'}
                      >
                        {library.cover.error_message || 'Cover generation failed.'}
                        {typeof library.cover.attempts === 'number' && library.cover.attempts > 0 && (
                          <span className="text-red-500/80 dark:text-red-400/80">
                            {' '}({library.cover.attempts} attempt{library.cover.attempts === 1 ? '' : 's'})
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryCover(library);
                      }}
                      disabled={retryingCovers.has(library.id)}
                      className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 ${retryingCovers.has(library.id) ? 'animate-spin' : ''}`} />
                      Retry cover
                    </button>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{library.name}</h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLibraryToDelete(library);
                    }}
                    className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={t.delete_library}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {library.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                    {library.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {library.word_count || 0} words
                  </span>
                  <div className="flex items-center gap-2">
                    {library.difficulty && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        library.difficulty === 'beginner'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : library.difficulty === 'intermediate'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}>
                        {library.difficulty}
                      </span>
                    )}
                    {library.is_recommended && (
                      <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                        Recommended
                      </span>
                    )}
                  </div>
                </div>
                {library.category && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Category: {library.category}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No libraries available for {selectedLanguage}</p>
            </div>
          </div>
        )}
      </div>

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

      {/* Main Content - Three Panel Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* Left Panel - Translation */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Translation</h3>
            <button
              onClick={swapLanguages}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Swap languages"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Language Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className={`${commonClasses.input} text-sm`}
            >
              {Array.isArray(languages) && languages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.native_name} ({lang.name})
                </option>
              ))}
            </select>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className={`${commonClasses.input} text-sm`}
            >
              {Array.isArray(languages) && languages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.native_name} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          {/* Input Text Area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.input_placeholder}
            rows={6}
            className={`${commonClasses.input} flex-1 mb-4 resize-none`}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleTranslate}
              disabled={translation.loading || !inputText.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {translation.loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
              {t.translate}
            </button>
            <button
              onClick={handleDetectAndTranslate}
              disabled={translation.loading || !inputText.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              {t.auto_detect}
            </button>
            <button
              onClick={() => {
                setInputText('');
                setTranslation({ data: null, loading: false, error: null, status: 'idle' });
              }}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <X className="w-4 h-4" />
              {t.clear}
            </button>
          </div>

          {/* Translation Result */}
          {translation.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm mb-4">
              {translation.error}
            </div>
          )}

          {translation.data && (
            <div className="flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Translation</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(translation.data!.translated_text)}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGenerateTTS}
                    disabled={tts.loading}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Generate TTS"
                  >
                    {tts.loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
                <p className="text-slate-900 dark:text-slate-100">{translation.data.translated_text}</p>
              </div>
              {translation.data.phonetic && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  /{translation.data.phonetic}/
                </p>
              )}
              {translation.data.alternatives && translation.data.alternatives.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Alternatives:</p>
                  <div className="flex flex-wrap gap-1">
                    {translation.data.alternatives.map((alt, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          setTranslation(prev => ({
                            ...prev,
                            data: { ...prev.data!, translated_text: alt }
                          }));
                        }}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {translation.data.confidence && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confidence: {(translation.data.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </div>

        {/* Center Panel - TTS Player */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <h3 className="font-semibold mb-4">Audio Player</h3>

          {tts.data ? (
            <>
              {/* Audio Element */}
              <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDuration(audioRef.current.duration);
                  }
                }}
                className="hidden"
              />

              {/* Progress Bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  disabled
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  disabled
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Audio Info */}
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <p>Duration: {tts.data.duration}s</p>
                <p>Format: {tts.data.format.toUpperCase()}</p>
                {tts.data.cache_hit && (
                  <p className="text-emerald-600 dark:text-emerald-400">✓ Cached</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Volume2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No audio generated</p>
                <p className="text-xs">Translate text and click TTS button</p>
              </div>
            </div>
          )}
        </div>

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
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : tasks.error ? (
            <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
              {tasks.error}
            </div>
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
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          task.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {task.status}
                        </span>
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
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  No vocabulary words in this task
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks available</p>
                <button
                  onClick={loadTasks}
                  className="mt-2 text-xs text-indigo-500 hover:text-indigo-400"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Library Words Modal */}
      {libraryWordsModalOpen && activeLibrary && (
        <Portal>
          <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-700/80">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {activeLibrary.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {activeLibrary.language} · {activeLibrary.word_count || 0} words · {activeLibrary.difficulty || 'intermediate'}
                </p>
              </div>
              <button
                onClick={() => setLibraryWordsModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controls */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Page {libraryWordsPage} · {libraryWordsTotal} words
                </span>
                <select
                  className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  value={libraryWordsPerPage}
                  onChange={(e) => {
                    const per = parseInt(e.target.value, 10) || 100;
                    // update state, then reload page 1 with explicit perPage
                    setLibraryWordsPerPage(per);
                    loadLibraryWords(activeLibrary, 1, per);
                  }}
                >
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={libraryWordsPage <= 1 || libraryWordsLoading}
                  onClick={() => loadLibraryWords(activeLibrary, libraryWordsPage - 1)}
                  className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  disabled={
                    libraryWordsLoading ||
                    libraryWordsTotal <= libraryWordsPage * libraryWordsPerPage
                  }
                  onClick={() => loadLibraryWords(activeLibrary, libraryWordsPage + 1)}
                  className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Words Table */}
            <div className="flex-1 overflow-auto">
              {libraryWordsLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-500 dark:text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading words...
                </div>
              ) : libraryWords.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                  No words found for this library.
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-14">
                        #
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-32">
                        Word
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-32">
                        Phonetic
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">
                        Translations
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {libraryWords.map((word: any, idx: number) => {
                      const index =
                        (word.index as number | undefined) ??
                        (word.word_index as number | undefined) ??
                        idx + 1 + (libraryWordsPage - 1) * libraryWordsPerPage;
                      const translations: string[] = Array.isArray(word.translations)
                        ? word.translations
                        : [];
                      const shortTranslations =
                        translations.length === 0
                          ? ''
                          : translations.join(', ').slice(0, 80) +
                            (translations.join(', ').length > 80 ? '…' : '');

                      const fullTranslations = translations.join(', ');

                      return (
                        <tr key={`${index}-${word.word || idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono">
                            {index}
                          </td>
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100 font-semibold">
                            {word.word}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {word.us_phonetic && (
                              <span className="mr-2">US: /{word.us_phonetic}/</span>
                            )}
                            {word.uk_phonetic && (
                              <span>UK: /{word.uk_phonetic}/</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {shortTranslations ? (
                              <button
                                type="button"
                                className="text-left w-full truncate hover:text-indigo-600 dark:hover:text-indigo-400"
                                title={fullTranslations}
                              >
                                {shortTranslations}
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            </div>
          </div>
        </Portal>
      )}

      {/* History Bar */}
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
