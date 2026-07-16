/**
 * PcWordAudioPage — pycore word-audio (real pronunciation lookup) over the
 * Direct :59000: report which real-pronunciation sources are wired, then run a
 * live fetch of a single word's pronunciation and play it back.
 *
 * Mirrors PcSubtitleSearchPage's "status card + test form" shape, and reuses
 * PcImageSearchPage's base64→media idiom (there for <img>, here for <audio>):
 *
 *  1. Status — which real sources are available (pycore reports 3:
 *     free_dictionary_api / cambridge_dictionary / forvo — the last key-gated),
 *     whether the Forvo key is present (its value is NEVER returned), and that
 *     TTS is the last-resort fallback. Driven by `pycoreApi.getWordAudioStatus()`.
 *
 *  2. Test — a word (default "hello") + language (default "en") feed
 *     `pycoreApi.testWordAudio()` (POST /api/local/word-audio/test), the REAL
 *     live fetch through the existing pronunciation client. On a hit the raw
 *     audio bytes come back base64-encoded, so a Play button plays them via a
 *     `data:` URI (new Audio('data:'+mime+';base64,'+audio_base64)); a provider
 *     badge, byte size and any meta are shown. On a clean miss the returned
 *     message (TTS would cover it) is shown.
 *
 * Local React state only; every call is guarded and the page never crashes when
 * the backend (:59000) is offline. Hardcoded-English copy is centralized in `L`,
 * with zh values kept as comments (the pycore-manager pages have no `t` object).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Volume2, RefreshCw, CheckCircle2, MinusCircle, WifiOff, Languages,
  Type, Play, Loader2, KeyRound, AudioLines, Info,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { WordAudioStatus, WordAudioTestResponse } from '../../../core/api-libs/pycore';

// i18n labels (single source; the pages use literals, not a `t` object).
const L = {
  title: 'Word Audio',                                                // 单词发音
  subtitle: 'Fetch a real word pronunciation from Free Dictionary, Cambridge and Forvo, with a TTS fallback covering any miss.',
  refresh: 'Refresh',                                                 // 刷新
  status: 'Status',                                                   // 状态
  backend: 'Backend',                                                 // 后端
  sources: 'Pronunciation sources',                                  // 发音来源
  sourcesHint: 'The word-audio side tries these real sources; a clean miss falls back to TTS synthesis.',
  available: 'Available',                                             // 可用
  unavailable: 'Unavailable',                                        // 不可用
  needsKey: 'Needs key',                                             // 需要密钥
  keyless: 'Keyless',                                                // 无需密钥
  forvoKey: 'Forvo key',                                            // Forvo 密钥
  forvoPresent: 'Configured',                                        // 已配置
  forvoMissing: 'Not set',                                           // 未配置
  forvoHint: 'Set FORVO_API_KEY in the Special Software environment manager to enable Forvo.',
  streamelementsKey: 'StreamElements key',
  streamelementsPresent: 'Configured',
  streamelementsMissing: 'Not set',
  streamelementsHint: 'Set STREAMELEMENTS_API_KEY in the Special Software environment manager (.secret_keys/.secret_ignore) to enable the streamelements TTS engine.',
  ttsFallback: 'TTS fallback',                                       // TTS 回退
  ttsFallbackNote: 'TTS is the last-resort fallback — a word with no real pronunciation is still spoken.',
  noSources: 'No sources reported.',                                // 无来源
  test: 'Test pronunciation',                                       // 测试发音
  testHint: 'Enter a word and its language, then fetch the real pronunciation through the live client.',
  word: 'Word',                                                     // 单词
  wordPlaceholder: 'e.g. hello',                                    // 例如：hello
  language: 'Language',                                             // 语言
  langPlaceholder: 'en',                                            // en
  fetch: 'Fetch',                                                   // 获取
  fetching: 'Fetching…',                                           // 获取中…
  play: 'Play',                                                     // 播放
  playing: 'Playing…',                                             // 播放中…
  provider: 'Provider',                                             // 提供方
  size: 'Size',                                                     // 大小
  sourceId: 'Source ID',                                            // 来源 ID
  meta: 'Meta',                                                     // 元数据
  hit: 'Pronunciation found',                                       // 已找到发音
  miss: 'No real pronunciation',                                    // 未找到真实发音
  noResult: 'No result yet.',                                       // 暂无结果
  offline: 'pycore is offline — status unavailable.',               // pycore 离线 — 状态不可用
  notSet: 'unknown',                                                // 未知
  enterWord: 'Enter a word first',                                  // 请先输入单词
};

const OK_BADGE = 'bg-emerald-500/15 text-emerald-500';
const OFF_BADGE = 'bg-slate-500/15 text-slate-400';

function Badge({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  const Icon = ok ? CheckCircle2 : MinusCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ok ? OK_BADGE : OFF_BADGE}`}>
      <Icon className="w-3 h-3" /> {ok ? okLabel : offLabel}
    </span>
  );
}

/** Compact byte size (B / KB / MB). */
function humanBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Build a playable data: URI from a hit (base64 audio → <audio>/Audio idiom). */
function audioSrc(r: WordAudioTestResponse | null): string | null {
  if (!r || !r.success || !r.audio_base64) return null;
  return `data:${r.mime || 'audio/mpeg'};base64,${r.audio_base64}`;
}

