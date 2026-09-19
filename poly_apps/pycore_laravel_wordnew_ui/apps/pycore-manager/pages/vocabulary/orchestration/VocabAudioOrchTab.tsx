/**
 * Audio-orchestration tab of the pycore-manager vocabulary page.
 *
 * Composition root: loads the qy auth status, the cached backend book list and
 * the orchestration task list from pycore; polls progress while any task is
 * generating. Sub-panels: OrchLoginPanel / OrchBookPicker / OrchTaskList /
 * OrchTaskEditor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  pycoreApi,
  onHttpStatus,
  subscribeLaravelRelayDevice,
  loadTtlCache,
  loadTtlCacheStale,
  saveTtlCache,
  type OrchAuthStatus,
  type OrchBookItem,
  type OrchSystemStatus,
  type OrchTask,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { ORCH_L, orchErrorMessage } from './orchShared';
import { VocabBanner } from '../vocabShared';
import { SHARED_BASE_URL_CHANGED_EVENT } from '../../../../../core/integrations/laravel/transport/BaseAPI';
import OrchLoginPanel from './OrchLoginPanel';
import OrchSystemPanel from './OrchSystemPanel';
import OrchBookPicker from './OrchBookPicker';
import OrchTaskList from './OrchTaskList';
import OrchTaskEditor from './OrchTaskEditor';
import OrchLearningVideoPanel from './OrchLearningVideoPanel';

const POLL_MS = 3000;
// Frontend central TTL cache for the system probe (ffmpeg etc.): instant paint
// with the last good value, a forced re-probe every 3h or when the pycore
// relay device changes.
const SYSTEM_CACHE_NAME = 'orch.system_status';
const SYSTEM_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const VocabAudioOrchTab: React.FC = () => {
  const [auth, setAuth] = useState<OrchAuthStatus | null>(null);
  const [systemStatus, setSystemStatus] = useState<OrchSystemStatus | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [books, setBooks] = useState<OrchBookItem[]>([]);
  const [cachedSentenceBooks, setCachedSentenceBooks] = useState<Set<string>>(new Set());
  const [pendingSyncs, setPendingSyncs] = useState<Set<string>>(new Set());
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksRefreshing, setBooksRefreshing] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [selectedBookKey, setSelectedBookKey] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OrchTaskSummary[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editorTask, setEditorTask] = useState<OrchTask | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestsRef = useRef({ system: false, books: false, tasks: false });

  const loadAuth = useCallback(async () => {
    try {
      setAuth(await pycoreApi.orchAuthStatus());
    } catch {
      setAuth(null);
    }
  }, []);

  const loadSystem = useCallback(async (refresh: boolean) => {
    if (requestsRef.current.system) return;
    requestsRef.current.system = true;
    setSystemLoading(true);
    try {
      // Force a backend re-probe when the frontend TTL cache has expired.
      const forceProbe = refresh || !loadTtlCache(SYSTEM_CACHE_NAME, SYSTEM_CACHE_TTL_MS);
      const response = await pycoreApi.orchSystemStatus(forceProbe);
      if (!response.success) throw new Error(response.error || ORCH_L.loadFailed);
      setSystemStatus(response);
      saveTtlCache(SYSTEM_CACHE_NAME, response);
      setSystemError(null);
    } catch (e) {
      setSystemError(orchErrorMessage(e, ORCH_L.loadFailed));
    } finally {
      requestsRef.current.system = false;
      setSystemLoading(false);
    }
  }, []);

  // Returns true while a background books/sentences fetch is still running
  // (the caller keeps polling until pycore's background job lands).
  const loadBooks = useCallback(async (refresh: boolean): Promise<boolean> => {
    if (requestsRef.current.books) return true;
    requestsRef.current.books = true;
    setBooksLoading(true);
    setBooksError(null);
    try {
      const r = await pycoreApi.orchBooksList(refresh);
      if (!r.success) throw new Error(r.error || ORCH_L.loadFailed);
      setBooks(Array.isArray(r.items) ? r.items : []);
      const cachedKeys = new Set(r.cached_sentence_books || []);
      setCachedSentenceBooks(cachedKeys);
      const syncStates = r.sync_states || {};
      setPendingSyncs((prev) => {
        const next = new Set<string>();
        prev.forEach((key) => {
          const state = syncStates[key];
          // Keep polling only while the background fetch is genuinely running;
          // done (cached) and failed both stop the loop.
          if (state && state.status && state.status !== 'running') return;
          next.add(key);
        });
        Object.entries(syncStates).forEach(([key, state]) => {
          if (key !== 'books' && state.status === 'running') next.add(key);
        });
        return next;
      });
      const syncFailure = r.sync?.status === 'failed' ? r.sync.error : null;
      const sentenceFailure = Object.values(syncStates).find((state) => state.status === 'failed' && state.error)?.error;
      if (syncFailure || sentenceFailure) setBooksError(String(syncFailure || sentenceFailure));
      setBooksRefreshing(Boolean(r.refreshing));
      return Boolean(r.refreshing);
    } catch (e) {
      setBooksError(orchErrorMessage(e, ORCH_L.loadFailed));
      setBooksRefreshing(false);
      return false;
    } finally {
      requestsRef.current.books = false;
      setBooksLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (requestsRef.current.tasks) return;
    requestsRef.current.tasks = true;
    try {
      const r = await pycoreApi.orchTasksList();
      if (!r.success) throw new Error(ORCH_L.loadFailed);
      setTasks(Array.isArray(r.tasks) ? r.tasks : []);
      setTasksError(null);
    } catch (e) {
      setTasksError(orchErrorMessage(e, ORCH_L.loadFailed));
    } finally {
      requestsRef.current.tasks = false;
    }
  }, []);

  const syncAuth = useCallback(async () => {
    try {
      setAuth(await pycoreApi.orchAuthSync());
    } catch (e) {
      setSystemError(orchErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    // Paint the cached system status (ffmpeg probe result) instantly; the
    // load below revalidates in the background.
    const cached = loadTtlCacheStale<OrchSystemStatus>(SYSTEM_CACHE_NAME);
    if (cached) setSystemStatus(cached.value);
    void loadAuth();
    void syncAuth();
    void loadSystem(false);
    void loadBooks(false);
    void loadTasks();
  }, [loadAuth, syncAuth, loadSystem, loadBooks, loadTasks]);

  useEffect(() => {
    const refresh = () => {
      void syncAuth();
      void loadSystem(false);
      void loadBooks(false);
      void loadTasks();
    };
    const unsubscribe = [
      // A new relay device may mean a different pycore machine: re-probe.
      subscribeLaravelRelayDevice(() => {
        void syncAuth();
        void loadSystem(true);
      }),
      onHttpStatus((connected) => {
        if (!connected) return;
        refresh();
      }),
    ];
    window.addEventListener(SHARED_BASE_URL_CHANGED_EVENT, refresh);
    return () => {
      unsubscribe.forEach((stop) => stop());
      window.removeEventListener(SHARED_BASE_URL_CHANGED_EVENT, refresh);
    };
  }, [syncAuth, loadSystem, loadBooks, loadTasks]);

  // Poll while any task is generating so progress bars + statuses stay live.
  useEffect(() => {
    const running = tasks.some((task) => task.running || task.status === 'generating' || task.progress?.sync_pending);
    if (running && !pollRef.current) {
      pollRef.current = setInterval(() => void loadTasks(), POLL_MS);
    } else if (!running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [tasks, loadTasks]);

  // Poll while books/sentence background syncs run on the pycore side.
  useEffect(() => {
    if (pendingSyncs.size === 0 && !booksRefreshing) return;
    const timer = setInterval(() => void loadBooks(false), POLL_MS);
    return () => clearInterval(timer);
  }, [pendingSyncs, booksRefreshing, loadBooks]);

  // Always stop the poller on unmount (the effect above skips cleanup while
  // a task is still running).
  useEffect(() => () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const openEdit = async (taskId: string) => {
    try {
      const r = await pycoreApi.orchTaskGet(taskId);
      if (!r.success) throw new Error(r.error || ORCH_L.actionFailed);
      setEditorTask(r);
      setEditorOpen(true);
      setTasksError(null);
    } catch (e) {
      setTasksError(orchErrorMessage(e));
    }
  };

  const generate = async (taskId: string) => {
    try {
      const r = await pycoreApi.orchTaskGenerate(taskId);
      if (!r.success) throw new Error(r.error || ORCH_L.generateFailed);
      setSelectedTaskId(taskId);
      void loadTasks();
    } catch (e) {
      setTasksError(orchErrorMessage(e, ORCH_L.generateFailed));
    }
  };

  const refreshBooks = async () => {
    // Kick the background fetch, then poll until it lands.
    await loadBooks(true);
  };

  const selectedBook = books.find((b) => b.source_key === selectedBookKey) || null;

  return (
    <div className="space-y-4">
      <OrchSystemPanel
        status={systemStatus}
        loading={systemLoading}
        error={systemError}
        onRefresh={() => { void syncAuth(); void loadSystem(true); }}
      />

      <OrchLoginPanel auth={auth} onChanged={() => { void loadAuth(); void loadSystem(false); }} />

      <OrchBookPicker
        books={books}
        cachedSentenceBooks={cachedSentenceBooks}
        pendingSyncs={pendingSyncs}
        selectedKey={selectedBookKey}
        onSelect={(b) => setSelectedBookKey(b.source_key)}
        onNewTask={(b) => { setSelectedBookKey(b.source_key); setEditorTask(null); setEditorOpen(true); }}
        onRefresh={() => void refreshBooks()}
        onSyncStarted={(key) => setPendingSyncs((prev) => new Set(prev).add(key))}
        loading={booksLoading}
        error={booksError}
      />

      {editorOpen && (
        <OrchTaskEditor
          key={editorTask?.task_id || selectedBook?.source_key || 'new'}
          book={selectedBook}
          books={books}
          task={editorTask}
          onSyncStarted={(key) => setPendingSyncs((prev) => new Set(prev).add(key))}
          onSaved={(taskId) => { setSelectedTaskId(taskId); void loadTasks(); }}
          onClose={() => { setEditorOpen(false); setEditorTask(null); void loadTasks(); }}
        />
      )}

      {tasksError && <VocabBanner kind="error" message={tasksError} />}
      <OrchTaskList
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onSelect={(taskId) => setSelectedTaskId((prev) => (prev === taskId ? null : taskId))}
        onEdit={(taskId) => void openEdit(taskId)}
        onGenerate={(taskId) => void generate(taskId)}
        onChanged={() => void loadTasks()}
      />

      {/* Learning video generation (moved from agent-history; reuses the
          shared agent_history_article video_* config + video jobs log). */}
      <OrchLearningVideoPanel />
    </div>
  );
};

export default VocabAudioOrchTab;
