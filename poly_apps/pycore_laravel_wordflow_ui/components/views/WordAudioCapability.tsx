/**
 * WordAudioCapability — laravel-manager page over laravel_main's real-word
 * pronunciation lookup.
 *
 *   - Sources : the real pronunciation sources laravel can reach
 *               (free_dictionary_api + forvo) with available / needs-key
 *               badges, a Forvo-key hint and the TTS last-resort note.
 *               Cheap GET /status — no network calls, never leaks the key.
 *   - Test box: a word + lang input that runs the REAL live fetch through the
 *               existing client (POST /test). On a hit it shows the provider
 *               badge, byte size, a Play button (base64 → <audio>) and meta;
 *               on a clean miss it shows the fallback message.
 *
 * Mirrors AiManagement's layout, glass CARD surface, Badge helpers, useToast
 * and global log usage at a smaller scale. BaseAPI auto-logs every request;
 * notable user actions also append to the global log store.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  AudioLines, RefreshCcw, CheckCircle2, AlertTriangle, MinusCircle, KeyRound,
  Play, Volume2, Sparkles,
} from 'lucide-react';
import { api } from '../../core/api';
import { useToast } from '../admin';
import { appendLog } from '../../core/logstore/logStore';
import type { WordAudioStatus, WordAudioTestResult } from '../../core/api/modules/WordAudioAPI';

/** Shared glass-card surface used across the laravel-manager views. */
const CARD = 'rounded-2xl ring-1 ring-slate-200/60 dark:ring-white/5 bg-white/70 dark:bg-white/[0.025] backdrop-blur-md shadow-sm';

/** Default test inputs. */
const DEFAULT_WORD = 'hello';
const DEFAULT_LANG = 'en';

