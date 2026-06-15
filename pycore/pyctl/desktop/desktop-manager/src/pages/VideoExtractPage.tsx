import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Clapperboard, Search, Play, RefreshCw, Square, Plus, Trash2, X,
  Folder, FileVideo, Terminal, Wifi, WifiOff, FolderOpen,
  Pause, Cpu, MemoryStick, Gpu, Captions, ChevronDown, ChevronUp, ListChecks,
  SlidersHorizontal, PanelRightClose, Scissors, CornerDownRight,
  UploadCloud, Film, Grid2x2, Music,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useLive } from '../state/LiveContext';
import { pycoreApi } from '../api/pycore';
import { callRpc, subscribeWs } from '../api/ws';
import type {
  VideoExtractEntry, VideoExtractMode, VideoExtractOptions, WhisperLanguage,
  SystemResources, VideoExtractSnapshot, VideoExtractOpenKind, VideoExtractMapping,
} from '../types';

const VE = '/api/local/video-extract';
const DEFAULT_BASE = 'D:\\.tmp';
// Sync RPCs ingest a whole source (thousands of sentence rows + clip uploads)
// in one call — far beyond callRpc's 30s default. 10 minutes covers worst-case
// syncs; progress still streams live via the video_extract_sync event.
const SYNC_RPC_TIMEOUT_MS = 600_000;

// Fallbacks used only until the backend capabilities load (or if it fails).
// Full catalog shown even before caps load / when backend is offline (mirrors
// the backend's WHISPER_MODEL_CANDIDATES). Non-installed ones render disabled.
const FALLBACK_ALL_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3', 'turbo'];
const FALLBACK_LANGS: WhisperLanguage[] = [{ code: 'en', name: 'English' }];
const FORMATS = ['mp3', 'opus', 'aac', 'vorbis'];
const FALLBACK_EXTS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv'];

const DEFAULT_OPTIONS: VideoExtractOptions = {
  subtitle: true, model: 'auto', formats: ['mp3'], lang: 'en', extensions: [],
};

