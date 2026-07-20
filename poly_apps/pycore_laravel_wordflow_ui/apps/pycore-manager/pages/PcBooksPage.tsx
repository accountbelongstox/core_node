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
  ChevronDown, ChevronRight, Lock, BookMarked, Workflow,
} from 'lucide-react';
import {
  pycoreApi, connectPycoreWs, onWsStatus, callRpc, subscribeWs,
} from '../../../core/api-libs/pycore';
import type {
  VideoExtractMode, BooksAnalyzeResponse, BookTextStats, BookSourceState,
  BookChapter, BookSlot,
} from '../../../core/api-libs/pycore';
import { WF_SUPPORTED_LANGUAGES } from '../../../core/api-libs/wordflow/wordflowLanguages';
import { PcCoreBookPanel } from './PcCoreBookPage';
import PcSentenceAudioPanel from '../components/PcSentenceAudioPanel';
import PcBookSourceExplorer from '../components/PcBookSourceExplorer';

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
  // language multi-select
  languages2: 'Languages',                            // 语言
  languagesHint: 'Pick the languages to build a correspondence for. The detected primary language is checked and locked.',
  needOneLang: 'Select at least one language',        // 至少选择一种语言
  primaryLang: 'Primary (locked)',                    // 主语言（锁定）
  selectedCount: 'selected',                          // 已选
  // chapter -> sentence tree
  chapters2: 'Chapters',                              // 章节
  chaptersHint: 'Chapter → sentence tree. Each row shows every checked language side by side; blank = no correspondence.',
  viewChapters: 'View chapters',                      // 查看章节
  hideChapters: 'Hide chapters',                      // 收起章节
  chapter: 'Chapter',                                 // 章
  noChapters: 'No chapters analyzed yet.',            // 暂无章节
  emptyChapter: 'No sentences in this chapter.',      // 本章无句子
  grainSentence: 'Sentence',                          // 句子
  grainCue: 'Cue',                                    // 行
  grainLabel: 'Grain',                                // 粒度
  blankCorr: '—',                                     // 留空占位
  // advanced — embedded CoreBook panel
  advanced: 'Advanced — AI languages · audio · whole/partial submit (CoreBook)',
  advancedHint: 'The simple flow above ingests sources as-is. This advanced section converts a document to a portable CoreBook to AI-translate languages, synthesize audio, and submit it whole or partial.',
  // one-click auto-flow (convert → translate → voice → submit)
  runPipeline: 'Run pipeline',                       // 一键流水线
  pipelineHint: 'One click runs the full CoreBook pipeline for the selected target languages — convert, AI-translate, synthesize audio, and submit to Laravel.',
  pipelineRunning: 'Pipeline running…',              // 流水线运行中…
  pipelineDone: 'Pipeline done',                      // 流水线完成
  pipelineFailed: 'Pipeline failed',                  // 流水线失败
  pipelineBusy: 'Another pipeline is running — wait for it to finish',
  // auto-flow stage labels
  flConvert: 'Converting',                            // 转换中
  flTranslate: 'Translating',                         // 翻译中
  flVoice: 'Synthesizing audio',                      // 合成语音
  flAudio: 'Synthesizing audio',                      // 合成语音
  flAudioUpload: 'Uploading audio',                   // 上传语音
  flSubmit: 'Submitting',                             // 提交中
  explore: 'Explore',                                  // 浏览
  exploreHint: 'Languages · sentences · chapters · sortable words · searchable sentences',
  metaLangs: 'languages',                              // 语言
  metaChapters: 'chapters',                            // 章
  flDone: 'Done',                                     // 完成
  flError: 'Error',                                   // 错误
};

const DEFAULT_BASE = 'D:\\.tmp';
// Cap the "run until empty" loop so a stuck backend can never spin forever.
const MAX_LOOP_ITERATIONS = 50;
// The auto-flow chains convert + translate + TTS + ingest — all slow; give it a
// long ceiling so the RPC never times out before the engine finishes.
const AUTOFLOW_RPC_TIMEOUT_MS = 600_000;   // 10 min

