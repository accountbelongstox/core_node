/**
 * PcBooksPage — pycore Books source ingest + analyze/preview + enrichment.
 *
 * Three self-contained capabilities driven through pycore HTTP controllers:
 *
 *  1. Books — manage a list of book file/folder paths (added via the native
 *     picker, manual entry, or DRAG-AND-DROP) and push them to Laravel via
 *     the shared book-sync HTTP controller. A FORMAT-FILTER sidebar selects
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
 * the backend (:59000) is offline. `L` maps each label to its `pc` locale key.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Plus, Trash2, X, Folder, FileText, FolderOpen, RefreshCw,
  UploadCloud, Library, Sparkles, WifiOff, ListChecks, Filter, Languages,
  Type, Hash, AlignLeft, Eye, EyeOff, ScanText, FileStack,
  ChevronDown, ChevronRight, Lock, BookMarked, Workflow,
} from 'lucide-react';
import {
  laravelApi, pycoreApi, connectPycoreHttp, onHttpStatus, requestPycoreHttp, subscribeHttpEvent,
} from '@/apps/pycore-manager/api';
import { PYCORE_HTTP_ROUTES } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import type {
  VideoExtractMode, BooksAnalyzeResponse, BookTextStats, BookSourceState,
  BookChapter, BookSlot,
} from '@/apps/pycore-manager/api';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';
import { PcCoreBookPanel } from './PcCoreBookPage';
import PcSentenceAudioPanel from '../components/PcSentenceAudioPanel';
import PcBookSourceExplorer from '../components/PcBookSourceExplorer';
import { BookStatTile, formatBookMetric as nf } from '@/shared/books/BookStats';
import { pcLaravelErrorMessage } from '../utils/pcErrorCodes';
import { pcT } from '../utils/pcI18n';

const L = {
  title: 'books.title',
  subtitle: 'books.subtitle',
  addSource: 'books.addSource',
  sources: 'books.sources',
  selectAll: 'books.selectAll',
  noSources: 'books.noSources',
  pick: 'books.pick',
  folder: 'books.folder',
  file: 'books.file',
  singleFile: 'books.singleFile',
  path: 'books.path',
  browse: 'books.browse',
  cancel: 'books.cancel',
  add: 'books.add',
  remove: 'books.remove',
  enterPath: 'books.enterPath',
  pickFolderHint: 'books.pickFolderHint',
  pickFileHint: 'books.pickFileHint',
  syncLaravel: 'books.syncLaravel',
  syncing: 'books.syncing',
  syncDone: 'books.syncDone',
  syncFailed: 'books.syncFailed',
  syncedBadge: 'books.syncedBadge',
  syncStage: 'books.syncStage',
  selectFirst: 'books.selectFirst',
  dropHere: 'books.dropHere',
  dropOr: 'books.dropOr',
  upload: 'books.upload',
  uploadHint: 'books.uploadHint',
  formats: 'books.formats',
  filterHint: 'books.filterHint',
  allFormats: 'books.allFormats',
  noFormats: 'books.noFormats',
  analyze: 'books.analyze',
  analyzing: 'books.analyzing',
  reAnalyze: 'books.reAnalyze',
  words: 'books.words',
  uniqueWords: 'books.uniqueWords',
  sentences: 'books.sentences',
  uniqueSentences: 'books.uniqueSentences',
  characters: 'books.characters',
  langs: 'books.langs',
  topWords: 'books.topWords',
  capHit: 'books.capHit',
  showPreview: 'books.showPreview',
  hidePreview: 'books.hidePreview',
  noText: 'books.noText',
  analyzeFailed: 'books.analyzeFailed',
  prev: 'books.prev',
  next: 'books.next',
  loadingList: 'books.loadingList',
  emptyList: 'books.emptyList',
  stScan: 'books.stScan',
  stSource: 'books.stSource',
  stExtract: 'books.stExtract',
  stBuild: 'books.stBuild',
  stIngest: 'books.stIngest',
  stClips: 'books.stClips',
  stDone: 'books.stDone',
  stError: 'books.stError',
  library: 'books.library',
  libraryHint: 'books.libraryHint',
  batchLimit: 'books.batchLimit',
  enrichNow: 'books.enrichNow',
  enriching: 'books.enriching',
  keepGoing: 'books.keepGoing',
  stopLoop: 'books.stopLoop',
  processed: 'books.processed',
  enriched: 'books.enriched',
  remaining: 'books.remaining',
  enrichFailed: 'books.enrichFailed',
  unreachable: 'books.unreachable',
  languages2: 'books.languages2',
  languagesHint: 'books.languagesHint',
  needOneLang: 'books.needOneLang',
  primaryLang: 'books.primaryLang',
  selectedCount: 'books.selectedCount',
  chapters2: 'books.chapters2',
  chaptersHint: 'books.chaptersHint',
  viewChapters: 'books.viewChapters',
  hideChapters: 'books.hideChapters',
  noChapters: 'books.noChapters',
  emptyChapter: 'books.emptyChapter',
  grainSentence: 'books.grainSentence',
  grainCue: 'books.grainCue',
  grainLabel: 'books.grainLabel',
  blankCorr: 'books.blankCorr',
  advanced: 'books.advanced',
  advancedHint: 'books.advancedHint',
  pipelineHint: 'books.pipelineHint',
  pipelineRunning: 'books.pipelineRunning',
  pipelineDone: 'books.pipelineDone',
  pipelineFailed: 'books.pipelineFailed',
  pipelineBusy: 'books.pipelineBusy',
  flConvert: 'books.flConvert',
  flTranslate: 'books.flTranslate',
  flVoice: 'books.flVoice',
  flAudio: 'books.flAudio',
  flAudioUpload: 'books.flAudioUpload',
  flSubmit: 'books.flSubmit',
  explore: 'books.explore',
  flDone: 'books.flDone',
  flError: 'books.flError',
  sourceAdded: 'books.sourceAdded',
  pickerUnavailable: 'books.pickerUnavailable',
  uploadFailed: 'books.uploadFailed',
  submitFailed: 'books.submitFailed',
  requestFailed: 'books.requestFailed',
  fileSkipped: 'books.fileSkipped',
  uploadSummary: 'books.uploadSummary',
  skippedDetail: 'books.skippedDetail',
  sourcesAdded: 'books.sourcesAdded',
  noMatchingFiles: 'books.noMatchingFiles',
  ingestSummary: 'books.ingestSummary',
  syncSentences: 'books.syncSentences',
  syncErrors: 'books.syncErrors',
  errorCount: 'books.errorCount',
  chapterNumber: 'books.chapterNumber',
  sentenceCount: 'books.sentenceCount',
  langCount: 'books.langCount',
  chapterCount: 'books.chapterCount',
  analyzedFiles: 'books.analyzedFiles',
  fileCount: 'books.fileCount',
  charCount: 'books.charCount',
  wordsSummary: 'books.wordsSummary',
  sentencesSummary: 'books.sentencesSummary',
  distinctSummary: 'books.distinctSummary',
  range: 'books.range',
  pipelineTitle: 'books.pipelineTitle',
} as const;

const DEFAULT_BASE = 'D:\\.tmp';
// Cap the "run until empty" loop so a stuck backend can never spin forever.
const MAX_LOOP_ITERATIONS = 50;
// The auto-flow chains convert + translate + TTS + ingest — all slow; give it a
// long ceiling so the HTTP never times out before the engine finishes.
const AUTOFLOW_HTTP_TIMEOUT_MS = 600_000;   // 10 min

interface BookEntry { path: string; mode: VideoExtractMode; }
interface SyncProgress { stage: string; done: number; total: number; detail: string; }
interface EnrichResult { processed: number; enriched: number; remaining: number; errors?: string[]; }
interface FlowProgress { stage: string; done: number; total: number; detail: string; }


const PcBooksPage: React.FC = () => {
  const { t } = useTranslation('pc');
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
  const [httpConnected, setHttpConnected] = useState(false);
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

  // HTTP connection status drives the offline banner. Book ingest progress uses
  // the same `video_extract_sync` event the video page subscribes to.
  useEffect(() => {
    connectPycoreHttp();
    const offStatus = onHttpStatus(setHttpConnected);
    const offSync = subscribeHttpEvent(PYCORE_EVENT_TOPICS.videoExtractSync, (d: any) => {
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
          s.sentences != null ? pcT(L.syncSentences, { count: s.sentences }) : null,
          s.errors != null && s.errors ? pcT(L.syncErrors, { count: s.errors }) : null,
        ].filter(Boolean).join(' · ');
        setNotice(`${pcT(L.syncDone)}${parts ? ' — ' + parts : ''}`);
        setSyncing(false);
        setSyncProgress(null);
      } else if (stage === 'error') {
        const errs = Array.isArray(d?.errors) ? d.errors.join('; ') : '';
        setNotice(`${pcT(L.syncFailed)}${d?.detail ? ': ' + d.detail : errs ? ': ' + errs : ''}`);
        setSyncing(false);
        setSyncProgress(null);
      }
    });
    // Auto-flow progress: the engine broadcasts a `corebook_autoflow` event per
    // stage (convert/translate/voice/submit + sub-steps audio/audio_upload). We
    // mirror it into `flowProgress`; the runPipeline() resolve handles the final
    // notice + state, so here we just clear progress on the terminal stages.
    const offFlow = subscribeHttpEvent(PYCORE_EVENT_TOPICS.corebookAutoflow, (d: any) => {
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
    (): string[] => SUPPORTED_LEARNING_LANGUAGES.map((l) => l.code).filter((c) => selectedLangs.has(c)),
    [selectedLangs],
  );

  // --- analyze a source (file or folder) --------------------------------- #
  const analyzeEntry = useCallback(async (path: string) => {
    setAnalyzing((prev) => new Set(prev).add(path));
    try {
      const r = await pycoreApi.booksAnalyze(path, { formats: activeFormats(), languages: selectedLangList(), preview_chars: 1200, persist: true });
      if (r && r.success) {
        setAnalyses((prev) => ({ ...prev, [path]: r }));
        // Read lightweight totals through HTTP API (chapter count lives in totals.chapters).
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
        setNotice(`${t(L.analyzeFailed)}${r?.error ? ': ' + r.error : ''}`);
      }
    } catch (e: any) {
      setNotice(`${t(L.analyzeFailed)}: ${e?.message || t(L.requestFailed)}`);
    } finally {
      setAnalyzing((prev) => { const n = new Set(prev); n.delete(path); return n; });
    }
  }, [activeFormats, selectedLangList, t]);

  // Derive the detected primary language from the analyses and auto-check +
  // lock it (spec §9: the primary language is checked and cannot be unchecked).
  // The most recently analyzed source wins; falls back to 'en' when unknown.
  useEffect(() => {
    const valid = new Set(SUPPORTED_LEARNING_LANGUAGES.map((l) => l.code));
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
    if (!p) { setNotice(t(L.enterPath)); return; }
    addEntry(p, addMode);
    setShowAdd(false);
    setAddPath(DEFAULT_BASE);
    setNotice(t(L.sourceAdded));
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
      else setNotice(r?.error || t(L.pickerUnavailable));
    } catch {
      setNotice(t(L.pickerUnavailable));
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
      if (!r || !r.success) { setNotice(`${t(L.analyzeFailed)}${r?.error ? ': ' + r.error : ''}`); return; }
      let added = 0;
      const errs: string[] = [];
      r.files.forEach((f) => {
        if (!f.path) { errs.push(`${f.name}: ${f.error || t(L.fileSkipped)}`); return; }
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
      setNotice(`${t(L.uploadSummary, { count: added })}${errs.length
        ? ` · ${t(L.skippedDetail, { count: errs.length, detail: errs.join('; ') })}`
        : ''}`);
    } catch (e: any) {
      setNotice(`${t(L.analyzeFailed)}: ${e?.message || t(L.uploadFailed)}`);
    } finally {
      setUploading(false);
    }
  }, [addEntry, selectedLangList, t]);

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
    if (withPath.length) setNotice(t(L.sourcesAdded, { count: withPath.length }));
    if (noPath.length) void uploadFiles(noPath);
  }, [addEntry, uploadFiles, t]);

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
    if (!selPaths.length) { setNotice(t(L.selectFirst)); return; }
    const langs = selectedLangList();
    if (!langs.length) { setNotice(t(L.needOneLang)); return; }
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
      setNotice(`${t(L.syncFailed)}: ${t(L.noMatchingFiles)}`);
      setSyncing(false); setSyncProgress(null); return;
    }
    // One-shot batch submit: pycore builds the v2 payload for each source and
    // ingests it; per-stage progress still streams over `video_extract_sync`.
    try {
      const r = await pycoreApi.booksSubmit(paths, undefined, langs);
      if (!r || !r.success) {
        const errs = (r?.items || []).flatMap((it) => it.errors || []);
        setNotice(`${t(L.syncFailed)}${errs.length ? ': ' + errs.slice(0, 3).join('; ') : (r?.error ? ': ' + r.error : '')}`);
      } else {
        setNotice(`${t(L.syncDone)} — ${t(L.ingestSummary, { sentences: r.total_sentences, words: r.total_words })}`);
      }
    } catch (e: any) {
      setNotice(`${t(L.syncFailed)}: ${e?.message || t(L.submitFailed)}`);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
      void loadState();   // refresh submission_state badges
    }
  }, [entries, selected, syncing, resolveSyncPaths, loadState, selectedLangList, t]);

  // --- one-click auto-flow: convert → translate → voice → submit --------- #
  // Fires the backend `corebook.autoflow` HTTP for ONE source; per-stage progress
  // streams over the `corebook_autoflow` HTTP event (wired above). One flow at a
  // time; the catch keeps it safe when the HTTP service is offline.
  const runPipeline = useCallback(async (path: string) => {
    if (flowPath) { setNotice(t(L.pipelineBusy)); return; }
    const langs = selectedLangList();
    if (!langs.length) { setNotice(t(L.needOneLang)); return; }
    setFlowPath(path);
    setFlowProgress({ stage: 'convert', done: 0, total: 0, detail: '' });
    setNotice(null);
    const r: any = await requestPycoreHttp(
      PYCORE_HTTP_ROUTES.corebookAutoflow,
      { path, languages: langs, source_type: 'book' },
      AUTOFLOW_HTTP_TIMEOUT_MS,
    ).catch((e: any) => ({ success: false, errors: [e?.message || t(L.requestFailed)] }));
    const errCount = Array.isArray(r?.errors) ? r.errors.length : 0;
    setFlowResult((prev) => ({ ...prev, [path]: { success: !!r?.success, errors: errCount } }));
    if (r?.success) {
      const title = r.title ? ` — ${r.title}` : '';
      setNotice(`${t(L.pipelineDone)}${title}${errCount ? ` · ${t(L.errorCount, { count: errCount })}` : ''}`);
    } else {
      const errs = Array.isArray(r?.errors) && r.errors.length ? `: ${r.errors.slice(0, 3).join('; ')}` : '';
      setNotice(`${t(L.pipelineFailed)}${errs}`);
    }
    setFlowPath(null);
    setFlowProgress(null);
    void loadState();   // refresh submission_state badges after submit
  }, [flowPath, selectedLangList, loadState, t]);

  // --- enrichment -------------------------------------------------------- #
  const enrichOnce = useCallback(async (): Promise<EnrichResult | null> => {
    const lim = Math.max(1, Math.floor(limit) || 1);
    const r: any = await laravelApi.enrichMedia(lim)
      .catch((e: unknown) => ({ error: pcLaravelErrorMessage(e) }));
    if (!r || r.error || r.success === false) {
      setNotice(`${t(L.enrichFailed)}${r?.error ? ': ' + r.error : ''}`);
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
      setNotice(`${t(L.enrichFailed)}: ${res.errors.join('; ')}`);
    }
    return res;
  }, [limit, t]);

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
        setListView({ path, kind, start, limit: LIST_LIMIT, total: 0, items: [], totals: {}, loading: false, error: r?.error || t(L.requestFailed) });
      }
    } catch (e: any) {
      setListView({ path, kind, start, limit: LIST_LIMIT, total: 0, items: [], totals: {}, loading: false, error: e?.message || t(L.requestFailed) });
    }
  }, [t]);
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
        error: r && r.success ? undefined : (r?.error || t(L.requestFailed)) } }));
    } catch (e: any) {
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], openChapter: chapterIndex, slots: [], slotsLoading: false, error: e?.message || t(L.requestFailed) } }));
    }
  }, [selectedLangList, t]);

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
        chapters = [{ chapter_index: 0, title: t(L.chapterNumber, { number: 1 }), sentence_count: 0 }];
      }
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], open: true, loading: false, chapters,
        error: r && r.success ? undefined : (r?.error || t(L.requestFailed)) } }));
      // Auto-expand the first chapter for immediate feedback.
      if (chapters.length) void loadChapterSlots(path, chapters[0].chapter_index, 'sentence');
    } catch (e: any) {
      setTrees((prev) => ({ ...prev, [path]: { ...prev[path], open: true, loading: false, error: e?.message || t(L.requestFailed) } }));
    }
  }, [trees, selectedLangList, loadChapterSlots, t]);

  // --- styling helpers --------------------------------------------------- #
  const inputCls = 'text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none';
  const allSelected = entries.length > 0 && selected.size === entries.length;
  const syncPct = syncProgress && syncProgress.total > 0
    ? Math.min(100, Math.round((syncProgress.done / syncProgress.total) * 100))
    : 0;
  // Friendly labels for sync stages streamed through HTTP events.
  const stageLabel = (stage: string): string => ({
    scan: t(L.stScan), source: t(L.stSource), extract: t(L.stExtract), build: t(L.stBuild),
    ingest: t(L.stIngest), clips: t(L.stClips), done: t(L.stDone), error: t(L.stError),
  } as Record<string, string>)[stage] || stage;
  // Friendly labels for the auto-flow stages (incl. engine sub-steps).
  const flowStageLabel = (stage: string): string => ({
    convert: t(L.flConvert), translate: t(L.flTranslate), voice: t(L.flVoice),
    audio: t(L.flAudio), audio_upload: t(L.flAudioUpload), submit: t(L.flSubmit),
    done: t(L.flDone), error: t(L.flError),
  } as Record<string, string>)[stage] || stage;
  const busyAny = enriching || looping;
  const filterLabel = useMemo(() => {
    if (!supportedFormats.length) return '';
    if (formatFilter.size === supportedFormats.length) return t(L.allFormats);
    if (formatFilter.size === 0) return t(L.noFormats);
    return `${formatFilter.size}/${supportedFormats.length}`;
  }, [supportedFormats, formatFilter, t]);

  const renderStats = (s: BookTextStats, path: string) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      <BookStatTile variant="source" icon={<Type className="w-3 h-3" />} label={t(L.words)} value={nf(s.word_count)} onClick={() => openList(path, 'words')} />
      <BookStatTile variant="source" icon={<Hash className="w-3 h-3" />} label={t(L.uniqueWords)} value={nf(s.unique_word_count)} accent="text-indigo-500" onClick={() => openList(path, 'unique_words')} />
      <BookStatTile variant="source" icon={<AlignLeft className="w-3 h-3" />} label={t(L.sentences)} value={nf(s.sentence_count)} onClick={() => openList(path, 'sentences')} />
      <BookStatTile variant="source" icon={<Hash className="w-3 h-3" />} label={t(L.uniqueSentences)} value={nf(s.unique_sentence_count)} accent="text-indigo-500" onClick={() => openList(path, 'unique_sentences')} />
      <BookStatTile variant="source" icon={<FileText className="w-3 h-3" />} label={t(L.characters)} value={nf(s.char_count)} />
      <BookStatTile variant="source" icon={<Languages className="w-3 h-3" />} label={t(L.langs)} value={(s.primary_language || 'und').toUpperCase()} accent="text-emerald-500" onClick={() => openList(path, 'languages')} />
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
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{t(L.topWords)}</span>
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
          <Languages className="w-3.5 h-3.5" /> {t(L.languages2)}
          <span className="ml-1 normal-case font-normal text-slate-400">({t(L.selectedCount, { count: selectedLangs.size })})</span>
        </h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{t(L.languagesHint)}</p>
      <div className="flex flex-wrap gap-1.5">
        {SUPPORTED_LEARNING_LANGUAGES.map((l) => {
          const on = selectedLangs.has(l.code);
          const locked = l.code === lockedLang;
          return (
            <button key={l.code} type="button" onClick={() => toggleLang(l.code)} disabled={locked}
              title={locked ? t(L.primaryLang) : l.name}
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
        <p className="mt-2 text-[11px] font-bold text-amber-500">{t(L.needOneLang)}</p>
      )}
    </div>
  );

  // --- chapter -> sentence correspondence tree ---------------------------- #
  const langName = (code: string): string =>
    SUPPORTED_LEARNING_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();

  // Chapter title (v3.1): prefer the per-language title for the primary language,
  // then any non-empty title in the map, then the flat title, then a default.
  const chapterTitle = (ch: BookChapter): string => {
    const titles = ch.titles;
    if (titles) {
      const byPrimary = titles[lockedLang];
      if (byPrimary) return byPrimary;
      const firstNonEmpty = Object.values(titles).find((v) => !!v);
      if (firstNonEmpty) return firstNonEmpty;
    }
    return ch.title || t(L.chapterNumber, { number: ch.chapter_index + 1 });
  };

  const renderTree = (path: string) => {
    const tree = trees[path];
    if (!tree || !tree.open) return null;
    const cols = selectedLangList();
    return (
      <div className="mt-2.5 rounded-2xl p-3 border bg-slate-100/40 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-slate-500">
          <BookMarked className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-bold">{t(L.chapters2)}</span>
          <span className="text-slate-400">· {t(L.chaptersHint)}</span>
        </div>
        {tree.loading ? (
          <div className="py-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t(L.loadingList)}
          </div>
        ) : tree.error ? (
          <div className="py-4 text-center text-[11px] text-amber-500">{tree.error}</div>
        ) : tree.chapters.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-slate-400">{t(L.noChapters)}</div>
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
                      <span className="shrink-0 text-[10px] text-slate-400">{t(L.sentenceCount, { count: nf(ch.sentence_count) })}</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-2.5 pb-2.5">
                      {/* grain toggle (cue / sentence) */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{t(L.grainLabel)}:</span>
                        {(['sentence', 'cue'] as const).map((g) => (
                          <button key={g} type="button"
                            onClick={() => void loadChapterSlots(path, ch.chapter_index, g)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                              tree.grain === g
                                ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                                : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300'}`}>
                            {g === 'cue' ? t(L.grainCue) : t(L.grainSentence)}
                          </button>
                        ))}
                      </div>
                      {tree.slotsLoading ? (
                        <div className="py-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t(L.loadingList)}
                        </div>
                      ) : tree.slots.length === 0 ? (
                        <div className="py-3 text-center text-[11px] text-slate-400">{t(L.emptyChapter)}</div>
                      ) : (
                        <div className="overflow-auto max-h-72 rounded-lg border border-slate-200/60 dark:border-white/5">
                          <table className="w-full text-[11px] border-collapse">
                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                              <tr>
                                <th className="px-2 py-1 text-right text-slate-400 font-bold w-10">#</th>
                                <th className="px-2 py-1 text-left text-slate-400 font-bold w-14">{t(L.grainLabel)}</th>
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
                                      {slot.grain === 'cue' ? t(L.grainCue) : t(L.grainSentence)}
                                    </span>
                                  </td>
                                  {cols.map((c) => {
                                    const txt = slot.langs ? slot.langs[c] : null;
                                    return (
                                      <td key={c} className={`px-2 py-1 break-words ${txt ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 italic'}`}>
                                        {txt || t(L.blankCorr)}
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
        <span className="inline-flex items-center gap-1"><Languages className="w-3 h-3" />{t(L.langCount, { count: langN })}</span>
        <span className="inline-flex items-center gap-1"><AlignLeft className="w-3 h-3" />{t(L.sentenceCount, { count: nf(a.sentence_count) })}</span>
        {meta?.chapters != null && (
          <span className="inline-flex items-center gap-1"><BookMarked className="w-3 h-3" />{t(L.chapterCount, { count: nf(meta.chapters) })}</span>
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
            ? <span>{t(L.analyzedFiles, { analyzed: nf(a.analyzed), scanned: nf(a.scanned) })}</span>
            : <span>{t(L.fileCount, { count: 1 })}</span>}
          {a.truncated_files && <span className="text-amber-500">· {t(L.capHit)}</span>}
          <button onClick={() => setDetailPath(path)}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition">
            <ListChecks className="w-3 h-3" /> {t(L.explore)}
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
              {showPv ? t(L.hidePreview) : t(L.showPreview)}
              <span className="text-slate-400 font-normal">· {previewFile.name}</span>
            </button>
            {showPv && (
              <pre className="mt-1.5 max-h-48 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-xl p-3 bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300">
                {previewFile.error ? `(${t(L.noText)})` : previewFile.preview}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-5">
      {/* header + sources */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <BookOpen className="w-5 h-5 text-rose-500" /> {t(L.title)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t(L.subtitle)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowFilter((v) => !v)}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border ${
                showFilter
                  ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                  : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
              <Filter className="w-4 h-4" /> {t(L.formats)}
              {filterLabel && <span className="text-[10px] opacity-80">({filterLabel})</span>}
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={onPickUpload}
              accept={supportedFormats.join(',')} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50"
              title={t(L.uploadHint)}>
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} {t(L.upload)}
            </button>
            <button onClick={() => { setAddPath(DEFAULT_BASE); setShowAdd(true); }}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1">
              <Plus className="w-4 h-4" /> {t(L.addSource)}
            </button>
          </div>
        </div>

        {/* format-filter sidebar (collapsible) */}
        {showFilter && (
          <div className="mb-4 rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ScanText className="w-3.5 h-3.5" /> {t(L.formats)}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setAllFormats(true)} className="text-[11px] font-bold text-rose-500 hover:text-rose-400">{t(L.allFormats)}</button>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button onClick={() => setAllFormats(false)} className="text-[11px] font-bold text-slate-500 hover:text-slate-400">{t(L.noFormats)}</button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">{t(L.filterHint)}</p>
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
              {!supportedFormats.length && <span className="text-[11px] text-slate-400">{t(L.unreachable)}</span>}
            </div>
          </div>
        )}

        {/* language multi-select (>=1 required; primary auto-checked + locked) */}
        <div className="mb-4">{renderLangSelect()}</div>

        {!httpConnected && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{t(L.unreachable)}</span>
          </div>
        )}

        {/* drop zone wrapping the sources list */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`space-y-2 rounded-2xl transition ${dragOver ? 'ring-2 ring-rose-500/60 bg-rose-500/5 p-3' : ''}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{t(L.sources)}</h3>
            {entries.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> {t(L.selectAll)}
              </label>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{t(L.pick)}</p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Workflow className="w-3 h-3 text-rose-400 shrink-0" /> {t(L.pipelineHint)}
          </p>

          {entries.length === 0 ? (
            <div className={`text-xs py-8 text-center border border-dashed rounded-2xl transition ${
              dragOver ? 'border-rose-500/60 text-rose-500' : 'border-slate-300 dark:border-white/10 text-slate-500'}`}>
              <UploadCloud className="w-6 h-6 mx-auto mb-1.5 opacity-60" />
              {t(L.dropHere)} <span className="text-slate-400">{t(L.dropOr)}</span>{' '}
              <button onClick={() => { setAddPath(DEFAULT_BASE); setShowAdd(true); }} className="font-bold text-rose-500 hover:text-rose-400">{t(L.addSource)}</button>
              <div className="mt-1 text-[11px] text-slate-400">{t(L.noSources)}</div>
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
                        {e.mode === 'folder' ? t(L.folder) : t(L.file)}
                      </span>
                      <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={e.path}>{e.path}</span>
                      {sourceStates[e.path]?.submission_state === 'synced' && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
                          {t(L.syncedBadge)}
                        </span>
                      )}
                      <button onClick={() => analyzeEntry(e.path)} disabled={isAnalyzing}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition disabled:opacity-50"
                        title={analyses[e.path] ? t(L.reAnalyze) : t(L.analyze)}>
                        {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => void runPipeline(e.path)}
                        disabled={!!flowPath || selectedLangs.size === 0}
                        className={`p-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          flowPath === e.path
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
                        title={t(L.pipelineTitle, { languages: selectedLangList().join(', ') || '—' })}>
                        {flowPath === e.path ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Workflow className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => void toggleTree(e.path)}
                        className={`p-1.5 rounded-lg transition ${
                          trees[e.path]?.open
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
                        title={trees[e.path]?.open ? t(L.hideChapters) : t(L.viewChapters)}>
                        <BookMarked className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeEntry(e.path)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition" title={t(L.remove)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isAnalyzing && !analyses[e.path] && (
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> {t(L.analyzing)}
                      </div>
                    )}
                    {/* live auto-flow progress for THIS source */}
                    {flowPath === e.path && (
                      <div className="mt-2 text-[11px] text-rose-500 flex items-center gap-1.5 flex-wrap">
                        <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                        <span className="font-bold">{flowProgress ? flowStageLabel(flowProgress.stage) : t(L.pipelineRunning)}</span>
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
                        {flowResult[e.path].success ? t(L.pipelineDone) : t(L.pipelineFailed)}
                        {flowResult[e.path].errors > 0 && (
                          <span className="text-slate-400">· {t(L.errorCount, { count: flowResult[e.path].errors })}</span>
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
            {syncing ? t(L.syncing) : t(L.syncLaravel)}
          </button>
          {selectedLangs.size === 0 && (
            <span className="text-[11px] font-bold text-amber-500">{t(L.needOneLang)}</span>
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
              {t(L.syncStage)}:
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
            <Library className="w-4 h-4 text-rose-500" /> {t(L.library)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">{t(L.libraryHint)}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">{t(L.batchLimit)}</label>
            <input type="number" min={1} value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
              disabled={busyAny}
              className={`${inputCls} w-28 disabled:opacity-50`} />
          </div>
          <button onClick={enrichNow} disabled={busyAny}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {enriching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {enriching ? t(L.enriching) : t(L.enrichNow)}
          </button>
          {!looping ? (
            <button onClick={runUntilEmpty} disabled={busyAny}
              className="px-5 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
              <ListChecks className="w-4 h-4" /> {t(L.keepGoing)}
            </button>
          ) : (
            <button onClick={stopLoop}
              className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition">
              <RefreshCw className="w-4 h-4 animate-spin" /> {t(L.stopLoop)}
            </button>
          )}
        </div>

        {enrichResult && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
            <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
              <div className="text-slate-400 uppercase tracking-wide">{t(L.processed)}</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{enrichResult.processed}</div>
            </div>
            <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
              <div className="text-slate-400 uppercase tracking-wide">{t(L.enriched)}</div>
              <div className="text-lg font-bold text-emerald-500">{enrichResult.enriched}</div>
            </div>
            <div className="rounded-2xl p-4 border bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5">
              <div className="text-slate-400 uppercase tracking-wide">{t(L.remaining)}</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{enrichResult.remaining}</div>
            </div>
          </div>
        )}
      </section>

      {/* Sentence Audio - idempotent TTS generation for every library sentence,
          with progress persisted to localStorage (survives refresh/reopen).
          Drives the existing `media.enrich` HTTP (-> laravel_main
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
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{t(L.advanced)}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{t(L.advancedHint)}</p>
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
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><Plus className="w-4 h-4 text-rose-500" /> {t(L.addSource)}</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setAddMode('folder')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'folder'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <Folder className="w-5 h-5" /> {t(L.folder)}
              </button>
              <button onClick={() => setAddMode('file')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'file'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <FileText className="w-5 h-5" /> {t(L.singleFile)}
              </button>
            </div>

            <label className="block text-[11px] text-slate-500 mb-1">{t(L.path)}</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={addPath} autoFocus
                onChange={(ev) => setAddPath(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') confirmAdd(); }}
                placeholder={DEFAULT_BASE}
                className={`${inputCls} flex-1`} />
              <button onClick={browse} disabled={browsing}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-slate-200 transition flex items-center gap-1 shrink-0 disabled:opacity-50">
                {browsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                {t(L.browse)}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-5">
              {addMode === 'folder' ? t(L.pickFolderHint) : t(L.pickFileHint)}
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                {t(L.cancel)}
              </button>
              <button onClick={confirmAdd}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {t(L.add)}
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
          words: t(L.words), unique_words: t(L.uniqueWords), sentences: t(L.sentences),
          unique_sentences: t(L.uniqueSentences), languages: t(L.langs),
        };
        const fname = lv.path.split(/[\\/]/).pop();
        const from = lv.total === 0 ? 0 : lv.start + 1;
        const to = lv.start + lv.items.length;
        const hasPrev = lv.start > 0;
        const hasNext = lv.start + lv.limit < lv.total;
        const totals = lv.totals || {};
        // Always surface the character count too (the user expects it shown).
        const charsPart = (totals.chars != null) ? ` · ${t(L.charCount, { count: nf(totals.chars) })}` : '';
        let summary = '';
        if (lv.kind === 'words' || lv.kind === 'unique_words') {
          summary = `${t(L.wordsSummary, { distinct: nf(totals.unique_words), total: nf(totals.words) })}${charsPart}`;
        } else if (lv.kind === 'sentences') {
          summary = `${t(L.sentencesSummary, { count: nf(totals.sentences) })}${charsPart}`;
        } else if (lv.kind === 'unique_sentences') {
          summary = `${t(L.distinctSummary, { count: nf(totals.unique_sentences) })}${charsPart}`;
        } else if (lv.kind === 'languages') {
          summary = t(L.charCount, { count: nf(totals.chars) });
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
                    <RefreshCw className="w-4 h-4 animate-spin" /> {t(L.loadingList)}
                  </div>
                ) : lv.error ? (
                  <div className="py-8 text-center text-xs text-amber-500">{lv.error}</div>
                ) : lv.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">{t(L.emptyList)}</div>
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
                        {Math.round((l.ratio || 0) * 100)}% · {t(L.charCount, { count: nf(l.chars) })}
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
                <span>{t(L.range, { from: nf(from), to: nf(to), total: nf(lv.total) })}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => loadListPage(lv.path, lv.kind, Math.max(0, lv.start - lv.limit))}
                    disabled={!hasPrev || lv.loading}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/5 font-bold disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300">{t(L.prev)}</button>
                  <button onClick={() => loadListPage(lv.path, lv.kind, lv.start + lv.limit)}
                    disabled={!hasNext || lv.loading}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/5 font-bold disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300">{t(L.next)}</button>
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
