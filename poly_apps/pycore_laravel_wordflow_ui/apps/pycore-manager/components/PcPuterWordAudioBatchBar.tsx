/**
 * PcPuterWordAudioBatchBar — unified Word Audio panel (the only body of the
 * Queue Center wordAudio section; the section header shows state only).
 *
 * ONE idempotent On/Off auto toggle; semantics depend on the selected engine:
 *
 *   Browser sources (puter.js / longman) — the toggle IS the browser-side loop
 *   (fetch missing batch → synthesize → upload → next batch; internal fetch
 *   limit 500). The loop's running state is the toggle state: a natural stop
 *   (nothing left / no progress) flips the toggle Off.
 *
 *   pycore engines (edge default, listed from hub.tts) — the toggle drives the
 *   pycore word worker via setWordTtsAutoConfig; turning On (or switching
 *   engine while On) first writes the selected engine to the front of the
 *   word_tts priority profile (saveCapabilitySettings) so pycore rebinds live.
 *
 * Kept: longman accent US/UK + random delay min/max (browser sources), the
 * language select, the Laravel pending/leased counts (hub.voiceWord.laravel),
 * the local history log, and the pycore word worker's processing records
 * (hub.voiceWord.worker.events) with its heartbeat state. Playback uses the
 * hub's active Laravel endpoint, falling back to getDefaultBaseURL().
 *
 * Word fix: garbled words are cleaned and persisted back via /fix-word.
 * Dynamic priority queue: WS 'word_audio_priority_boost' moves boosted words to
 * the front of the in-flight pending queue.
 * Retry: words where a Longman fetch or upload fails are re-appended to the end
 * of the pending queue for one retry pass.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribe, connectPycoreWs } from '../../../core/api-libs/pycore/PycoreWs';
import { pycoreApi, ttsEngineUiState, ttsConcurrencyAnnotation } from '../../../core/api-libs/pycore';
import type { TtsStatus, TtsEngine } from '../../../core/api-libs/pycore/pycoreTypes';
import { puterSynthesizeWord, blobToBase64, cleanWordText } from '../../../core/utils/puterAudio';
import { getDefaultBaseURL } from '../../../config/constants';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

const LOG_KEY = 'pc_puter_word_batch_log';
const EXPAND_KEY = 'pc_puter_batch_expanded';
const ENGINE_KEY = 'pc_puter_batch_source';
const LONGMAN_ACCENT_KEY = 'pc_puter_batch_lm_accent';
const LONGMAN_DELAY_MIN_KEY = 'pc_puter_batch_lm_delay_min';
const LONGMAN_DELAY_MAX_KEY = 'pc_puter_batch_lm_delay_max';
const BROWSER_AUTO_KEY = 'pc_puter_batch_auto_continue';
// Persisted set of `${lang}:${md5}` keys already generated (SUCCESS only), so a
// page reload does not re-request words the backend may still re-list (e.g. a
// stale has_audio, or a laravel write that lagged). Failures are NOT persisted —
// they stay retryable in a fresh session; the durable truth is the server flag.
const DONE_KEY = 'pc_puter_batch_done';
const DONE_CAP = 200000;
const LOG_CAP = 5000;
/** pycore word worker concurrency (0/empty = backend recommended value). */
const WORD_CONCURRENCY_KEY = 'pc_word_tts_concurrency';
/** In-memory cap for the merged unified log (persisted history keeps LOG_CAP). */
const UNIFIED_LOG_CAP = 1000;
const PUTER_PACING_MS = 250;
/** Internal fetch size for browser-source batches (the selector was removed). */
const BROWSER_BATCH_LIMIT = 500;

type EntryStatus = 'ok' | 'fail' | 'pending';

interface WordItem { word: string; md5: string; language: string; }

interface LogEntry {
  word: string;
  md5: string;
  lang: string;
  status: EntryStatus;
  at: number;
  detail?: string;
}

interface LiveItem extends LogEntry {
  blobUrl?: string;
}

/**
 * One row of the unified log: browser-source entries (ok/fail/pending), live
 * session items, and pycore worker events share this shape (times in ms).
 */
interface UnifiedLogRow {
  at: number;
  kind: string;
  text: string;
  detail?: string;
  blobUrl?: string;
  lang?: string;
  md5?: string;
  live?: boolean;
}

const isBrowserSource = (engine: string): boolean => engine === 'puter' || engine === 'longman';

