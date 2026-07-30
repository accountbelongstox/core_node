/**
 * PcVideoExtractContext — persistent running-task state for the Video Extract
 * feature. This is now a THIN ADOPTION of the global task layer
 * (`core/tasks/usePersistentTask`): the generic two-layer persistence
 * (provider-above-routes survival + localStorage backend re-attach) lives in the
 * shell's <TaskPersistenceProvider>, and this context binds the Video Extract
 * specifics (request shape, snapshot/progress derivation, segment↔subtitle
 * mapping, Laravel sync) on top of it.
 *
 * PERSISTENCE DESIGN (unchanged behavior, now via the foundation):
 *
 *  1. Survives page navigation — the live session (task id, polled snapshot,
 *     running flag, poll timer) is held in the global provider mounted ABOVE the
 *     router, so leaving and returning to the Video Extract page re-reads the
 *     still-live state instead of resetting.
 *
 *  2. Survives a FULL reload — `begin(saved)` persists the minimal re-attach
 *     record (`{ taskId, output, source }`) under the `task_pycore_video-extract`
 *     namespace. On provider INIT the hook's `reattach(saved)` fetches the
 *     backend task through HTTP v2 and restores it:
 *       - still running  → restore busy + snapshot + resume polling
 *       - finished       → restore the final snapshot/output (no polling)
 *       - unknown (404)  → clears the stored id
 *
 * The hook owns the task LIFECYCLE; this context derives feature state from its
 * `data` and the page stays a pure VIEW. Following the page's conventions, no
 * try/catch — every async backend call is guarded with `.catch`.
 */
import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  pycoreApi, requestPycoreHttp, subscribeHttpEvent,
} from '../../core/api-libs/pycore';
import { PYCORE_HTTP_ROUTES } from '../../core/api-libs/pycore/PycoreHttpRoutes';
import { PYCORE_EVENT_TOPICS } from '../../core/api-libs/pycore/PycoreEventTopics';
import type { VideoExtractMapping, VideoExtractSegment } from '../../core/api-libs/pycore';
import { usePersistentTask } from '../../core/tasks/usePersistentTask';
import { useTopicDrivenRefresh } from './hooks/useTopicDrivenRefresh';
import { StorageKeys, StorageManager } from '../../core/persistence';

const TASK_KEY = 'pycore.video-extract';
// sentinel entry in `syncing` while a sync-ALL is in flight (not a real path,
// so it never collides with a source path; the shared HTTP event handler
// clears the whole set, which clears this flag too).
const SYNC_ALL_KEY = '*all*';
// localStorage mirror for the auto-sync toggle (instant hydration on load,
// works even when pycore is offline). Backend persistence rides the page's
// existing options effect — see the autoSync comment below.

// run snapshot shape (loose: backend-owned). Kept here as the source of truth;
// the page imports it from the context.
// One structured decision step in a video's processing flow (the backend emits
// these on `current.flow`/`item.flow`): title-translate, the subtitle provider
// chain + cache decisions, per-language API/Whisper/AI, poster. Rendered as the
// "处理流程 / Flow" panel so the decision + cache process is visible.  // 处理流程步骤
export interface VeFlowStep {
  step: string;                 // title | subtitle_primary | subtitle_lang | poster
  status: string;               // ok|api|whisper|ai|cache|api_miss|empty|miss|fail
  label?: string;
  lang?: string;
  provider?: string | null;
  detail?: string;
  en?: string | null;
  year?: number | null;
}

export interface VeSnapshot {
  processed?: number;
  total?: number;
  output?: string | null;
  root?: string | null;
  elapsed_total?: number | null;
  eta?: number | null;
  stats?: { srt_done?: number; srt_skip?: number };
  current?: {
    rel?: string;
    src_size?: number | null;
    out_dir?: string | null;
    segments_dir?: string | null;
    srt?: string | null;
    srt_pct?: number | null;
    file_elapsed?: number | null;
    mp4?: boolean;
    audios?: { size?: number }[];
    // collect-info pre-pass + per-decision flow (see VeFlowStep).
    title_en?: string | null;
    lang_tracks?: Record<string, string>;
    flow?: VeFlowStep[];
  } | null;
}

