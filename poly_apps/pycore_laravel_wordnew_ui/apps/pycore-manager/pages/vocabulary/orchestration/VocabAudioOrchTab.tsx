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
  type OrchTask,
  type OrchTaskSummary,
} from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';
import OrchLoginPanel from './OrchLoginPanel';
import OrchBookPicker from './OrchBookPicker';
import OrchTaskList from './OrchTaskList';
import OrchTaskEditor from './OrchTaskEditor';

const POLL_MS = 3000;

const VocabAudioOrchTab: React.FC = () => {
  const [auth, setAuth] = useState<OrchAuthStatus | null>(null);
  const [books, setBooks] = useState<OrchBookItem[]>([]);
  const [cachedSentenceBooks, setCachedSentenceBooks] = useState<Set<string>>(new Set());
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

  const loadBooks = useCallback(async (refresh: boolean) => {
    setBooksLoading(true);
    setBooksError(null);
    try {
      const r = await pycoreApi.orchBooksList(refresh);
      setBooks(Array.isArray(r.items) ? r.items : []);
      setCachedSentenceBooks(new Set(r.cached_sentence_books || []));
      if (!r.success && r.error) setBooksError(String(r.error));
    } catch (e) {
      setBooksError(e instanceof Error ? e.message : 'load failed');
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
    void loadBooks(false);
    void loadTasks();
  }, [loadAuth, loadBooks, loadTasks]);

  // Poll while any task is generating so progress bars + statuses stay live.
  useEffect(() => {
    const running = tasks.some((task) => task.running || task.status === 'generating');
    if (running && !pollRef.current) {
      pollRef.current = setInterval(() => void loadTasks(), POLL_MS);
    } else if (!running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current && !running) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [tasks, loadTasks]);

  const openEdit = async (taskId: string) => {
    const r = await pycoreApi.orchTaskGet(taskId);
    if (r.success) {
      setEditorTask(r);
      setEditorOpen(true);
    }
  };

  const selectedBook = books.find((b) => b.source_key === selectedBookKey) || null;

  return (
    <div className="space-y-4">
      <OrchLoginPanel auth={auth} onChanged={() => void loadAuth()} />

      <OrchBookPicker
        books={books}
        cachedSentenceBooks={cachedSentenceBooks}
        selectedKey={selectedBookKey}
        onSelect={(b) => setSelectedBookKey(b.source_key)}
        onRefresh={() => { void loadBooks(true); void loadTasks(); }}
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
        onSelect={setSelectedTaskId}
        onEdit={(taskId) => void openEdit(taskId)}
        onChanged={() => void loadTasks()}
      />
    </div>
  );
};

export default VocabAudioOrchTab;
