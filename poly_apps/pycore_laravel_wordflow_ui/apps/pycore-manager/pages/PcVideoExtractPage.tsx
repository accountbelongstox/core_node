/**
 * PcVideoExtractPage — pycore video → audio + .srt extraction (faster-whisper).
 *
 * Self-contained port of the desktop-manager VideoExtractPage: manage source
 * folders/files, configure whisper model / formats / extensions / language,
 * preview, and run extraction with live total + per-file progress, a live
 * segment↔subtitle map, and a live CPU/MEM/GPU monitor. Uses pycoreApi + WS
 * (connectPycoreWs/subscribe/onWsStatus). Optional live updates with a manual
 * Refresh; every backend call is guarded and the UI never crashes when the
 * backend (:59000) is offline. Appearance/language live in the shell controls.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clapperboard, Search, Play, RefreshCw, Square, Plus, Trash2, X,
  Folder, FileVideo, WifiOff, FolderOpen,
  Pause, Cpu, MemoryStick, Captions, ChevronDown, ChevronUp, ListChecks,
  SlidersHorizontal, PanelRightClose, Scissors, CornerDownRight, MonitorSmartphone,
  UploadCloud, Film, Grid2x2, Music, Image as ImageIcon,
  Languages, Lock, Wand2,
} from 'lucide-react';
import {
  pycoreApi, connectPycoreWs, onWsStatus,
} from '../../../core/api-libs/pycore';
import type {
  VideoExtractEntry, VideoExtractMode, VideoExtractOptions, WhisperLanguage,
  SystemResources, VideoExtractOpenKind,
} from '../../../core/api-libs/pycore';
import { WF_SUPPORTED_LANGUAGES } from '../../../core/api-libs/wordflow/wordflowLanguages';
import { usePcVideoExtract } from '../PcVideoExtractContext';
import type { SegWithFull, VeFlowStep } from '../PcVideoExtractContext';
import PcLaravelMediaPanel from '../components/PcLaravelMediaPanel';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';

// Flow-step status → badge color + short label for the "处理流程 / Flow" panel.
const FLOW_STATUS: Record<string, { dot: string; text: string; label: string }> = {
  ok:       { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'OK' },
  api:      { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'API' },
  whisper:  { dot: 'bg-indigo-500',  text: 'text-indigo-500',  label: 'Whisper' },
  ai:       { dot: 'bg-violet-500',  text: 'text-violet-500',  label: 'AI' },
  cache:    { dot: 'bg-sky-500',     text: 'text-sky-500',     label: 'Cache' },
  api_miss: { dot: 'bg-amber-500',   text: 'text-amber-500',   label: 'API miss' },
  warn:     { dot: 'bg-amber-500',   text: 'text-amber-500',   label: 'Warn' },
  empty:    { dot: 'bg-slate-400',   text: 'text-slate-400',   label: 'Empty' },
  miss:     { dot: 'bg-slate-400',   text: 'text-slate-400',   label: 'Miss' },
  fail:     { dot: 'bg-rose-500',    text: 'text-rose-500',    label: 'Fail' },
};
function flowStyle(status: string) {
  return FLOW_STATUS[status] || { dot: 'bg-slate-400', text: 'text-slate-400', label: status };
}

// i18n labels for the new sync + clip-variant UI. The rest of this page uses
// hardcoded English literals (no `t` object exists in pycore-manager), so the
// new copy follows the same pattern, centralized here as the single source.
// Chinese values are kept alongside as inline comments for future i18n wiring.
const L = {
  veSyncLaravel: 'Sync to Laravel',   // 同步到 Laravel
  veSyncAll: 'Sync ALL to Laravel',   // 全部同步到 Laravel
  veAutoSync: 'Auto-sync after run',  // 跑完自动同步
  veIdempotent: 'Idempotent — safe to re-run; existing data is never overwritten.', // 幂等——可重复执行,已有数据不会被覆盖
  veSyncing: 'Syncing…',              // 同步中…
  veSyncDone: 'Synced to Laravel',    // 已同步到 Laravel
  veSyncFailed: 'Sync failed',        // 同步失败
  veSyncStage: 'Stage',               // 阶段
  veFullClip: 'Full',                 // 完整
  veTinyClip: '2×2',
  veAudioClip: 'Audio',               // 音频
  veWholeFiles: 'Outputs',            // 输出文件
  veOpenClipDir: 'Open clip dir',     // 打开切片目录
  vePoster: 'Poster',                 // 海报
  veOpenPosterDir: 'Open poster dir', // 打开海报目录
  // language multi-select + multi-language correspondence
  veLanguages: 'Languages',                       // 语言
  veLanguagesHint: 'Pick the languages to build a per-cue correspondence for. The recognition (primary) language is checked and locked.',
  veNeedOneLang: 'Select at least one language',   // 至少选择一种语言
  vePrimaryLang: 'Primary (locked)',              // 主语言(锁定)
  veSelected: 'selected',                          // 已选
  veFlowTitle: 'Process / decision / cache flow',  // 处理流程 / 决策 / 缓存
  veGrainLabel: 'Grain',                           // 粒度
  veGrainCue: 'Cue',                               // 行
  veGrainSentence: 'Sentence',                     // 句子
  veBlankCorr: '—',                                // 留空占位
  // subtitle source (options panel)
  veSubtitleSource: 'Subtitle source',                                            // 字幕来源
  veSrcApiFirst: 'API first (OpenSubtitles → Whisper)',                           // 优先 API(OpenSubtitles → Whisper)
  veSrcWhisper: 'Always Whisper',                                                 // 始终使用 Whisper
  veSubtitleSourceHint: 'API first tries OpenSubtitles for the primary track, then falls back to Whisper.', // API 优先先尝试 OpenSubtitles,失败再回退 Whisper
  // fill languages (Laravel-sync section)
  veFill: 'Fill languages (API → AI)',                                            // 填充语言(API → AI)
  veFilling: 'Filling…',                                                          // 填充中…
  veFillHint: 'Filled tracks are cached locally next to each video, then Submit (Sync) sends them.', // 填充的字幕缓存在视频旁,随后点击同步提交
  veFillStage: 'Stage',                                                           // 阶段
};

const DEFAULT_BASE = 'D:\\.tmp';

// Full whisper model catalog (mirrors the backend); non-installed render disabled.
const FALLBACK_ALL_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3', 'turbo'];
const FALLBACK_LANGS: WhisperLanguage[] = [{ code: 'en', name: 'English' }];
const FORMATS = ['mp3', 'opus', 'aac', 'vorbis'];
const FALLBACK_EXTS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv'];

const DEFAULT_OPTIONS: VideoExtractOptions = {
  subtitle: true, model: 'auto', formats: ['mp3'], lang: 'en', extensions: [],
  subtitle_source: 'api_first', target_languages: ['en', 'zh'],
};

const fmtMB = (bytes?: number | null): string => {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '-';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
const fmtDur = (sec?: number | null): string => {
  if (typeof sec !== 'number' || !isFinite(sec) || sec < 0) return '-';
  const s = Math.round(sec);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${String(rem).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
};
const fmtClock = (sec?: number | null): string => {
  if (typeof sec !== 'number' || !isFinite(sec) || sec < 0) return '00:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const joinDir = (dir: string, name: string): string => {
  const sep = dir.includes('\\') ? '\\' : '/';
  const d = dir.endsWith(sep) ? dir.slice(0, -1) : dir;
  return `${d}${sep}${name}`;
};
// parent directory of a path (segments_dir's parent == the whole-file output dir)
const parentOf = (dir: string): string => {
  const sep = dir.includes('\\') ? '\\' : '/';
  const d = dir.endsWith(sep) ? dir.slice(0, -1) : dir;
  const i = d.lastIndexOf(sep);
  return i > 0 ? d.slice(0, i) : d;
};

const PcVideoExtractPage: React.FC = () => {
  // --- persistent run/progress/snapshot/mapping/sync state (survives nav) - #
  // Lifted into PcVideoExtractContext (mounted above the routes) so navigating
  // away and back — or a full reload — re-attaches to the still-running backend
  // task instead of resetting. See PcVideoExtractContext for the design.
  const {
    taskId, busy, paused, progress, snapshot, output, mapping, segmentsDir,
    syncing, syncingAll, syncProgress, filling, fillProgress,
    autoSync, setAutoSync, notice, setNotice,
    corrLanguages, setCorrLanguages,
    start: startRun, preview: previewRun, stop, togglePause, syncSource, syncAll,
    fillLanguages,
  } = usePcVideoExtract();

  // --- multi-language correspondence selection (spec §12) ---------------- #
  // Local checkbox state mirrored into the context (which the segments fetch +
  // sync RPCs read). The recognition language (`options.lang`) is the locked
  // primary: auto-checked and not removable. >=1 required to sync.
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(corrLanguages.length ? corrLanguages : ['en', 'zh']));
  // Display grain for the per-cue correspondence (cue = one source line; sentence
  // = merged + re-split). When cues carry a `grain` field the view filters to it.
  const [corrGrain, setCorrGrain] = useState<'cue' | 'sentence'>('sentence');

  // --- history / sources ------------------------------------------------- #
  const [baseDir, setBaseDir] = useState(DEFAULT_BASE);
  const [entries, setEntries] = useState<VideoExtractEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unreachable, setUnreachable] = useState(false);

  // --- add dialog -------------------------------------------------------- #
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<VideoExtractMode>('folder');
  const [addPath, setAddPath] = useState(DEFAULT_BASE);

  // --- options ----------------------------------------------------------- #
  const [options, setOptions] = useState<VideoExtractOptions>(DEFAULT_OPTIONS);
  const optionsHydrated = useRef(false);
  // Hydrate the Laravel-sync language multi-select from last_options exactly
  // once (first history load) so later refreshes never clobber the live choice.
  const langsHydrated = useRef(false);

  // --- backend capabilities ---------------------------------------------- #
  const [allModels, setAllModels] = useState<string[]>(FALLBACK_ALL_MODELS);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<WhisperLanguage[]>(FALLBACK_LANGS);
  const [defaultModel, setDefaultModel] = useState('auto');
  const [browsing, setBrowsing] = useState(false);
  const [allExtensions, setAllExtensions] = useState<string[]>(FALLBACK_EXTS);
  const extsHydrated = useRef(false);

  // --- segment ↔ subtitle map selection (page-local UI) ------------------ #
  // The mapping data + segmentsDir come from the context; only the click-to-
  // highlight selection and the scroll refs are page-local.
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [selectedSubSeg, setSelectedSubSeg] = useState<number | null>(null);
  const segRefs = useRef<Record<number, HTMLLIElement | null>>({});

  // --- live system resources --------------------------------------------- #
  const [resources, setResources] = useState<SystemResources | null>(null);

  const refreshResources = useCallback(() => {
    pycoreApi.getSystemResources()
      .then((r) => {
        if (r && typeof r.cpu_percent === 'number' && r.mem) {
          setResources({ cpu_percent: r.cpu_percent, mem: r.mem, gpus: r.gpus || [] });
        }
      })
      .catch(() => { /* not ready */ });
  }, []);

  // --- ws status (live log lives in the global PcFloatingLog) ------------- #
  const [wsConnected, setWsConnected] = useState(false);

  // --- load history ------------------------------------------------------ #
  const loadHistory = useCallback(async () => {
    try {
      const r = await pycoreApi.getVideoExtractHistory();
      setUnreachable(false);
      if (!r?.success) return;
      if (r.base_dir) { setBaseDir(r.base_dir); setAddPath((p) => (p === DEFAULT_BASE ? r.base_dir : p)); }
      const list = Array.isArray(r.entries) ? r.entries : [];
      setEntries(list);
      setSelected((prev) => new Set([...prev].filter((p) => list.some((e) => e.path === p))));
      const lo = (r.last_options || {}) as Partial<VideoExtractOptions>;
      setOptions((prev) => ({
        subtitle: typeof lo.subtitle === 'boolean' ? lo.subtitle : prev.subtitle,
        model: typeof lo.model === 'string' ? lo.model : prev.model,
        formats: Array.isArray(lo.formats) && lo.formats.length ? lo.formats : prev.formats,
        lang: typeof lo.lang === 'string' ? lo.lang : prev.lang,
        extensions: Array.isArray(lo.extensions) ? lo.extensions : prev.extensions,
        subtitle_source: (lo.subtitle_source === 'whisper' || lo.subtitle_source === 'api_first')
          ? lo.subtitle_source : (prev.subtitle_source ?? 'api_first'),
        target_languages: (Array.isArray(lo.target_languages) && lo.target_languages.length)
          ? lo.target_languages : prev.target_languages,
      }));
      if (Array.isArray(lo.extensions) && lo.extensions.length) extsHydrated.current = true;
      // Hydrate the Laravel-sync language multi-select from persisted
      // target_languages (fall back to en+zh) — but only once, on first load,
      // so a later refresh doesn't clobber the user's live selection.
      if (!langsHydrated.current) {
        const tl = (Array.isArray(lo.target_languages) && lo.target_languages.length)
          ? lo.target_languages : ['en', 'zh'];
        setSelectedLangs(new Set(tl));
        langsHydrated.current = true;
      }
      optionsHydrated.current = true;
    } catch {
      setUnreachable(true);
    }
  }, []);

  // --- load backend capabilities ----------------------------------------- #
  const loadCaps = useCallback(async () => {
    try {
      const c = await pycoreApi.getVideoExtractCapabilities();
      if (Array.isArray(c?.all_models) && c.all_models.length) setAllModels(c.all_models);
      if (Array.isArray(c?.installed_models)) setInstalledModels(c.installed_models);
      if (Array.isArray(c?.languages) && c.languages.length) setLanguages(c.languages);
      if (c?.default_model) setDefaultModel(c.default_model);
      if (Array.isArray(c?.extensions) && c.extensions.length) setAllExtensions(c.extensions);
      if (!extsHydrated.current) {
        const def = Array.isArray(c?.default_extensions) && c.default_extensions.length
          ? c.default_extensions
          : (Array.isArray(c?.extensions) ? c.extensions : FALLBACK_EXTS);
        setOptions((o) => (o.extensions && o.extensions.length ? o : { ...o, extensions: def }));
        extsHydrated.current = true;
      }
    } catch {
      /* offline — keep fallbacks */
    }
  }, []);

  // Load on mount AND every time the backend (re)connects (startup race fix).
  useEffect(() => { loadHistory(); loadCaps(); }, [loadHistory, loadCaps, wsConnected]);

  // WS: connect + mirror status (reload-on-reconnect, offline banner). The live
  // log itself is now the global PcFloatingLog (PcLiveProvider buffers it).
  useEffect(() => {
    connectPycoreWs();
    const offStatus = onWsStatus(setWsConnected);
    return () => { offStatus(); };
  }, []);

  useEffect(() => { refreshResources(); }, [refreshResources]);
  useTopicDrivenRefresh(
    ['video_extract_sync', 'operation.changed'],
    refreshResources,
    { fallbackMs: 30_000 },
  );

  // Reset the click-to-highlight selection whenever the current file (and thus
  // its segments dir) changes. The mapping data itself is fetched/polled by the
  // context; this only manages page-local selection.
  useEffect(() => {
    setSelectedSub(null);
    setSelectedSubSeg(null);
  }, [segmentsDir]);

  // Resolve 'auto'/uninstalled model → largest installed concrete model.
  useEffect(() => {
    if (!optionsHydrated.current || installedModels.length === 0) return;
    const best = installedModels.includes(defaultModel)
      ? defaultModel
      : installedModels[installedModels.length - 1];
    if (options.model === 'auto' || !installedModels.includes(options.model)) {
      setOptions((o) => ({ ...o, model: best }));
    }
  }, [installedModels, defaultModel, options.model]);

  // Persist options on change (skip initial hydration). `auto_sync` (context
  // state, hydrated there from last_options/localStorage) rides the same
  // options record so it round-trips via getVideoExtractHistory().last_options
  // — a separate `{auto_sync}`-only write could clobber the other options.
  useEffect(() => {
    if (!optionsHydrated.current) return;
    pycoreApi.setVideoExtractOptions(
      { ...options, auto_sync: autoSync } as Partial<VideoExtractOptions>,
    ).catch(() => { /* offline */ });
  }, [options, autoSync]);

  // --- native OS folder/file picker -------------------------------------- #
  const browse = async () => {
    setBrowsing(true);
    try {
      const r = await pycoreApi.pickPath(addMode, addPath || baseDir || DEFAULT_BASE);
      if (r?.success && r.path) setAddPath(r.path);
      else if (r?.canceled) { /* keep current */ }
      else setNotice(r?.error || 'Native picker unavailable — type the path manually');
    } catch {
      setNotice('Native picker unavailable — type the path manually');
    } finally { setBrowsing(false); }
  };

  // --- add / remove ------------------------------------------------------ #
  const confirmAdd = async () => {
    const p = addPath.trim();
    if (!p) { setNotice('Enter a path'); return; }
    try {
      const r = await pycoreApi.addVideoExtractEntry(p, addMode);
      if (r?.success) {
        if (Array.isArray(r.entries)) setEntries(r.entries);
        else await loadHistory();
        setShowAdd(false);
        setAddPath(baseDir || DEFAULT_BASE);
        setNotice('Source added');
      } else {
        setNotice(r?.error || 'Failed to add');
      }
    } catch (e: any) {
      setUnreachable(true);
      setNotice('Add failed: ' + (e?.message || 'pycore unreachable'));
    }
  };

  const removeEntry = async (path: string) => {
    try {
      const r = await pycoreApi.removeVideoExtractEntry(path);
      if (r?.success && Array.isArray(r.entries)) setEntries(r.entries);
      else await loadHistory();
      setSelected((prev) => { const n = new Set(prev); n.delete(path); return n; });
    } catch (e: any) { setNotice('Request failed: ' + (e?.message || '')); }
  };

  const toggleSelect = (path: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === entries.length ? new Set() : new Set(entries.map((e) => e.path))));
  };

  const activePaths = (): string[] =>
    entries.filter((e) => selected.has(e.path)).map((e) => e.path);

  // --- language multi-select: locked primary + mirror to context --------- #
  const LANG_CODES = WF_SUPPORTED_LANGUAGES.map((l) => l.code);
  const LANG_CODE_SET = new Set(LANG_CODES);
  // The recognition language is the locked primary (codes only; fallback 'en').
  const lockedLang = (options.lang && LANG_CODE_SET.has(options.lang)) ? options.lang : 'en';
  const langName = (code: string): string =>
    WF_SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();
  // Stable, code-ordered list of the checked languages (never names).
  const selectedLangList = (): string[] => LANG_CODES.filter((c) => selectedLangs.has(c));

  // Resolve one cue's text for a language column: prefer the v3 correspondence
  // slot `langs[code]`; for a legacy single-language cue (no `langs`) fall back
  // to the flat `text` under the primary (locked) language only.
  const cueLangText = (sub: { text: string; langs?: Record<string, string | null> }, code: string): string | null => {
    if (sub.langs) return sub.langs[code] ?? null;
    return code === lockedLang ? (sub.text || null) : null;
  };
  const grainLabel = (g?: string): string => (g === 'cue' ? L.veGrainCue : L.veGrainSentence);

  // Keep the locked primary checked whenever the recognition language changes,
  // and mirror the checked set into the context (segments fetch + sync RPCs).
  useEffect(() => {
    setSelectedLangs((prev) => (prev.has(lockedLang) ? prev : new Set(prev).add(lockedLang)));
  }, [lockedLang]);
  useEffect(() => {
    const list = selectedLangList();
    setCorrLanguages(list);
    // Persist the selection into options.target_languages so it round-trips via
    // the existing setVideoExtractOptions effect (last_options.target_languages).
    setOptions((o) => (
      JSON.stringify(o.target_languages ?? []) === JSON.stringify(list)
        ? o : { ...o, target_languages: list }
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLangs]);

  const toggleLang = (code: string) => {
    if (code === lockedLang) return;                 // primary is locked on
    setSelectedLangs((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      n.add(lockedLang);                             // never drop the primary
      return n;
    });
  };

  const reqBase = () => ({
    subtitle: options.subtitle,
    engine: 'faster-whisper',
    whisper_model: options.model,
    model: options.model,
    formats: options.formats.length ? options.formats : ['mp3'],
    lang: options.lang || 'en',
    extensions: options.extensions && options.extensions.length ? options.extensions : [],
    make_mp4: true,
    // primary subtitle track source (OpenSubtitles → Whisper, or always
    // Whisper); default 'api_first'. The backend reads config.subtitle_source.
    subtitle_source: (options.subtitle_source ?? 'api_first') as 'api_first' | 'whisper',
  });

  // --- preview / start --------------------------------------------------- #
  // These build the request from the page-local form, then hand the run
  // lifecycle to the context (which owns busy/progress/snapshot + polling).
  const preview = async () => {
    const paths = activePaths();
    if (!paths.length) { setNotice('Select at least one source first'); return; }
    await previewRun({ ...reqBase(), paths, path: paths[0] });
  };

  const start = async () => {
    const paths = activePaths();
    if (!paths.length) { setNotice('Select at least one source first'); return; }
    await startRun({ ...reqBase(), paths, path: paths[0] });
  };

  // stop / togglePause / syncSource come from the context (see usePcVideoExtract).

  // --- open a path in the OS file manager -------------------------------- #
  const openPath = async (kind: VideoExtractOpenKind, path?: string | null) => {
    const r = await pycoreApi.openVideoExtractPath(kind, path ?? undefined)
      .catch(() => ({ success: false }));
    if (!r.success) setNotice('Could not open path');
  };

  // Sources eligible for sync: the selected entries, else the run root (so there
  // is always at least one actionable target after a run completes).
  const syncTargets = (): string[] => {
    const sel = entries.filter((e) => selected.has(e.path)).map((e) => e.path);
    if (sel.length) return sel;
    const root = (snapshot?.root as string | undefined) || undefined;
    return root ? [root] : [];
  };

  const selectSubtitle = (subIdx: number, segIndex: number) => {
    setSelectedSub(subIdx);
    setSelectedSubSeg(segIndex);
    segRefs.current[segIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const currentSrc = (): string | undefined => {
    const cur = snapshot?.current;
    if (!cur) return undefined;
    const root = snapshot?.root;
    if (root && cur.rel) {
      const sep = root.includes('\\') ? '\\' : '/';
      const r = root.endsWith(sep) ? root.slice(0, -1) : root;
      return `${r}${sep}${cur.rel}`;
    }
    return cur.rel;
  };

  // --- styling helpers --------------------------------------------------- #
  const inputCls = 'text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none';
  const pill = (active: boolean, disabled = false) =>
    `px-3 py-1.5 text-xs font-bold rounded-lg transition ${
      disabled
        ? 'bg-slate-200/30 dark:bg-white/5 text-slate-400/60 dark:text-slate-600 line-through cursor-not-allowed'
        : active ? 'bg-rose-500 text-white' : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300'}`;

  const allSelected = entries.length > 0 && selected.size === entries.length;

  const [panelOpen, setPanelOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const allExtsSelected = allExtensions.length > 0 && (options.extensions || []).length >= allExtensions.length;
  const toggleAllExtensions = () => setOptions((o) => ({
    ...o,
    extensions: (o.extensions || []).length >= allExtensions.length ? [] : [...allExtensions],
  }));

  return (
    <div className="p-6 md:p-8 space-y-5">
      {/* header */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Clapperboard className="w-5 h-5 text-rose-500" /> Video Extract
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Extract audio + .srt (faster-whisper) from folders or single videos via the local pycore engine.
            </p>
          </div>
          <button onClick={() => { setAddPath(baseDir || DEFAULT_BASE); setShowAdd(true); }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 shrink-0">
            <Plus className="w-4 h-4" /> Add source
          </button>
        </div>

        {unreachable && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">pycore unreachable — the backend (:59000) may be offline. Showing the last known state.</span>
          </div>
        )}

        {/* sources list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Sources</h3>
            {entries.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> Select all
              </label>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Check the sources to act on, then preview or start.</p>

          {entries.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
              No sources yet — add a folder or a single video.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {entries.map((e) => (
                <li key={e.path}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    selected.has(e.path)
                      ? 'border-rose-500/50 bg-rose-500/5'
                      : 'border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]'}`}>
                  <input type="checkbox" checked={selected.has(e.path)} onChange={() => toggleSelect(e.path)} />
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                    e.mode === 'folder'
                      ? 'bg-sky-500/15 text-sky-500'
                      : 'bg-amber-500/15 text-amber-500'}`}>
                    {e.mode === 'folder' ? <Folder className="w-3 h-3" /> : <FileVideo className="w-3 h-3" />}
                    {e.mode === 'folder' ? 'Folder' : 'File'}
                  </span>
                  <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={e.path}>{e.path}</span>
                  <button onClick={() => removeEntry(e.path)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* action row */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <span title="Subtitles are always generated"
            className="px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 border bg-emerald-500/15 border-emerald-500/40 text-emerald-500 select-none">
            <Captions className="w-4 h-4" /> Subtitles · {options.lang || 'en'}
          </span>
          <button onClick={preview}
            className="px-4 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200">
            <Search className="w-4 h-4" /> Preview
          </button>
          {!busy ? (
            <button onClick={start}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1">
              <Play className="w-4 h-4 fill-current" /> Start
            </button>
          ) : (
            <>
              <button onClick={togglePause} disabled={!taskId}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 disabled:opacity-50">
                {paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button onClick={stop}
                className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1">
                <Square className="w-4 h-4" /> Stop
              </button>
            </>
          )}
          {snapshot?.output && (
            <button onClick={() => openPath('output', snapshot.output)}
              className="ml-auto px-4 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200">
              <FolderOpen className="w-4 h-4" /> Open output
            </button>
          )}
        </div>

        {notice && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{notice}</p>
        )}

        {progress && (
          <div className="mt-4">
            <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              {busy && !paused && <RefreshCw className="w-3 h-3 animate-spin" />}
              {paused && <Pause className="w-3 h-3" />}
              {progress.text} ({progress.pct}%)
            </div>

            {busy && snapshot?.current?.srt_pct != null && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Captions className="w-3 h-3" /> Subtitle progress
                  </span>
                  <span className="font-bold text-emerald-500">
                    {Math.round(Math.max(0, Math.min(100, snapshot.current.srt_pct)))}%
                  </span>
                </div>
                <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, snapshot.current.srt_pct))}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* rich run snapshot */}
        {snapshot && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-black/30 border border-slate-200/50 dark:border-white/5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <div className="text-slate-400 uppercase tracking-wide">Total</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  {snapshot.processed ?? 0}/{snapshot.total ?? '?'}
                  {snapshot.total ? ` (${Math.round(((snapshot.processed ?? 0) / snapshot.total) * 100)}%)` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wide">Elapsed</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{fmtDur(snapshot.elapsed_total)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wide">ETA</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{fmtDur(snapshot.eta)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wide">This file</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{fmtDur(snapshot.current?.file_elapsed)}</div>
              </div>
            </div>

            {snapshot.current && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                <div className="text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-slate-700 dark:text-slate-200">
                    <span className="text-slate-400">Current file:</span>{' '}
                    <span className="font-mono">{snapshot.current.rel}</span>
                  </span>
                  <span className="text-slate-500">
                    Source: {fmtMB(snapshot.current.src_size)}
                  </span>
                  {Array.isArray(snapshot.current.audios) && snapshot.current.audios.length > 0 && (
                    <span className="text-slate-500">
                      Output: {snapshot.current.audios.map((a) => fmtMB(a.size)).join(' + ')}
                      {snapshot.current.mp4 ? ' · mp4' : ''}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openPath('file', currentSrc())}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1">
                    <FileVideo className="w-3 h-3" /> Open file
                  </button>
                  <button onClick={() => openPath('file_dir', currentSrc())}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1">
                    <Folder className="w-3 h-3" /> Open file dir
                  </button>
                  <button onClick={() => openPath('file_output_dir', snapshot.current?.out_dir)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" /> Open output dir
                  </button>
                  <button onClick={() => openPath('subtitle', snapshot.current?.srt)}
                    disabled={!snapshot.current?.srt}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Captions className="w-3 h-3" /> Open subtitle
                  </button>
                </div>
                {Array.isArray(snapshot.current.flow) && snapshot.current.flow.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-white/5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                      <Wand2 className="w-3.5 h-3.5" /> {L.veFlowTitle}
                    </div>
                    <ul className="space-y-1">
                      {snapshot.current.flow.map((s: VeFlowStep, i: number) => {
                        const st = flowStyle(s.status);
                        return (
                          <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                            <span className={`mt-[5px] w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                            <span className="min-w-0">
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{s.label || s.step}</span>
                              {s.lang && <span className="ml-1 font-mono text-slate-400">[{s.lang}]</span>}
                              <span className={`ml-1.5 font-bold ${st.text}`}>{st.label}</span>
                              {s.provider && <span className="ml-1 text-slate-400">· {s.provider}</span>}
                              {s.detail && <span className="ml-1 text-slate-400 break-all">— {s.detail}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {output && (
          <pre className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200/50 dark:border-white/5 text-[11px] text-slate-700 dark:text-zinc-200 whitespace-pre-wrap max-h-60 overflow-auto font-mono">{output}</pre>
        )}
      </section>

      {/* Laravel media-sync: idempotent ingest of extracted outputs into
          Laravel. ALWAYS shown when there is anything to sync (sources or a
          run root) — not just after a run this session, so a reload can still
          re-sync. Buttons (not the section) are disabled while a run is busy
          or a sync is in flight. */}
      {(entries.length > 0 || !!snapshot?.root) && (
        <section className="pc-glass p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-rose-500" /> {L.veSyncLaravel}
            </h3>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
              {L.veAutoSync}
            </label>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">{L.veIdempotent}</p>
          <p className="text-[11px] text-slate-500 mb-3">
            Laravel endpoint: use the switcher in the top bar (also in Settings).
          </p>

          {/* language multi-select (>=1 required; recognition lang locked on) */}
          <div className="mb-3 rounded-2xl p-4 border bg-slate-100/60 dark:bg-black/20 border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5" /> {L.veLanguages}
                <span className="ml-1 normal-case font-normal text-slate-400">({selectedLangs.size} {L.veSelected})</span>
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">{L.veLanguagesHint}</p>
            <div className="flex flex-wrap gap-1.5">
              {WF_SUPPORTED_LANGUAGES.map((l) => {
                const on = selectedLangs.has(l.code);
                const locked = l.code === lockedLang;
                return (
                  <button key={l.code} type="button" onClick={() => toggleLang(l.code)} disabled={locked}
                    title={locked ? L.vePrimaryLang : l.name}
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
              <p className="mt-2 text-[11px] font-bold text-amber-500">{L.veNeedOneLang}</p>
            )}
          </div>

          {/* Step 1 — Fill languages: ensure every selected language has a
              `<stem>.<lang>.srt` sibling (OpenSubtitles when subtitle_source is
              'api_first' + credentialed, else AI-translated from the primary
              cues). Writes tracks locally; then Step 2 (Sync) submits them. */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <button onClick={() => fillLanguages(syncTargets(), selectedLangList(), options.subtitle_source ?? 'api_first')}
              disabled={busy || filling || syncingAll || syncing.size > 0 || selectedLangs.size === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {filling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {filling ? L.veFilling : L.veFill}
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {(options.subtitle_source ?? 'api_first') === 'api_first' ? 'API → AI' : 'AI only'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">{L.veFillHint}</p>

          {/* live fill progress (mirrors the sync progress UI) */}
          {fillProgress && (
            <div className="mb-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {L.veFillStage}: <span className="font-bold text-slate-700 dark:text-slate-200">{fillProgress.stage}</span>
                {fillProgress.total > 0 && <span className="text-slate-400">· {fillProgress.done}/{fillProgress.total}</span>}
                {fillProgress.detail && <span className="truncate text-slate-400" title={fillProgress.detail}>· {fillProgress.detail}</span>}
              </div>
              {fillProgress.total > 0 && (
                <div className="mt-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round((fillProgress.done / fillProgress.total) * 100))}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Step 2 — Submit: no path args → the backend syncs its full history
                of sources; the checked language set drives the per-cue
                correspondence ingest and auto-discovers the filled tracks. */}
            <button onClick={() => syncAll(undefined, selectedLangList())}
              disabled={busy || filling || syncingAll || syncing.size > 0 || selectedLangs.size === 0}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {syncingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {syncingAll ? L.veSyncing : L.veSyncAll}
            </button>
            {selectedLangs.size === 0 && (
              <span className="text-[11px] font-bold text-amber-500">{L.veNeedOneLang}</span>
            )}
          </div>
          <ul className="space-y-1.5">
            {syncTargets().map((p) => {
              const inFlight = syncing.has(p);
              return (
                <li key={p}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]">
                  <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={p}>{p}</span>
                  <button onClick={() => syncSource(p, selectedLangList())}
                    disabled={inFlight || busy || filling || syncingAll || selectedLangs.size === 0}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                    {inFlight ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    {inFlight ? L.veSyncing : L.veSyncLaravel}
                  </button>
                </li>
              );
            })}
          </ul>
          {syncProgress && (
            <div className="mt-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {L.veSyncStage}: <span className="font-bold text-slate-700 dark:text-slate-200">{syncProgress.stage}</span>
                {syncProgress.total > 0 && <span className="text-slate-400">· {syncProgress.done}/{syncProgress.total}</span>}
                {syncProgress.detail && <span className="truncate text-slate-400" title={syncProgress.detail}>· {syncProgress.detail}</span>}
              </div>
              {syncProgress.total > 0 && (
                <div className="mt-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-rose-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round((syncProgress.done / syncProgress.total) * 100))}%` }} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Segment ↔ subtitle map for the CURRENT file */}
      {segmentsDir && (
        <section className="pc-glass p-6">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Scissors className="w-4 h-4 text-rose-500" /> Segments
            </h3>
            <div className="flex items-center gap-2">
              {/* grain (cue / sentence) toggle for the correspondence display */}
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{L.veGrainLabel}:</span>
              {(['sentence', 'cue'] as const).map((g) => (
                <button key={g} type="button" onClick={() => setCorrGrain(g)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                    corrGrain === g
                      ? 'border-rose-500/60 bg-rose-500/10 text-rose-500'
                      : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300'}`}>
                  {g === 'cue' ? L.veGrainCue : L.veGrainSentence}
                </button>
              ))}
              {mapping && (
                <span className="text-[11px] font-bold text-slate-500 ml-1">
                  {mapping.segment_count} clip{mapping.segment_count === 1 ? '' : 's'} · {fmtDur(mapping.duration)}
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Click a cue to highlight its parent clip. Each cue shows every checked language side by side; blank = no correspondence.
          </p>

          {/* whole-file outputs (full mp4 / 2×2 mp4 / mp3 / srt) — these live in
              the output dir = parent of segments_dir. Render present ones as
              folder-open buttons; absent ones (null filename) are disabled. */}
          {mapping?.files && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">{L.veWholeFiles}:</span>
              {([
                { name: mapping.files.full_mp4, label: L.veFullClip, Icon: Film },
                { name: mapping.files.tiny_mp4, label: L.veTinyClip, Icon: Grid2x2 },
                { name: mapping.files.mp3, label: L.veAudioClip, Icon: Music },
                { name: mapping.files.srt, label: 'SRT', Icon: Captions },
                // Movie/TV poster (MOVIE_POSTER_PIPELINE.md §8): the poster.jpg
                // lives in the same output dir; opens its folder like the rest
                // (no local-file HTTP serving exists for an inline thumbnail).
                { name: mapping.files.poster, label: L.vePoster, Icon: ImageIcon },
              ] as Array<{ name?: string | null; label: string; Icon: typeof Film }>).map(({ name, label, Icon }) => (
                <button key={label}
                  onClick={() => name && openPath('file_dir', joinDir(parentOf(segmentsDir), name))}
                  disabled={!name}
                  title={name ? `${L.veOpenClipDir}: ${name}` : undefined}
                  className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          )}

          {!mapping || mapping.segments.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
              No segments yet.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[28rem] overflow-auto pr-1">
              {mapping.segments.map((seg) => {
                const highlighted = selectedSubSeg === seg.index;
                return (
                  <li key={seg.index}
                    ref={(el) => { segRefs.current[seg.index] = el; }}
                    className={`rounded-2xl border p-3 transition ${
                      highlighted
                        ? 'border-rose-500/70 bg-rose-500/10 ring-1 ring-rose-500/40'
                        : 'border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-rose-500/15 text-rose-500">
                        Clip {seg.index}
                      </span>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        {fmtClock(seg.start)}–{fmtClock(seg.end)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {seg.subtitle_count} subtitles
                      </span>
                      {highlighted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
                          <CornerDownRight className="w-3 h-3" /> in clip {seg.index}
                        </span>
                      )}
                      {/* per-segment clip variants: Full (full_mp4) / 2×2 (mp4) /
                          Audio (mp3). Each opens its folder; disabled when that
                          variant's filename is null (not produced for this clip). */}
                      <div className="ml-auto flex items-center gap-1.5">
                        {([
                          { name: (seg as SegWithFull).full_mp4, label: L.veFullClip, Icon: Film },
                          { name: seg.mp4, label: L.veTinyClip, Icon: Grid2x2 },
                          { name: seg.mp3, label: L.veAudioClip, Icon: Music },
                        ] as Array<{ name?: string | null; label: string; Icon: typeof Film }>).map(({ name, label, Icon }) => (
                          <button key={label}
                            onClick={() => name && openPath('file_dir', joinDir(segmentsDir, name))}
                            disabled={!name}
                            title={name ? `${L.veOpenClipDir}: ${name}` : undefined}
                            className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                            <Icon className="w-3 h-3" /> {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const cols = selectedLangList();
                      // When cues carry a `grain`, filter to the selected grain;
                      // legacy cues (no grain) are shown regardless.
                      const cues = seg.subtitles.filter((s) => !s.grain || s.grain === corrGrain);
                      if (cues.length === 0) return null;
                      return (
                        <ul className="mt-2 space-y-1">
                          {cues.map((sub) => {
                            const on = selectedSub === sub.idx && selectedSubSeg === seg.index;
                            return (
                              <li key={sub.idx}>
                                <button onClick={() => selectSubtitle(sub.idx, seg.index)}
                                  className={`w-full text-left flex gap-2 px-2 py-1.5 rounded-lg text-[11px] transition ${
                                    on
                                      ? 'bg-rose-500/20 text-slate-800 dark:text-slate-100'
                                      : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                                  <span className="shrink-0 font-mono text-slate-400">
                                    {fmtClock(sub.start)}
                                  </span>
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase self-start ${
                                    (sub.grain || corrGrain) === 'cue' ? 'bg-sky-500/15 text-sky-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                    {grainLabel(sub.grain || corrGrain)}
                                  </span>
                                  {/* every checked language side by side; blank where null */}
                                  <span className="flex-1 grid gap-0.5">
                                    {cols.map((c) => {
                                      const txt = cueLangText(sub, c);
                                      return (
                                        <span key={c} className="flex gap-1.5">
                                          <span className="shrink-0 font-mono uppercase text-[9px] text-slate-400 w-6 pt-0.5">{c}</span>
                                          <span className={`flex-1 break-words ${txt ? '' : 'text-slate-300 dark:text-slate-600 italic'}`}>
                                            {txt || L.veBlankCorr}
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Laravel backend data — optional, collapsible (collapsed by default):
          read-only view of what the media sync actually landed on laravel_main,
          so pycore↔Laravel cooperation can be verified without leaving the page. */}
      <PcLaravelMediaPanel />

      {/* Floating settings panel */}
      {!panelOpen && (
        <button type="button" onClick={() => setPanelOpen(true)} aria-label="Open settings"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 pl-2 pr-1.5 py-3 rounded-l-2xl bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/30 flex flex-col items-center gap-1.5 transition">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-wider" style={{ writingMode: 'vertical-rl' }}>Options</span>
        </button>
      )}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl border shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-white/10">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b backdrop-blur-xl border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><SlidersHorizontal className="w-4 h-4 text-rose-500" /> Options</h3>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Collapse to side"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-500/10 transition">
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">

              {/* system resources monitor */}
              <div className="pc-glass p-5">
                <button type="button" onClick={() => setShowResources((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider">
                  <span className="flex items-center gap-2"><Cpu className="w-4 h-4" /> Resources</span>
                  <span className="flex items-center gap-2 normal-case font-normal text-[11px] text-slate-500">
                    {resources && !showResources && <span>CPU {Math.round(resources.cpu_percent)}% · MEM {Math.round(resources.mem.percent)}%</span>}
                    {showResources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>
                {showResources && (resources ? (
                  <div className="space-y-3 mt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-500 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(resources.cpu_percent)}%</span>
                        </div>
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, resources.cpu_percent)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-500 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> Memory</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {fmtMB(resources.mem.used_mb * 1024 * 1024)} / {fmtMB(resources.mem.total_mb * 1024 * 1024)} ({Math.round(resources.mem.percent)}%)
                          </span>
                        </div>
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, resources.mem.percent)}%` }} />
                        </div>
                      </div>
                    </div>
                    {resources.gpus.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {resources.gpus.map((g) => (
                          <div key={g.index}>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-slate-500 flex items-center gap-1 truncate">
                                <MonitorSmartphone className="w-3 h-3 shrink-0" /> <span className="truncate" title={g.name}>GPU {g.index}: {g.name}</span>
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0 ml-2">
                                {Math.round(g.util_percent)}% · {fmtMB(g.mem_used_mb * 1024 * 1024)} / {fmtMB(g.mem_total_mb * 1024 * 1024)}
                              </span>
                            </div>
                            <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, g.util_percent)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-3">—</p>
                ))}
              </div>

              {/* options */}
              <div className="pc-glass p-5">
                <button type="button" onClick={() => setShowOptions((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">
                  <span>Options</span>
                  {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showOptions && (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 select-none opacity-90">
                    <input type="checkbox" checked readOnly disabled />
                    Generate subtitles <span className="text-[10px] font-bold text-emerald-500">· {options.lang || 'en'}</span>
                  </label>

                  {/* primary subtitle track source: OpenSubtitles → Whisper, or
                      always Whisper. Bound to options.subtitle_source (default
                      'api_first'); persisted via the setVideoExtractOptions effect. */}
                  <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">{L.veSubtitleSource}</span>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['api_first', L.veSrcApiFirst],
                        ['whisper', L.veSrcWhisper],
                      ] as ['api_first' | 'whisper', string][]).map(([val, label]) => (
                        <button key={val} type="button"
                          onClick={() => setOptions((o) => ({ ...o, subtitle_source: val }))}
                          className={pill((options.subtitle_source ?? 'api_first') === val)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">{L.veSubtitleSourceHint}</p>
                  </div>

                  <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Whisper model</span>
                    <div className="flex flex-wrap gap-2">
                      {allModels.map((m) => {
                        const installed = installedModels.includes(m);
                        return (
                          <button key={m} type="button" disabled={!installed}
                            title={installed ? undefined : 'Not installed'}
                            onClick={() => installed && setOptions((o) => ({ ...o, model: m }))}
                            className={pill(options.model === m, !installed)}>
                            {m}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Only installed models are selectable.</p>
                  </div>

                  <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Audio formats</span>
                    <div className="flex flex-wrap gap-2">
                      {FORMATS.map((f) => {
                        const on = options.formats.includes(f);
                        return (
                          <button key={f}
                            onClick={() => setOptions((o) => ({
                              ...o,
                              formats: on ? o.formats.filter((x) => x !== f) : [...o.formats, f],
                            }))}
                            className={pill(on)}>{f}</button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">File extensions</span>
                      <button type="button" onClick={toggleAllExtensions}
                        className="text-[11px] font-bold flex items-center gap-1 text-sky-500 hover:text-sky-400 transition">
                        <ListChecks className="w-3.5 h-3.5" /> {allExtsSelected ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allExtensions.map((ext) => {
                        const on = (options.extensions || []).includes(ext);
                        return (
                          <button key={ext} type="button"
                            onClick={() => setOptions((o) => {
                              const cur = o.extensions || [];
                              return {
                                ...o,
                                extensions: on ? cur.filter((x) => x !== ext) : [...cur, ext],
                              };
                            })}
                            className={pill(on)}>{ext}</button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Only matching files are processed (empty = all).</p>
                  </div>

                  <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Language</span>
                    <select value={options.lang}
                      onChange={(e) => setOptions((o) => ({ ...o, lang: e.target.value }))}
                      className={`${inputCls} w-56`}>
                      {languages.map((l) => (
                        <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* add dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-3xl p-6 border bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><Plus className="w-4 h-4 text-rose-500" /> Add source</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setAddMode('folder')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'folder'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <Folder className="w-5 h-5" /> Folder
              </button>
              <button onClick={() => setAddMode('file')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'file'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <FileVideo className="w-5 h-5" /> Single file
              </button>
            </div>

            <label className="block text-[11px] text-slate-500 mb-1">Path</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={addPath} autoFocus
                onChange={(e) => setAddPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); }}
                placeholder={baseDir || DEFAULT_BASE}
                className={`${inputCls} flex-1`} />
              <button onClick={browse} disabled={browsing}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-slate-200 transition flex items-center gap-1 shrink-0 disabled:opacity-50">
                {browsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                Browse
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-5">
              {addMode === 'folder' ? 'Pick a folder to scan recursively for videos.' : 'Pick a single video file.'}
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                Cancel
              </button>
              <button onClick={confirmAdd}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PcVideoExtractPage;
