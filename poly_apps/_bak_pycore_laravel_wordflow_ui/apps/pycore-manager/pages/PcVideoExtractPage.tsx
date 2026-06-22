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
  KeyRound, AlertTriangle,
} from 'lucide-react';
import {
  pycoreApi, connectPycoreWs, onWsStatus,
} from '../../../core/api-libs/pycore';
import type {
  VideoExtractEntry, VideoExtractMode, VideoExtractOptions, WhisperLanguage,
  SystemResources, VideoExtractOpenKind,
  PosterStatus, PosterTestResponse, AssistPosterCounts,
} from '../../../core/api-libs/pycore';
import { usePcVideoExtract } from '../PcVideoExtractContext';
import type { SegWithFull } from '../PcVideoExtractContext';
import PcLaravelMediaPanel from '../components/PcLaravelMediaPanel';

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
};

const DEFAULT_BASE = 'D:\\.tmp';

// Full whisper model catalog (mirrors the backend); non-installed render disabled.
const FALLBACK_ALL_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3', 'turbo'];
const FALLBACK_LANGS: WhisperLanguage[] = [{ code: 'en', name: 'English' }];
const FORMATS = ['mp3', 'opus', 'aac', 'vorbis'];
const FALLBACK_EXTS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv'];

const DEFAULT_OPTIONS: VideoExtractOptions = {
  subtitle: true, model: 'auto', formats: ['mp3'], lang: 'en', extensions: [],
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

/**
 * PcMoviePosterStrip — compact Movie/TV poster pipeline status panel for the
 * Video Extract page (MOVIE_POSTER_PIPELINE.md). Shows the TMDB/OMDB provider
 * key status (from pycore GET /api/local/poster/status), the per-status poster
 * counts for the media produced by extraction (from the assist snapshot's
 * `poster` block, GET /api/local/assist/status), and a small inline title→
 * poster lookup/preview (POST /api/local/poster/test). All pycore endpoints are
 * REUSED from pycoreApi; every call is guarded so an offline backend degrades to
 * a muted line instead of crashing the page.
 *
 * 404 hardening: getJSON does NOT throw on a non-2xx body, so a stale backend
 * can return `{detail:"Not Found"}` with NO providers/keys. We treat a payload
 * missing the expected `providers` array as "endpoint missing" and show a clear
 * "restart backend" notice rather than rendering empty/zero badges silently.
 */
const PcMoviePosterStrip: React.FC = () => {
  const [status, setStatus] = useState<PosterStatus | null>(null);
  const [counts, setCounts] = useState<AssistPosterCounts | null>(null);
  const [loading, setLoading] = useState(false);
  // null = not yet loaded; '' = loaded OK; non-empty = error / endpoint-missing.
  const [err, setErr] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState('');
  const [testYear, setTestYear] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PosterTestResponse | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Poster key status (TMDB/OMDB). getJSON never throws on a 404 body, so
      // validate the SHAPE: a real status carries a providers array.
      const s = await pycoreApi.getPosterStatus();
      if (!mounted.current) return;
      if (s && Array.isArray((s as any).providers)) {
        setStatus(s); setErr('');
      } else {
        setStatus(null);
        setErr((s as any)?.detail || (s as any)?.error
          ? 'Poster status endpoint missing — restart the pycore backend (:59000).'
          : 'Poster status unavailable.');
      }
      // Poster counts ride the assist snapshot's optional `poster` block. Absent
      // (older backend) → leave counts null (the counts row simply hides).
      const a = await pycoreApi.getAssistStatus().catch(() => null);
      if (!mounted.current) return;
      const p = a?.laravel_status?.poster;
      setCounts(p && typeof p.total === 'number' ? p : null);
    } catch (e: any) {
      if (mounted.current) { setStatus(null); setErr(e?.message || 'pycore unreachable'); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runTest = async () => {
    const title = testTitle.trim();
    if (!title) { setTestErr('Enter a movie / show title'); return; }
    setTesting(true); setTestErr(null); setTestResult(null);
    try {
      const yr = testYear.trim() ? Number(testYear.trim()) : undefined;
      const r = await pycoreApi.testPoster(title, Number.isFinite(yr) ? yr : undefined);
      if (!mounted.current) return;
      // testPoster never throws ({found:false} on a miss) — but a stale backend
      // 404 returns a body with neither `found` nor `error`: surface that too.
      if (r && (typeof r.found === 'boolean' || r.error)) {
        setTestResult(r);
        if (!r.found && !r.error) setTestErr('No poster found for that title.');
        if (r.error) setTestErr(r.error);
      } else {
        setTestErr('Poster test endpoint missing — restart the pycore backend (:59000).');
      }
    } catch (e: any) {
      if (mounted.current) setTestErr(e?.message || 'Poster lookup failed');
    } finally {
      if (mounted.current) setTesting(false);
    }
  };

  const providers = status?.providers ?? [];
  const countItems: Array<{ label: string; value: number; cls: string }> = counts ? [
    { label: 'Pending', value: counts.pending, cls: 'text-amber-500' },
    { label: 'Ready', value: counts.ready, cls: 'text-emerald-500' },
    { label: 'Failed', value: counts.failed, cls: 'text-rose-500' },
    { label: 'None', value: counts.none, cls: 'text-slate-400' },
  ] : [];

  return (
    <section className="pc-glass p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-rose-500" /> Movie {L.vePoster} status
        </h3>
        <button onClick={load} disabled={loading}
          className="text-[11px] font-bold flex items-center gap-1 text-rose-500 hover:text-rose-400 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        TMDB / OMDB poster fetch for the media produced by extraction (Books / Subtitles).
      </p>

      {/* endpoint-missing / offline notice (never silently show empty badges) */}
      {err ? (
        <div className="mb-3 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{err}</span>
        </div>
      ) : !status ? (
        <p className="text-[11px] text-slate-400">Loading…</p>
      ) : (
        <>
          {/* provider key badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> Keys:
            </span>
            {providers.map((p) => (
              <span key={p.name}
                title={p.configured ? `${p.name.toUpperCase()} key configured` : `${p.name.toUpperCase()} key missing`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${
                  p.configured
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-slate-200/50 dark:bg-white/5 text-slate-400 line-through'}`}>
                {p.name}
                {p.name === 'tmdb' && p.has_v4_token && (
                  <span className="not-italic normal-case text-[10px] text-emerald-400">v4</span>
                )}
              </span>
            ))}
            {providers.every((p) => !p.configured) && (
              <span className="text-[11px] text-amber-500">No provider keys configured — set TMDB_API_KEY / OMDB_API_KEY.</span>
            )}
          </div>

          {/* per-status counts (only when the assist snapshot exposes them) */}
          {counts ? (
            <div className="grid grid-cols-4 gap-3 text-[11px] mb-3">
              {countItems.map((c) => (
                <div key={c.label}>
                  <div className="text-slate-400 uppercase tracking-wide">{c.label}</div>
                  <div className={`font-bold ${c.cls}`}>{c.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mb-3">
              Poster counts unavailable — the assist snapshot has no <span className="font-mono">poster</span> block yet (start the assist worker / update the backend).
            </p>
          )}

          {/* inline title → poster lookup + preview */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-white/5">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[10rem]">
                <label className="block text-[11px] text-slate-500 mb-1">Test lookup — title</label>
                <input type="text" value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }}
                  placeholder="e.g. Inception"
                  className="w-full text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none" />
              </div>
              <div className="w-24">
                <label className="block text-[11px] text-slate-500 mb-1">Year</label>
                <input type="text" inputMode="numeric" value={testYear}
                  onChange={(e) => setTestYear(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }}
                  placeholder="2010"
                  className="w-full text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none" />
              </div>
              <button onClick={runTest} disabled={testing}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 disabled:opacity-50">
                {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Look up
              </button>
            </div>

            {testErr && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">{testErr}</p>}

            {testResult?.found && (
              <div className="mt-3 flex gap-3 items-start p-3 rounded-2xl bg-slate-100 dark:bg-black/30 border border-slate-200/50 dark:border-white/5">
                {testResult.image_base64 && (
                  <img
                    src={`data:${testResult.mime || 'image/jpeg'};base64,${testResult.image_base64}`}
                    alt={testResult.meta?.title || 'poster'}
                    className="w-20 h-auto rounded-lg shrink-0 object-cover" />
                )}
                <div className="text-[11px] space-y-1 min-w-0">
                  <div className="font-bold text-slate-700 dark:text-slate-200 truncate">
                    {testResult.meta?.title || testTitle}
                    {testResult.meta?.year ? ` (${testResult.meta.year})` : ''}
                  </div>
                  {testResult.provider && (
                    <div className="text-slate-500">
                      Source: <span className="font-bold uppercase">{testResult.provider}</span>
                      {testResult.source_id ? ` · ${testResult.source_id}` : ''}
                    </div>
                  )}
                  {testResult.meta?.overview && (
                    <p className="text-slate-500 line-clamp-3">{testResult.meta.overview}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

const PcVideoExtractPage: React.FC = () => {
  // --- persistent run/progress/snapshot/mapping/sync state (survives nav) - #
  // Lifted into PcVideoExtractContext (mounted above the routes) so navigating
  // away and back — or a full reload — re-attaches to the still-running backend
  // task instead of resetting. See PcVideoExtractContext for the design.
  const {
    taskId, busy, paused, progress, snapshot, output, mapping, segmentsDir,
    syncing, syncingAll, syncProgress, autoSync, setAutoSync, notice, setNotice,
    start: startRun, preview: previewRun, stop, togglePause, syncSource, syncAll,
  } = usePcVideoExtract();

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
  const resPollRef = useRef<number | null>(null);

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
      }));
      if (Array.isArray(lo.extensions) && lo.extensions.length) extsHydrated.current = true;
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

  useEffect(() => () => {
    if (resPollRef.current) clearInterval(resPollRef.current);
  }, []);

  // Reset the click-to-highlight selection whenever the current file (and thus
  // its segments dir) changes. The mapping data itself is fetched/polled by the
  // context; this only manages page-local selection.
  useEffect(() => {
    setSelectedSub(null);
    setSelectedSubSeg(null);
  }, [segmentsDir]);

  // Poll live system resources (~1.5s) while mounted.
  useEffect(() => {
    const tick = () => {
      pycoreApi.getSystemResources()
        .then((r) => {
          if (r && typeof r.cpu_percent === 'number' && r.mem) {
            setResources({ cpu_percent: r.cpu_percent, mem: r.mem, gpus: r.gpus || [] });
          }
        })
        .catch(() => { /* not ready — retry next tick */ });
    };
    tick();
    resPollRef.current = window.setInterval(tick, 1500);
    return () => { if (resPollRef.current) clearInterval(resPollRef.current); };
  }, []);

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

  const reqBase = () => ({
    subtitle: options.subtitle,
    engine: 'faster-whisper',
    whisper_model: options.model,
    model: options.model,
    formats: options.formats.length ? options.formats : ['mp3'],
    lang: options.lang || 'en',
    extensions: options.extensions && options.extensions.length ? options.extensions : [],
    make_mp4: true,
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
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* no args → the backend syncs its full history of sources */}
            <button onClick={() => syncAll()} disabled={busy || syncingAll || syncing.size > 0}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {syncingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {syncingAll ? L.veSyncing : L.veSyncAll}
            </button>
          </div>
          <ul className="space-y-1.5">
            {syncTargets().map((p) => {
              const inFlight = syncing.has(p);
              return (
                <li key={p}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-100/40 dark:bg-white/[0.02]">
                  <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 truncate" title={p}>{p}</span>
                  <button onClick={() => syncSource(p)} disabled={inFlight || busy || syncingAll}
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

      {/* Movie / TV poster pipeline: key status + counts + inline test/preview
          for the media produced by extraction (TMDB/OMDB via pycore). */}
      <PcMoviePosterStrip />

      {/* Segment ↔ subtitle map for the CURRENT file */}
      {segmentsDir && (
        <section className="pc-glass p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Scissors className="w-4 h-4 text-rose-500" /> Segments
            </h3>
            {mapping && (
              <span className="text-[11px] font-bold text-slate-500">
                {mapping.segment_count} clip{mapping.segment_count === 1 ? '' : 's'} · {fmtDur(mapping.duration)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Click a subtitle to highlight its parent clip.</p>

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