// The shared VideoExtractMapping/Segment types don't yet carry the full-clip
// (`full_mp4`) or whole-file `files` fields, but the backend sends them.
export type SegWithFull = VideoExtractSegment & { full_mp4?: string | null };
export interface VeWholeFiles {
  full_mp4?: string | null;
  tiny_mp4?: string | null;
  mp3?: string | null;
  srt?: string | null;
  /** Movie/TV poster filename in the output dir (MOVIE_POSTER_PIPELINE.md §8;
   *  `mapping.json` → `files.poster`). Present once the poster is fetched. */
  poster?: string | null;
}
export type MappingWithFiles = VideoExtractMapping & { files?: VeWholeFiles };

export interface VeProgress { pct: number; text: string }
export interface VeSyncProgress { stage: string; done: number; total: number; detail: string }
// Live progress for the subtitle-language fill (mirrors VeSyncProgress; carries
// the same stage/done/total/detail streamed over the `subtitle_language_fill`
// THREAD_BUS event).  // 字幕语言填充进度
export interface VeFillProgress { stage: string; done: number; total: number; detail: string }

// minimal info persisted so a reload knows what to re-attach to (the `saved`
// payload of the persistent task).
interface VeStored {
  taskId: string;
  output?: string | null;
  source?: string | null;
}

export interface VeReqBase {
  subtitle: boolean;
  engine: string;
  whisper_model: string;
  model: string;
  formats: string[];
  lang: string;
  extensions: string[];
  make_mp4: boolean;
  // primary subtitle track source: 'api_first' (OpenSubtitles → Whisper) or
  // 'whisper' (always local). Default 'api_first' (backend honors it).  // 字幕来源
  subtitle_source?: 'api_first' | 'whisper';
  // Correspondence languages to build subtitle tracks for THIS run (the multi-
  // select). Injected by start() from corrLanguages; primary auto-included.  // 所选语言
  selected_languages?: string[];
}
// the page passes reqBase + the selected paths
export type VeStartReq = VeReqBase & { paths: string[]; path: string };

interface PcVideoExtractValue {
  // ---- run state ----
  taskId: string | null;
  busy: boolean;
  paused: boolean;
  progress: VeProgress | null;
  snapshot: VeSnapshot | null;
  output: string | null;
  mapping: MappingWithFiles | null;
  segmentsDir: string | null;
  syncing: Set<string>;
  syncingAll: boolean;
  syncProgress: VeSyncProgress | null;
  // ---- subtitle-language fill (video_extract.fill_languages) ----
  // `filling` while a fill HTTP is in flight; `fillProgress` streams the live
  // stage/done/total over the `subtitle_language_fill` event.
  filling: boolean;
  fillProgress: VeFillProgress | null;
  ranThisSession: boolean;
  // auto-sync toggle: when on, a run that COMPLETES in this session triggers an
  // idempotent syncAll([root]) automatically (once per run).
  autoSync: boolean;
  setAutoSync: (v: boolean) => void;
  // surfaced messages (page renders these into its notice line)
  notice: string | null;
  setNotice: (n: string | null) => void;

  // ---- multi-language correspondence selection (spec §12) ----
  // The checked language CODES (>=1, includes the primary). Drives both the
  // per-cue correspondence display (segments fetch) and the sync HTTP payloads.
  corrLanguages: string[];
  setCorrLanguages: (codes: string[]) => void;

