import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, UploadCloud, RefreshCw, FileText,
  Type, Hash, AlignLeft, Languages, Eye, EyeOff, Filter, Sparkles,
} from 'lucide-react';
import { api } from '../../core/api';
import type {
  BookTextStats, BookUploadFile, BookTotals, BookListKind,
} from '../../core/api/modules/BooksAPI';
import { commonClasses } from '../../styles/theme';
import { useToast } from '../admin';
import { logInfo, logSuccess, logError } from '../../core/logstore/logStore';
import PaginatedListModal, { PaginatedListColumn } from './PaginatedListModal';
import ProcessingCapabilityCard from './ProcessingCapabilityCard';

/**
 * BooksPanel — laravel-manager "Books / Add source" collapsible section for the
 * Vocabulary page. Ports the pycore PcBooksPage UX onto the Laravel backend:
 *
 *  - drag-drop + file-picker multi-upload of book files (POST /books/upload),
 *  - per-file + aggregate stat tiles (words / unique words / sentences / unique
 *    sentences / characters / languages); each numeric tile is CLICKABLE and
 *    opens a paginated drill-down (POST /books/list) via PaginatedListModal,
 *  - a quick optional LOCAL preview stat for plain text (txt/md/html) shown
 *    instantly before the authoritative backend stats land,
 *  - text preview per file,
 *  - "Ingest to library" (POST /books/ingest) — sync result summary OR async
 *    {task_id} polled against GET /task/{id}/status with a stage + % progress bar.
 *
 * All UI strings are English. Toasts via useToast(); logs via logStore.
 */

const LIST_LIMIT = 100;
const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');

