/**
 * PcPuterWordAudioBatchBar - persistent (cross-tab) word-audio batch bar.
 *
 * Collapsed by default; expand via the toggle button. Supports two audio
 * sources switchable in the UI:
 *
 *   Puter.js  — browser-side AWS Polly (visitor credits, no server cost).
 *   Longman   — Youdao CDN proxy (http://dict.youdao.com/dictvoice, no key
 *               needed, UK/US accent, configurable random delay between
 *               requests to stay within the CDN's rate limit).
 *
 * Word fix: if a word contains HTML markup or garbled chars, cleanWordText
 * replaces them with '-' and the batch calls /fix-word to persist the fix
 * back to the Laravel dictionary row.
 *
 * Dynamic priority queue: subscribes to the pycore WS bus for
 * 'word_audio_priority_boost' events (emitted when the wordnew library UI
 * boosts a word). On receipt, the boosted word is moved to the front of the
 * in-flight pending queue immediately.
 *
 * Retry: words where Longman fetch or upload fails are re-appended to the end
 * of the pending queue for one retry pass. Auto-continue: after a batch
 * completes, optionally auto-fetches the next batch from Laravel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe, connectPycoreWs } from '../../../core/api-libs/pycore/PycoreWs';
import { pycoreApi } from '../../../core/api-libs/pycore';
import { puterSynthesizeWord, blobToBase64, cleanWordText } from '../../../core/utils/puterAudio';
import { getDefaultBaseURL } from '../../../config/constants';

const LOG_KEY = 'pc_puter_word_batch_log';
const EXPAND_KEY = 'pc_puter_batch_expanded';
const SOURCE_KEY = 'pc_puter_batch_source';
const LONGMAN_ACCENT_KEY = 'pc_puter_batch_lm_accent';
const LONGMAN_DELAY_MIN_KEY = 'pc_puter_batch_lm_delay_min';
const LONGMAN_DELAY_MAX_KEY = 'pc_puter_batch_lm_delay_max';
const AUTO_CONTINUE_KEY = 'pc_puter_batch_auto_continue';
const LOG_CAP = 5000;
const PUTER_PACING_MS = 250;

type AudioSource = 'puter' | 'longman';
type BatchSize = '1000' | '5000' | '10000' | 'all';
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

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.floor(Math.random() * Math.max(1, max - min));
  return new Promise((r) => setTimeout(r, ms));
}


export function PcPuterWordAudioBatchBar(): JSX.Element {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(EXPAND_KEY) === '1');
  const [source, setSource] = useState<AudioSource>(
    () => (localStorage.getItem(SOURCE_KEY) as AudioSource) || 'puter',
  );
  const [longmanAccent, setLongmanAccent] = useState<'us' | 'uk'>(
    () => (localStorage.getItem(LONGMAN_ACCENT_KEY) as 'us' | 'uk') || 'us',
  );
  const [delayMin, setDelayMin] = useState(() => readInt(LONGMAN_DELAY_MIN_KEY, 500));
  const [delayMax, setDelayMax] = useState(() => readInt(LONGMAN_DELAY_MAX_KEY, 1200));
  const [autoContinue, setAutoContinue] = useState(() => localStorage.getItem(AUTO_CONTINUE_KEY) === '1');

  const [lang, setLang] = useState('en');
  const [batchSize, setBatchSize] = useState<BatchSize>('1000');
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>(() => loadLog());
  const [line, setLine] = useState('Idle — expand to configure and start.');
  const stopRef = useRef(false);
  const blobUrls = useRef<Map<string, string>>(new Map());
  // Mutable pending queue — WS priority-boost handler moves boosted words to front.
  const pendingRef = useRef<WordItem[]>([]);

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

  const setAutoContinuePersist = useCallback((v: boolean) => {
    localStorage.setItem(AUTO_CONTINUE_KEY, v ? '1' : '0');
    setAutoContinue(v);
  }, []);

  const setSourcePersist = useCallback((s: AudioSource) => {
    localStorage.setItem(SOURCE_KEY, s);
    setSource(s);
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

  const limitParam = (b: BatchSize): number => (b === 'all' ? 100000 : parseInt(b, 10));

  const playEntry = useCallback(async (e: LogEntry) => {
    const blobUrl = blobUrls.current.get(e.md5);
    if (blobUrl) {
      try { new Audio(blobUrl).play(); } catch { /* ignore */ }
      return;
    }
    try {
      const base = getDefaultBaseURL();
      const r = await fetch(`${base}/api/app_qy_v1/word/${encodeURIComponent(e.lang)}/${encodeURIComponent(e.word)}/media`);
      const j = await r.json();
      const url: string | null = j?.data?.audio_url || j?.url || null;
      if (url) {
        const full = url.startsWith('http') ? url : base + url;
        new Audio(full).play();
      }
    } catch { /* ignore */ }
  }, []);

  /** Fix a garbled word on the backend when the cleaned text differs. */
  const maybeFixWord = useCallback(async (md5: string, langCode: string, originalWord: string, cleaned: string) => {
    if (!cleaned || cleaned === originalWord) return;
    try {
      await pycoreApi.fixWordText({ md5, lang: langCode, cleaned_word: cleaned });
    } catch { /* non-critical; the audio was already stored */ }
  }, []);

  /**
   * Run one fetch+process+retry batch. Returns true when auto-continue should
   * fetch another batch (autoContinue enabled and at least one word succeeded).
   * Never recurses - the caller (start) loops instead, so `running` reflects
   * reality for the whole auto-continue chain (no window where the UI reports
   * "idle" while a continuation batch is still in flight).
   */
  const runOneBatch = useCallback(async (): Promise<boolean> => {
    setItems([]);
    const srcLabel = source === 'longman' ? 'Longman (Youdao CDN)' : 'Puter.js';
    setLine(`Fetching missing-audio words (limit=${batchSize}, lang=${lang})...`);
    try {
      const res = await pycoreApi.getWordAudioMissingBatch(limitParam(batchSize), lang);
      if (!res || res.success === false) {
        setLine(`Batch error: ${res?.error || 'pycore unreachable'}`);
        return false;
      }
      if (!res.words || res.words.length === 0) {
        setLine('No missing-audio words found (all done or none valid).');
        return false;
      }
      // Load initial batch into the mutable pending queue (WS boost handler reorders it).
      pendingRef.current = [...res.words];
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

        if (source === 'puter') {
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
              if (up?.data?.stored === true) {
                status = 'ok'; ok++;
                detail = 'uploaded';
                await maybeFixWord(w.md5, w.language, w.word, cleaned);
              } else {
                detail = up?.error || (up?.data?.stored === false ? 'not stored (already exists or validation fail)' : 'upload rejected');
              }
            } catch (e: any) { detail = `upload error: ${e?.message || e}`; }
          } else {
            detail = 'puter synth failed';
          }
          await new Promise((r) => setTimeout(r, PUTER_PACING_MS));
        } else {
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
              if (up?.data?.stored === true) {
                status = 'ok'; ok++;
                detail = `uploaded (${longmanAccent})`;
                await maybeFixWord(w.md5, w.language, w.word, cleaned);
              } else {
                detail = up?.error || (up?.data?.stored === false ? 'not stored (already exists)' : 'upload rejected');
                // Not a fetch failure — no retry needed; already stored on backend.
              }
            } catch (e: any) { detail = `upload error: ${e?.message || e}`; }
          } else {
            detail = audioResult?.error || 'longman fetch failed';
            retryQueue.push(w); // network failure → retry at end
            await maybeFixWord(w.md5, w.language, w.word, cleaned);
          }
          await randomDelay(delayMin, delayMax);
        }

        if (status !== 'ok') fail++;
        const item: LiveItem = { word: w.word, md5: w.md5, lang: w.language, status, at: Date.now(), detail, blobUrl };
        setItems((prev) => [item, ...prev].slice(0, 500));
        newLog.push({ word: item.word, md5: item.md5, lang: item.lang, status: item.status, at: item.at, detail: item.detail });
        setLine(`[${processed}/${totalFetched + retryQueue.length}] ${w.word} → ${detail}`);
      }

      // Retry pass: Longman network failures appended to end of queue.
      if (!stopRef.current && retryQueue.length > 0) {
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
              if (up?.data?.stored === true) {
                status = 'ok'; ok++; fail--;
                detail = `retry ok (${longmanAccent})`;
                await maybeFixWord(w.md5, w.language, w.word, cleaned);
              } else {
                detail = 'retry upload rejected';
              }
            } catch (e: any) { detail = `retry error: ${e?.message || e}`; }
          } else {
            detail = 'retry fetch failed';
          }
          if (status !== 'ok') fail++;
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
      if (stopRef.current) return false;
      setLine(`Batch complete: ok=${ok} fail=${fail} (of ${totalFetched}).`);
      return autoContinue && ok > 0;
    } catch (e: any) {
      setLine(`Batch error: ${e?.message || e}`);
      return false;
    }
  }, [lang, batchSize, source, longmanAccent, delayMin, delayMax, autoContinue, maybeFixWord]);

  /**
   * Start (or continue) batch processing. Sets `running` exactly once for the
   * whole auto-continue chain - no recursion, no gap where the UI reports
   * "idle" while a continuation batch is still running in the background.
   */
  const start = useCallback(async () => {
    if (running) return;
    setRunning(true);
    stopRef.current = false;
    try {
      // eslint-disable-next-line no-await-in-loop
      while (await runOneBatch()) {
        if (stopRef.current) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      setRunning(false);
    }
  }, [running, runOneBatch]);

  const stop = useCallback(() => {
    stopRef.current = true;
    setLine('Stopping after current word...');
  }, []);

  const clearLog = useCallback(() => {
    setLog([]);
    saveLog([]);
  }, []);

  const okCount = items.filter((i) => i.status === 'ok').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const total = items.length;

  const renderRow = (e: LiveItem | LogEntry, idx: number, live: boolean) => (
    <div key={`${e.md5}-${e.at}-${idx}`} className="flex items-center gap-2 px-2 py-1 text-xs border-b border-slate-800/60">
      <span className={`w-2 h-2 rounded-full shrink-0 ${e.status === 'ok' ? 'bg-emerald-500' : e.status === 'fail' ? 'bg-rose-500' : 'bg-amber-400'}`} />
      <span className="font-mono text-slate-300 truncate flex-1" title={e.word}>{e.word}</span>
      <span className="text-[10px] text-slate-500 shrink-0">{e.lang}</span>
      <span className={`text-[10px] shrink-0 ${e.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{e.detail || e.status}</span>
      <button onClick={() => playEntry(e)}
        className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
        title="Play audio">▶</button>
      {live && 'blobUrl' in e && <span className="text-[9px] text-sky-400 shrink-0">live</span>}
    </div>
  );

  const sourceLabel = source === 'longman' ? 'Longman' : 'Puter.js';

  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/80">
      {/* Collapsed header — always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-semibold text-sky-300">🔊 Word-Audio Batch</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${source === 'longman' ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'}`}>
          {sourceLabel}
        </span>
        {running && (
          <span className="text-[10px] text-emerald-400 animate-pulse">● running</span>
        )}
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
          {/* Source toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Source</span>
            <button
              onClick={() => setSourcePersist('puter')}
              disabled={running}
              className={`px-2 py-1 rounded text-xs font-semibold transition ${source === 'puter' ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Puter.js
            </button>
            <button
              onClick={() => setSourcePersist('longman')}
              disabled={running}
              className={`px-2 py-1 rounded text-xs font-semibold transition ${source === 'longman' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Longman
            </button>
          </div>

          {/* Longman-specific settings */}
          {source === 'longman' && (
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
                  type="number" min={100} max={10000} step={50}
                  value={delayMin}
                  onChange={(e) => setDelayMinPersist(Math.max(100, parseInt(e.target.value, 10) || delayMin))}
                  disabled={running}
                  className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
                />
                <label className="text-[10px] text-slate-400">Max</label>
                <input
                  type="number" min={100} max={30000} step={50}
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

          {/* Common settings: lang + batch size + start/stop */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={running}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200">
              <option value="en">en</option><option value="zh">zh</option><option value="ja">ja</option>
              <option value="ko">ko</option><option value="fr">fr</option><option value="de">de</option>
              <option value="es">es</option>
            </select>
            <select value={batchSize} onChange={(e) => setBatchSize(e.target.value as BatchSize)} disabled={running}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200">
              <option value="1000">1000</option><option value="5000">5000</option>
              <option value="10000">10000</option><option value="all">All</option>
            </select>
            {!running ? (
              <button onClick={start}
                className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500">
                Start
              </button>
            ) : (
              <button onClick={stop}
                className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500">
                Stop
              </button>
            )}
            {/* Auto-continue toggle */}
            <button
              onClick={() => setAutoContinuePersist(!autoContinue)}
              disabled={running}
              title="After each batch completes, auto-fetch the next missing-audio batch from Laravel"
              className={`px-2 py-1 rounded text-[10px] font-semibold transition ${autoContinue ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
            >
              {autoContinue ? '⟳ auto' : '⟳ manual'}
            </button>
            <span className="text-xs text-slate-400">
              {total > 0 ? `${total} processed · ok ${okCount} · fail ${failCount}` : 'idle'}
            </span>
            {log.length > 0 && (
              <button onClick={clearLog}
                className="ml-auto rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-600">
                Clear log ({log.length})
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-500">
            {source === 'puter'
              ? 'Browser-side Puter.js (visitor credits) · local log (word/path/status) · uploads to laravel · skips backend-invalid words · direct upload'
              : 'Longman CDN via pycore proxy · local log · uploads to laravel · word text fix when garbled · random delay between requests'}
          </p>

          {/* Live + history log */}
          {(items.length > 0 || log.length > 0) && (
            <div className="mt-1 max-h-56 overflow-y-auto rounded border border-slate-800 bg-slate-950/60">
              {items.length > 0 && (
                <>
                  <div className="sticky top-0 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-sky-400">This session</div>
                  {items.map((e, i) => renderRow(e, i, true))}
                </>
              )}
              {log.length > 0 && (
                <>
                  <div className="sticky top-0 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-500 mt-1">History ({log.length})</div>
                  {log.slice(0, 200).map((e, i) => renderRow(e, i, false))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