  // ---- actions ----
  start: (req: VeStartReq) => Promise<void>;
  preview: (req: VeStartReq) => Promise<string>;
  stop: () => void;
  togglePause: () => Promise<void>;
  // sync calls carry the checked language set; omitted → the context's current
  // corrLanguages selection is used.
  syncSource: (sourcePath: string, languages?: string[]) => void;
  syncAll: (paths?: string[], languages?: string[]) => Promise<void>;
  // Ensure each requested language has a `<stem>.<lang>.srt` sibling track
  // (OpenSubtitles when strategy='api_first' + credentialed, else AI-translated
  // from the primary cues). Omitted languages/strategy → the current selection.
  // Writes tracks locally; the user then clicks the existing Sync/Submit.
  fillLanguages: (paths?: string[], languages?: string[], strategy?: 'api_first' | 'whisper') => Promise<void>;
}

const L = {
  veSyncDone: 'Synced to Laravel',                              // 已同步到 Laravel
  veSyncFailed: 'Sync failed',                                  // 同步失败
  veAutoSyncStarted: 'Auto-sync to Laravel started (idempotent)', // 已自动开始同步到 Laravel(幂等)
  veFillDone: 'Language tracks filled',                         // 语言字幕已填充
  veFillFailed: 'Fill failed',                                  // 填充失败
};

// localStorage helpers — sync APIs can't be `.catch`-guarded, and localStorage
// may throw (private mode / blocked storage), so these are the one place a
// try/catch is unavoidable.
function readAutoSyncLs(): boolean {
  return StorageManager.getRaw(StorageKeys.PYCORE_VIDEO_EXTRACT_AUTO_SYNC) === '1';
}
function writeAutoSyncLs(v: boolean): void {
  StorageManager.setRaw(StorageKeys.PYCORE_VIDEO_EXTRACT_AUTO_SYNC, v ? '1' : '0');
}

function isDone(task: any): boolean {
  return task?.status === 'completed' || task?.status === 'failed';
}

function snapshotOf(task: any): VeSnapshot {
  return (task?.result || {}) as VeSnapshot;
}

function progressOf(task: any): VeProgress {
  const snap = snapshotOf(task);
  const rel = snap.current?.rel;
  return {
    pct: task?.progress || 0,
    text: `${task?.status} ${snap.processed ?? 0}/${snap.total ?? '?'}${rel ? ' · ' + rel : ''}`,
  };
}

function doneOutput(task: any): string {
  const snap = snapshotOf(task);
  const s = snap.stats || {};
  return `Done. ${snap.processed ?? 0}/${snap.total ?? 0} · srt ${s.srt_done ?? 0} new/${s.srt_skip ?? 0} skip · output: ${snap.output ?? '-'}`;
}

const PcVideoExtractContext = createContext<PcVideoExtractValue | null>(null);