/** Quick, rough local stats for readable text — labelled "local preview". */
const ROUGH_TEXT_EXTS = ['txt', 'md', 'markdown', 'html', 'htm', 'csv', 'log'];
function roughLocalStats(text: string): { words: number; uniqueWords: number; sentences: number; chars: number } {
  const stripped = text.replace(/<[^>]+>/g, ' ');
  const words = stripped.match(/[\p{L}\p{N}']+/gu) || [];
  const unique = new Set(words.map((w) => w.toLowerCase()));
  const sentences = stripped.split(/[.!?。！？\n]+/).map((s) => s.trim()).filter(Boolean);
  return { words: words.length, uniqueWords: unique.size, sentences: sentences.length, chars: text.length };
}

interface UploadedDoc {
  upload_id: string;
  files: BookUploadFile[];
  aggregate?: BookTextStats | null;
  totals: BookTotals;
}

interface LocalPreview {
  name: string;
  words: number;
  uniqueWords: number;
  sentences: number;
  chars: number;
}

interface IngestProgress {
  stage: string;
  percent: number;
}

/** Clickable / static stat tile (mirrors PcBooksPage's StatTile affordance). */
const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  onClick?: () => void;
}> = ({ icon, label, value, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`text-left rounded-lg p-3 border bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 ${
      onClick
        ? 'cursor-pointer hover:border-indigo-400 hover:ring-1 hover:ring-indigo-400/40 transition'
        : 'cursor-default'
    }`}
  >
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
      {icon}
      {label}
      {onClick && <Eye className="w-3 h-3 ml-auto opacity-50" />}
    </div>
    <div className={`text-base font-bold ${accent || 'text-slate-700 dark:text-slate-200'}`}>{value}</div>
  </button>
);

const BooksPanel: React.FC = () => {
  const toast = useToast();

  const [collapsed, setCollapsed] = useState(true);

  // Upload + analysis
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([]);
  const [openPreview, setOpenPreview] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supported formats + optional language hint
  const [supportedFormats, setSupportedFormats] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>('');

  // Ingest
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drill-down list modal
  const [listView, setListView] = useState<{ uploadId: string; kind: BookListKind; name: string } | null>(null);

  useEffect(() => {
    api.books
      .getBooksSupportedFormats()
      .then((r) => {
        const formats = (r.success && r.data && Array.isArray(r.data.formats)) ? r.data.formats : [];
        if (formats.length) setSupportedFormats(formats);
      })
      .catch(() => { /* offline — picker just accepts everything */ });
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // --- upload + analyze --------------------------------------------------- #
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);

      // Optional instant local preview for plain text (labelled "local preview").
      const previews: LocalPreview[] = [];
      for (const f of files) {
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        if (ROUGH_TEXT_EXTS.includes(ext) && f.size <= 2_000_000) {
          try {
            const text = await f.text();
            const s = roughLocalStats(text);
            previews.push({ name: f.name, ...s });
          } catch { /* skip */ }
        }
      }
      if (previews.length) setLocalPreviews(previews);

      logInfo('books', `Uploading ${files.length} file(s) for analysis...`);
      try {
        const r = await api.books.booksUpload(files, language || undefined);
        // Backend envelope is {success, data:{upload_id, files, aggregate, totals}};
        // gate on the presence of the staged upload_id, not a (nonexistent) inner success.
        if (r.success && r.data && r.data.upload_id) {
          const d = r.data;
          setDocs((prev) => [
            { upload_id: d.upload_id, files: d.files || [], aggregate: d.aggregate, totals: d.totals },
            ...prev,
          ]);
          setLocalPreviews([]);
          const errCount = (d.files || []).filter((f) => f.error).length;
          toast.success(`Analyzed ${d.files?.length || 0} file(s)${errCount ? ` · ${errCount} with errors` : ''}`);
          logSuccess('books', `Analyzed upload ${d.upload_id} (${d.files?.length || 0} files, ${nf(d.totals?.words)} words)`);
        } else {
          const msg = r.data?.error || r.error || 'Upload analysis failed';
          toast.error(msg);
          logError('books', `Upload analysis failed: ${msg}`);
        }
      } catch (e: any) {
        toast.error(e?.message || 'Upload failed');
        logError('books', `Upload failed: ${e?.message || 'unknown error'}`);
      } finally {
        setUploading(false);
      }
    },
    [language, toast]
  );

  const onPickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) void uploadFiles(files);
    e.target.value = '';
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      if (files.length) void uploadFiles(files);
    },
    [uploadFiles]
  );

  const togglePreview = (key: string) =>
    setOpenPreview((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  // --- ingest (sync result OR async task poll) ---------------------------- #
  const pollTask = useCallback(
    async (taskId: string | number, uploadId: string) => {
      try {
        const r = await api.books.getTaskStatus(taskId);
        const task = r.success && r.data ? r.data.task : null;
        if (!task) {
          setIngestProgress(null);
          setIngestingId(null);
          toast.error('Lost track of the ingest task');
          logError('books', `Task ${taskId} status unavailable`);
          return;
        }
        const pct = Math.max(0, Math.min(100, Number(task.progress) || 0));
        setIngestProgress({ stage: task.stage || task.status || 'processing', percent: pct });

        if (task.status === 'completed' || task.status === 'success' || task.status === 'done') {
          const result = task.result || {};
          const sentences = result.total_sentences ?? result.sentences;
          setIngestProgress(null);
          setIngestingId(null);
          toast.success(`Ingested to library${sentences != null ? ` — ${nf(sentences)} sentences` : ''}`);
          logSuccess('books', `Ingest task ${taskId} completed`);
          return;
        }
        if (task.status === 'failed' || task.status === 'error') {
          setIngestProgress(null);
          setIngestingId(null);
          toast.error(task.error || 'Ingest failed');
          logError('books', `Ingest task ${taskId} failed: ${task.error || 'unknown error'}`);
          return;
        }
        // still running — poll again
        pollTimer.current = setTimeout(() => void pollTask(taskId, uploadId), 1500);
      } catch (e: any) {
        setIngestProgress(null);
        setIngestingId(null);
        toast.error(e?.message || 'Ingest polling failed');
        logError('books', `Ingest task ${taskId} poll error: ${e?.message || 'unknown error'}`);
      }
    },
    [toast]
  );

  const ingest = useCallback(
    async (uploadId: string) => {
      if (ingestingId) return;
      setIngestingId(uploadId);
      setIngestProgress({ stage: 'submitting', percent: 0 });
      logInfo('books', `Ingesting upload ${uploadId} to library...`);
      try {
        const r = await api.books.booksIngest({ upload_id: uploadId, language: language || undefined });
        if (!r.success || !r.data) {
          throw new Error(r.data?.error || r.error || 'Ingest failed');
        }
        const d = r.data;
        if (d.task_id != null) {
          // Async — poll for stage + progress.
          logInfo('books', `Ingest queued as task ${d.task_id}; polling...`);
          void pollTask(d.task_id, uploadId);
          return;
        }
        // Sync result.
        const books = d.books || [];
        const totalSentences = books.reduce((acc, b) => acc + (b.sentences || 0), 0);
        const totalWords = books.reduce((acc, b) => acc + (b.words || 0), 0);
        setIngestProgress(null);
        setIngestingId(null);
        toast.success(`Ingested ${books.length} book(s) — ${nf(totalSentences)} sentences · ${nf(totalWords)} words`);
        logSuccess('books', `Ingested upload ${uploadId} (${books.length} books, ${nf(totalSentences)} sentences)`);
      } catch (e: any) {
        setIngestProgress(null);
        setIngestingId(null);
        toast.error(e?.message || 'Ingest failed');
        logError('books', `Ingest failed for upload ${uploadId}: ${e?.message || 'unknown error'}`);
      }
    },
    [ingestingId, language, pollTask, toast]
  );

  // --- drill-down list fetcher (shared with PaginatedListModal) ----------- #
  const listFetcher = useCallback(
    (uploadId: string, kind: BookListKind) => async (start: number, limit: number) => {
      const r = await api.books.booksList({ upload_id: uploadId, kind, start, limit });
      if (!r.success || !r.data) throw new Error(r.data?.error || r.error || 'Failed to load');
      const t = r.data.totals || {};
      let summary = '';
      if (kind === 'words' || kind === 'unique_words') {
        summary = `${nf(t.unique_words)} distinct · ${nf(t.words)} total occurrences`;
      } else if (kind === 'sentences') {
        summary = `${nf(t.sentences)} sentences`;
      } else if (kind === 'unique_sentences') {
        summary = `${nf(t.unique_sentences)} distinct sentences`;
      }
      return { items: r.data.items || [], total: r.data.total || 0, summary };
    },
    []
  );

  const listColumns = useMemo<PaginatedListColumn[] | undefined>(() => {
    if (!listView) return undefined;
    const k = listView.kind;
    if (k === 'words' || k === 'unique_words') {
      return [
        { key: 'word', header: 'Word', className: 'font-medium text-slate-900 dark:text-slate-100' },
        { key: 'count', header: 'Count', className: 'text-right text-slate-500', render: (row) => nf(row.count) },
      ];
    }
    if (k === 'languages') {
      return [
        { key: 'code', header: 'Code', className: 'font-bold uppercase text-emerald-600 dark:text-emerald-400', render: (row) => (row.code || '').toUpperCase() },
        { key: 'chars', header: 'Chars', className: 'text-right', render: (row) => nf(row.chars) },
        { key: 'ratio', header: 'Ratio', className: 'text-right text-slate-500', render: (row) => `${Math.round((row.ratio || 0) * 100)}%` },
      ];
    }
    // sentences / unique_sentences
    return [
      { key: 'text', header: 'Sentence', className: 'break-words', render: (row) => row.text },
    ];
  }, [listView]);

  const kindLabel: Record<BookListKind, string> = {
    words: 'Words',
    unique_words: 'Unique words',
    sentences: 'Sentences',
    unique_sentences: 'Unique sentences',
    languages: 'Languages',
  };

  // --- render: aggregate / per-file stat tiles ---------------------------- #
  const renderStatTiles = (s: BookTextStats, uploadId: string, name: string) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      <StatTile icon={<Type className="w-3 h-3" />} label="Words" value={nf(s.word_count)}
        onClick={() => setListView({ uploadId, kind: 'words', name })} />
      <StatTile icon={<Hash className="w-3 h-3" />} label="Unique words" value={nf(s.unique_word_count)} accent="text-indigo-500"
        onClick={() => setListView({ uploadId, kind: 'unique_words', name })} />
      <StatTile icon={<AlignLeft className="w-3 h-3" />} label="Sentences" value={nf(s.sentence_count)}
        onClick={() => setListView({ uploadId, kind: 'sentences', name })} />
      <StatTile icon={<Hash className="w-3 h-3" />} label="Unique sentences" value={nf(s.unique_sentence_count)} accent="text-indigo-500"
        onClick={() => setListView({ uploadId, kind: 'unique_sentences', name })} />
      <StatTile icon={<FileText className="w-3 h-3" />} label="Characters" value={nf(s.char_count)} />
      <StatTile icon={<Languages className="w-3 h-3" />} label="Languages" value={(s.primary_language || 'und').toUpperCase()} accent="text-emerald-500"
        onClick={() => setListView({ uploadId, kind: 'languages', name })} />
    </div>
  );

  const renderLangChips = (s: BookTextStats) =>
    s.languages && s.languages.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Languages className="w-3 h-3 text-slate-400" />
        {s.languages.slice(0, 8).map((l) => (
          <span key={l.script} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {(l.code || '').toUpperCase()} {Math.round((l.ratio || 0) * 100)}%
          </span>
        ))}
      </div>
    ) : null;

  const renderTopWords = (s: BookTextStats) =>
    s.top_words && s.top_words.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Top words</span>
        {s.top_words.slice(0, 10).map((w) => (
          <span key={w.word} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-slate-300">
            {w.word} <span className="text-slate-400">×{nf(w.count)}</span>
          </span>
        ))}
      </div>
    ) : null;

  return (
    <div className={`${commonClasses.card} mb-4`}>
      {/* collapsible header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-rose-500" />
          Books / Add source
          {docs.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
              {docs.length}
            </span>
          )}
        </h3>
        {collapsed ? <ChevronRight className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload book files (or drag them in) to analyze words / sentences / languages, then ingest them into the
            sentence and word library.
          </p>

          {/* controls row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`${commonClasses.input} text-sm`}
                title="Optional language hint sent with the upload"
              >
                <option value="">Auto language</option>
                <option value="english">English</option>
                <option value="chinese">Chinese</option>
                <option value="japanese">Japanese</option>
                <option value="korean">Korean</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="spanish">Spanish</option>
              </select>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={onPickUpload}
              accept={supportedFormats.length ? supportedFormats.map((f) => (f.startsWith('.') ? f : `.${f}`)).join(',') : undefined}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {uploading ? 'Analyzing...' : 'Upload book files'}
            </button>
            {supportedFormats.length > 0 && (
              <span className="text-[11px] text-slate-400">Formats: {supportedFormats.join(', ')}</span>
            )}
          </div>

          {/* server load / GPU + laravel-direct-vs-pycore recommendation */}
          <ProcessingCapabilityCard />

          {/* drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-xl border border-dashed p-6 text-center text-sm transition ${
              dragOver
                ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/10 text-rose-500'
                : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <UploadCloud className="w-6 h-6 mx-auto mb-1.5 opacity-60" />
            Drop book files here, or use the Upload button above.
          </div>

          {/* local preview (instant, rough) */}
          {localPreviews.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Local preview (rough — authoritative stats come from the backend)
              </div>
              {localPreviews.map((p) => (
                <div key={p.name} className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-mono">{p.name}</span>: {nf(p.words)} words · {nf(p.uniqueWords)} unique ·{' '}
                  {nf(p.sentences)} sentences · {nf(p.chars)} chars
                </div>
              ))}
            </div>
          )}

          {/* analyzed uploads */}
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No analyzed uploads yet.</p>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => {
                const aggName = (doc.files[0]?.name || doc.upload_id);
                const busy = ingestingId === doc.upload_id;
                return (
                  <div key={doc.upload_id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    {/* aggregate header + ingest */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <FileText className="w-4 h-4 text-rose-400" />
                        {doc.files.length} file{doc.files.length === 1 ? '' : 's'}
                        <span className="text-xs font-normal text-slate-400">· {nf(doc.totals?.words)} words</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => ingest(doc.upload_id)}
                        disabled={busy}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {busy ? 'Ingesting...' : 'Ingest to library'}
                      </button>
                    </div>

                    {/* ingest progress */}
                    {busy && ingestProgress && (
                      <div className="mt-2">
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Stage: <span className="font-bold text-rose-500">{ingestProgress.stage}</span>
                          <span className="text-slate-400">· {ingestProgress.percent}%</span>
                        </div>
                        <div className="mt-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-rose-500 transition-all" style={{ width: `${ingestProgress.percent}%` }} />
                        </div>
                      </div>
                    )}

                    {/* aggregate stat tiles (clickable) */}
                    {doc.aggregate && renderStatTiles(doc.aggregate, doc.upload_id, aggName)}
                    {doc.aggregate && renderLangChips(doc.aggregate)}
                    {doc.aggregate && renderTopWords(doc.aggregate)}

                    {/* per-file breakdown */}
                    {doc.files.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Per-file breakdown</div>
                        {doc.files.map((f, i) => {
                          const key = `${doc.upload_id}#${i}`;
                          const open = openPreview.has(key);
                          return (
                            <div key={key} className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/30 p-2.5">
                              <div className="flex items-center gap-2 text-[11px]">
                                <FileText className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                                <span className="font-mono text-slate-700 dark:text-slate-200 truncate flex-1" title={f.name}>{f.name}</span>
                                {f.error ? (
                                  <span className="text-amber-500 flex-shrink-0">{f.error}</span>
                                ) : f.stats ? (
                                  <span className="text-slate-400 flex-shrink-0">
                                    {nf(f.stats.word_count)}w · {nf(f.stats.unique_word_count)}u · {nf(f.stats.sentence_count)}s · {(f.stats.primary_language || 'und').toUpperCase()}
                                  </span>
                                ) : null}
                                {f.preview && (
                                  <button
                                    type="button"
                                    onClick={() => togglePreview(key)}
                                    className="flex-shrink-0 text-rose-500 hover:text-rose-400"
                                    title={open ? 'Hide preview' : 'Show preview'}
                                  >
                                    {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              {open && f.preview && (
                                <pre className="mt-1.5 max-h-40 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-lg p-2.5 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300">
                                  {f.preview}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* paginated drill-down (words / sentences / languages of one upload) */}
      {listView && (
        <PaginatedListModal
          open={!!listView}
          onClose={() => setListView(null)}
          title={`${kindLabel[listView.kind]} — ${listView.name}`}
          fetchPage={listFetcher(listView.uploadId, listView.kind)}
          columns={listColumns}
          limit={LIST_LIMIT}
          reloadKey={`${listView.uploadId}:${listView.kind}`}
        />
      )}
    </div>
  );
};

export default BooksPanel;