// bytes (number) -> "12.3 MB"; tolerant of undefined/null.
const fmtMB = (bytes?: number | null): string => {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '-';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
// seconds -> "1m 05s" / "12s"
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
// seconds -> "mm:ss" (clock form, for segment/subtitle time ranges)
const fmtClock = (sec?: number | null): string => {
  if (typeof sec !== 'number' || !isFinite(sec) || sec < 0) return '00:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
// join a directory with a filename using the dir's own separator
const joinDir = (dir: string, name: string): string => {
  const sep = dir.includes('\\') ? '\\' : '/';
  const d = dir.endsWith(sep) ? dir.slice(0, -1) : dir;
  return `${d}${sep}${name}`;
};
// parent directory of a path (segments_dir's parent == the output dir)
const parentOf = (dir: string): string => {
  const sep = dir.includes('\\') ? '\\' : '/';
  const d = dir.endsWith(sep) ? dir.slice(0, -1) : dir;
  const i = d.lastIndexOf(sep);
  return i > 0 ? d.slice(0, i) : d;
};

export default function VideoExtractPage() {
  const { settings, t, toast } = useApp();
  const { logs, wsConnected, clearLogs } = useLive();
  const dark = settings.theme === 'dark';

  // --- history / sources ------------------------------------------------- #
  const [baseDir, setBaseDir] = useState(DEFAULT_BASE);
  const [entries, setEntries] = useState<VideoExtractEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- add dialog -------------------------------------------------------- #
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<VideoExtractMode>('folder');
  const [addPath, setAddPath] = useState(DEFAULT_BASE);

  // --- options ----------------------------------------------------------- #
  const [options, setOptions] = useState<VideoExtractOptions>(DEFAULT_OPTIONS);
  const optionsHydrated = useRef(false);

  // --- backend capabilities (full catalog + installed set + languages) ---- #
  // allModels = every candidate model (shown); installedModels = the selectable
  // subset (the rest render disabled). 'auto' is always selectable.
  const [allModels, setAllModels] = useState<string[]>(FALLBACK_ALL_MODELS);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [languages, setLanguages] = useState<WhisperLanguage[]>(FALLBACK_LANGS);
  const [defaultModel, setDefaultModel] = useState('auto');
  const [browsing, setBrowsing] = useState(false);

  // supported video extensions + the user-selected filter (default-checked set)
  const [allExtensions, setAllExtensions] = useState<string[]>(FALLBACK_EXTS);
  const extsHydrated = useRef(false);

  // --- run state --------------------------------------------------------- #
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ pct: number; text: string } | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<VideoExtractSnapshot | null>(null);
  const pollRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // --- segment ↔ subtitle map for the CURRENT file ----------------------- #
  const [mapping, setMapping] = useState<VideoExtractMapping | null>(null);
  // currently-selected subtitle idx (to highlight its parent segment) + which
  // segment index that subtitle belongs to.
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [selectedSubSeg, setSelectedSubSeg] = useState<number | null>(null);
  const segMapPollRef = useRef<number | null>(null);
  const segRefs = useRef<Record<number, HTMLLIElement | null>>({});

  // --- Laravel media sync (after a run completes) ------------------------ #
  // Did a run start this session? Gates the sync prompt so it only shows once a
  // run has been started + finished (not on a fresh page with no run).
  const [ranThisSession, setRanThisSession] = useState(false);
  // per-source-path in-flight syncing flag
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  // live sync progress per-source: stage label + done/total + detail
  const [syncProgress, setSyncProgress] = useState<{ stage: string; done: number; total: number; detail: string } | null>(null);

  // --- live system resources --------------------------------------------- #
  const [resources, setResources] = useState<SystemResources | null>(null);
  const resPollRef = useRef<number | null>(null);

  // --- load history ------------------------------------------------------ #
  const loadHistory = useCallback(async () => {
    try {
      const r = await pycoreApi.getVideoExtractHistory();
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
      }));
      if (Array.isArray(lo.extensions) && lo.extensions.length) extsHydrated.current = true;
      optionsHydrated.current = true;
    } catch (e) {
      // Don't swallow: surface the exact endpoint + error. Most often this is the
      // worker (:59000) not up yet on first paint — the reconnect effect retries.
      console.error('[VideoExtract] history load failed (GET /pyapi/api/local/user-data/video-extract):', e);
    }
  }, []);

  // --- load backend capabilities (all models shown; installed selectable) - #
  const loadCaps = useCallback(async () => {
    try {
      const c = await pycoreApi.getVideoExtractCapabilities();
      if (Array.isArray(c?.all_models) && c.all_models.length) setAllModels(c.all_models);
      if (Array.isArray(c?.installed_models)) setInstalledModels(c.installed_models);
      if (Array.isArray(c?.languages) && c.languages.length) setLanguages(c.languages);
      if (c?.default_model) setDefaultModel(c.default_model);
      if (Array.isArray(c?.extensions) && c.extensions.length) setAllExtensions(c.extensions);
      // Default-check the backend's default_extensions, once, unless the saved
      // options already supplied a non-empty filter.
      if (!extsHydrated.current) {
        const def = Array.isArray(c?.default_extensions) && c.default_extensions.length
          ? c.default_extensions
          : (Array.isArray(c?.extensions) ? c.extensions : FALLBACK_EXTS);
        setOptions((o) => (o.extensions && o.extensions.length ? o : { ...o, extensions: def }));
        extsHydrated.current = true;
      }
    } catch (e) {
      console.error('[VideoExtract] capabilities load failed (GET /pyapi/api/local/video-extract/capabilities):', e);
    }
  }, []);

  // Load on mount AND every time the backend (re)connects. Fixes the startup race
  // where the worker (:59000) isn't ready on first paint: the initial fetch fails,
  // and when the live WS connects we reload so saved sources actually appear (and
  // adds work) instead of the UI silently sitting on defaults.
  useEffect(() => { loadHistory(); loadCaps(); }, [loadHistory, loadCaps, wsConnected]);
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (resPollRef.current) clearInterval(resPollRef.current);
    if (segMapPollRef.current) clearInterval(segMapPollRef.current);
  }, []);

  // --- live segment ↔ subtitle map -------------------------------------- #
  // Re-fetch the current file's mapping whenever segments_dir changes, and (while
  // busy) every few seconds so the panel grows as clips/subtitles are produced.
  const segmentsDir = snapshot?.current?.segments_dir ?? null;
  useEffect(() => {
    if (segMapPollRef.current) { clearInterval(segMapPollRef.current); segMapPollRef.current = null; }
    if (!segmentsDir) { setMapping(null); setSelectedSub(null); setSelectedSubSeg(null); return; }
    const fetchMap = () => {
      pycoreApi.getVideoExtractSegments(segmentsDir)
        .then((r) => { if (r?.success && r.mapping) setMapping(r.mapping); })
        .catch(() => { /* keep last mapping; retry next tick */ });
    };
    fetchMap();
    // poll only while a run is active — once done the mapping is stable
    if (busy) segMapPollRef.current = window.setInterval(fetchMap, 3000);
    return () => { if (segMapPollRef.current) { clearInterval(segMapPollRef.current); segMapPollRef.current = null; } };
  }, [segmentsDir, busy]);

  // --- live Laravel-sync progress events -------------------------------- #
  // The backend broadcasts `video_extract_sync` on the rpc_v2 bus during an
  // ingest. We mirror it into a small progress line + toast on done/error.
  useEffect(() => subscribeWs('video_extract_sync', (d: any) => {
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
        s.segments != null ? `${s.segments} segments` : null,
        s.clips != null ? `${s.clips} clips` : null,
      ].filter(Boolean).join(' · ');
      toast(`${t.veSyncDone}${parts ? ' — ' + parts : ''}`, 'success');
      setSyncing(new Set());
      setSyncProgress(null);
    } else if (stage === 'error') {
      const errs = Array.isArray(d?.errors) ? d.errors.join('; ') : '';
      toast(`${t.veSyncFailed}${d?.detail ? ': ' + d.detail : errs ? ': ' + errs : ''}`, 'error');
      setSyncing(new Set());
      setSyncProgress(null);
    }
  }), [t]);

  // Poll live system resources (~1.5s) only while this page is mounted.
  useEffect(() => {
    const tick = () => {
      pycoreApi.getSystemResources()
        .then((r) => {
          if (r && typeof r.cpu_percent === 'number' && r.mem) {
            setResources({ cpu_percent: r.cpu_percent, mem: r.mem, gpus: r.gpus || [] });
          }
        })
        .catch(() => { /* backend not ready — try again next tick */ });
    };
    tick();
    resPollRef.current = window.setInterval(tick, 1500);
    return () => { if (resPollRef.current) clearInterval(resPollRef.current); };
  }, []);

  // "Auto-select best" resolves to a CONCRETE model the user can see — the largest
  // installed one — never an opaque 'auto'. installedModels is ascending by
  // capability, so its last item is the largest; the backend's default_model is the
  // same value. We resolve whenever the current pick is 'auto' or not installed, so
  // the largest installed model ends up highlighted and is what actually runs.
  useEffect(() => {
    if (!optionsHydrated.current || installedModels.length === 0) return;
    const best = installedModels.includes(defaultModel)
      ? defaultModel
      : installedModels[installedModels.length - 1];
    if (options.model === 'auto' || !installedModels.includes(options.model)) {
      setOptions((o) => ({ ...o, model: best }));
    }
  }, [installedModels, defaultModel, options.model]);

  // persist options on change (skip the initial hydration)
  useEffect(() => {
    if (!optionsHydrated.current) return;
    pycoreApi.setVideoExtractOptions(options).catch((e) => {
      console.error('[VideoExtract] options save failed (POST /pyapi/api/local/user-data/video-extract/options):', e);
    });
  }, [options]);

  // auto-scroll the live log to the newest line
  useEffect(() => { logEndRef.current?.scrollIntoView({ block: 'end' }); }, [logs]);

  // --- native OS folder/file picker -------------------------------------- #
  const browse = async () => {
    setBrowsing(true);
    try {
      const r = await pycoreApi.pickPath(addMode, addPath || baseDir || DEFAULT_BASE);
      if (r?.success && r.path) setAddPath(r.path);
      else if (r?.canceled) { /* user dismissed: keep current path */ }
      else toast(r?.error || 'Native picker unavailable — type the path manually', 'info');
    } catch {
      toast('Native picker unavailable — type the path manually', 'info');
    } finally { setBrowsing(false); }
  };

  // --- add / remove ------------------------------------------------------ #
  const confirmAdd = async () => {
    const p = addPath.trim();
    if (!p) { toast('Enter a path', 'error'); return; }
    try {
      const r = await pycoreApi.addVideoExtractEntry(p, addMode);
      if (r?.success) {
        if (Array.isArray(r.entries)) setEntries(r.entries);
        else await loadHistory();
        setShowAdd(false);
        setAddPath(baseDir || DEFAULT_BASE);
        toast('Source added', 'success');
      } else {
        console.error('[VideoExtract] add rejected by backend:', r);
        toast(r?.error || 'Failed to add', 'error');
      }
    } catch (e: any) {
      console.error('[VideoExtract] add failed (POST /pyapi/api/local/user-data/video-extract/add):', e);
      toast('Add failed: ' + e.message, 'error');
    }
  };

  const removeEntry = async (path: string) => {
    try {
      const r = await pycoreApi.removeVideoExtractEntry(path);
      if (r?.success && Array.isArray(r.entries)) setEntries(r.entries);
      else await loadHistory();
      setSelected((prev) => { const n = new Set(prev); n.delete(path); return n; });
    } catch (e: any) { toast('Request failed: ' + e.message, 'error'); }
  };

  const toggleSelect = (path: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === entries.length ? new Set() : new Set(entries.map((e) => e.path))));
  };

  // Act on the SELECTED sources only. No silent "none = all" fallback: if nothing
  // is checked the callers show a toast and bail (see start/preview).
  const activePaths = (): string[] =>
    entries.filter((e) => selected.has(e.path)).map((e) => e.path);

  const reqBase = () => ({
    subtitle: options.subtitle,
    engine: 'faster-whisper',
    // The backend request field is `whisper_model` — send it under that name so the
    // UI's model choice actually applies (a bare `model` is ignored by the schema).
    whisper_model: options.model,
    model: options.model,
    formats: options.formats.length ? options.formats : ['mp3'],
    lang: options.lang || 'en',
    // selected extension filter; omit when empty so the backend treats it as "all"
    extensions: options.extensions && options.extensions.length ? options.extensions : [],
    make_mp4: true,
  });

  // --- preview / start / stop ------------------------------------------- #
  const preview = async () => {
    const paths = activePaths();
    if (!paths.length) { toast(t.veSelectFirst, 'error'); return; }
    setOutput('Scanning...');
    try {
      const r: any = await pycoreApi.pyPost(`${VE}/preview`, { ...reqBase(), paths, path: paths[0], dry_run: true });
      if (!r.success) { setOutput(`Error: ${r.error}`); return; }
      setOutput(`${r.count} video(s) · ffmpeg ${r.ffmpeg_found ? 'OK' : 'missing'} · ${r.engine}/${r.model}/${r.device}\n` +
        (r.videos || []).slice(0, 50).map((v: string) => '  • ' + v).join('\n'));
    } catch (e: any) { setOutput('Request failed: ' + e.message); }
  };

  const start = async () => {
    const paths = activePaths();
    if (!paths.length) { toast(t.veSelectFirst, 'error'); return; }
    setBusy(true); setPaused(false); setSnapshot(null); setRanThisSession(true);
    setProgress({ pct: 0, text: 'starting' });
    const r: any = await pycoreApi.pyPost(`${VE}/start`, { ...reqBase(), paths, path: paths[0] })
      .catch((e: any) => ({ success: false, error: e?.message || 'request failed' }));
    if (!r.success || !r.task_id) {
      toast(r.error || 'Failed', 'error'); setBusy(false); return;
    }
    const tid = r.task_id;
    setTaskId(tid);
    pollRef.current = window.setInterval(() => {
      pycoreApi.pyGet<any>(`${VE}/tasks/${tid}`)
        .then((tr: any) => {
          if (!tr?.success || !tr.task) return;
          const task = tr.task;
          const snap: VideoExtractSnapshot = task.result || {};
          setSnapshot(snap);
          const rel = snap.current?.rel;
          setProgress({
            pct: task.progress || 0,
            text: `${task.status} ${snap.processed ?? 0}/${snap.total ?? '?'}${rel ? ' · ' + rel : ''}`,
          });
          if (task.status === 'completed' || task.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setBusy(false); setPaused(false);
            const s = snap.stats || {};
            setOutput(`Done. ${snap.processed ?? 0}/${snap.total ?? 0} · srt ${s.srt_done ?? 0} new/${s.srt_skip ?? 0} skip · output: ${snap.output ?? '-'}`);
            toast('Video extraction finished', 'success');
          }
        })
        .catch(() => { /* keep polling */ });
    }, 2000);
  };

  const stop = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (taskId) {
      // best-effort cancel on the backend (endpoint may not exist — ignore failure)
      pycoreApi.cancelVideoExtractTask(taskId).catch(() => { /* optional */ });
    }
    setBusy(false); setPaused(false); setProgress(null);
    toast('Stopped polling', 'info');
  };

  // --- pause / resume ---------------------------------------------------- #
  const togglePause = async () => {
    if (!taskId) return;
    if (paused) {
      const r = await pycoreApi.resumeVideoExtractTask(taskId).catch(() => ({ success: false }));
      if (r.success) { setPaused(false); toast(t.veResumed, 'info'); }
      else toast('Resume failed', 'error');
    } else {
      const r = await pycoreApi.pauseVideoExtractTask(taskId).catch(() => ({ success: false }));
      if (r.success) { setPaused(true); toast(t.vePaused, 'info'); }
      else toast('Pause failed', 'error');
    }
  };

  // --- open a path in the OS file manager -------------------------------- #
  const openPath = async (kind: VideoExtractOpenKind, path?: string | null) => {
    const r = await pycoreApi.openVideoExtractPath(kind, path ?? undefined)
      .catch(() => ({ success: false }));
    if (!r.success) toast(t.veOpenFailed, 'error');
  };

  // --- sync a scanned source's outputs into Laravel (over the rpc_v2 WS) -- #
  const syncSource = (sourcePath: string) => {
    if (!sourcePath || syncing.has(sourcePath)) return;
    setSyncing((prev) => new Set(prev).add(sourcePath));
    setSyncProgress({ stage: 'scan', done: 0, total: 0, detail: '' });
    callRpc('video_extract.sync_source', { source_path: sourcePath }, SYNC_RPC_TIMEOUT_MS)
      .catch((e: any) => {
        // RPC unavailable / rejected — surface and clear in-flight state. The
        // progress events handle the happy path (done/error toasts).
        toast(`${t.veSyncFailed}: ${e?.message || 'RPC failed'}`, 'error');
        setSyncing((prev) => { const n = new Set(prev); n.delete(sourcePath); return n; });
        setSyncProgress(null);
      });
  };

  // The scanned sources eligible for sync: the selected entries, else the run
  // root (so there's always at least one actionable target after a run).
  const syncTargets = (): string[] => {
    const sel = entries.filter((e) => selected.has(e.path)).map((e) => e.path);
    if (sel.length) return sel;
    const root = (snapshot?.root as string | undefined) || undefined;
    return root ? [root] : [];
  };

  // click a subtitle → mark its parent segment and scroll that segment into view
  const selectSubtitle = (subIdx: number, segIndex: number) => {
    setSelectedSub(subIdx);
    setSelectedSubSeg(segIndex);
    segRefs.current[segIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // current-file source abs path: prefer an explicit field, else root + rel
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
  const card = `rounded-3xl p-6 border backdrop-blur-xl transition-all ${
    dark ? 'bg-slate-900/40 border-white/10' : 'bg-white hover:border-slate-200 shadow-md'}`;
  const inputCls = 'text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none';
  const pill = (active: boolean, disabled = false) =>
    `px-3 py-1.5 text-xs font-bold rounded-lg transition ${
      disabled
        ? 'bg-slate-200/30 dark:bg-white/5 text-slate-400/60 dark:text-slate-600 line-through cursor-not-allowed'
        : active ? 'bg-rose-500 text-white' : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300'}`;

  const allSelected = entries.length > 0 && selected.size === entries.length;

  // Floating settings panel: collapsed = a side tab (off the main UI); expanded =
  // a centered floating overlay that does NOT push the main content.
  const [panelOpen, setPanelOpen] = useState(false);
  // Inner section folds within the floating panel.
  const [showOptions, setShowOptions] = useState(true);
  const [showResources, setShowResources] = useState(true);
  // Select-all / clear toggle for the file-extension filter.
  const allExtsSelected = allExtensions.length > 0 && (options.extensions || []).length >= allExtensions.length;
  const toggleAllExtensions = () => setOptions((o) => ({
    ...o,
    extensions: (o.extensions || []).length >= allExtensions.length ? [] : [...allExtensions],
  }));

  return (
    <div className="space-y-5">
      {/* header */}
      <div className={card}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clapperboard className="w-5 h-5 text-rose-500" /> {t.videoExtract}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Extract audio + .srt (faster-whisper) from folders or single videos via the local pycore engine.
            </p>
          </div>
          <button onClick={() => { setAddPath(baseDir || DEFAULT_BASE); setShowAdd(true); }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 shrink-0">
            <Plus className="w-4 h-4" /> {t.veAddEntry}
          </button>
        </div>

        {/* history list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">{t.veHistory}</h3>
            {entries.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> {t.veSelectAll}
              </label>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{t.veSelectHint}</p>

          {entries.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
              {t.veNoEntries}
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
                    {e.mode === 'folder' ? t.veFolderBadge : t.veFileBadge}
                  </span>
                  <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={e.path}>{e.path}</span>
                  <button onClick={() => removeEntry(e.path)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition" title={t.veRemove}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* action row */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          {/* Subtitles are ALWAYS generated (≥1 language) — shown as a static badge,
              not a toggle. The backend forces it on; the .srt is idempotent + resumable. */}
          <span title={t.veGenSubtitle}
            className="px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 border bg-emerald-500/15 border-emerald-500/40 text-emerald-500 select-none">
            <Captions className="w-4 h-4" /> {t.veGenSubtitle} · {options.lang || 'en'}
          </span>
          <button onClick={preview}
            className="px-4 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition">
            <Search className="w-4 h-4" /> {t.vePreview}
          </button>
          {!busy ? (
            <button onClick={start}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1">
              <Play className="w-4 h-4 fill-current" /> {t.veStart}
            </button>
          ) : (
            <>
              <button onClick={togglePause} disabled={!taskId}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 disabled:opacity-50">
                {paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                {paused ? t.veResume : t.vePause}
              </button>
              <button onClick={stop}
                className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1">
                <Square className="w-4 h-4" /> {t.veStop}
              </button>
            </>
          )}
          {snapshot?.output && (
            <button onClick={() => openPath('output', snapshot.output)}
              className="ml-auto px-4 py-2.5 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition">
              <FolderOpen className="w-4 h-4" /> {t.veOpenOutput}
            </button>
          )}
        </div>

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

            {/* SINGLE-FILE srt sub-progress: only while a file is transcribing
                (busy + srt_pct present). When idle, only the total bar shows. */}
            {busy && snapshot?.current?.srt_pct != null && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Captions className="w-3 h-3" /> {t.veSrtProgress}
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

        {/* rich run snapshot: totals + current file + per-file open buttons */}
        {snapshot && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-black/30 border border-slate-200/50 dark:border-white/5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <div className="text-slate-400 uppercase tracking-wide">{t.veTotalProgress}</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  {snapshot.processed ?? 0}/{snapshot.total ?? '?'}
                  {snapshot.total ? ` (${Math.round(((snapshot.processed ?? 0) / snapshot.total) * 100)}%)` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wide">{t.veElapsed}</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{fmtDur(snapshot.elapsed_total)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wide">{t.veEta}</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{fmtDur(snapshot.eta)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wide">{t.veSingleProgress}</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">{fmtDur(snapshot.current?.file_elapsed)}</div>
              </div>
            </div>

            {snapshot.current && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                <div className="text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-slate-700 dark:text-slate-200">
                    <span className="text-slate-400">{t.veCurrentFile}:</span>{' '}
                    <span className="font-mono">{snapshot.current.rel}</span>
                  </span>
                  <span className="text-slate-500">
                    {t.veOrigSize}: {fmtMB(snapshot.current.src_size)}
                  </span>
                  {Array.isArray(snapshot.current.audios) && snapshot.current.audios.length > 0 && (
                    <span className="text-slate-500">
                      {t.veOutputSize}: {snapshot.current.audios.map((a) => fmtMB(a.size)).join(' + ')}
                      {snapshot.current.mp4 ? ' · mp4' : ''}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openPath('file', currentSrc())}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1">
                    <FileVideo className="w-3 h-3" /> {t.veOpenFile}
                  </button>
                  <button onClick={() => openPath('file_dir', currentSrc())}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1">
                    <Folder className="w-3 h-3" /> {t.veOpenFileDir}
                  </button>
                  <button onClick={() => openPath('file_output_dir', snapshot.current?.out_dir)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" /> {t.veOpenFileOutput}
                  </button>
                  <button onClick={() => openPath('subtitle', snapshot.current?.srt)}
                    disabled={!snapshot.current?.srt}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Captions className="w-3 h-3" /> {t.veOpenSubtitle}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {output && (
          <pre className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200/50 dark:border-white/5 text-[11px] text-slate-700 dark:text-zinc-200 whitespace-pre-wrap max-h-60 overflow-auto font-mono">{output}</pre>
        )}
      </div>

      {/* Laravel media-sync prompt: after a run finished this session, offer to
          ingest each scanned source's outputs into Laravel (idempotent). One
          button per target; disabled while that source is in flight. */}
      {ranThisSession && !busy && syncTargets().length > 0 && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-rose-500" /> {t.veSyncLaravel}
            </h3>
          </div>
          <ul className="space-y-1.5">
            {syncTargets().map((p) => {
              const inFlight = syncing.has(p);
              return (
                <li key={p}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]">
                  <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={p}>{p}</span>
                  <button onClick={() => syncSource(p)} disabled={inFlight}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                    {inFlight ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    {inFlight ? t.veSyncing : t.veSyncLaravel}
                  </button>
                </li>
              );
            })}
          </ul>
          {syncProgress && (
            <div className="mt-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {t.veSyncStage}: <span className="font-bold text-slate-700 dark:text-slate-200">{syncProgress.stage}</span>
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
        </div>
      )}

      {/* Segment ↔ subtitle map for the CURRENT file (live, grows as produced).
          Click a subtitle to highlight + scroll to its parent segment. */}
      {segmentsDir && (
        <div className={card}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Scissors className="w-4 h-4 text-rose-500" /> {t.veSegments}
            </h3>
            {mapping && (
              <span className="text-[11px] font-bold text-slate-500">
                {mapping.segment_count} {t.veSegment.toLowerCase()}{mapping.segment_count === 1 ? '' : 's'} · {fmtDur(mapping.duration)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">{t.veSegmentsHint}</p>

          {/* whole-file outputs (full mp4 / 2×2 mp4 / mp3 / srt) — these live in
              the output dir = parent of segments_dir. Render present ones as
              folder-open buttons. */}
          {mapping?.files && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">{t.veWholeFiles}:</span>
              {([
                { name: mapping.files.full_mp4, label: t.veFullClip, Icon: Film },
                { name: mapping.files.tiny_mp4, label: t.veTinyClip, Icon: Grid2x2 },
                { name: mapping.files.mp3, label: t.veAudioClip, Icon: Music },
                { name: mapping.files.srt, label: 'SRT', Icon: Captions },
              ] as Array<{ name?: string | null; label: string; Icon: typeof Film }>).map(({ name, label, Icon }) => (
                <button key={label}
                  onClick={() => name && openPath('file_dir', joinDir(parentOf(segmentsDir), name))}
                  disabled={!name}
                  title={name ? `${t.veOpenClipDir}: ${name}` : undefined}
                  className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          )}

          {!mapping || mapping.segments.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
              {t.veNoSegments}
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
                        {t.veClip} {seg.index}
                      </span>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                        {fmtClock(seg.start)}–{fmtClock(seg.end)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {seg.subtitle_count} {t.veSubtitleCount}
                      </span>
                      {highlighted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
                          <CornerDownRight className="w-3 h-3" /> {t.veSubtitleInSegment} {seg.index}
                        </span>
                      )}
                      {/* per-segment clip variants: Full / 2×2 / Audio. Each opens
                          its folder; disabled when that variant's file is null. */}
                      <div className="ml-auto flex items-center gap-1.5">
                        {[
                          { name: seg.full_mp4, label: t.veFullClip, Icon: Film },
                          { name: seg.mp4, label: t.veTinyClip, Icon: Grid2x2 },
                          { name: seg.mp3, label: t.veAudioClip, Icon: Music },
                        ].map(({ name, label, Icon }) => (
                          <button key={label}
                            onClick={() => name && openPath('file_dir', joinDir(segmentsDir, name))}
                            disabled={!name}
                            title={name ? `${t.veOpenClipDir}: ${name}` : undefined}
                            className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-white/10 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                            <Icon className="w-3 h-3" /> {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {seg.subtitles.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {seg.subtitles.map((sub) => {
                          const on = selectedSub === sub.idx && selectedSubSeg === seg.index;
                          return (
                            <li key={sub.idx}>
                              <button onClick={() => selectSubtitle(sub.idx, seg.index)}
                                className={`w-full text-left flex gap-2 px-2 py-1 rounded-lg text-[11px] transition ${
                                  on
                                    ? 'bg-rose-500/20 text-slate-800 dark:text-slate-100'
                                    : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                                <span className="shrink-0 font-mono text-slate-400">
                                  {fmtClock(sub.start)}
                                </span>
                                <span className="flex-1 break-words">{sub.text}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Floating settings: a docked side-tab when collapsed (off the main UI);
          a centered floating overlay when open (does not push the main content). */}
      {!panelOpen && (
        <button type="button" onClick={() => setPanelOpen(true)} aria-label="Open settings"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 pl-2 pr-1.5 py-3 rounded-l-2xl bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/30 flex flex-col items-center gap-1.5 transition">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-wider" style={{ writingMode: 'vertical-rl' }}>{t.veOptions}</span>
        </button>
      )}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center p-4 pointer-events-none">
          <div className={`pointer-events-auto w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl border shadow-2xl backdrop-blur-xl ${dark ? 'bg-slate-900/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
            <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b backdrop-blur-xl ${dark ? 'border-white/10 bg-slate-900/90' : 'border-slate-200 bg-white/90'}`}>
              <h3 className="text-sm font-bold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-rose-500" /> {t.veOptions}</h3>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Collapse to side"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-500/10 transition">
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">

      {/* system resources monitor */}
      <div className={card}>
        <button type="button" onClick={() => setShowResources((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider">
          <span className="flex items-center gap-2"><Cpu className="w-4 h-4" /> {t.veResources}</span>
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
                  <span className="text-slate-500 flex items-center gap-1"><Cpu className="w-3 h-3" /> {t.veCpu}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(resources.cpu_percent)}%</span>
                </div>
                <div className="bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, resources.cpu_percent)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> {t.veMem}</span>
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
                        <Gpu className="w-3 h-3 shrink-0" /> <span className="truncate" title={g.name}>{t.veGpu} {g.index}: {g.name}</span>
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
      <div className={card}>
        <button type="button" onClick={() => setShowOptions((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">
          <span>{t.veOptions}</span>
          {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showOptions && (
        <div className="space-y-4">
          {/* Subtitles are always generated (backend-enforced); shown checked + locked. */}
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 select-none opacity-90">
            <input type="checkbox" checked readOnly disabled />
            {t.veGenSubtitle} <span className="text-[10px] font-bold text-emerald-500">· {options.lang || 'en'}</span>
          </label>

          <div>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">{t.veModel}</span>
            <div className="flex flex-wrap gap-2">
              {allModels.map((m) => {
                const installed = installedModels.includes(m);
                return (
                  <button key={m} type="button" disabled={!installed}
                    title={installed ? undefined : t.veModelNotInstalled}
                    onClick={() => installed && setOptions((o) => ({ ...o, model: m }))}
                    className={pill(options.model === m, !installed)}>
                    {m}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{t.veModelsInstalledHint}</p>
          </div>

          <div>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">{t.veFormats}</span>
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
              <span className="text-xs text-slate-500 dark:text-slate-400">{t.veExtensions}</span>
              <button type="button" onClick={toggleAllExtensions}
                className="text-[11px] font-bold flex items-center gap-1 text-sky-500 hover:text-sky-400 transition">
                <ListChecks className="w-3.5 h-3.5" /> {allExtsSelected ? t.liveClear : t.veSelectAll}
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
            <p className="text-[11px] text-slate-400 mt-2">{t.veExtensionsHint}</p>
          </div>

          <div>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mb-2">{t.veLang}</span>
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

      {/* live backend log */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4" /> {t.liveLog}
          </h3>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${wsConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
              {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {wsConnected ? t.liveConnected : t.liveDisconnected}
            </span>
            <button onClick={clearLogs}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
              {t.liveClear}
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 border border-white/5 text-[11px] font-mono h-64 overflow-auto p-3 leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-slate-600">{t.liveEmpty}</div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-all"
                style={{ color: l.color || (l.level === 'error' ? '#f87171' : l.level === 'warn' || l.level === 'warning' ? '#fbbf24' : '#d4d4d8') }}>
                {l.message}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* add dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAdd(false)}>
          <div className={`w-full max-w-md rounded-3xl p-6 border ${dark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-xl'}`}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-rose-500" /> {t.veAddEntry}</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setAddMode('folder')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'folder'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <Folder className="w-5 h-5" /> {t.veAddFolder}
              </button>
              <button onClick={() => setAddMode('file')}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs font-bold transition ${
                  addMode === 'file'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'}`}>
                <FileVideo className="w-5 h-5" /> {t.veAddFile}
              </button>
            </div>

            <label className="block text-[11px] text-slate-500 mb-1">{t.vePathLabel}</label>
            {/* Native OS dialog (reliable in the webview, where the browser can't read
                a real filesystem path) + manual entry as a fallback. */}
            <div className="flex gap-2 mb-2">
              <input type="text" value={addPath} autoFocus
                onChange={(e) => setAddPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); }}
                placeholder={baseDir || DEFAULT_BASE}
                className={`${inputCls} flex-1`} />
              <button onClick={browse} disabled={browsing}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-slate-200 transition flex items-center gap-1 shrink-0 disabled:opacity-50">
                {browsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                {t.veBrowse}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-5">
              {addMode === 'folder' ? t.veBrowseFolderHint : t.veBrowseFileHint}
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300 transition">
                {t.veCancel}
              </button>
              <button onClick={confirmAdd}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {t.veConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