export function PcVideoExtractProvider({ children }: { children: React.ReactNode }) {
  // ---- the generic persistent task: data = the latest polled backend task --- #
  const task = usePersistentTask<any, VeStored>(TASK_KEY, {
    intervalMs: 2000,
    poll: () => {
      const saved = task.saved;
      const tid = saved?.taskId;
      if (!tid) return Promise.resolve(null);
      return requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractGetTask, { task_id: tid })
        .then((tr: any) => {
          if (!tr?.success || !tr.task) return null;
          if (isDone(tr.task)) {
            // Deliver the FINAL task once (so `data` holds the completed
            // snapshot/output); on subsequent ticks return null to "settle" —
            // the global layer then stops polling but KEEPS the final data +
            // re-attach record, so a later reload still restores the finished
            // state (matching the original behavior). The completion notice is
            // surfaced by the `done` effect, keyed off the task id.
            if (settledTaskRef.current === tid) return null;
            settledTaskRef.current = tid;
            return tr.task;
          }
          return tr.task;
        })
        .catch(() => null);
    },
    reattach: (saved: VeStored) => {
      if (!saved?.taskId) return Promise.resolve(null);
      return requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractGetTask, { task_id: saved.taskId })
        .then((tr: any) => {
          if (!tr?.success || !tr.task) return null;
          // finished while we were away → restore the final task; mark settled so
          // the first poll halts immediately (no needless polling of a done task).
          if (isDone(tr.task)) settledTaskRef.current = saved.taskId;
          return tr.task;
        })
        .catch(() => null);
    },
  });

  const polled = task.data;
  const savedTaskId = task.saved?.taskId ?? null;

  const [paused, setPaused] = useState(false);
  const [mapping, setMapping] = useState<MappingWithFiles | null>(null);
  const [ranThisSession, setRanThisSession] = useState(false);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [syncProgress, setSyncProgress] = useState<VeSyncProgress | null>(null);
  // Subtitle-language fill (video_extract.fill_languages): in-flight flag + live
  // progress streamed over the `subtitle_language_fill` event (mirrors sync).
  const [filling, setFilling] = useState(false);
  const [fillProgress, setFillProgress] = useState<VeFillProgress | null>(null);
  // AUTO-SYNC PERSISTENCE (chosen approach, documented per the FE/BE contract):
  // the context owns the state + a localStorage mirror (read once on init,
  // written on change) so the toggle hydrates instantly and survives pycore
  // being offline. The BACKEND round-trip (`last_options.auto_sync`) is handled
  // in two places: (a) hydration below prefers the backend value from
  // getVideoExtractHistory() when available, and (b) the PAGE's existing
  // persist-options effect sends `auto_sync` along with the full options object
  // (a partial `{auto_sync}`-only write could clobber the other options, so it
  // rides the page effect instead of a separate context-side write).
  const [autoSync, setAutoSyncState] = useState<boolean>(readAutoSyncLs);
  const [notice, setNotice] = useState<string | null>(null);
  // Checked correspondence language codes (>=1, includes the primary). Defaults
  // to English + Chinese; the page drives this from its language multi-select.
  const [corrLanguages, setCorrLanguages] = useState<string[]>(['en', 'zh']);
  // Mirror in a ref so the live segments-fetch interval always reads the latest
  // selection without re-subscribing the interval on every toggle.
  const corrLangsRef = useRef<string[]>(['en', 'zh']);
  useEffect(() => { corrLangsRef.current = corrLanguages; }, [corrLanguages]);
  // pre-start optimistic state (before the first poll returns a task) +
  // preview/error text that isn't part of a backend task.
  const [localOutput, setLocalOutput] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const finishedRef = useRef<string | null>(null);
  // task id whose terminal task has already been delivered to `data` (so the
  // poll loop returns null thereafter and the session settles).
  const settledTaskRef = useRef<string | null>(null);
  // task id of the run STARTED in this browser session (set by start(), never
  // by reattach) — auto-sync only fires for these, not for finished runs
  // restored after a reload.
  const sessionRunRef = useRef<string | null>(null);
  // task id already auto-synced (or deliberately skipped), so the effect fires
  // exactly once per completed run regardless of re-renders.
  const autoSyncedRef = useRef<string | null>(null);
  // user touched the toggle this session → backend hydration must not override.
  const autoSyncTouchedRef = useRef(false);

  // ---- derive feature state from the polled task ----------------------- #
  const snapshot: VeSnapshot | null = polled ? snapshotOf(polled) : null;
  const taskId = polled?.task_id ?? savedTaskId;
  const done = polled ? isDone(polled) : false;
  // busy = a session is live (running) AND the backend task is not terminal.
  const busy = (task.running && !done) || starting;
  const progress: VeProgress | null = polled ? progressOf(polled) : (starting ? { pct: 0, text: 'starting' } : null);
  const output = polled && done ? doneOutput(polled) : localOutput;
  const segmentsDir = snapshot?.current?.segments_dir ?? null;

  const fetchSegmentMap = useCallback(() => {
    if (!segmentsDir) return;
    pycoreApi.getVideoExtractSegments(segmentsDir, corrLangsRef.current)
      .then((r) => { if (r?.success && r.mapping) setMapping(r.mapping as MappingWithFiles); })
      .catch(() => { /* keep last mapping */ });
  }, [segmentsDir]);

  useEffect(() => {
    if (!segmentsDir) {
      setMapping(null);
      return;
    }
    fetchSegmentMap();
  }, [segmentsDir, corrLanguages, fetchSegmentMap]);

  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.videoExtractSync, PYCORE_EVENT_TOPICS.operationChanged],
    fetchSegmentMap,
    { fallbackMs: busy ? 15_000 : 0, enabled: Boolean(segmentsDir && busy) },
  );

  // When the backend task terminates, surface the completion notice once per task
  // id. The poll loop itself "settles" the session (stops the timer but keeps the
  // final data + re-attach record), so a later reload still restores the finished
  // snapshot/output — matching the original behavior. We intentionally do NOT call
  // end() here (that would clear the stored id).
  useEffect(() => {
    if (!polled || !done) return;
    const tid = polled.task_id ?? savedTaskId;
    if (finishedRef.current === tid) return;
    finishedRef.current = tid;
    setPaused(false);
    setNotice('Video extraction finished');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled, done, savedTaskId]);

  // mark ranThisSession whenever we have an active/known task (covers reattach).
  useEffect(() => {
    if (taskId) setRanThisSession(true);
  }, [taskId]);

  // keep paused flag in sync with a reattached/polled task status
  useEffect(() => {
    if (polled && !done) setPaused(polled.status === 'paused');
  }, [polled, done]);

  // ---- live Laravel-sync progress events ------------------------------- #
  // Shared by syncSource AND syncAll: both emit the same `video_extract_sync`
  // stages, and 'done'/'error' reset the WHOLE `syncing` set — which also
  // clears the SYNC_ALL_KEY sentinel (the "all" flag).
  useEffect(() => subscribeHttpEvent(PYCORE_EVENT_TOPICS.videoExtractSync, (d: any) => {
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
      setNotice(`${L.veSyncDone}${parts ? ' — ' + parts : ''}`);
      setSyncing(new Set());
      setSyncProgress(null);
    } else if (stage === 'error') {
      const errs = Array.isArray(d?.errors) ? d.errors.join('; ') : '';
      setNotice(`${L.veSyncFailed}${d?.detail ? ': ' + d.detail : errs ? ': ' + errs : ''}`);
      setSyncing(new Set());
      setSyncProgress(null);
    }
  }), []);

  // ---- live subtitle-language-fill progress events --------------------- #
  // Mirrors the `video_extract_sync` subscription above: the fill HTTP streams
  // `subtitle_language_fill` stages; 'done'/'error' clear the in-flight flag and
  // progress. The summary (filled/skipped/failed counts) is surfaced as a notice.
  useEffect(() => subscribeHttpEvent(PYCORE_EVENT_TOPICS.subtitleLanguageFill, (d: any) => {
    const stage = String(d?.stage ?? '');
    setFillProgress({
      stage,
      done: Number(d?.done ?? 0),
      total: Number(d?.total ?? 0),
      detail: String(d?.detail ?? ''),
    });
    if (stage === 'done') {
      const s = d?.summary || {};
      const parts = [
        s.filled != null ? `${s.filled} filled` : null,
        s.skipped != null ? `${s.skipped} skipped` : null,
        s.failed != null ? `${s.failed} failed` : null,
      ].filter(Boolean).join(' · ');
      setNotice(`${L.veFillDone}${parts ? ' — ' + parts : ''}`);
      setFilling(false);
      setFillProgress(null);
    } else if (stage === 'error') {
      const errs = Array.isArray(d?.errors) ? d.errors.join('; ') : '';
      setNotice(`${L.veFillFailed}${d?.detail ? ': ' + d.detail : errs ? ': ' + errs : ''}`);
      setFilling(false);
      setFillProgress(null);
    }
  }), []);

  // ---- actions ---------------------------------------------------------- #
  const preview = useCallback(async (req: VeStartReq): Promise<string> => {
    const r: any = await requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractPreview, { ...req, dry_run: true })
      .catch((e: any) => ({ success: false, error: e?.message || 'pycore unreachable' }));
    if (!r.success) {
      const msg = `Error: ${r.error}`;
      setLocalOutput(msg);
      return msg;
    }
    const text = `${r.count} video(s) · ffmpeg ${r.ffmpeg_found ? 'OK' : 'missing'} · ${r.engine}/${r.model}/${r.device}\n` +
      (r.videos || []).slice(0, 50).map((v: string) => '  • ' + v).join('\n');
    setLocalOutput(text);
    return text;
  }, []);

  const start = useCallback(async (req: VeStartReq): Promise<void> => {
    setStarting(true); setPaused(false); setRanThisSession(true);
    setLocalOutput(null);
    finishedRef.current = null;
    settledTaskRef.current = null;
    task.set(null); // clear any prior finished snapshot so the UI shows "starting"
    // Inject the checked correspondence languages so the backend builds EVERY
    // selected language's subtitle track inline this run (provider chain → AI),
    // not just the primary. Primary is auto-included; this is the multi-select.
    const startReq = { ...req, selected_languages: corrLangsRef.current };
    const r: any = await requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractStart, startReq)
      .catch((e: any) => ({ success: false, error: e?.message || 'request failed' }));
    setStarting(false);
    if (!r.success || !r.task_id) {
      setNotice(r.error || 'Failed to start');
      return;
    }
    const tid = r.task_id;
    sessionRunRef.current = tid; // auto-sync eligibility: started THIS session
    task.begin({ taskId: tid, output: null, source: req.path ?? null });
  }, [task]);

  const stop = useCallback(() => {
    if (taskId) pycoreApi.cancelVideoExtractTask(taskId).catch(() => { /* optional */ });
    task.end();
    setPaused(false);
    setNotice('Stopped polling');
  }, [taskId, task]);

  const togglePause = useCallback(async (): Promise<void> => {
    if (!taskId) return;
    if (paused) {
      const r = await pycoreApi.resumeVideoExtractTask(taskId).catch(() => ({ success: false }));
      if (r.success) { setPaused(false); setNotice('Resumed'); } else setNotice('Resume failed');
    } else {
      const r = await pycoreApi.pauseVideoExtractTask(taskId).catch(() => ({ success: false }));
      if (r.success) { setPaused(true); setNotice('Paused'); } else setNotice('Pause failed');
    }
  }, [taskId, paused]);

  const syncSource = useCallback((sourcePath: string, languages?: string[]) => {
    if (!sourcePath) return;
    let alreadyInFlight = false;
    setSyncing((prev) => {
      if (prev.has(sourcePath)) { alreadyInFlight = true; return prev; }
      return new Set(prev).add(sourcePath);
    });
    if (alreadyInFlight) return;
    setSyncProgress({ stage: 'scan', done: 0, total: 0, detail: '' });
    const langs = (languages && languages.length) ? languages : corrLangsRef.current;
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractSyncSource, { source_path: sourcePath, languages: langs })
      .catch((e: any) => {
        setNotice(`${L.veSyncFailed}: ${e?.message || 'HTTP failed'}`);
        setSyncing((prev) => { const n = new Set(prev); n.delete(sourcePath); return n; });
        setSyncProgress(null);
      });
  }, []);

  // Idempotent sync of EVERYTHING (or the given roots) to Laravel. Guards like
  // syncSource: skipped while ANY sync (per-source or all) is in flight. The
  // SYNC_ALL_KEY sentinel in `syncing` is the "all" flag; progress + cleanup
  // ride the shared `video_extract_sync` subscription above.
  const syncAll = useCallback(async (paths?: string[], languages?: string[]): Promise<void> => {
    let alreadyInFlight = false;
    setSyncing((prev) => {
      if (prev.size > 0) { alreadyInFlight = true; return prev; }
      return new Set(prev).add(SYNC_ALL_KEY);
    });
    if (alreadyInFlight) return;
    setSyncProgress({ stage: 'scan', done: 0, total: 0, detail: '' });
    const langs = (languages && languages.length) ? languages : corrLangsRef.current;
    const payload: Record<string, unknown> = { languages: langs };
    if (paths && paths.length) payload.paths = paths;
    await requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractSyncAll, payload)
      .catch((e: any) => {
        setNotice(`${L.veSyncFailed}: ${e?.message || 'HTTP failed'}`);
        setSyncing(new Set());
        setSyncProgress(null);
      });
  }, []);

  // Fill every requested language with a `<stem>.<lang>.srt` sibling track.
  // Writes tracks locally (cached); the user then clicks the existing Sync to
  // submit them. Guarded like the sync actions: skipped while a fill is already
  // in flight; progress + cleanup ride the `subtitle_language_fill` subscription
  // above. Generous timeout (same as sync) — OpenSubtitles fetch + AI-translate
  // of full cue sets far exceeds requestPycoreHttp's 30s default.
  const fillLanguages = useCallback(async (
    paths?: string[], languages?: string[], strategy: 'api_first' | 'whisper' = 'api_first',
  ): Promise<void> => {
    if (filling) return;
    setFilling(true);
    setFillProgress({ stage: 'scan', done: 0, total: 0, detail: '' });
    const langs = (languages && languages.length) ? languages : corrLangsRef.current;
    const payload: Record<string, unknown> = { languages: langs, strategy };
    if (paths && paths.length) payload.paths = paths;
    await requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractFillLanguages, payload, 600_000)
      .catch((e: any) => {
        setNotice(`${L.veFillFailed}: ${e?.message || 'HTTP failed'}`);
        setFilling(false);
        setFillProgress(null);
      });
  }, [filling]);

  const setAutoSync = useCallback((v: boolean) => {
    autoSyncTouchedRef.current = true;
    setAutoSyncState(v);
    writeAutoSyncLs(v);
    // Backend round-trip (last_options.auto_sync) is persisted by the page's
    // options effect, which watches autoSync — see the state comment above.
  }, []);

  // Hydrate auto-sync from the backend-persisted options once on mount; the
  // backend value wins over the localStorage mirror UNLESS the user already
  // toggled this session. Offline → the mirror stands.
  useEffect(() => {
    pycoreApi.getVideoExtractHistory()
      .then((r: any) => {
        if (autoSyncTouchedRef.current) return;
        const a = (r?.last_options as any)?.auto_sync;
        if (typeof a === 'boolean') { setAutoSyncState(a); writeAutoSyncLs(a); }
      })
      .catch(() => { /* pycore offline — keep the localStorage value */ });
  }, []);

  // AUTO idempotent sync: when a run STARTED in this session completes
  // successfully, fire syncAll([root]) exactly once for that run (ref-guarded,
  // so re-renders/reloads never re-trigger). Skipped — and not retried — if
  // auto-sync is off or another sync is already in flight at completion time.
  useEffect(() => {
    if (!polled || !done || polled.status !== 'completed') return;
    const tid = polled.task_id ?? savedTaskId;
    if (!tid || tid !== sessionRunRef.current) return;
    if (autoSyncedRef.current === tid) return;
    autoSyncedRef.current = tid;
    if (!autoSync || syncing.size > 0) return;
    const root = (snapshotOf(polled).root as string | null | undefined) || null;
    setNotice(L.veAutoSyncStarted);
    syncAll(root ? [root] : undefined);
  }, [polled, done, savedTaskId, autoSync, syncing, syncAll]);

  const value: PcVideoExtractValue = {
    taskId, busy, paused, progress, snapshot, output, mapping, segmentsDir,
    syncing, syncingAll: syncing.has(SYNC_ALL_KEY), syncProgress,
    filling, fillProgress, ranThisSession,
    autoSync, setAutoSync, notice, setNotice,
    corrLanguages, setCorrLanguages,
    start, preview, stop, togglePause, syncSource, syncAll, fillLanguages,
  };
  return <PcVideoExtractContext.Provider value={value}>{children}</PcVideoExtractContext.Provider>;
}

export function usePcVideoExtract(): PcVideoExtractValue {
  const ctx = useContext(PcVideoExtractContext);
  if (!ctx) throw new Error('usePcVideoExtract must be used within <PcVideoExtractProvider>');
  return ctx;
}
