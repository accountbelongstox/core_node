/**
 * PcBooksPage — pycore Books source ingest + analyze/preview + enrichment.
 *
 * Three self-contained capabilities, all driven over the pycore proxy/WS:
 *
 *  1. Books — manage a list of book file/folder paths (added via the native
 *     picker, manual entry, or DRAG-AND-DROP) and push them to Laravel via
 *     `callRpc('book.sync_source', { paths })`. A FORMAT-FILTER sidebar selects
 *     which document extensions to scan; for a folder source the filter is
 *     honored on sync by expanding it (books/scan) to an explicit file list.
 *
 *  2. Analyze/preview — before syncing, each source is analyzed locally over
 *     `/api/local/books/analyze`: filename, format, multi-language statistics
 *     (words / unique words / sentences / unique sentences / per-language) and a
 *     text preview, with a folder aggregate. Pure local read — no Laravel call.
 *
 *  3. Sentence Library — a batch enrichment control (`media.enrich`).
 *
 * Local React state only; every call is guarded and the UI never crashes when
 * the backend (:59000) is offline. Hardcoded-English copy is centralized in `L`,
 * with zh values kept as comments (the pycore-manager pages have no `t` object).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Plus, Trash2, X, Folder, FileText, FolderOpen, RefreshCw,
  UploadCloud, Library, Sparkles, WifiOff, ListChecks, Filter, Languages,
  Type, Hash, AlignLeft, Eye, EyeOff, ScanText, FileStack,
} from 'lucide-react';
import {
  pycoreApi, connectPycoreWs, onWsStatus, callRpc, subscribeWs,
} from '../../../core/api-libs/pycore';
import type {
  VideoExtractMode, BooksAnalyzeResponse, BookTextStats, BookSourceState,
} from '../../../core/api-libs/pycore';

// i18n labels (single source; the pages use literals, not a `t` object).
const L = {
  title: 'Books',                                   // 书籍
  subtitle: 'Add book files or folders (or drag them in), then sync them to Laravel as a sentence source via the local pycore engine.',
  addSource: 'Add source',                          // 添加来源
  sources: 'Sources',                               // 来源
  selectAll: 'Select all',                          // 全选
  noSources: 'No sources yet — add or drop a book file, or a folder of books.',
  pick: 'Check the sources to sync, then push them to Laravel.',
  folder: 'Folder',                                 // 文件夹
  file: 'File',                                      // 文件
  singleFile: 'Single file',                        // 单个文件
  path: 'Path',                                      // 路径
  browse: 'Browse',                                  // 浏览
  cancel: 'Cancel',                                  // 取消
  add: 'Add',                                        // 添加
  remove: 'Remove',                                  // 移除
  enterPath: 'Enter a path',                         // 请输入路径
  pickFolderHint: 'Pick a folder to scan recursively for book files.',
  pickFileHint: 'Pick a single book file.',
  syncLaravel: 'Sync books to Laravel',             // 同步书籍到 Laravel
  syncing: 'Syncing…',                               // 同步中…
  syncDone: 'Synced to Laravel',                     // 已同步到 Laravel
  syncFailed: 'Sync failed',                         // 同步失败
  syncedBadge: 'Synced',                             // 已同步
  syncStage: 'Stage',                                // 阶段
  selectFirst: 'Select at least one source first',
  // drag & drop / upload
  dropHere: 'Drop files or folders here',            // 拖放文件或文件夹到此处
  dropOr: 'or',                                       // 或
  dropNoPath: 'The drop did not expose a file path (browser sandbox) — use Browse to pick the file/folder.',
  upload: 'Upload',                                   // 上传
  uploadHint: 'Upload file bytes — staged server-side, then analyzed and syncable (works without a file path).',
  uploading: 'Uploading…',                            // 上传中…
  // format filter
  formats: 'Formats',                                // 格式
  filterHint: 'Choose which document formats to scan.',
  allFormats: 'All',                                 // 全部
  noFormats: 'None',                                 // 无
  // analyze / stats
  analyze: 'Analyze',                                // 分析
  analyzing: 'Analyzing…',                           // 分析中…
  reAnalyze: 'Re-analyze',                           // 重新分析
  statistics: 'Statistics',                          // 统计
  words: 'Words',                                    // 词数
  uniqueWords: 'Unique words',                       // 不重复词数
  sentences: 'Sentences',                            // 句子数
  uniqueSentences: 'Unique sentences',               // 不重复句子数
  characters: 'Characters',                          // 字符数
  langs: 'Languages',                                // 多语言
  topWords: 'Top words',                             // 高频词
  format: 'Format',                                  // 格式
  filesWord: 'files',                                // 个文件
  analyzedOf: 'analyzed of',                         // 已分析/共
  capHit: 'file cap reached — sync still ingests all matching files',
  showPreview: 'Preview',                            // 预览
  hidePreview: 'Hide',                               // 收起
  noText: 'no extractable text',                     // 无可提取文本
  analyzeFailed: 'Analyze failed',                   // 分析失败
  details: 'Details',                                // 详情
  detailsTitle: 'Source details',                    // 来源详情
  perFile: 'Per-file breakdown',                      // 分文件统计
  allLanguages: 'Languages',                          // 各语言
  allTopWords: 'Top words (full)',                    // 全部高频词
  chars: 'chars',                                     // 字符
  close: 'Close',                                     // 关闭
  noAnalysis: 'No analysis yet — click Analyze first.',
  // drill-down list modal
  prev: 'Prev',                                       // 上一页
  next: 'Next',                                       // 下一页
  showing: 'Showing',                                 // 显示
  listOf: 'of',                                       // 共
  distinctWord: 'distinct',                           // 去重
  totalOccur: 'total occurrences',                    // 总出现
  loadingList: 'Loading…',                            // 加载中…
  emptyList: 'No items.',                             // 无内容
  // sync stage labels
  stScan: 'Scanning',                                 // 扫描
  stSource: 'Source',                                 // 来源
  stExtract: 'Extracting text',                       // 提取文本
  stBuild: 'Structuring',                             // 结构化
  stIngest: 'Ingesting',                              // 入库
  stClips: 'Clips',                                   // 切片
  stDone: 'Done',                                     // 完成
  stError: 'Error',                                   // 错误
  // sentence library / enrichment
  library: 'Sentence Library',                       // 句库
  libraryHint: 'Trigger AI + TTS enrichment of stored sentences. Each batch processes up to the limit; loop to drain the queue.',
  batchLimit: 'Batch limit',                         // 批量上限
  enrichNow: 'Enrich now',                           // 立即丰富
  enriching: 'Enriching…',                           // 丰富中…
  keepGoing: 'Run until empty',                      // 持续运行至清空
  stopLoop: 'Stop',                                  // 停止
  processed: 'Processed',                            // 已处理
  enriched: 'Enriched',                              // 已丰富
  remaining: 'Remaining',                            // 剩余
  enrichFailed: 'Enrichment failed',                 // 丰富失败
  unreachable: 'pycore unreachable — the backend (:59000) may be offline. Connect to sync or analyze.',
};

const DEFAULT_BASE = 'D:\\.tmp';
// Cap the "run until empty" loop so a stuck backend can never spin forever.
const MAX_LOOP_ITERATIONS = 50;

interface BookEntry { path: string; mode: VideoExtractMode; }
interface SyncProgress { stage: string; done: number; total: number; detail: string; }
interface EnrichResult { processed: number; enriched: number; remaining: number; errors?: string[]; }

const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');

const PcBooksPage: React.FC = () => {
  // --- sources (page-local; books need no backend history/options) -------- #
  const [entries, setEntries] = useState<BookEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- add dialog -------------------------------------------------------- #
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<VideoExtractMode>('folder');
  const [addPath, setAddPath] = useState(DEFAULT_BASE);
  const [browsing, setBrowsing] = useState(false);

  // --- format filter ----------------------------------------------------- #
  const [supportedFormats, setSupportedFormats] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState(false);

  // --- analyze ----------------------------------------------------------- #
  const [analyses, setAnalyses] = useState<Record<string, BooksAnalyzeResponse>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [openPreview, setOpenPreview] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Path whose full analysis details modal is open (null = closed).
  const [detailPath, setDetailPath] = useState<string | null>(null);
  // Paginated drill-down list modal (Words/Sentences/Languages behind a stat).
  const [listView, setListView] = useState<
    { path: string; kind: string; start: number; limit: number; total: number;
      items: any[]; totals: Record<string, number>; loading: boolean; error?: string } | null
  >(null);
  // Persisted per-source state (submission_state etc.) keyed by path.
  const [sourceStates, setSourceStates] = useState<Record<string, BookSourceState>>({});

  // --- sync state -------------------------------------------------------- #
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // --- enrichment state -------------------------------------------------- #
  const [limit, setLimit] = useState(50);
  const [enriching, setEnriching] = useState(false);
  const [looping, setLooping] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const loopAbort = useRef(false);

  // --- shared ----------------------------------------------------------- #
  const [notice, setNotice] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Effective format filter: undefined when "all supported" are checked (the
  // backend then uses its full set), else the explicit subset to scan.
  const activeFormats = useCallback((): string[] | undefined => {
    if (!supportedFormats.length) return undefined;
    if (formatFilter.size === 0) return [];                 // nothing selected
    if (formatFilter.size === supportedFormats.length) return undefined;
    return Array.from(formatFilter);
  }, [supportedFormats, formatFilter]);

  // WS connect + status mirror (offline banner). Book ingest progress comes over
  // the same `video_extract_sync` event the video page subscribes to.
  useEffect(() => {
    connectPycoreWs();
    const offStatus = onWsStatus(setWsConnected);
    const offSync = subscribeWs('video_extract_sync', (d: any) => {
      const stage = String(d?.stage ?? '');
      setSyncProgress({
        stage,
        done: Number(d?.done ?? 0),
        total: Number(d?.total ?? 0),
        detail: String(d?.detail ?? ''),
      });
      if (stage === 'done') {
        const s = d?.summary || {};
        const parts = [
          s.sentences != null ? `${s.sentences} sentences` : null,
          s.errors != null && s.errors ? `${s.errors} errors` : null,
        ].filter(Boolean).join(' · ');
        setNotice(`${L.syncDone}${parts ? ' — ' + parts : ''}`);
        setSyncing(false);
        setSyncProgress(null);
      } else if (stage === 'error') {
        const errs = Array.isArray(d?.errors) ? d.errors.join('; ') : '';
        setNotice(`${L.syncFailed}${d?.detail ? ': ' + d.detail : errs ? ': ' + errs : ''}`);
        setSyncing(false);
        setSyncProgress(null);
      }
    });
    return () => { offStatus(); offSync(); };
  }, []);

  // Load the supported-formats list (drives the filter sidebar); default all on.
  useEffect(() => {
    pycoreApi.getBooksSupportedFormats()
      .then((r) => {
        if (r?.success && Array.isArray(r.formats)) {
          setSupportedFormats(r.formats);
          setFormatFilter(new Set(r.formats));
        }
      })
      .catch(() => { /* offline — sidebar stays empty, analyze still degrades */ });
  }, []);

  // --- persisted state: reload on mount (survives UI switch/reopen) ------- #
  // Rebuilds the source list + their cached (compact) analysis from pycore's
  // user-data so the page is exactly where the user left it.
  const loadState = useCallback(async () => {
    try {
      const r = await pycoreApi.getBooksState();
      if (!r?.success) return;
      const ents: BookEntry[] = [];
      const ana: Record<string, BooksAnalyzeResponse> = {};
      const sm: Record<string, BookSourceState> = {};
      r.sources.forEach((s) => {
        ents.push({ path: s.path, mode: (s.mode as VideoExtractMode) || 'file' });
        sm[s.path] = s;
        if (s.summary && s.summary.aggregate) {
          ana[s.path] = {
            success: true, root: '', mode: (s.summary.mode as any) || s.mode,
            files: (s.summary.files || []).map((f: any) => ({
              path: '', rel: '', name: f.name, ext: f.ext, size_bytes: 0,
              // Rebuild a partial per-file stats object from the compact summary
              // so the Details modal still shows per-file counts after a reload.
              stats: {
                char_count: 0, char_count_no_space: 0,
                word_count: f.words || 0, unique_word_count: f.unique_words || 0,
                sentence_count: f.sentences || 0, unique_sentence_count: f.unique_sentences || 0,
                line_count: 0, paragraph_count: 0,
                primary_language: f.primary_language || 'und', languages: [],
                top_words: [], truncated: false,
              } as BookTextStats,
              preview: '', error: f.error,
            })),
            aggregate: s.summary.aggregate, scanned: s.summary.scanned || 0,
            analyzed: s.summary.analyzed || 0, truncated_files: false,
          };
        }
      });
      setEntries(ents);
      setAnalyses(ana);
      setSourceStates(sm);
      setSelected(new Set(ents.map((e) => e.path)));
    } catch { /* offline — start empty */ }
  }, []);

  useEffect(() => { void loadState(); }, [loadState]);

  // --- analyze a source (file or folder) --------------------------------- #
  const analyzeEntry = useCallback(async (path: string) => {
    setAnalyzing((prev) => new Set(prev).add(path));
    try {
      const r = await pycoreApi.booksAnalyze(path, { formats: activeFormats(), preview_chars: 1200, persist: true });
      if (r && r.success) {
        setAnalyses((prev) => ({ ...prev, [path]: r }));
        // Refine the entry's folder/file badge from the analysis result.
        if (r.mode === 'file' || r.mode === 'folder') {
          setEntries((prev) => prev.map((e) => (e.path === path ? { ...e, mode: r.mode as VideoExtractMode } : e)));
        }
      } else {
        setNotice(`${L.analyzeFailed}${r?.error ? ': ' + r.error : ''}`);
      }
    } catch (e: any) {
      setNotice(`${L.analyzeFailed}: ${e?.message || 'request failed'}`);
    } finally {
      setAnalyzing((prev) => { const n = new Set(prev); n.delete(path); return n; });
    }
  }, [activeFormats]);

  // --- add / remove ------------------------------------------------------ #
  const addEntry = useCallback((path: string, mode: VideoExtractMode, analyze = true) => {
    const p = path.trim();
    if (!p) return;
    setEntries((prev) => (prev.some((e) => e.path === p) ? prev : [...prev, { path: p, mode }]));
    setSelected((prev) => new Set(prev).add(p));
    // Persist the source server-side (draft); analyze (persist=true) follows.
    pycoreApi.booksStateAdd(p, mode).catch(() => { /* offline — local only */ });
    if (analyze) void analyzeEntry(p);
  }, [analyzeEntry]);

  const confirmAdd = () => {
    const p = addPath.trim();
    if (!p) { setNotice(L.enterPath); return; }
    addEntry(p, addMode);
    setShowAdd(false);
    setAddPath(DEFAULT_BASE);
    setNotice('Source added');
  };

  const removeEntry = (path: string) => {
    setEntries((prev) => prev.filter((e) => e.path !== path));
    setSelected((prev) => { const n = new Set(prev); n.delete(path); return n; });
    setAnalyses((prev) => { const n = { ...prev }; delete n[path]; return n; });
    setSourceStates((prev) => { const n = { ...prev }; delete n[path]; return n; });
    pycoreApi.booksStateRemove(path).catch(() => { /* offline — local only */ });
  };

  const toggleSelect = (path: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === entries.length ? new Set() : new Set(entries.map((e) => e.path))));
  };

  // --- native OS folder/file picker -------------------------------------- #
  const browse = async () => {
    setBrowsing(true);
    try {
      const r = await pycoreApi.pickPath(addMode, addPath || DEFAULT_BASE);
      if (r?.success && r.path) setAddPath(r.path);
      else if (r?.canceled) { /* keep current */ }
      else setNotice(r?.error || 'Native picker unavailable — type the path manually');
    } catch {
      setNotice('Native picker unavailable — type the path manually');
    } finally { setBrowsing(false); }
  };

  // --- upload (sandboxed browsers: no File.path) ------------------------- #
  // Send the raw bytes to /analyze-upload; the backend stages them to disk and
  // returns each staged absolute path + its analysis, which we add as sources
  // (already analyzed) so they can be synced like any local file.
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setNotice(null);
    try {
      const r = await pycoreApi.booksAnalyzeUpload(files, { preview_chars: 1200, persist: true });
      if (!r || !r.success) { setNotice(`${L.analyzeFailed}${r?.error ? ': ' + r.error : ''}`); return; }
      let added = 0;
      const errs: string[] = [];
      r.files.forEach((f) => {
        if (!f.path) { errs.push(`${f.name}: ${f.error || 'skipped'}`); return; }
        // Pre-store a single-file analysis so the card renders immediately.
        setAnalyses((prev) => ({
          ...prev,
          [f.path]: {
            success: true, root: r.root, mode: 'file', files: [f],
            aggregate: f.stats, scanned: 1, analyzed: 1, truncated_files: false,
          },
        }));
        addEntry(f.path, 'file', false);
        added += 1;
      });
      setNotice(`${added} uploaded${errs.length ? ` · ${errs.length} skipped (${errs.join('; ')})` : ''}`);
    } catch (e: any) {
      setNotice(`${L.analyzeFailed}: ${e?.message || 'upload failed'}`);
    } finally {
      setUploading(false);
    }
  }, [addEntry]);

  // --- drag & drop ------------------------------------------------------- #
  // Desktop webviews / Electron expose the dropped item's absolute path on
  // `File.path`; plain browsers sandbox it away. Items WITH a path are added
  // directly; items WITHOUT one are uploaded (bytes -> staged path).
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fl = e.dataTransfer?.files;
    const files: File[] = fl ? Array.from(fl) : [];
    if (!files.length) return;
    const withPath: string[] = [];
    const noPath: File[] = [];
    files.forEach((f) => {
      const p = (f as any).path;
      if (p && typeof p === 'string') withPath.push(p);
      else noPath.push(f);
    });
    // A dropped item with an extension is a file; otherwise treat it as a folder.
    withPath.forEach((p) => addEntry(p, /\.[A-Za-z0-9]{1,8}$/.test(p) ? 'file' : 'folder'));
    if (withPath.length) setNotice(`${withPath.length} source(s) added`);
    if (noPath.length) void uploadFiles(noPath);
  }, [addEntry, uploadFiles]);

  const onPickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    const files: File[] = fl ? Array.from(fl) : [];
    if (files.length) void uploadFiles(files);
    e.target.value = '';   // allow re-selecting the same file
  };

  const activePaths = (): string[] => entries.filter((e) => selected.has(e.path)).map((e) => e.path);

  // --- sync books to Laravel --------------------------------------------- #
  // Honors the format filter: when a partial filter is active, folder sources
  // are expanded (books/scan) to the matching file list before ingest; with the
  // full set the folder path is sent as-is (the backend expands it).
  const resolveSyncPaths = useCallback(async (paths: string[]): Promise<string[]> => {
    const fmts = activeFormats();
    const partial = Array.isArray(fmts);                 // a real subset (or [])
    if (!partial) return paths;                          // all formats → send as-is
    const out: string[] = [];
    for (const p of paths) {
      const entry = entries.find((e) => e.path === p);
      if (entry && entry.mode === 'folder') {
        try {
          const r = await pycoreApi.booksScan(p, fmts);
          if (r?.success) out.push(...r.files.map((f) => f.path));
        } catch { /* skip unreadable folder */ }
      } else {
        out.push(p);
      }
    }
    return out;
  }, [entries, activeFormats]);

  const syncBooks = useCallback(async () => {
    const selPaths = activePaths();
    if (!selPaths.length) { setNotice(L.selectFirst); return; }
    if (syncing) return;
    setSyncing(true);
    setSyncProgress({ stage: 'scan', done: 0, total: 0, detail: '' });
    setNotice(null);
    // Honor the format filter: expand folders to the matching file list when a
    // partial filter is active (else submit expands folders server-side).
    let paths = selPaths;
    try {
      paths = await resolveSyncPaths(selPaths);
    } catch { /* fall back to raw selection */ }
    if (!paths.length) {
      setNotice(`${L.syncFailed}: no matching files for the selected formats`);
      setSyncing(false); setSyncProgress(null); return;
    }
    // One-shot batch submit: pycore builds the v2 payload for each source and
    // ingests it; per-stage progress still streams over `video_extract_sync`.
    try {
      const r = await pycoreApi.booksSubmit(paths);
      if (!r || !r.success) {
        const errs = (r?.items || []).flatMap((it) => it.errors || []);
        setNotice(`${L.syncFailed}${errs.length ? ': ' + errs.slice(0, 3).join('; ') : (r?.error ? ': ' + r.error : '')}`);
      } else {
        setNotice(`${L.syncDone} — ${r.total_sentences} sentences · ${r.total_words} words`);
      }
    } catch (e: any) {
      setNotice(`${L.syncFailed}: ${e?.message || 'submit failed'}`);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
      void loadState();   // refresh submission_state badges
    }
  }, [entries, selected, syncing, resolveSyncPaths, loadState]);

  // --- enrichment -------------------------------------------------------- #
  const enrichOnce = useCallback(async (): Promise<EnrichResult | null> => {
    const lim = Math.max(1, Math.floor(limit) || 1);
    const r: any = await callRpc('media.enrich', { limit: lim })
      .catch((e: any) => ({ error: e?.message || 'RPC failed' }));
    if (!r || r.error || r.success === false) {
      setNotice(`${L.enrichFailed}${r?.error ? ': ' + r.error : ''}`);
      return null;
    }
    const res: EnrichResult = {
      processed: Number(r.processed ?? 0),
      enriched: Number(r.enriched ?? 0),
      remaining: Number(r.remaining ?? 0),
      errors: Array.isArray(r.errors) ? r.errors : undefined,
    };
    setEnrichResult(res);
    if (res.errors && res.errors.length) {
      setNotice(`${L.enrichFailed}: ${res.errors.join('; ')}`);
    }
    return res;
  }, [limit]);

  const enrichNow = useCallback(async () => {
    if (enriching || looping) return;
    setEnriching(true);
    setNotice(null);
    await enrichOnce();
    setEnriching(false);
  }, [enriching, looping, enrichOnce]);

  const runUntilEmpty = useCallback(async () => {
    if (enriching || looping) return;
    setLooping(true);
    loopAbort.current = false;
    setNotice(null);
    for (let i = 0; i < MAX_LOOP_ITERATIONS; i += 1) {
      if (loopAbort.current) break;
      const res = await enrichOnce();
      if (!res) break;
      if (res.remaining <= 0) break;
      if (res.processed <= 0) break;
    }
    setLooping(false);
  }, [enriching, looping, enrichOnce]);

  const stopLoop = () => { loopAbort.current = true; };

  // --- format filter controls -------------------------------------------- #
  const toggleFormat = (fmt: string) => {
    setFormatFilter((prev) => { const n = new Set(prev); n.has(fmt) ? n.delete(fmt) : n.add(fmt); return n; });
  };
  const setAllFormats = (on: boolean) =>
    setFormatFilter(on ? new Set(supportedFormats) : new Set());

  const togglePreview = (path: string) =>
    setOpenPreview((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });

  // --- drill-down list modal (paginated words / sentences / languages) ---- #
  const LIST_LIMIT = 100;
  const loadListPage = useCallback(async (path: string, kind: string, start: number) => {
    setListView((prev) => (prev
      ? { ...prev, path, kind, start, loading: true, error: undefined }
      : { path, kind, start, limit: LIST_LIMIT, total: 0, items: [], totals: {}, loading: true }));
    try {
      const r = await pycoreApi.booksList(path, kind, start, LIST_LIMIT);
      if (r && r.success) {
        setListView({ path, kind, start: r.start, limit: r.limit, total: r.total, items: r.items, totals: r.totals || {}, loading: false });
      } else {
        setListView({ path, kind, start, limit: LIST_LIMIT, total: 0, items: [], totals: {}, loading: false, error: r?.error || 'failed' });
      }
    } catch (e: any) {
      setListView({ path, kind, start, limit: LIST_LIMIT, total: 0, items: [], totals: {}, loading: false, error: e?.message || 'request failed' });
    }
  }, []);
  const openList = useCallback((path: string, kind: string) => { void loadListPage(path, kind, 0); }, [loadListPage]);

  // --- styling helpers --------------------------------------------------- #
  const inputCls = 'text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none';
  const allSelected = entries.length > 0 && selected.size === entries.length;
  const syncPct = syncProgress && syncProgress.total > 0
    ? Math.min(100, Math.round((syncProgress.done / syncProgress.total) * 100))
    : 0;
  // Friendly labels for the (now richer) sync stages streamed over the WS.
  const stageLabel = (stage: string): string => ({
    scan: L.stScan, source: L.stSource, extract: L.stExtract, build: L.stBuild,
    ingest: L.stIngest, clips: L.stClips, done: L.stDone, error: L.stError,
  } as Record<string, string>)[stage] || stage;
  const busyAny = enriching || looping;
  const filterLabel = useMemo(() => {
    if (!supportedFormats.length) return '';
    if (formatFilter.size === supportedFormats.length) return L.allFormats;
    if (formatFilter.size === 0) return L.noFormats;
    return `${formatFilter.size}/${supportedFormats.length}`;
  }, [supportedFormats, formatFilter]);

  // --- per-source stats card --------------------------------------------- #
  // Tiles with an onClick are clickable and open the paginated drill-down list.
  const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: string; onClick?: () => void }> =
    ({ icon, label, value, accent, onClick }) => (
      <div onClick={onClick}
        className={`rounded-xl p-3 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5 ${
          onClick ? 'cursor-pointer hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30 transition' : ''}`}>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
          {icon}{label}{onClick && <Eye className="w-3 h-3 ml-auto opacity-50" />}
        </div>
        <div className={`text-base font-bold ${accent || 'text-slate-700 dark:text-slate-200'}`}>{value}</div>
      </div>
    );

  const renderStats = (s: BookTextStats, path: string) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      <StatTile icon={<Type className="w-3 h-3" />} label={L.words} value={nf(s.word_count)} onClick={() => openList(path, 'words')} />
      <StatTile icon={<Hash className="w-3 h-3" />} label={L.uniqueWords} value={nf(s.unique_word_count)} accent="text-indigo-500" onClick={() => openList(path, 'unique_words')} />
      <StatTile icon={<AlignLeft className="w-3 h-3" />} label={L.sentences} value={nf(s.sentence_count)} onClick={() => openList(path, 'sentences')} />
      <StatTile icon={<Hash className="w-3 h-3" />} label={L.uniqueSentences} value={nf(s.unique_sentence_count)} accent="text-indigo-500" onClick={() => openList(path, 'unique_sentences')} />
      <StatTile icon={<FileText className="w-3 h-3" />} label={L.characters} value={nf(s.char_count)} />
      <StatTile icon={<Languages className="w-3 h-3" />} label={L.langs} value={(s.primary_language || 'und').toUpperCase()} accent="text-emerald-500" onClick={() => openList(path, 'languages')} />
    </div>
  );

  const renderLangChips = (s: BookTextStats) => (
    s.languages.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Languages className="w-3 h-3 text-slate-400" />
        {s.languages.slice(0, 8).map((l) => (
          <span key={l.script} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {l.code.toUpperCase()} {Math.round(l.ratio * 100)}%
          </span>
        ))}
      </div>
    )
  );

  const renderTopWords = (s: BookTextStats) => (
    s.top_words.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{L.topWords}</span>
        {s.top_words.slice(0, 10).map((w) => (
          <span key={w.word} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-slate-300">
            {w.word} <span className="text-slate-400">×{w.count}</span>
          </span>
        ))}
      </div>
    )
  );

  const renderAnalysis = (path: string) => {
    const a = analyses[path];
    if (!a) return null;
    const showPv = openPreview.has(path);
    const previewFile = a.files.find((f) => f.preview) || a.files[0];
    return (
      <div className="mt-2.5 pl-1 border-l-2 border-rose-500/30 space-y-1">
        {/* aggregate / file summary */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <FileStack className="w-3.5 h-3.5 text-rose-400" />
          {a.mode === 'folder'
            ? <span>{nf(a.analyzed)} {L.analyzedOf} {nf(a.scanned)} {L.filesWord}</span>
            : <span>1 {L.filesWord}</span>}
          {a.truncated_files && <span className="text-amber-500">· {L.capHit}</span>}
          <button onClick={() => setDetailPath(path)}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition">
            <ListChecks className="w-3 h-3" /> {L.details}
          </button>
        </div>
        {a.aggregate && renderStats(a.aggregate, path)}
        {a.aggregate && renderLangChips(a.aggregate)}
        {a.aggregate && renderTopWords(a.aggregate)}

        {/* preview toggle + body */}
        {previewFile && (previewFile.preview || previewFile.error) && (
          <div className="mt-2">
            <button onClick={() => togglePreview(path)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-400">
              {showPv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPv ? L.hidePreview : L.showPreview}
              <span className="text-slate-400 font-normal">· {previewFile.name}</span>
            </button>
            {showPv && (
              <pre className="mt-1.5 max-h-48 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-xl p-3 bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300">
                {previewFile.error ? `(${L.noText})` : previewFile.preview}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-5">
      {/* header + sources */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <BookOpen className="w-5 h-5 text-rose-500" /> {L.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{L.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowFilter((v) => !v)}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border ${
                showFilter
                  ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                  : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
              <Filter className="w-4 h-4" /> {L.formats}
              {filterLabel && <span className="text-[10px] opacity-80">({filterLabel})</span>}
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={onPickUpload}
              accept={supportedFormats.join(',')} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50"
              title={L.uploadHint}>
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} {L.upload}
            </button>
            <button onClick={() => { setAddPath(DEFAULT_BASE); setShowAdd(true); }}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1">
              <Plus className="w-4 h-4" /> {L.addSource}
            </button>
          </div>
        </div>

        {/* format-filter sidebar (collapsible) */}
        {showFilter && (
          <div className="mb-4 rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ScanText className="w-3.5 h-3.5" /> {L.formats}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setAllFormats(true)} className="text-[11px] font-bold text-rose-500 hover:text-rose-400">{L.allFormats}</button>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button onClick={() => setAllFormats(false)} className="text-[11px] font-bold text-slate-500 hover:text-slate-400">{L.noFormats}</button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">{L.filterHint}</p>
            <div className="flex flex-wrap gap-1.5">
              {supportedFormats.map((fmt) => {
                const on = formatFilter.has(fmt);
                return (
                  <button key={fmt} onClick={() => toggleFormat(fmt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border transition ${
                      on
                        ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                        : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300'}`}>
                    {fmt}
                  </button>
                );
              })}
              {!supportedFormats.length && <span className="text-[11px] text-slate-400">{L.unreachable}</span>}
            </div>
          </div>
        )}

        {!wsConnected && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{L.unreachable}</span>
          </div>
        )}

        {/* drop zone wrapping the sources list */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`space-y-2 rounded-2xl transition ${dragOver ? 'ring-2 ring-rose-500/60 bg-rose-500/5 p-3' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{L.sources}</h3>
            {entries.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> {L.selectAll}
              </label>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{L.pick}</p>

          {entries.length === 0 ? (
            <div className={`text-xs py-8 text-center border border-dashed rounded-2xl transition ${
              dragOver ? 'border-rose-500/60 text-rose-500' : 'border-slate-300 dark:border-white/10 text-slate-500'}`}>
              <UploadCloud className="w-6 h-6 mx-auto mb-1.5 opacity-60" />
              {L.dropHere} <span className="text-slate-400">{L.dropOr}</span>{' '}
              <button onClick={() => { setAddPath(DEFAULT_BASE); setShowAdd(true); }} className="font-bold text-rose-500 hover:text-rose-400">{L.addSource}</button>
              <div className="mt-1 text-[11px] text-slate-400">{L.noSources}</div>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => {
                const isAnalyzing = analyzing.has(e.path);
                return (
                  <li key={e.path}
                    className={`p-2.5 rounded-xl border transition ${
                      selected.has(e.path)
                        ? 'border-rose-500/50 bg-rose-500/5'
                        : 'border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selected.has(e.path)} onChange={() => toggleSelect(e.path)} />
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                        e.mode === 'folder'
                          ? 'bg-sky-500/15 text-sky-500'
                          : 'bg-amber-500/15 text-amber-500'}`}>
                        {e.mode === 'folder' ? <Folder className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {e.mode === 'folder' ? L.folder : L.file}
                      </span>
                      <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={e.path}>{e.path}</span>
                      {sourceStates[e.path]?.submission_state === 'synced' && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
                          {L.syncedBadge}
                        </span>
                      )}
                      <button onClick={() => analyzeEntry(e.path)} disabled={isAnalyzing}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition disabled:opacity-50"
                        title={analyses[e.path] ? L.reAnalyze : L.analyze}>
                        {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => removeEntry(e.path)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition" title={L.remove}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isAnalyzing && !analyses[e.path] && (
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> {L.analyzing}
                      </div>
                    )}
                    {renderAnalysis(e.path)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* action row */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button onClick={syncBooks} disabled={syncing}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {syncing ? L.syncing : L.syncLaravel}
          </button>
        </div>

        {notice && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>
        )}

        {/* sync progress (mirrors the video page's sync widget) */}
        {syncProgress && (
          <div className="mt-4">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
              {L.syncStage}:
              <span className="font-bold text-rose-500">{stageLabel(syncProgress.stage)}</span>
              {syncProgress.total > 0 && (
                <span className="text-slate-400">· {syncProgress.done}/{syncProgress.total} ({syncPct}%)</span>
              )}
              {syncProgress.detail && (
                <span className="truncate max-w-[60%] text-slate-400" title={syncProgress.detail}>· {syncProgress.detail}</span>
              )}
            </div>
            {syncProgress.total > 0 && (
              <div className="mt-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${syncPct}%` }} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sentence Library — enrichment */}
      <section className="pc-glass p-6">
        <div className="mb-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Library className="w-4 h-4 text-rose-500" /> {L.library}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">{L.libraryHint}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">{L.batchLimit}</label>
            <input type="number" min={1} value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
              disabled={busyAny}
              className={`${inputCls} w-28 disabled:opacity-50`} />
          </div>
          <button onClick={enrichNow} disabled={busyAny}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {enriching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {enriching ? L.enriching : L.enrichNow}
          </button>
          {!looping ? (
            <button onClick={runUntilEmpty} disabled={busyAny}
              className="px-5 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
              <ListChecks className="w-4 h-4" /> {L.keepGoing}
            </button>
          ) : (
            <button onClick={stopLoop}
              className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition">
              <RefreshCw className="w-4 h-4 animate-spin" /> {L.stopLoop}
            </button>
          )}
        </div>

        {enrichResult && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
              <div className="text-slate-400 uppercase tracking-wide">{L.processed}</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{enrichResult.processed}</div>
            </div>
            <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
              <div className="text-slate-400 uppercase tracking-wide">{L.enriched}</div>
              <div className="text-lg font-bold text-emerald-500">{enrichResult.enriched}</div>
            </div>
            <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
              <div className="text-slate-400 uppercase tracking-wide">{L.remaining}</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{enrichResult.remaining}</div>
            </div>
          </div>
        )}
      </section>

      {/* add dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-3xl p-6 border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><Plus className="w-4 h-4 text-rose-500" /> {L.addSource}</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setAddMode('folder')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'folder'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <Folder className="w-5 h-5" /> {L.folder}
              </button>
              <button onClick={() => setAddMode('file')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'file'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <FileText className="w-5 h-5" /> {L.singleFile}
              </button>
            </div>

            <label className="block text-[11px] text-slate-500 mb-1">{L.path}</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={addPath} autoFocus
                onChange={(ev) => setAddPath(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') confirmAdd(); }}
                placeholder={DEFAULT_BASE}
                className={`${inputCls} flex-1`} />
              <button onClick={browse} disabled={browsing}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-slate-200 transition flex items-center gap-1 shrink-0 disabled:opacity-50">
                {browsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                {L.browse}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-5">
              {addMode === 'folder' ? L.pickFolderHint : L.pickFileHint}
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                {L.cancel}
              </button>
              <button onClick={confirmAdd}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {L.add}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* details modal — full per-source inspection (stats / languages / top words / per-file / preview) */}
      {detailPath && (() => {
        const a = analyses[detailPath];
        const fname = detailPath.split(/[\\/]/).pop();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDetailPath(null)}>
            <div className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-3xl p-6 border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
              onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <ListChecks className="w-4 h-4 text-indigo-500" /> {L.detailsTitle}
                </h3>
                <button onClick={() => setDetailPath(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all mb-3">{detailPath}</p>

              {!a ? (
                <p className="text-xs text-slate-500 py-6 text-center">{L.noAnalysis}</p>
              ) : (
                <div className="space-y-4">
                  {/* aggregate stats (tiles open the paginated drill-down list) */}
                  {a.aggregate && renderStats(a.aggregate, detailPath)}

                  {/* all languages with chars + ratio */}
                  {a.aggregate && a.aggregate.languages.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{L.allLanguages}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {a.aggregate.languages.map((l) => (
                          <span key={l.script} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <span className="font-bold">{l.code.toUpperCase()}</span>
                            {Math.round(l.ratio * 100)}% · {nf(l.chars)} {L.chars}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* full top words */}
                  {a.aggregate && a.aggregate.top_words.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{L.allTopWords}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {a.aggregate.top_words.map((w) => (
                          <span key={w.word} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                            {w.word} <span className="text-slate-400">×{nf(w.count)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* per-file breakdown */}
                  {a.files.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                        {L.perFile} ({nf(a.analyzed)}{a.mode === 'folder' ? ` / ${nf(a.scanned)}` : ''})
                      </div>
                      <div className="space-y-1.5">
                        {a.files.map((f, i) => {
                          const key = `${detailPath}#${i}`;
                          const open = openPreview.has(key);
                          const s = f.stats;
                          return (
                            <div key={key} className="rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02] p-2.5">
                              <div className="flex items-center gap-2 text-[11px]">
                                <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span className="font-mono text-slate-700 dark:text-slate-200 truncate flex-1" title={f.name}>{f.name}</span>
                                {f.error
                                  ? <span className="text-amber-500 shrink-0">{f.error}</span>
                                  : s && (
                                    <span className="text-slate-400 shrink-0">
                                      {nf(s.word_count)}w · {nf(s.unique_word_count)}u · {nf(s.sentence_count)}s · {(s.primary_language || 'und').toUpperCase()}
                                    </span>
                                  )}
                                {f.preview && (
                                  <button onClick={() => togglePreview(key)} className="shrink-0 text-rose-500 hover:text-rose-400">
                                    {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              {open && f.preview && (
                                <pre className="mt-1.5 max-h-40 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-lg p-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300">{f.preview}</pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-5">
                <button onClick={() => setDetailPath(null)}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition">
                  {L.close}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* drill-down list modal — paginated words / sentences / languages */}
      {listView && (() => {
        const lv = listView;
        const KIND_LABEL: Record<string, string> = {
          words: L.words, unique_words: L.uniqueWords, sentences: L.sentences,
          unique_sentences: L.uniqueSentences, languages: L.langs,
        };
        const fname = lv.path.split(/[\\/]/).pop();
        const from = lv.total === 0 ? 0 : lv.start + 1;
        const to = lv.start + lv.items.length;
        const hasPrev = lv.start > 0;
        const hasNext = lv.start + lv.limit < lv.total;
        const t = lv.totals || {};
        // Always surface the character count too (the user expects it shown).
        const charsPart = (t.chars != null) ? ` · ${nf(t.chars)} ${L.characters.toLowerCase()}` : '';
        let summary = '';
        if (lv.kind === 'words' || lv.kind === 'unique_words') {
          summary = `${nf(t.unique_words)} ${L.distinctWord} · ${nf(t.words)} ${L.totalOccur}${charsPart}`;
        } else if (lv.kind === 'sentences') {
          summary = `${nf(t.sentences)} ${L.sentences.toLowerCase()}${charsPart}`;
        } else if (lv.kind === 'unique_sentences') {
          summary = `${nf(t.unique_sentences)} ${L.distinctWord}${charsPart}`;
        } else if (lv.kind === 'languages') {
          summary = `${nf(t.chars)} ${L.characters.toLowerCase()}`;
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setListView(null)}>
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl p-6 border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
              onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <ListChecks className="w-4 h-4 text-indigo-500" /> {KIND_LABEL[lv.kind] || lv.kind}
                </h3>
                <button onClick={() => setListView(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-mono">{fname}</span>{summary && <span> · {summary}</span>}
              </p>

              <div className="flex-1 overflow-auto rounded-2xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02] p-2">
                {lv.loading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> {L.loadingList}
                  </div>
                ) : lv.error ? (
                  <div className="py-8 text-center text-xs text-amber-500">{lv.error}</div>
                ) : lv.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">{L.emptyList}</div>
                ) : (lv.kind === 'words' || lv.kind === 'unique_words') ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lv.items.map((w: any, i: number) => (
                      <span key={`${w.word}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                        {w.word} <span className="text-slate-400">×{nf(w.count)}</span>
                      </span>
                    ))}
                  </div>
                ) : (lv.kind === 'languages') ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lv.items.map((l: any) => (
                      <span key={l.script} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <span className="font-bold">{(l.code || '').toUpperCase()}</span>
                        {Math.round((l.ratio || 0) * 100)}% · {nf(l.chars)} {L.chars}
                      </span>
                    ))}
                  </div>
                ) : (
                  <ol className="space-y-1">
                    {lv.items.map((s: any, i: number) => (
                      <li key={`${s.seq}-${i}`} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="shrink-0 text-slate-400 tabular-nums w-12 text-right">{nf((s.seq ?? (lv.start + i)) + 1)}</span>
                        <span className="break-words">{s.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* pagination */}
              <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                <span>{L.showing} {nf(from)}–{nf(to)} {L.listOf} {nf(lv.total)}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => loadListPage(lv.path, lv.kind, Math.max(0, lv.start - lv.limit))}
                    disabled={!hasPrev || lv.loading}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/5 font-bold disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300">{L.prev}</button>
                  <button onClick={() => loadListPage(lv.path, lv.kind, lv.start + lv.limit)}
                    disabled={!hasNext || lv.loading}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/5 font-bold disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300">{L.next}</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PcBooksPage;