function readInt(key: string, fallback: number): number {
  const v = parseInt(localStorage.getItem(key) || '', 10);
  return isNaN(v) ? fallback : v;
}

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, LOG_CAP)));
  } catch {
    // quota — server has_audio flag is the durable truth
  }
}

function wordKey(lang: string, md5: string): string {
  return `${lang}:${md5}`;
}

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(done).slice(-DONE_CAP)));
  } catch {
    // quota — server has_audio flag is the durable truth
  }
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.floor(Math.random() * Math.max(1, max - min));
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Classify a laravel word-audio upload response. `stored:true` = a new file was
 * written. `stored:false` carries a `status` reason: exists / variant_exists =
 * the backend already has audio (a success — the word should drop out of the
 * missing-batch), whereas invalid / io_error / not_found are REAL problems that
 * must be surfaced as a failure (not silently reported as "already exists").
 */
function classifyUpload(up: any, uploadedDetail: string): { ok: boolean; uploaded: boolean; detail: string } {
  if (up?.data?.stored === true) return { ok: true, uploaded: true, detail: uploadedDetail };
  if (up?.data?.stored === false) {
    const st = up?.data?.status;
    if (st === 'exists' || st === 'variant_exists' || st == null) {
      return { ok: true, uploaded: false, detail: 'already exists' };
    }
    return { ok: false, uploaded: false, detail: `not stored (${st})` };
  }
  return { ok: false, uploaded: false, detail: up?.error || 'upload rejected' };
}