export default function PcWordAudioPage() {
  const [status, setStatus] = useState<WordAudioStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [word, setWord] = useState('hello');
  const [lang, setLang] = useState('en');

  const [result, setResult] = useState<WordAudioTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getWordAudioStatus();
      setStatus(s);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const runTest = useCallback(async () => {
    const clean = word.trim();
    if (!clean || testBusy) return;
    setTestBusy(true);
    setTestError(null);
    setResult(null);
    try {
      const r = await pycoreApi.testWordAudio(clean, lang.trim() || 'en');
      setResult(r);
      setOffline(false);
    } catch (e: any) {
      setTestError(e?.message || 'fetch failed');
    } finally {
      setTestBusy(false);
    }
  }, [word, lang, testBusy]);

  const playAudio = useCallback(() => {
    const src = audioSrc(result);
    if (!src || playing) return;
    try {
      const audio = new Audio(src);
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      void audio.play().catch(() => setPlaying(false));
    } catch {
      setPlaying(false);
    }
  }, [result, playing]);

  const canRun = !!word.trim();
  const src = audioSrc(result);

  return (
    <div className="p-6 md:p-8 space-y-5">
      {/* header + status */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Volume2 className="w-5 h-5 text-fuchsia-500" /> {L.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{L.subtitle}</p>
          </div>
          <button onClick={() => void loadStatus()} disabled={loading}
            className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {L.refresh}
          </button>
        </div>

        {offline && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-500">
            <WifiOff className="w-4 h-4" /> {L.offline}
          </div>
        )}

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L.status}</span>
            <div className="flex items-center gap-2">
              <Badge ok={!!status?.forvo_key_present} okLabel={L.forvoPresent} offLabel={L.forvoMissing} />
              <Badge ok={!!status?.tts_fallback} okLabel={L.ttsFallback} offLabel={L.ttsFallback} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{L.backend}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.backend || L.notSet}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><KeyRound className="w-3 h-3" /> {L.forvoKey}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? (status.forvo_key_present ? L.forvoPresent : L.forvoMissing) : L.notSet}
              </div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><KeyRound className="w-3 h-3" /> {L.streamelementsKey}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? (status.streamelements_key_present ? L.streamelementsPresent : L.streamelementsMissing) : L.notSet}
              </div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><AudioLines className="w-3 h-3" /> {L.ttsFallback}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? (status.tts_fallback ? L.available : L.unavailable) : L.notSet}
              </div>
            </div>
          </div>
          {status && !status.forvo_key_present && (
            <div className="mt-3 text-[10px] text-amber-500">{L.forvoHint}</div>
          )}
          {status && !status.streamelements_key_present && (
            <div className="mt-3 text-[10px] text-amber-500">{L.streamelementsHint}</div>
          )}
          <div className="mt-3 flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <Info className="w-3 h-3 mt-0.5 shrink-0" /> {L.ttsFallbackNote}
          </div>
        </div>
      </section>

      {/* sources — real-pronunciation providers */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <AudioLines className="w-4 h-4 text-fuchsia-500" /> {L.sources}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">{L.sourcesHint}</p>

        {status && status.sources.length === 0 && (
          <div className="text-sm text-slate-400">{L.noSources}</div>
        )}
        {!status && offline && (
          <div className="text-sm text-slate-400 flex items-center gap-2"><WifiOff className="w-4 h-4" /> {L.offline}</div>
        )}

        {status && status.sources.length > 0 && (
          <div className="space-y-2">
            {status.sources.map((s) => (
              <div key={s.key}
                className="rounded-xl p-3.5 border flex items-start gap-3 bg-white/50 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.label}</span>
                    <Badge ok={s.available} okLabel={L.available} offLabel={L.unavailable} />
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${s.requires_key
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-fuchsia-500/15 text-fuchsia-500'}`}>
                      {s.requires_key ? L.needsKey : L.keyless}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono text-slate-400">{s.key}</div>
                  {s.note && (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{s.note}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* test box */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Volume2 className="w-4 h-4 text-fuchsia-500" /> {L.test}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{L.testHint}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Type className="w-3 h-3" /> {L.word}</label>
            <input value={word} onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
              placeholder={L.wordPlaceholder}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[120px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Languages className="w-3 h-3" /> {L.language}</label>
            <input value={lang} onChange={(e) => setLang(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
              placeholder={L.langPlaceholder}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <button onClick={() => void runTest()} disabled={!canRun || testBusy}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {testBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            {testBusy ? L.fetching : L.fetch}
          </button>
        </div>

        {/* result */}
        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          {testError && <div className="text-sm text-rose-500 mb-2">{testError}</div>}
          {result ? (
            result.success && src ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 className="w-3 h-3" /> {L.hit}
                  </span>
                  {result.provider && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-500">
                      {L.provider}: {result.provider}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">{L.size}: {humanBytes(result.bytes || 0)}</span>
                  {result.mime && <span className="text-[10px] font-mono text-slate-400">{result.mime}</span>}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={playAudio} disabled={playing}
                    className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
                    {playing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {playing ? L.playing : L.play}
                  </button>
                  {/* native controls fallback (same data: URI) */}
                  <audio src={src} controls className="h-9 max-w-full" />
                </div>

                {result.source_id && (
                  <div className="text-[10px] font-mono text-slate-400 break-all">
                    <span className="uppercase tracking-wider mr-1">{L.sourceId}:</span>{result.source_id}
                  </div>
                )}
                {result.meta && Object.keys(result.meta).length > 0 && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
                    <span className="uppercase tracking-wider mr-1 text-slate-400">{L.meta}:</span>
                    {JSON.stringify(result.meta)}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                <MinusCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>{result.message || L.miss}</span>
              </div>
            )
          ) : (
            !testError && <div className="text-sm text-slate-400">{L.noResult}</div>
          )}
        </div>
      </section>
    </div>
  );
}
