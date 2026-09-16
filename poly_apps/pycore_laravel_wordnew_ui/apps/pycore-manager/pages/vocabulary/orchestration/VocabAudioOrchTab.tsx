/**
 * Audio-orchestration tab of the pycore-manager vocabulary page.
 *
 * Composition root: loads the qy auth status, the cached backend book list and
 * the orchestration task list from pycore; polls progress while any task is
 * generating. Sub-panels: OrchLoginPanel / OrchBookPicker / OrchTaskList /
 * OrchTaskEditor.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  pycoreApi,
  type OrchAuthStatus,
  type OrchBookItem,
  type OrchSystemStatus,
  type OrchTask,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';
import OrchLoginPanel from './OrchLoginPanel';
import OrchSystemPanel from './OrchSystemPanel';
import OrchBookPicker from './OrchBookPicker';
import OrchTaskList from './OrchTaskList';
import OrchTaskEditor from './OrchTaskEditor';

const POLL_MS = 3000;

const VocabAudioOrchTab: React.FC = () => {
  const [auth, setAuth] = useState<OrchAuthStatus | null>(null);
  const [systemStatus, setSystemStatus] = useState<OrchSystemStatus | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [books, setBooks] = useState<OrchBookItem[]>([]);
  const [cachedSentenceBooks, setCachedSentenceBooks] = useState<Set<string>>(new Set());
  const [pendingSyncs, setPendingSyncs] = useState<Set<string>>(new Set());
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [selectedBookKey, setSelectedBookKey] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OrchTaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editorTask, setEditorTask] = useState<OrchTask | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAuth = useCallback(async () => {
    try {
      setAuth(await pycoreApi.orchAuthStatus());
    } catch {
      setAuth(null);
    }
  }, []);

  const loadSystem = useCallback(async (refresh: boolean) => {
    setSystemLoading(true);
    try {
      setSystemStatus(await pycoreApi.orchSystemStatus(refresh));
    } catch {
      setSystemStatus(null);
    } finally {
      setSystemLoading(false);
    }
  }, []);

  // Returns true while a background books/sentences fetch is still running
  // (the caller keeps polling until pycore's background job lands).
  const loadBooks = useCallback(async (refresh: boolean): Promise<boolean> => {
    setBooksLoading(true);
    setBooksError(null);
    try {
      const r = await pycoreApi.orchBooksList(refresh);
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
          if (cachedKeys.has(key)) return;
          if (state && state.status && state.status !== 'running') return;
          next.add(key);
        });
        return next;
      });
      const syncFailure = r.sync?.status === 'failed' ? r.sync.error : null;
      if (!r.success && r.error) setBooksError(String(r.error));
      else if (syncFailure) setBooksError(String(syncFailure));
      return Boolean(r.refreshing);
    } catch (e) {
      setBooksError(e instanceof Error ? e.message : 'load failed');
      return false;
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const r = await pycoreApi.orchTasksList();
      setTasks(Array.isArray(r.tasks) ? r.tasks : []);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    void loadAuth();
    void loadSystem(false);
    void loadBooks(false);
    void loadTasks();
  }, [loadAuth, loadSystem, loadBooks, loadTasks]);

  // Poll while any task is generating so progress bars + statuses stay live.
  useEffect(() => {
    const running = tasks.some((task) => task.running || task.status === 'generating');
    if (running && !pollRef.current) {
      pollRef.current = setInterval(() => void loadTasks(), POLL_MS);
    } else if (!running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [tasks, loadTasks]);

  // Poll while books/sentence background syncs run on the pycore side.
  useEffect(() => {
    if (pendingSyncs.size === 0) return;
    const timer = setInterval(() => void loadBooks(false), POLL_MS);
    return () => clearInterval(timer);
  }, [pendingSyncs, loadBooks]);

  // Always stop the poller on unmount (the effect above skips cleanup while
  // a task is still running).
  useEffect(() => () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const openEdit = async (taskId: string) => {
    const r = await pycoreApi.orchTaskGet(taskId);
    if (r.success) {
      setEditorTask(r);
      setEditorOpen(true);
    }
  };

  const generate = async (taskId: string) => {
    await pycoreApi.orchTaskGenerate(taskId);
    void loadTasks();
  };

  const refreshBooks = async () => {
    // Kick the background fetch, then poll until it lands.
    const refreshing = await loadBooks(true);
    if (!refreshing) return;
    const timer = setInterval(async () => {
      const still = await loadBooks(false);
      if (!still) clearInterval(timer);
    }, POLL_MS);
  };

  const selectedBook = books.find((b) => b.source_key === selectedBookKey) || null;

  return (
    <div className="space-y-4">
      <OrchSystemPanel
        status={systemStatus}
        loading={systemLoading}
        onRefresh={() => void loadSystem(true)}
      />

      <OrchLoginPanel auth={auth} onChanged={() => void loadAuth()} />

      <OrchBookPicker
        books={books}
        cachedSentenceBooks={cachedSentenceBooks}
        pendingSyncs={pendingSyncs}
        selectedKey={selectedBookKey}
        onSelect={(b) => setSelectedBookKey(b.source_key)}
        onRefresh={() => void refreshBooks()}
        onSyncStarted={(key) => setPendingSyncs((prev) => new Set(prev).add(key))}
        loading={booksLoading}
        error={booksError}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setEditorTask(null); setEditorOpen(true); }}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus className="w-4 h-4" /> {ORCH_L.newTask}
        </button>
      </div>

      {editorOpen && (
        <OrchTaskEditor
          book={selectedBook}
          task={editorTask}
          onSaved={(taskId) => { setSelectedTaskId(taskId); void loadTasks(); }}
          onClose={() => { setEditorOpen(false); setEditorTask(null); void loadTasks(); }}
        />
      )}

      <OrchTaskList
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onSelect={(taskId) => setSelectedTaskId((prev) => (prev === taskId ? null : taskId))}
        onEdit={(taskId) => void openEdit(taskId)}
        onGenerate={(taskId) => void generate(taskId)}
        onChanged={() => void loadTasks()}
      />
    </div>
  );
};

export default VocabAudioOrchTab;
