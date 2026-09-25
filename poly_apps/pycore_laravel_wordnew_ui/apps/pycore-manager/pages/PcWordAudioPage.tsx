/**
 * PcWordAudioPage — pycore word-audio (real pronunciation lookup) over the
 * Direct :59000: report which real-pronunciation sources are wired, then run a
 * live fetch of a single word's pronunciation and play it back.
 *
 * Mirrors PcSubtitleSearchPage's "status card + test form" shape, and reuses
 * PcImageSearchPage's base64→media idiom (there for <img>, here for <audio>):
 *
 *  1. Status — real-recording sources plus the separate Queue Center
 *     Kokoro/CPU batch policy. The Forvo key value is never returned.
 *
 *  2. Test — a word (default "hello") + language (default "en") feed
 *     `pycoreApi.testWordAudio()` over HTTP API, the real
 *     live fetch through the existing pronunciation client. On a hit the raw
 *     audio bytes come back base64-encoded, so a Play button plays them via a
 *     `data:` URI (new Audio('data:'+mime+';base64,'+audio_base64)); a provider
 *     badge, byte size and any meta are shown. A clean miss stays a lookup miss;
 *     background dictionary fill belongs to Queue Center.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2, RefreshCw, CheckCircle2, MinusCircle, WifiOff, Languages,
  Type, Play, Loader2, KeyRound, AudioLines, Info,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { WordAudioStatus, WordAudioTestResponse } from '@/apps/pycore-manager/api';

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
  const { t } = useTranslation('pc');
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
      setTestError(e?.message || t('wordAudioPage.fetchFailed'));
    } finally {
      setTestBusy(false);
    }
  }, [word, lang, testBusy, t]);

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
    <div className="p-3 sm:p-6 md:p-8 space-y-5">
      {/* header + status */}
      <section className="pc-glass p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Volume2 className="w-5 h-5 text-fuchsia-500" /> {t('wordAudioPage.title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">{t('wordAudioPage.subtitle')}</p>
          </div>
          <button onClick={() => void loadStatus()} disabled={loading}
            className="px-3 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('wordAudioPage.refresh')}
          </button>
        </div>

        {offline && (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-500">
            <WifiOff className="w-4 h-4" /> {t('wordAudioPage.offline')}
          </div>
        )}

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('wordAudioPage.status')}</span>
            <div className="flex items-center gap-2">
              <Badge ok={!!status?.forvo_key_present} okLabel={t('wordAudioPage.configured')} offLabel={t('wordAudioPage.notSet')} />
              <Badge ok={status?.batch_engine === 'kokoro'} okLabel={t('wordAudioPage.batchReady')} offLabel={t('wordAudioPage.unavailable')} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t('wordAudioPage.backend')}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.backend || t('wordAudioPage.unknown')}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><KeyRound className="w-3 h-3" /> {t('wordAudioPage.forvoKey')}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {status ? (status.forvo_key_present ? t('wordAudioPage.configured') : t('wordAudioPage.notSet')) : t('wordAudioPage.unknown')}
              </div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider flex items-center gap-1"><AudioLines className="w-3 h-3" /> {t('wordAudioPage.batchEngine')}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">{status?.batch_engine || status?.tts_engines?.[0] || 'kokoro'}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase tracking-wider">{t('wordAudioPage.batchPolicy')}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300">
                {(status?.batch_device || 'cpu').toUpperCase()} · {status?.batch_size || 20}
              </div>
            </div>
          </div>
          {status && !status.forvo_key_present && (
            <div className="mt-3 text-[10px] text-amber-500">{t('wordAudioPage.forvoHint')}</div>
          )}
          <div className="mt-3 flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <Info className="w-3 h-3 mt-0.5 shrink-0" /> {t('wordAudioPage.batchNote')}
          </div>
        </div>
      </section>

      {/* sources — real-pronunciation providers */}
      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <AudioLines className="w-4 h-4 text-fuchsia-500" /> {t('wordAudioPage.sources')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">{t('wordAudioPage.sourcesHint')}</p>

        {status && status.sources.length === 0 && (
          <div className="text-sm text-slate-400">{t('wordAudioPage.noSources')}</div>
        )}
        {!status && offline && (
          <div className="text-sm text-slate-400 flex items-center gap-2"><WifiOff className="w-4 h-4" /> {t('wordAudioPage.offline')}</div>
        )}

        {status && status.sources.length > 0 && (
          <div className="space-y-2">
            {status.sources.map((s) => (
              <div key={s.key}
                className="rounded-xl p-3.5 border flex items-start gap-3 bg-white/50 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t(`wordAudioPage.source.${s.key}.label`, { defaultValue: s.label })}</span>
                    <Badge ok={s.available} okLabel={t('wordAudioPage.available')} offLabel={t('wordAudioPage.unavailable')} />
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${s.requires_key
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-fuchsia-500/15 text-fuchsia-500'}`}>
                      {s.requires_key ? t('wordAudioPage.needsKey') : t('wordAudioPage.keyless')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono text-slate-400">{s.key}</div>
                  {s.note && (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t(`wordAudioPage.source.${s.key}.note`, { defaultValue: s.note })}</div>
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
          <Volume2 className="w-4 h-4 text-fuchsia-500" /> {t('wordAudioPage.test')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t('wordAudioPage.testHint')}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Type className="w-3 h-3" /> {t('wordAudioPage.word')}</label>
            <input value={word} onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
              placeholder={t('wordAudioPage.wordPlaceholder')}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <div className="w-[120px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Languages className="w-3 h-3" /> {t('wordAudioPage.language')}</label>
            <input value={lang} onChange={(e) => setLang(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
              placeholder={t('wordAudioPage.langPlaceholder')}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400" />
          </div>
          <button onClick={() => void runTest()} disabled={!canRun || testBusy}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {testBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            {testBusy ? t('wordAudioPage.fetching') : t('wordAudioPage.fetch')}
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
                    <CheckCircle2 className="w-3 h-3" /> {t('wordAudioPage.hit')}
                  </span>
                  {result.provider && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-500">
                      {t('wordAudioPage.provider')}: {result.provider}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">{t('wordAudioPage.size')}: {humanBytes(result.bytes || 0)}</span>
                  {result.mime && <span className="text-[10px] font-mono text-slate-400">{result.mime}</span>}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={playAudio} disabled={playing}
                    className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
                    {playing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {playing ? t('wordAudioPage.playing') : t('wordAudioPage.play')}
                  </button>
                  {/* native controls fallback (same data: URI) */}
                  <audio src={src} controls className="h-9 max-w-full" />
                </div>

                {result.source_id && (
                  <div className="text-[10px] font-mono text-slate-400 break-all">
                    <span className="uppercase tracking-wider mr-1">{t('wordAudioPage.sourceId')}:</span>{result.source_id}
                  </div>
                )}
                {result.meta && Object.keys(result.meta).length > 0 && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
                    <span className="uppercase tracking-wider mr-1 text-slate-400">{t('wordAudioPage.meta')}:</span>
                    {JSON.stringify(result.meta)}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                <MinusCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>{result.message || t('wordAudioPage.miss')}</span>
              </div>
            )
          ) : (
            !testError && <div className="text-sm text-slate-400">{t('wordAudioPage.noResult')}</div>
          )}
        </div>
      </section>
    </div>
  );
}
