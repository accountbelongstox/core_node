/**
 * Backend book picker for the audio-orchestration page. Lists the pycore-cached
 * Laravel book list, refreshes from the backend on demand, and syncs a book's
 * sentence table into the local cache (required before planning/generation).
 */
import React, { useState } from 'react';
import { BookOpen, Loader2, Plus, RefreshCw } from 'lucide-react';
import { pycoreApi, type OrchBookItem, type OrchSyncState } from '@/apps/pycore-manager/api';
import { VocabBanner, humanInt } from '../vocabulary/vocabShared';
import { ORCH_L, orchErrorMessage, orchSyncFailureMessage } from './orchShared';

const OrchBookPicker: React.FC<{
  books: OrchBookItem[];
  cachedSentenceBooks: Set<string>;
  pendingSyncs: Set<string>;
  /** Per-book sentence sync attempt (failure shown on that book's row). */
  syncStates: Record<string, OrchSyncState>;
  selectedKey: string | null;
  onSelect: (book: OrchBookItem) => void;
  onNewTask: (book: OrchBookItem) => void;
  onRefresh: () => void;
  onSyncStarted: (sourceKey: string) => void;
  loading: boolean;
  error: string | null;
}> = ({ books, cachedSentenceBooks, pendingSyncs, syncStates, selectedKey, onSelect, onNewTask, onRefresh, onSyncStarted, loading, error }) => {
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncSentences = async (book: OrchBookItem, refresh = true) => {
    setSyncError(null);
    try {
      // Relay-safe: pycore answers instantly and fetches in the background
      // (resuming a failed sync from its saved partial); the parent polls
      // until the book lands in cached_sentence_books.
      const r = await pycoreApi.orchBookSentences(book.source_key, refresh);
      if (!r.success) {
        setSyncError(String(r.error || ORCH_L.loadFailed));
        return;
      }
      if (r.syncing) onSyncStarted(book.source_key);
    } catch (e) {
      setSyncError(orchErrorMessage(e, ORCH_L.loadFailed));
    }
  };

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.booksTitle}</h3>
          <span className="text-xs text-slate-500">{humanInt(books.length)}</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-500/50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {ORCH_L.refresh}
        </button>
      </div>
      {error && <VocabBanner kind="error" message={error} />}
      {syncError && <VocabBanner kind="error" message={syncError} />}
      {books.length === 0 && !loading && (
        <p className="text-xs text-slate-500">{ORCH_L.noBooks}</p>
      )}
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
        {books.map((book) => {
          const cached = cachedSentenceBooks.has(book.source_key);
          const syncing = pendingSyncs.has(book.source_key);
          const syncState = syncStates[book.source_key];
          const syncFailed = !syncing && syncState?.status === 'failed';
          const selected = selectedKey === book.source_key;
          return (
            <div
              key={book.source_key}
              className={`flex items-center gap-3 py-2 px-1 cursor-pointer rounded ${selected ? 'bg-sky-500/10' : 'hover:bg-slate-800/40'}`}
              onClick={() => onSelect(book)}
            >
              {book.image_url && (
                <img src={book.image_url} alt="" className="w-8 h-10 rounded object-cover flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{book.title || book.original_name || book.source_key}</p>
                <p className="text-[11px] text-slate-500">
                  {book.language || 'en'} · {humanInt(book.sentence_count)} {ORCH_L.sentences}
                  {cached && <span className="ml-2 text-emerald-400">· {ORCH_L.sentencesCached}</span>}
                  {syncing && (
                    <span className="ml-2 text-sky-400">
                      · {ORCH_L.syncing}
                      {syncState?.total ? ` ${humanInt(syncState.fetched)}/${humanInt(syncState.total)}` : ''}
                    </span>
                  )}
                </p>
                {syncFailed && (
                  <p className="text-[11px] text-rose-400" title={syncState?.detail || ''}>
                    {orchSyncFailureMessage(syncState)}
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); void syncSentences(book); }}
                      className="ml-2 inline-flex items-center gap-1 rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-300 hover:border-rose-400"
                    >
                      <RefreshCw className="w-3 h-3" /> {ORCH_L.retry}
                    </button>
                  </p>
                )}
              </div>
              <button type="button" onClick={(event) => { event.stopPropagation(); onNewTask(book); void syncSentences(book); }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500">
                <Plus className="w-3 h-3" /> {ORCH_L.newTask}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default OrchBookPicker;