interface BookEntry { path: string; mode: VideoExtractMode; }
interface SyncProgress { stage: string; done: number; total: number; detail: string; }
interface EnrichResult { processed: number; enriched: number; remaining: number; errors?: string[]; }
interface FlowProgress { stage: string; done: number; total: number; detail: string; }

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
  // Cached list totals (chapters etc.) keyed by path — filled after analyze.
  const [bookMeta, setBookMeta] = useState<Record<string, Record<string, number>>>({});

  // --- language multi-select (>=1; primary auto-checked + locked) ---------- #
  // `selectedLangs` is the checked correspondence set submitted to the backend.
  // The primary language (detected from the most-recent analysis) is forced on
  // and cannot be unchecked. Defaults to English so a fresh page is always valid.
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(['en']));
  const [lockedLang, setLockedLang] = useState<string>('en');

  // --- chapter -> sentence tree (lazy per source) ------------------------- #
  // Map path -> { open, loading, error, chapters, openChapter (the chapter whose
  // slots are loaded), slots, grain (cue|sentence toggle) }.
  interface ChapterTreeState {
    open: boolean; loading: boolean; error?: string;
    chapters: BookChapter[]; openChapter: number | null;
    slots: BookSlot[]; slotsLoading: boolean; grain: 'sentence' | 'cue';
  }
  const [trees, setTrees] = useState<Record<string, ChapterTreeState>>({});

  // --- sync state -------------------------------------------------------- #
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // --- one-click auto-flow (convert → translate → voice → submit) -------- #
  // `flowPath` is the source currently running the pipeline (one at a time);
  // `flowProgress` is the live THREAD_BUS `corebook_autoflow` event; `flowResult`
  // keeps the last outcome per source path for a compact pass/fail badge.
  const [flowPath, setFlowPath] = useState<string | null>(null);
  const [flowProgress, setFlowProgress] = useState<FlowProgress | null>(null);
  const [flowResult, setFlowResult] = useState<Record<string, { success: boolean; errors: number }>>({});

  // --- enrichment state -------------------------------------------------- #
  const [limit, setLimit] = useState(50);
  const [enriching, setEnriching] = useState(false);
  const [looping, setLooping] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const loopAbort = useRef(false);

  // --- shared ----------------------------------------------------------- #
  const [notice, setNotice] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  // Advanced CoreBook section disclosure (collapsed by default).
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    // Auto-flow progress: the engine broadcasts a `corebook_autoflow` event per
    // stage (convert/translate/voice/submit + sub-steps audio/audio_upload). We
    // mirror it into `flowProgress`; the runPipeline() resolve handles the final
    // notice + state, so here we just clear progress on the terminal stages.
    const offFlow = subscribeWs('corebook_autoflow', (d: any) => {
      const stage = String(d?.stage ?? '');
      setFlowProgress({
        stage,
        done: Number(d?.done ?? 0),
        total: Number(d?.total ?? 0),
        detail: String(d?.detail ?? ''),
      });
      if (stage === 'done' || stage === 'error') setFlowProgress(null);
    });
    return () => { offStatus(); offSync(); offFlow(); };
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

  // The selected language codes (hoisted ABOVE analyzeEntry: it lists this in its
  // dependency array, and a useCallback dep array is evaluated DURING render — a
  // `const` declared later would be in the temporal dead zone → "Cannot access
  // 'selectedLangList' before initialization" crash).
  const selectedLangList = useCallback(
    (): string[] => WF_SUPPORTED_LANGUAGES.map((l) => l.code).filter((c) => selectedLangs.has(c)),
    [selectedLangs],
  );

  // --- analyze a source (file or folder) --------------------------------- #
  const analyzeEntry = useCallback(async (path: string) => {
    setAnalyzing((prev) => new Set(prev).add(path));
    try {
      const r = await pycoreApi.booksAnalyze(path, { formats: activeFormats(), languages: selectedLangList(), preview_chars: 1200, persist: true });
      if (r && r.success) {
        setAnalyses((prev) => ({ ...prev, [path]: r }));
        // Light totals fetch (chapter count lives in totals.chapters).
        pycoreApi.booksList(path, 'chapters', 0, 1, { languages: selectedLangList() })
          .then((lr) => {
            if (lr?.totals) {
              setBookMeta((prev) => ({ ...prev, [path]: lr.totals as Record<string, number> }));
            }
          })
          .catch(() => { /* offline */ });
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
  }, [activeFormats, selectedLangList]);

  // Derive the detected primary language from the analyses and auto-check +
  // lock it (spec §9: the primary language is checked and cannot be unchecked).
  // The most recently analyzed source wins; falls back to 'en' when unknown.
  useEffect(() => {
    const valid = new Set(WF_SUPPORTED_LANGUAGES.map((l) => l.code));
    let primary = '';
    for (const a of Object.values(analyses) as BooksAnalyzeResponse[]) {
      const code = a?.aggregate?.primary_language;
      if (code && valid.has(code)) primary = code;   // last wins
    }
    if (!primary) primary = 'en';
    setLockedLang(primary);
    setSelectedLangs((prev) => (prev.has(primary) ? prev : new Set(prev).add(primary)));
  }, [analyses]);

  // --- language multi-select controls ------------------------------------- #
  const toggleLang = useCallback((code: string) => {
    if (code === lockedLang) return;                  // primary is locked on
    setSelectedLangs((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      n.add(lockedLang);                              // never drop the primary
      return n;
    });
  }, [lockedLang]);

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
      const r = await pycoreApi.booksAnalyzeUpload(files, {
        preview_chars: 1200, persist: true, languages: selectedLangList(),
      });
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
  }, [addEntry, selectedLangList]);

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
    const langs = selectedLangList();
    if (!langs.length) { setNotice(L.needOneLang); return; }
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
      const r = await pycoreApi.booksSubmit(paths, undefined, langs);
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
  }, [entries, selected, syncing, resolveSyncPaths, loadState, selectedLangList]);

  // --- one-click auto-flow: convert → translate → voice → submit --------- #
  // Fires the backend `corebook.autoflow` RPC for ONE source; per-stage progress
  // streams over the `corebook_autoflow` WS event (wired above). One flow at a
  // time; the .catch keeps it offline-safe (callRpc rejects when the WS is down).
  const runPipeline = useCallback(async (path: string) => {
    if (flowPath) { setNotice(L.pipelineBusy); return; }
    const langs = selectedLangList();
    if (!langs.length) { setNotice(L.needOneLang); return; }
    setFlowPath(path);
    setFlowProgress({ stage: 'convert', done: 0, total: 0, detail: '' });
    setNotice(null);
    const r: any = await callRpc(
      'corebook.autoflow',
      { path, languages: langs, source_type: 'book' },
      AUTOFLOW_RPC_TIMEOUT_MS,
    ).catch((e: any) => ({ success: false, errors: [e?.message || 'failed'] }));
    const errCount = Array.isArray(r?.errors) ? r.errors.length : 0;
    setFlowResult((prev) => ({ ...prev, [path]: { success: !!r?.success, errors: errCount } }));
    if (r?.success) {
      const title = r.title ? ` — ${r.title}` : '';
      setNotice(`${L.pipelineDone}${title}${errCount ? ` · ${errCount} ${L.stError.toLowerCase()}` : ''}`);
    } else {
      const errs = Array.isArray(r?.errors) && r.errors.length ? `: ${r.errors.slice(0, 3).join('; ')}` : '';
      setNotice(`${L.pipelineFailed}${errs}`);
    }
    setFlowPath(null);
    setFlowProgress(null);
    void loadState();   // refresh submission_state badges after submit
  }, [flowPath, selectedLangList, loadState]);

  // --- enrichment -------------------------------------------------------- #
  const enrichOnce = useCallback(async (): Promise<EnrichResult | null> => {
    const lim = Math.max(1, Math.floor(limit) || 1);
    const r: any = await callRpc('media.enrich', { limit: lim })
      .catch((e: any) => ({ error: e?.message || 'RPC failed' }));
    if (!r || r.error || r.success === false) {
      setNotice(`${L.enrichFailed}${r?.error ? ': ' + r.error : ''}`);
      return null;
    }
    // media.enrich forwards Laravel's {success, data:{...}} envelope unchanged;
    // the counts live under `data`. Read there, falling back to the top level.
    const d = (r && typeof r.data === 'object' && r.data) ? r.data : r;
    const res: EnrichResult = {
      processed: Number(d.processed ?? 0),
      enriched: Number(d.enriched ?? 0),
      remaining: Number(d.remaining ?? 0),
      errors: Array.isArray(d.errors) ? d.errors : undefined,
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

  // --- chapter -> sentence tree (lazy load over booksList) ---------------- #
  const CHAPTER_SLOT_LIMIT = 200;
  // Load a chapter's correspondence slots (every checked language side by side).
  const loadChapterSlots = useCallback(async (path: string, chapterIndex: number, grain: 'sentence' | 'cue') => {
    setTrees((prev) => ({ ...prev, [path]: { ...prev[path], openChapter: chapterIndex, slotsLoading: true, slots: [], grain } }));
    try {
      const r = await pycoreApi.booksList(path, grain === 'cue' ? 'cues' : 'sentences', 0, CHAPTER_SLOT_LIMIT,
        { chapter_index: chapterIndex, languages: selectedLangList() });
      const slots: BookSlot[] = (r && r.success && Array.isArray(r.items)) ? (r.items as BookSlot[]) : [];
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], openChapter: chapterIndex, slots, slotsLoading: false,
        error: r && r.success ? undefined : (r?.error || 'failed') } }));
    } catch (e: any) {
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], openChapter: chapterIndex, slots: [], slotsLoading: false, error: e?.message || 'request failed' } }));
    }
  }, [selectedLangList]);

  // Toggle the chapter tree for a source; first open lazily fetches the chapters.
  const toggleTree = useCallback(async (path: string) => {
    const cur = trees[path];
    if (cur?.open) { setTrees((prev) => ({ ...prev, [path]: { ...prev[path], open: false } })); return; }
    if (cur && cur.chapters.length) { setTrees((prev) => ({ ...prev, [path]: { ...prev[path], open: true } })); return; }
    setTrees((prev) => ({ ...prev, [path]: { open: true, loading: true, chapters: [], openChapter: null, slots: [], slotsLoading: false, grain: 'sentence' } }));
    try {
      const r = await pycoreApi.booksList(path, 'chapters', 0, 500, { languages: selectedLangList() });
      let chapters: BookChapter[] = (r && r.success)
        ? (Array.isArray(r.chapters) ? r.chapters : (Array.isArray(r.items) ? (r.items as BookChapter[]) : []))
        : [];
      // A book with no detected chapters shows a single "Chapter 1".
      if (!chapters.length && r && r.success) {
        chapters = [{ chapter_index: 0, title: 'Chapter 1', sentence_count: 0 }];
      }
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], open: true, loading: false, chapters,
        error: r && r.success ? undefined : (r?.error || 'failed') } }));
      // Auto-expand the first chapter for immediate feedback.
      if (chapters.length) void loadChapterSlots(path, chapters[0].chapter_index, 'sentence');
    } catch (e: any) {
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], open: true, loading: false, error: e?.message || 'request failed' } }));
    }
  }, [trees, selectedLangList, loadChapterSlots]);

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
  // Friendly labels for the auto-flow stages (incl. engine sub-steps).
  const flowStageLabel = (stage: string): string => ({
    convert: L.flConvert, translate: L.flTranslate, voice: L.flVoice,
    audio: L.flAudio, audio_upload: L.flAudioUpload, submit: L.flSubmit,
    done: L.flDone, error: L.flError,
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

  // --- language multi-select (checkbox group; primary locked on) ---------- #
  const renderLangSelect = () => (
    <div className="rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Languages className="w-3.5 h-3.5" /> {L.languages2}
          <span className="ml-1 normal-case font-normal text-slate-400">({selectedLangs.size} {L.selectedCount})</span>
        </h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{L.languagesHint}</p>
      <div className="flex flex-wrap gap-1.5">
        {WF_SUPPORTED_LANGUAGES.map((l) => {
          const on = selectedLangs.has(l.code);
          const locked = l.code === lockedLang;
          return (
            <button key={l.code} type="button" onClick={() => toggleLang(l.code)} disabled={locked}
              title={locked ? L.primaryLang : l.name}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                on
                  ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                  : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300'
              } ${locked ? 'cursor-default opacity-90' : ''}`}>
              <span className="font-mono uppercase">{l.code}</span>
              <span className="font-normal opacity-80">{l.name}</span>
              {locked && <Lock className="w-3 h-3" />}
            </button>
          );
        })}
      </div>
      {selectedLangs.size === 0 && (
        <p className="mt-2 text-[11px] font-bold text-amber-500">{L.needOneLang}</p>
      )}
    </div>
  );

  // --- chapter -> sentence correspondence tree ---------------------------- #
  const langName = (code: string): string =>
    WF_SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();

  // Chapter title (v3.1): prefer the per-language title for the primary language,
  // then any non-empty title in the map, then the flat title, then a default.
  const chapterTitle = (ch: BookChapter): string => {
    const t = ch.titles;
    if (t) {
      const byPrimary = t[lockedLang];
      if (byPrimary) return byPrimary;
      const firstNonEmpty = Object.values(t).find((v) => !!v);
      if (firstNonEmpty) return firstNonEmpty;
    }
    return ch.title || `${L.chapter} ${ch.chapter_index + 1}`;
  };

  const renderTree = (path: string) => {
    const tree = trees[path];
    if (!tree || !tree.open) return null;
    const cols = selectedLangList();
    return (
      <div className="mt-2.5 rounded-2xl p-3 border bg-slate-100/40 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-slate-500">
          <BookMarked className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-bold">{L.chapters2}</span>
          <span className="text-slate-400">· {L.chaptersHint}</span>
        </div>
        {tree.loading ? (
          <div className="py-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {L.loadingList}
          </div>
        ) : tree.error ? (
          <div className="py-4 text-center text-[11px] text-amber-500">{tree.error}</div>
        ) : tree.chapters.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-slate-400">{L.noChapters}</div>
        ) : (
          <div className="space-y-1.5">
            {tree.chapters.map((ch) => {
              const isOpen = tree.openChapter === ch.chapter_index;
              return (
                <div key={ch.chapter_index} className="rounded-xl border border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]">
                  <button type="button"
                    onClick={() => isOpen
                      ? setTrees((prev) => ({ ...prev, [path]: { ...prev[path], openChapter: null } }))
                      : void loadChapterSlots(path, ch.chapter_index, tree.grain)}
                    className="w-full flex items-center gap-2 p-2.5 text-left">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate flex-1" title={chapterTitle(ch)}>
                      {chapterTitle(ch)}
                    </span>
                    {(ch.sentence_count ?? 0) > 0 && (
                      <span className="shrink-0 text-[10px] text-slate-400">{nf(ch.sentence_count)} {L.sentences.toLowerCase()}</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-2.5 pb-2.5">
                      {/* grain toggle (cue / sentence) */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{L.grainLabel}:</span>
                        {(['sentence', 'cue'] as const).map((g) => (
                          <button key={g} type="button"
                            onClick={() => void loadChapterSlots(path, ch.chapter_index, g)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                              tree.grain === g
                                ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                                : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300'}`}>
                            {g === 'cue' ? L.grainCue : L.grainSentence}
                          </button>
                        ))}
                      </div>
                      {tree.slotsLoading ? (
                        <div className="py-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {L.loadingList}
                        </div>
                      ) : tree.slots.length === 0 ? (
                        <div className="py-3 text-center text-[11px] text-slate-400">{L.emptyChapter}</div>
                      ) : (
                        <div className="overflow-auto max-h-72 rounded-lg border border-slate-200/60 dark:border-white/5">
                          <table className="w-full text-[11px] border-collapse">
                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                              <tr>
                                <th className="px-2 py-1 text-right text-slate-400 font-bold w-10">#</th>
                                <th className="px-2 py-1 text-left text-slate-400 font-bold w-14">{L.grainLabel}</th>
                                {cols.map((c) => (
                                  <th key={c} className="px-2 py-1 text-left text-slate-400 font-bold">
                                    <span className="font-mono uppercase">{c}</span> <span className="font-normal opacity-70">{langName(c)}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tree.slots.map((slot, i) => (
                                <tr key={slot.corr_id || `${slot.grain}-${slot.seq}-${i}`} className="border-t border-slate-200/50 dark:border-white/5 align-top">
                                  <td className="px-2 py-1 text-right tabular-nums text-slate-400">{nf((slot.seq ?? i) + 1)}</td>
                                  <td className="px-2 py-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      slot.grain === 'cue' ? 'bg-sky-500/15 text-sky-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                      {slot.grain === 'cue' ? L.grainCue : L.grainSentence}
                                    </span>
                                  </td>
                                  {cols.map((c) => {
                                    const txt = slot.langs ? slot.langs[c] : null;
                                    return (
                                      <td key={c} className={`px-2 py-1 break-words ${txt ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 italic'}`}>
                                        {txt || L.blankCorr}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSourceMeta = (path: string) => {
    const a = analyses[path]?.aggregate;
    if (!a) return null;
    const meta = bookMeta[path];
    const langN = selectedLangList().length;
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><Languages className="w-3 h-3" />{langN} {L.metaLangs}</span>
        <span className="inline-flex items-center gap-1"><AlignLeft className="w-3 h-3" />{nf(a.sentence_count)} {L.sentences.toLowerCase()}</span>
        {meta?.chapters != null && (
          <span className="inline-flex items-center gap-1"><BookMarked className="w-3 h-3" />{nf(meta.chapters)} {L.metaChapters}</span>
        )}
      </div>
    );
  };

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
            <ListChecks className="w-3 h-3" /> {L.explore}
          </button>
        </div>
        {renderSourceMeta(path)}
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

        {/* language multi-select (>=1 required; primary auto-checked + locked) */}
        <div className="mb-4">{renderLangSelect()}</div>

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
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Workflow className="w-3 h-3 text-rose-400 shrink-0" /> {L.pipelineHint}
          </p>

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
                      <button onClick={() => void runPipeline(e.path)}
                        disabled={!!flowPath || selectedLangs.size === 0}
                        className={`p-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          flowPath === e.path
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
                        title={`${L.runPipeline}: ${L.flConvert} → ${L.flTranslate} (${selectedLangList().join(', ') || '—'}) → ${L.flVoice} → ${L.flSubmit}`}>
                        {flowPath === e.path ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Workflow className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => void toggleTree(e.path)}
                        className={`p-1.5 rounded-lg transition ${
                          trees[e.path]?.open
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
                        title={trees[e.path]?.open ? L.hideChapters : L.viewChapters}>
                        <BookMarked className="w-3.5 h-3.5" />
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
                    {/* live auto-flow progress for THIS source */}
                    {flowPath === e.path && (
                      <div className="mt-2 text-[11px] text-rose-500 flex items-center gap-1.5 flex-wrap">
                        <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                        <span className="font-bold">{flowProgress ? flowStageLabel(flowProgress.stage) : L.pipelineRunning}</span>
                        {flowProgress && flowProgress.total > 0 && (
                          <span className="text-slate-400">· {flowProgress.done}/{flowProgress.total}</span>
                        )}
                        {flowProgress?.detail && (
                          <span className="truncate max-w-[60%] text-slate-400" title={flowProgress.detail}>· {flowProgress.detail}</span>
                        )}
                      </div>
                    )}
                    {/* last auto-flow outcome badge (when not currently running) */}
                    {flowPath !== e.path && flowResult[e.path] && (
                      <div className={`mt-2 text-[11px] flex items-center gap-1.5 ${
                        flowResult[e.path].success ? 'text-emerald-500' : 'text-amber-500'}`}>
                        <Workflow className="w-3 h-3 shrink-0" />
                        {flowResult[e.path].success ? L.pipelineDone : L.pipelineFailed}
                        {flowResult[e.path].errors > 0 && (
                          <span className="text-slate-400">· {flowResult[e.path].errors} {L.stError.toLowerCase()}</span>
                        )}
                      </div>
                    )}
                    {renderAnalysis(e.path)}
                    {renderTree(e.path)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* action row */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button onClick={syncBooks} disabled={syncing || selectedLangs.size === 0}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {syncing ? L.syncing : L.syncLaravel}
          </button>
          {selectedLangs.size === 0 && (
            <span className="text-[11px] font-bold text-amber-500">{L.needOneLang}</span>
          )}
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

      {/* Sentence Audio - idempotent TTS generation for every library sentence,
          with progress persisted to localStorage (survives refresh/reopen).
          Drives the existing `media.enrich` RPC (-> laravel_main
          SentenceEnrichmentService: fill-missing audio saved locally). */}
      <PcSentenceAudioPanel entries={entries} sourceStates={sourceStates} />

      {/* Advanced — embedded CoreBook panel (collapsible, default collapsed).
          Mounted once opened and only HIDDEN when collapsed, so its in-progress
          state (library selection, convert/enrich forms) survives toggling. */}
      <section className="pc-glass p-6">
        <button type="button" onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center gap-2 text-left">
          {showAdvanced ? <ChevronDown className="w-4 h-4 text-rose-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <BookMarked className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{L.advanced}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{L.advancedHint}</p>
          </div>
        </button>
        {showAdvanced && (
          <div className="mt-4 rounded-2xl p-4 border bg-slate-950/40 dark:bg-black/30 border-slate-200/60 dark:border-white/5">
            <PcCoreBookPanel embedded />
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

      {/* source explorer — words / sentences / chapters */}
      {detailPath && (
        <PcBookSourceExplorer
          path={detailPath}
          analysis={analyses[detailPath] || null}
          selectedLangs={selectedLangList()}
          lockedLang={lockedLang}
          sourceKey={sourceStates[detailPath]?.source_key}
          onClose={() => setDetailPath(null)}
        />
      )}

      {/* legacy details modal removed — explorer replaces it */}

      {/* drill-down list modal — paginated words / sentences / languages (quick tiles) */}
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