export function PcPuterWordAudioBatchBar(): JSX.Element {
  const hub = useQueueCenterHub();
  const [expanded, setExpanded] = useState(() => localStorage.getItem(EXPAND_KEY) === '1');
  const [engine, setEngine] = useState<string>(
    () => localStorage.getItem(ENGINE_KEY) || 'edge',
  );
  const [longmanAccent, setLongmanAccent] = useState<'us' | 'uk'>(
    () => (localStorage.getItem(LONGMAN_ACCENT_KEY) as 'us' | 'uk') || 'us',
  );
  const [delayMin, setDelayMin] = useState(() => readInt(LONGMAN_DELAY_MIN_KEY, 500));
  const [delayMax, setDelayMax] = useState(() => readInt(LONGMAN_DELAY_MAX_KEY, 1200));
  const [browserOn, setBrowserOn] = useState(() => localStorage.getItem(BROWSER_AUTO_KEY) === '1');
  const [concurrencyInput, setConcurrencyInput] = useState(() => localStorage.getItem(WORD_CONCURRENCY_KEY) ?? '');
  // Local cutoff for the unified log Clear (worker events are backend-owned, so
  // they are only hidden locally — everything at/before this ms-epoch is dropped).
  const [logClearedAt, setLogClearedAt] = useState(0);

  const [lang, setLang] = useState('en');
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>(() => loadLog());
  const [line, setLine] = useState('Idle — expand to configure.');
  const [toggleBusy, setToggleBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const blobUrls = useRef<Map<string, string>>(new Map());
  // Mutable pending queue — WS priority-boost handler moves boosted words to front.
  const pendingRef = useRef<WordItem[]>([]);
  // Session dedup: every word attempted this run (success OR fail), keyed
  // `${language}:${md5}`, so a loop tick / re-fetch never re-synthesizes it.
  // `doneRef` mirrors ONLY success keys to localStorage so a reload skips words
  // already generated.
  const attemptedRef = useRef<Set<string>>(new Set());
  const doneRef = useRef<Set<string>>(loadDone());

  // Subscribe to WS priority-boost events — reorder the in-flight pending queue.
  useEffect(() => {
    connectPycoreWs();
    const off = subscribe('word_audio_priority_boost', (data: { md5?: string; lang?: string }) => {
      const { md5, lang: boostLang } = data || {};
      if (!md5) return;
      const q = pendingRef.current;
      const idx = q.findIndex((w) => w.md5 === md5 && (!boostLang || w.language === boostLang));
      if (idx > 0) {
        const [word] = q.splice(idx, 1);
        q.unshift(word);
      }
    });
    return off;
  }, []);

  const toggle = useCallback(() => {
    setExpanded((v) => {
      localStorage.setItem(EXPAND_KEY, v ? '0' : '1');
      return !v;
    });
  }, []);

  const setBrowserOnPersist = useCallback((v: boolean) => {
    localStorage.setItem(BROWSER_AUTO_KEY, v ? '1' : '0');
    setBrowserOn(v);
  }, []);

  const setEnginePersist = useCallback((e: string) => {
    localStorage.setItem(ENGINE_KEY, e);
    setEngine(e);
  }, []);

  const setLongmanAccentPersist = useCallback((a: 'us' | 'uk') => {
    localStorage.setItem(LONGMAN_ACCENT_KEY, a);
    setLongmanAccent(a);
  }, []);

  const setDelayMinPersist = useCallback((v: number) => {
    localStorage.setItem(LONGMAN_DELAY_MIN_KEY, String(v));
    setDelayMin(v);
  }, []);

  const setDelayMaxPersist = useCallback((v: number) => {
    localStorage.setItem(LONGMAN_DELAY_MAX_KEY, String(v));
    setDelayMax(v);
  }, []);

  // Hub-derived engine/worker state.
  const ttsRaw = hub.tts as any;
  const ttsStatus: TtsStatus | null =
    ttsRaw && ttsRaw.success !== false && Array.isArray(ttsRaw.engines) ? (ttsRaw as TtsStatus) : null;
  const pycoreEngines: TtsEngine[] = ttsStatus?.engines ?? [];
  const selectedTts: TtsEngine | null = !isBrowserSource(engine)
    ? (pycoreEngines.find((e) => e.name === engine) ?? null)
    : null;
  const concurrency = ttsConcurrencyAnnotation(selectedTts?.concurrency, engine);
  // Serial engines (edge) are fixed at 1; others accept a user value (0 = recommended).
  const isSerialEngine = !isBrowserSource(engine)
    && (selectedTts?.concurrency ?? (engine === 'edge' ? 'serial' : undefined)) === 'serial';
  const workerConcurrency = hub.voiceWord?.concurrency;
  const concurrencyRecommended = hub.voiceWord?.concurrency_recommended;
  const workerAutoOn = hub.voiceWord?.auto_start === true;
  const autoOn = isBrowserSource(engine) ? browserOn : workerAutoOn;
  const wordWorker = hub.voiceWord?.worker ?? null;
  const workerEvents = wordWorker?.events ?? [];
  const heartbeatOn = wordWorker?.heartbeat_enabled ?? hub.voiceWord?.heartbeat_enabled ?? false;
  const laravelPending = hub.voiceWord?.laravel?.pending ?? null;
  const laravelLeased = hub.voiceWord?.laravel?.leased ?? null;

  // Persist the word_tts priority profile with the selected engine at the front;
  // pycore rebinds the live chain on save.
  const saveWordPriority = useCallback(async (name: string) => {
    const rest = pycoreEngines.map((e) => e.name).filter((n) => n !== name);
    await pycoreApi.saveCapabilitySettings('word_tts', { priority: [name, ...rest] });
  }, [pycoreEngines]);

  // Concurrency input: persist locally and push to the word worker config
  // (0/empty = use the backend-recommended value).
  const onConcurrencyChange = useCallback((raw: string) => {
    setConcurrencyInput(raw);
    localStorage.setItem(WORD_CONCURRENCY_KEY, raw);
    const n = Math.min(8, Math.max(0, parseInt(raw, 10) || 0));
    setActionErr(null);
    pycoreApi.setWordTtsConcurrency(n, workerAutoOn)
      .then(() => hub.refreshHub())
      .catch((e: any) => setActionErr(e?.message || 'concurrency save failed'));
  }, [workerAutoOn, hub]);

  // THE single On/Off auto toggle (idempotent). Browser sources flip the local
  // loop state; pycore engines drive the backend word worker.
  const onToggleAuto = useCallback(async () => {
    if (toggleBusy) return;
    setActionErr(null);
    if (isBrowserSource(engine)) {
      const next = !browserOn;
      setBrowserOnPersist(next);
      if (!next && runningRef.current) {
        stopRef.current = true;
        setLine('Stopping after current word…');
      }
      return; // the driver effect below starts the loop when next === true
    }
    setToggleBusy(true);
    try {
      const next = !workerAutoOn;
      if (next) await saveWordPriority(engine);
      await pycoreApi.setWordTtsAutoConfig(next);
      hub.refreshHub();
    } catch (e: any) {
      setActionErr(e?.message || 'toggle failed');
    } finally {
      setToggleBusy(false);
    }
  }, [toggleBusy, engine, browserOn, workerAutoOn, saveWordPriority, hub, setBrowserOnPersist]);

  // Engine change: browser sources take effect on the next loop round; switching
  // to a pycore engine while the worker is On re-points the live chain first.
  const onEngineChange = useCallback(async (next: string) => {
    setEnginePersist(next);
    setActionErr(null);
    if (!isBrowserSource(next) && workerAutoOn) {
      try {
        await saveWordPriority(next);
        hub.refreshHub();
      } catch (e: any) {
        setActionErr(e?.message || 'priority save failed');
      }
    }
  }, [workerAutoOn, saveWordPriority, hub, setEnginePersist]);

  const playEntry = useCallback(async (e: LogEntry) => {
    const blobUrl = blobUrls.current.get(e.md5);
    if (blobUrl) {
      try { new Audio(blobUrl).play(); } catch { /* ignore */ }
      return;
    }
    try {
      const base = hub.laravelActiveEndpoint ?? getDefaultBaseURL();
      const r = await fetch(`${base}/api/app_qy_v1/word/${encodeURIComponent(e.lang)}/${encodeURIComponent(e.word)}/media`);
      const j = await r.json();
      const url: string | null = j?.data?.audio_url || j?.url || null;
      if (url) {
        const full = url.startsWith('http') ? url : base + url;
        new Audio(full).play();
      }
    } catch { /* ignore */ }
  }, [hub.laravelActiveEndpoint]);

  /** Fix a garbled word on the backend when the cleaned text differs. */
  const maybeFixWord = useCallback(async (md5: string, langCode: string, originalWord: string, cleaned: string) => {
    if (!cleaned || cleaned === originalWord) return;
    try {
      await pycoreApi.fixWordText({ md5, lang: langCode, cleaned_word: cleaned });
    } catch { /* non-critical; the audio was already stored */ }
  }, []);

  /**
   * Run one fetch+process+retry batch (browser sources only). Returns true when
   * the loop should fetch another batch (at least one word succeeded). Never
   * recurses - the caller (startLoop) loops instead, so `running` reflects
   * reality for the whole chain.
   */
  const runOneBatch = useCallback(async (): Promise<boolean> => {
    setItems([]);
    const srcLabel = engine === 'longman' ? 'Longman (Youdao CDN)' : 'Puter.js';
    setLine(`Fetching words with NO backend audio (limit=${BROWSER_BATCH_LIMIT}, lang=${lang})...`);
    try {
      const res = await pycoreApi.getWordAudioMissingBatch(BROWSER_BATCH_LIMIT, lang);
      if (!res || res.success === false) {
        setLine(`Batch error: ${res?.error || 'pycore unreachable'}`);
        return false;
      }
      if (!res.words || res.words.length === 0) {
        setLine('No missing-audio words found (all done or none valid).');
        return false;
      }
      // Drop words already handled this session (success OR fail) or generated in a
      // prior session (persisted success set). Without this, a word the backend
      // re-lists — because a synth/upload failure left has_audio=false — is
      // regenerated on every loop tick and every reload.
      const fresh = res.words.filter((w) => {
        const k = wordKey(w.language, w.md5);
        return !attemptedRef.current.has(k) && !doneRef.current.has(k);
      });
      if (fresh.length === 0) {
        setLine(`All ${res.words.length} fetched word(s) already processed this session — nothing new.`);
        return false;
      }
      // Load initial batch into the mutable pending queue (WS boost handler reorders it).
      pendingRef.current = [...fresh];
      const totalFetched = pendingRef.current.length;
      let processed = 0;
      let ok = 0;
      let fail = 0;
      const retryQueue: WordItem[] = [];
      const newLog: LogEntry[] = [];
      setLine(`Processing ${totalFetched} word(s) via ${srcLabel}...`);

      while (pendingRef.current.length > 0) {
        if (stopRef.current) {
          setLine(`Stopped at ${processed}/${totalFetched}.`);
          break;
        }
        const w = pendingRef.current.shift()!;
        processed++;
        const cleaned = cleanWordText(w.word);
        const speakText = cleaned || w.word;
        let status: EntryStatus = 'fail';
        let detail = '';
        let blobUrl: string | undefined;
        // Longman network failures are re-appended to retryQueue for one pass; defer
        // recording those in the dedup set until the retry pass resolves them.
        let queuedForRetry = false;

        if (engine === 'puter') {
          const accent = lang === 'en' ? 'us' : null;
          let result = null;
          try { result = await puterSynthesizeWord(speakText, w.language, accent); } catch { result = null; }
          if (result) {
            blobUrl = result.objectUrl;
            blobUrls.current.set(w.md5, blobUrl);
            try {
              const b64 = await blobToBase64(result.blob);
              const up = await pycoreApi.uploadWordAudio({
                md5: w.md5, lang: w.language, audio_base64: b64, provider: 'puter',
                accent, cleaned_word: cleaned !== w.word ? cleaned : undefined,
              });
              const c = classifyUpload(up, 'uploaded');
              if (c.ok) { status = 'ok'; ok++; }
              detail = c.detail;
              if (c.uploaded) await maybeFixWord(w.md5, w.language, w.word, cleaned);
            } catch (e: any) { detail = `upload error: ${e?.message || e}`; }
          } else {
            detail = 'puter synth failed';
          }
          await new Promise((r) => setTimeout(r, PUTER_PACING_MS));
        } else {
          // longman (Youdao CDN via pycore proxy)
          const accentType = longmanAccent === 'uk' ? 1 : 2;
          let audioResult = null;
          try { audioResult = await pycoreApi.fetchYoudaoAudio(speakText, accentType); } catch { audioResult = null; }
          if (audioResult?.success && audioResult.audio_base64) {
            try {
              const up = await pycoreApi.uploadWordAudio({
                md5: w.md5, lang: w.language,
                audio_base64: audioResult.audio_base64,
                provider: 'longman',
                accent: longmanAccent,
                cleaned_word: cleaned !== w.word ? cleaned : undefined,
              });
              const c = classifyUpload(up, `uploaded (${longmanAccent})`);
              if (c.ok) { status = 'ok'; ok++; }
              detail = c.detail;
              if (c.uploaded) await maybeFixWord(w.md5, w.language, w.word, cleaned);
            } catch (e: any) { detail = `upload error: ${e?.message || e}`; }
          } else {
            detail = audioResult?.error || 'longman fetch failed';
            retryQueue.push(w); // network failure → retry at end
            queuedForRetry = true;
            await maybeFixWord(w.md5, w.language, w.word, cleaned);
          }
          await randomDelay(delayMin, delayMax);
        }

        if (status !== 'ok') fail++;
        // Session dedup bookkeeping (skip words deferred to the longman retry pass).
        if (!queuedForRetry) {
          const k = wordKey(w.language, w.md5);
          attemptedRef.current.add(k);
          if (status === 'ok') doneRef.current.add(k);
        }
        const item: LiveItem = { word: w.word, md5: w.md5, lang: w.language, status, at: Date.now(), detail, blobUrl };
        setItems((prev) => [item, ...prev].slice(0, 500));
        newLog.push({ word: item.word, md5: item.md5, lang: item.lang, status: item.status, at: item.at, detail: item.detail });
        setLine(`[${processed}/${totalFetched + retryQueue.length}] ${w.word} → ${detail}`);
      }

      // Retry pass: Longman network failures appended to end of queue.
      if (engine === 'longman' && !stopRef.current && retryQueue.length > 0) {
        setLine(`Retrying ${retryQueue.length} failed word(s)...`);
        pendingRef.current = [...retryQueue];
        while (pendingRef.current.length > 0) {
          if (stopRef.current) break;
          const w = pendingRef.current.shift()!;
          processed++;
          const cleaned = cleanWordText(w.word);
          const speakText = cleaned || w.word;
          const accentType = longmanAccent === 'uk' ? 1 : 2;
          let audioResult = null;
          try { audioResult = await pycoreApi.fetchYoudaoAudio(speakText, accentType); } catch { audioResult = null; }
          let status: EntryStatus = 'fail';
          let detail = '';
          if (audioResult?.success && audioResult.audio_base64) {
            try {
              const up = await pycoreApi.uploadWordAudio({
                md5: w.md5, lang: w.language, audio_base64: audioResult.audio_base64,
                provider: 'longman', accent: longmanAccent,
                cleaned_word: cleaned !== w.word ? cleaned : undefined,
              });
              const c = classifyUpload(up, `retry ok (${longmanAccent})`);
              if (c.ok) { status = 'ok'; ok++; fail--; }
              detail = c.detail;
              if (c.uploaded) await maybeFixWord(w.md5, w.language, w.word, cleaned);
            } catch (e: any) { detail = `retry error: ${e?.message || e}`; }
          } else {
            detail = 'retry fetch failed';
          }
          if (status !== 'ok') fail++;
          const rk = wordKey(w.language, w.md5);
          attemptedRef.current.add(rk);
          if (status === 'ok') doneRef.current.add(rk);
          const item: LiveItem = { word: w.word, md5: w.md5, lang: w.language, status, at: Date.now(), detail };
          setItems((prev) => [item, ...prev].slice(0, 500));
          newLog.push({ word: item.word, md5: item.md5, lang: item.lang, status: item.status, at: item.at, detail: item.detail });
          setLine(`[retry] ${w.word} → ${detail}`);
          await randomDelay(delayMin, delayMax);
        }
      }

      if (newLog.length) {
        setLog((prev) => { const m = [...newLog.reverse(), ...prev].slice(0, LOG_CAP); saveLog(m); return m; });
      }
      saveDone(doneRef.current);
      if (stopRef.current) return false;
      setLine(`Batch complete: ok=${ok} fail=${fail} (of ${totalFetched}).`);
      // The On toggle subsumes auto-continue: keep looping while progress is made.
      return ok > 0;
    } catch (e: any) {
      setLine(`Batch error: ${e?.message || e}`);
      return false;
    }
  }, [lang, engine, longmanAccent, delayMin, delayMax, maybeFixWord]);

  // Latest-closure ref so an in-flight loop picks up engine/setting changes on
  // the NEXT batch without restarting (browser sources: "next round takes effect").
  const runOneBatchRef = useRef(runOneBatch);
  runOneBatchRef.current = runOneBatch;

  /**
   * Start (or continue) the browser-source loop. Sets `running` exactly once
   * for the whole chain - no recursion, no gap where the UI reports "idle"
   * while a continuation batch is still running in the background. The toggle
   * state IS the loop state: any exit (natural stop, no progress, or Off)
   * flips the toggle off.
   */
  const startLoop = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    stopRef.current = false;
    try {
      // eslint-disable-next-line no-await-in-loop
      while (await runOneBatchRef.current()) {
        if (stopRef.current) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      setBrowserOnPersist(false);
    }
  }, [setBrowserOnPersist]);

  // Driver: the browser-source toggle turns the loop on; Off is handled by
  // stopRef inside the loop itself.
  useEffect(() => {
    if (browserOn && isBrowserSource(engine) && !running) void startLoop();
  }, [browserOn, engine, running, startLoop]);

  // One Clear for the whole unified log: empties the local sources (persisted
  // history + live session items) and hides the backend-owned worker events.
  const clearLog = useCallback(() => {
    setLog([]);
    saveLog([]);
    setItems([]);
    setLogClearedAt(Date.now());
  }, []);

  // Merge worker events (sec → ms) with local history + live items into one
  // time-sorted (desc) unified log; live items win on md5+at collisions.
  const unifiedRows = useMemo<UnifiedLogRow[]>(() => {
    const rows: UnifiedLogRow[] = [];
    const seen = new Set<string>();
    for (const it of items) {
      rows.push({
        at: it.at, kind: it.status, text: it.word, detail: it.detail,
        blobUrl: it.blobUrl, lang: it.lang, md5: it.md5, live: true,
      });
      seen.add(`${it.md5}:${it.at}`);
    }
    for (const e of log) {
      const key = `${e.md5}:${e.at}`;
      if (seen.has(key)) continue;
      rows.push({ at: e.at, kind: e.status, text: e.word, detail: e.detail, lang: e.lang, md5: e.md5 });
      seen.add(key);
    }
    for (const ev of workerEvents) {
      const atMs = (ev.at ?? 0) * 1000;
      if (atMs <= logClearedAt) continue;
      rows.push({
        at: atMs, kind: ev.kind || 'event', text: ev.text_preview || '',
        detail: ev.detail, lang: ev.language,
      });
    }
    rows.sort((a, b) => b.at - a.at);
    return rows.slice(0, UNIFIED_LOG_CAP);
  }, [items, log, workerEvents, logClearedAt]);

  const okCount = items.filter((i) => i.status === 'ok').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const total = items.length;

  const renderRow = (r: UnifiedLogRow, idx: number) => (
    <div key={`${r.md5 || r.kind}-${r.at}-${idx}`} className="flex items-center gap-2 px-2 py-1 text-xs border-b border-slate-800/60">
      <span className={`px-1 rounded text-[9px] font-bold uppercase shrink-0 ${
        r.kind === 'ok'
          ? 'bg-emerald-500/15 text-emerald-400'
          : r.kind === 'fail'
            ? 'bg-rose-500/15 text-rose-400'
            : r.kind === 'pending'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-sky-500/15 text-sky-400'}`}>{r.kind}</span>
      <span className="text-[10px] text-slate-500 shrink-0">{r.at ? new Date(r.at).toLocaleTimeString() : '—'}</span>
      <span className="font-mono text-slate-300 truncate flex-1" title={r.text || r.detail}>{r.text || r.detail || '—'}</span>
      {r.lang && <span className="text-[10px] text-slate-500 shrink-0">{r.lang}</span>}
      {r.detail && r.text && (
        <span className="text-[10px] text-slate-500 truncate shrink-0 max-w-[40%]" title={r.detail}>{r.detail}</span>
      )}
      {r.md5 && r.lang && (
        <button onClick={() => playEntry({ word: r.text, md5: r.md5!, lang: r.lang!, status: 'ok', at: r.at })}
          className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
          title="Play audio">▶</button>
      )}
      {r.live && <span className="text-[9px] text-sky-400 shrink-0">live</span>}
    </div>
  );

  const engineLabel = engine === 'longman' ? 'Longman' : engine === 'puter' ? 'Puter.js' : engine;
  const selectedUiState = selectedTts ? ttsEngineUiState(selectedTts.installed, selectedTts.available) : null;
  // Engine options: pycore engines from hub.tts; ensure the default 'edge' is
  // always selectable even before the first hub poll lands.
  const pycoreEngineNames = pycoreEngines.map((e) => e.name);
  const optionNames = pycoreEngineNames.length
    ? (pycoreEngineNames.includes('edge') ? pycoreEngineNames : ['edge', ...pycoreEngineNames])
    : ['edge'];

  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/80">
      {/* Collapsed header — always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-semibold text-sky-300">🔊 Word Audio</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isBrowserSource(engine) ? 'bg-sky-500/20 text-sky-400' : 'bg-violet-500/20 text-violet-400'}`}>
          {engineLabel}
        </span>
        <span className={`text-[10px] font-bold ${autoOn ? 'text-emerald-400' : 'text-slate-500'}`}>
          {autoOn ? (running ? '● auto on · running' : '● auto on') : 'auto off'}
        </span>
        <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">{line}</span>
        <button
          onClick={toggle}
          className="shrink-0 rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-600"
        >
          {expanded ? '▲ collapse' : '▼ expand'}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/60 pt-2">
          {/* Engine selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Engine</span>
            <select
              value={engine}
              onChange={(e) => onEngineChange(e.target.value)}
              disabled={running}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            >
              <optgroup label="Browser">
                <option value="puter">puter.js (browser AWS Polly)</option>
                <option value="longman">longman (Youdao CDN)</option>
              </optgroup>
              <optgroup label="pycore engines">
                {optionNames.map((name) => {
                  const te = pycoreEngines.find((e) => e.name === name);
                  const ann = ttsConcurrencyAnnotation(te?.concurrency, name);
                  return (
                    <option key={name} value={name}>
                      {name}{ann ? ` — ${ann}` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            {!isBrowserSource(engine) && (
              <>
                {selectedUiState && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    selectedUiState === 'ready'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : selectedUiState === 'setup'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-600/40 text-slate-400'}`}>
                    {selectedUiState}
                  </span>
                )}
                {!selectedTts && ttsStatus && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-600/40 text-slate-400">missing</span>
                )}
                {selectedTts?.server_engine && selectedTts?.server_running && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400">svc</span>
                )}
                {concurrency && (
                  <span className="text-[10px] font-mono text-slate-500">{concurrency}</span>
                )}
                <label className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  concurrency
                  <input
                    type="text"
                    value={isSerialEngine ? '1' : concurrencyInput || (workerConcurrency ? String(workerConcurrency) : '')}
                    placeholder={concurrencyRecommended ? String(concurrencyRecommended) : 'auto'}
                    onChange={(e) => onConcurrencyChange(e.target.value)}
                    disabled={isSerialEngine}
                    title={isSerialEngine
                      ? 'Serial engine — concurrency is fixed at 1'
                      : 'pycore word worker concurrency (0/empty = recommended)'}
                    className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 disabled:opacity-50"
                  />
                </label>
              </>
            )}
          </div>

          {/* THE single On/Off auto toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onToggleAuto}
              disabled={toggleBusy}
              title={isBrowserSource(engine)
                ? 'On: browser loop fetches missing words → synthesizes → uploads → next batch. Off: stop after the current word.'
                : `On: pycore word worker synthesizes via ${engine} (saved to the word_tts priority front). Off: stop the worker.`}
              className={`px-3 py-1 rounded text-xs font-semibold transition disabled:opacity-50 ${
                autoOn ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {toggleBusy ? '…' : autoOn ? '⏻ Auto On' : '⏻ Auto Off'}
            </button>
            <span className="text-[10px] text-slate-500">
              {isBrowserSource(engine)
                ? 'Browser loop: fetch missing words → synthesize → upload → next batch.'
                : `pycore word worker synthesizes via ${engine}.`}
            </span>
            {actionErr && <span className="text-[10px] text-rose-400">{actionErr}</span>}
          </div>

          {/* Longman-specific settings (browser source) */}
          {engine === 'longman' && (
            <div className="rounded border border-amber-700/40 bg-amber-950/20 p-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider">Accent</span>
                <button
                  onClick={() => setLongmanAccentPersist('us')}
                  disabled={running}
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${longmanAccent === 'us' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >US</button>
                <button
                  onClick={() => setLongmanAccentPersist('uk')}
                  disabled={running}
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${longmanAccent === 'uk' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >UK</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider">Delay (ms)</span>
                <label className="text-[10px] text-slate-400">Min</label>
                <input
                  type="text"
                  value={delayMin}
                  onChange={(e) => setDelayMinPersist(Math.max(100, parseInt(e.target.value, 10) || delayMin))}
                  disabled={running}
                  className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
                />
                <label className="text-[10px] text-slate-400">Max</label>
                <input
                  type="text"
                  value={delayMax}
                  onChange={(e) => setDelayMaxPersist(Math.max(delayMin, parseInt(e.target.value, 10) || delayMax))}
                  disabled={running}
                  className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
                />
                <span className="text-[10px] text-slate-500">random in [{delayMin}, {delayMax}] ms per word</span>
              </div>
              <p className="text-[10px] text-amber-500/70">
                Longman CDN (dict.youdao.com/dictvoice) · no key · server-proxied to avoid CORS · rate-limit via delay above
              </p>
            </div>
          )}

          {/* Common row: language + Laravel counts + session tally + clear log */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={running}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200">
              <option value="en">en</option><option value="zh">zh</option><option value="ja">ja</option>
              <option value="ko">ko</option><option value="fr">fr</option><option value="de">de</option>
              <option value="es">es</option>
            </select>
            <span className="text-[10px] font-mono text-slate-400" title="Laravel word-audio queue (hub)">
              laravel pending <b className="text-sky-400">{laravelPending ?? '—'}</b>
              {' · '}leased <b className="text-violet-400">{laravelLeased ?? '—'}</b>
            </span>
            <span className="text-xs text-slate-400">
              {total > 0 ? `${total} processed · ok ${okCount} · fail ${failCount}` : 'idle'}
            </span>
          </div>

          {/* pycore word worker: heartbeat + totals (its events feed the unified log below) */}
          {!isBrowserSource(engine) && (
            <div className="rounded border border-slate-800 bg-slate-950/60">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 flex items-center gap-2 flex-wrap">
                <span>pycore worker</span>
                <span className={heartbeatOn ? 'text-emerald-400' : 'text-slate-500'}
                  title="Word worker live heartbeat">
                  heartbeat {heartbeatOn ? 'on' : 'off'}
                </span>
                {wordWorker && (
                  <span className="font-mono font-normal">
                    claimed {wordWorker.total_claimed ?? 0} · ok {wordWorker.total_succeeded ?? 0} · fail {wordWorker.total_failed ?? 0}
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="rounded border border-sky-700/40 bg-sky-950/20 px-2 py-1 text-[10px] text-sky-300/90">
            Browser sources fetch up to {BROWSER_BATCH_LIMIT} missing-audio words per
            round and synthesize them one by one per the settings above; pycore
            engines run in the backend word worker with its own batching. Only
            words the backend has NO audio for are requested. The backend
            reconciles each candidate against the actual audio file on disk and
            self-heals stale flags, so a word that already has audio is never
            re-served (no repeat "already exists").
          </p>

          {/* Unified log: live session items + persisted history + pycore worker events */}
          {unifiedRows.length > 0 && (
            <div className="mt-1 max-h-56 overflow-y-auto rounded border border-slate-800 bg-slate-950/60">
              <div className="sticky top-0 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-500 flex items-center gap-2">
                <span>Unified log ({unifiedRows.length})</span>
                <button onClick={clearLog}
                  className="ml-auto rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600">
                  Clear
                </button>
              </div>
              {unifiedRows.map((r, i) => renderRow(r, i))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