/** Human-readable byte size. */
function fmtBytes(n?: number): string {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Availability badge for one source (available / needs-key / unavailable). */
const SourceBadge: React.FC<{ available: boolean; requiresKey: boolean }> = ({ available, requiresKey }) => {
  const map = available
    ? { cls: 'bg-emerald-500/15 text-emerald-500', Icon: CheckCircle2, label: 'Available' }
    : requiresKey
      ? { cls: 'bg-amber-500/15 text-amber-500', Icon: KeyRound, label: 'Needs key' }
      : { cls: 'bg-slate-500/15 text-slate-400', Icon: MinusCircle, label: 'Unavailable' };
  const { Icon } = map;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${map.cls}`}>
      <Icon className="w-3 h-3" /> {map.label}
    </span>
  );
};

const WordAudioCapability: React.FC = () => {
  const toast = useToast();

  const [status, setStatus] = useState<WordAudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  // Test box state.
  const [word, setWord] = useState(DEFAULT_WORD);
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<WordAudioTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // --- status -------------------------------------------------------------- #
  const loadStatus = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.wordAudio.getStatus();
      if (res.success && res.data) {
        setStatus(res.data);
        setStatusError(null);
        setUnreachable(false);
      } else {
        setUnreachable(true);
        setStatusError(res.error || 'laravel_main unreachable');
      }
    } catch (e: any) {
      setUnreachable(true);
      setStatusError(e?.message || 'laravel_main unreachable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  // --- test ---------------------------------------------------------------- #
  const runTest = useCallback(async () => {
    const w = word.trim();
    const l = lang.trim() || DEFAULT_LANG;
    if (!w || fetching) return;
    setFetching(true);
    setTestError(null);
    setResult(null);
    appendLog('info', 'word-audio', `Fetch pronunciation → "${w}" (${l})`);
    try {
      const res = await api.wordAudio.test(w, l);
      if (res.success && res.data) {
        const data = res.data;
        setResult(data);
        if (data.success) {
          toast.success(`${data.provider} · ${fmtBytes(data.bytes)}`, 'Word audio');
          appendLog('success', 'word-audio',
            `Pronunciation "${w}" (${l}) via ${data.provider} · ${fmtBytes(data.bytes)}`);
        } else {
          toast.info(data.message || 'No real pronunciation found', 'Word audio');
          appendLog('warn', 'word-audio', `Miss "${w}" (${l}) — TTS fallback would handle it`);
        }
      } else {
        const msg = res.error || 'Fetch failed';
        setTestError(msg);
        toast.error(msg, 'Word audio');
        appendLog('error', 'word-audio', `Fetch "${w}" (${l}) failed: ${msg}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Fetch failed';
      setTestError(msg);
      toast.error(msg, 'Word audio');
    } finally {
      setFetching(false);
    }
  }, [word, lang, fetching, toast]);

  // --- playback ------------------------------------------------------------ #
  const play = useCallback(() => {
    if (!result || !result.audio_base64) return;
    const mime = result.mime || 'audio/mpeg';
    try {
      const audio = new Audio(`data:${mime};base64,${result.audio_base64}`);
      void audio.play();
    } catch (e: any) {
      toast.error(e?.message || 'Playback failed', 'Word audio');
    }
  }, [result, toast]);

  const sources = status?.sources ?? [];

  return (
    <div className="p-6 md:p-8 space-y-5 min-w-0 max-w-full">
      {/* Sticky page chrome — title + refresh pinned while scrolling. */}
      <div className="sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-3 -mt-6 md:-mt-8 mb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl">
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <AudioLines className="w-5 h-5 text-indigo-500" /> Word Audio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            laravel_main real-pronunciation lookup — sources, availability and a live fetch test.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 self-end sm:self-auto">
          <button
            onClick={() => loadStatus(true)}
            disabled={loading || refreshing}
            title="Reload the pronunciation source status"
            className="px-3 py-2 ring-1 ring-slate-200/60 dark:ring-white/10 bg-white/60 dark:bg-white/5 hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50 text-slate-700 dark:text-slate-200">
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {(unreachable || statusError) && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            {unreachable ? 'laravel_main is unreachable.' : 'Word audio status reported a problem.'}
            {statusError ? ` (${statusError})` : ''}
          </span>
        </div>
      )}

      {/* ===================== Sources ===================== */}
      <section className={`${CARD} p-5`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Volume2 className="w-4 h-4 text-indigo-500" /> Pronunciation Sources
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real audio sources this backend can reach. TTS is the last-resort fallback when none has a hit.
            </p>
          </div>
          {status?.forvo_key_present != null && (
            <span
              title="Whether a FORVO_API_KEY is configured (the key itself is never shown)"
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                status.forvo_key_present ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'
              }`}>
              <KeyRound className="w-3 h-3" /> Forvo key {status.forvo_key_present ? 'set' : 'absent'}
            </span>
          )}
        </div>

        {loading && sources.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> Loading sources…
          </div>
        ) : sources.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            No sources reported by the backend.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sources.map((s) => (
              <div key={s.key}
                   className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate block">{s.label}</span>
                    <span className="text-[10px] font-mono text-slate-400">{s.key}</span>
                  </div>
                  <SourceBadge available={s.available} requiresKey={s.requires_key} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{s.note}</p>
              </div>
            ))}
          </div>
        )}

        {status?.tts_fallback && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400/70 shrink-0 mt-0.5" />
            <span>TTS is the last-resort fallback: when no real source has a pronunciation, the backend synthesizes the word.</span>
          </p>
        )}
      </section>

      {/* ===================== Fetch test ===================== */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <AudioLines className="w-4 h-4 text-indigo-500" /> Fetch test
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Run a real live pronunciation fetch through the existing client. A hit returns downloadable audio; a miss defers to TTS.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runTest(); } }}
            placeholder="Word…"
            disabled={fetching}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs border bg-white/60 dark:bg-white/5 border-slate-300/40 dark:border-white/10 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
          />
          <input
            type="text"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runTest(); } }}
            placeholder="Lang"
            disabled={fetching}
            className="shrink-0 w-full sm:w-24 px-3 py-2 rounded-xl text-xs border bg-white/60 dark:bg-white/5 border-slate-300/40 dark:border-white/10 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
          />
          <button
            onClick={() => void runTest()}
            disabled={fetching || !word.trim()}
            className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
            {fetching ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <AudioLines className="w-3.5 h-3.5" />}
            {fetching ? 'Fetching…' : 'Fetch'}
          </button>
        </div>

        {testError && (
          <div className="mt-3 flex items-start gap-2 text-xs rounded-xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{testError}</span>
          </div>
        )}

        {/* Clean miss — no real pronunciation, TTS fallback would handle it. */}
        {result && !result.success && (
          <div className="mt-3 flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
            <MinusCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{result.message || 'No real pronunciation found; the TTS fallback would handle it.'}</span>
          </div>
        )}

        {/* Hit — provider badge + byte size + Play + meta. */}
        {result && result.success && (
          <div className="mt-3 rounded-xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="w-3 h-3" /> {result.provider}
                </span>
                <span className="text-[10px] font-mono text-slate-400">{result.mime || 'audio/mpeg'}</span>
                <span className="text-[10px] font-mono text-slate-400">{fmtBytes(result.bytes)}</span>
              </div>
              <button
                onClick={play}
                disabled={!result.audio_base64}
                title="Play the fetched pronunciation"
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-40 bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25">
                <Play className="w-3.5 h-3.5" /> Play
              </button>
            </div>
            {result.source_id && (
              <p className="text-[10px] font-mono text-slate-400 truncate" title={result.source_id}>
                source_id: {result.source_id}
              </p>
            )}
            {result.meta && Object.keys(result.meta).length > 0 && (
              <pre className="mt-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-slate-500/5 rounded-lg p-2">
                {JSON.stringify(result.meta, null, 2)}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default WordAudioCapability;
