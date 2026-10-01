/**
 * PcWordAudioPage — pycore word-audio (real pronunciation lookup): which real
 * pronunciation sources are wired, the Kokoro/CPU batch policy with its live
 * batch monitor, and a live fetch of one word's pronunciation with playback.
 * Status card + offline banner come from PcToolChrome.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2, RefreshCw, CheckCircle2, MinusCircle, Languages,
  Type, Play, Loader2, KeyRound, AudioLines, Info,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { WordAudioStatus, WordAudioTestResponse } from '@/apps/pycore-manager/api';
import { QUEUE_CENTER_WORD_AUDIO_BATCH } from '@/core/contracts/QueueCenterContract';
import { TTS_WORD_BATCH_ENGINE } from '@/core/contracts/ServiceContract';
import { formatBytes } from '../../../core/utils/formatters';
import { usePcSingleAudio } from '@/apps/pycore-manager/hooks/usePcSingleAudio';
import PcLivePanel from '../components/ai/live/PcLivePanel';
import { PcOfflineBanner, PcToolStatusCard } from '../components/ai/tools/PcToolChrome';
import { PcPresenceBadge } from '../components/ai/PcStatusPill';

const DEFAULT_WORD = 'hello';
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_MIME = 'audio/mpeg';
const MISS_CODE = 'REAL_PRONUNCIATION_NOT_FOUND';
const inputClass = 'w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-black/20 text-slate-700 dark:text-slate-200 outline-none focus:border-fuchsia-400';

/** Playable data: URI from a hit (base64 audio). */
function audioSrc(result: WordAudioTestResponse | null): string | null {
  if (!result || !result.success || !result.audio_base64) return null;
  return `data:${result.mime || DEFAULT_MIME};base64,${result.audio_base64}`;
}

export default function PcWordAudioPage() {
  const { t } = useTranslation('pc', { keyPrefix: 'wordAudioPage' });
  const [status, setStatus] = useState<WordAudioStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [word, setWord] = useState(DEFAULT_WORD);
  const [lang, setLang] = useState(DEFAULT_LANGUAGE);

  const [result, setResult] = useState<WordAudioTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const { playing, play: playClip } = usePcSingleAudio();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await pycoreApi.getWordAudioStatus());
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
      setResult(await pycoreApi.testWordAudio(clean, lang.trim() || DEFAULT_LANGUAGE));
      setOffline(false);
    } catch {
      setTestError(t('fetchFailed'));
    } finally {
      setTestBusy(false);
    }
  }, [word, lang, testBusy, t]);

  const src = audioSrc(result);
  const playAudio = useCallback(() => {
    if (!src || playing) return;
    void playClip(src).catch(() => undefined);
  }, [src, playing, playClip]);

  const canRun = !!word.trim();
  const configured = status ? (status.forvo_key_present ? t('configured') : t('notSet')) : t('unknown');

  return (
    <div className="space-y-5">
      <PcToolStatusCard
        title={t('title')}
        subtitle={t('subtitle')}
        Icon={Volume2}
        accent="text-fuchsia-500"
        loading={loading}
        offline={offline}
        onRefresh={() => { void loadStatus(); }}
        statusLabel={t('status')}
        columnsClass="grid-cols-2 md:grid-cols-3"
        badges={(
          <>
            <PcPresenceBadge ok={!!status?.forvo_key_present} yesLabel={t('configured')} noLabel={t('notSet')} />
            <PcPresenceBadge
              ok={status?.batch_engine === TTS_WORD_BATCH_ENGINE}
              yesLabel={t('batchReady')}
              noLabel={t('unavailable')}
            />
          </>
        )}
        fields={[
          { label: t('backend'), value: status?.backend || t('unknown') },
          { label: t('forvoKey'), Icon: KeyRound, value: configured },
          {
            label: t('batchEngine'),
            Icon: AudioLines,
            value: status?.batch_engine || status?.tts_engines?.[0] || TTS_WORD_BATCH_ENGINE,
          },
          {
            label: t('batchPolicy'),
            value: `${(status?.batch_device || QUEUE_CENTER_WORD_AUDIO_BATCH.device).toUpperCase()} · ${status?.batch_size || QUEUE_CENTER_WORD_AUDIO_BATCH.default_batch_size}`,
          },
        ]}
        hint={status && !status.forvo_key_present ? t('forvoHint') : null}
        footer={(
          <div className="mt-3 flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <Info className="w-3 h-3 mt-0.5 shrink-0" /> {t('batchNote')}
          </div>
        )}
      />

      <PcLivePanel variant="word_batch" />

      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <AudioLines className="w-4 h-4 text-fuchsia-500" /> {t('sources')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">{t('sourcesHint')}</p>

        {status && status.sources.length === 0 && <div className="text-sm text-slate-400">{t('noSources')}</div>}
        {!status && offline && <PcOfflineBanner />}

        {status && status.sources.length > 0 && (
          <div className="space-y-2">
            {status.sources.map((source) => (
              <div
                key={source.key}
                className="rounded-xl p-3.5 border flex items-start gap-3 bg-white/50 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {t(`source.${source.key}.label`, { defaultValue: source.label })}
                    </span>
                    <PcPresenceBadge ok={source.available} yesLabel={t('available')} noLabel={t('unavailable')} />
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${source.requires_key
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-fuchsia-500/15 text-fuchsia-500'}`}>
                      {source.requires_key ? t('needsKey') : t('keyless')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono text-slate-400">{source.key}</div>
                  {source.note && (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {t(`source.${source.key}.note`, { defaultValue: source.note })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pc-glass p-6">
        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Volume2 className="w-4 h-4 text-fuchsia-500" /> {t('test')}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">{t('testHint')}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Type className="w-3 h-3" /> {t('word')}
            </label>
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void runTest(); }}
              placeholder={t('wordPlaceholder')}
              className={inputClass}
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Languages className="w-3 h-3" /> {t('language')}
            </label>
            <input
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void runTest(); }}
              placeholder={t('langPlaceholder')}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={!canRun || testBusy}
            className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
            {testBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            {testBusy ? t('fetching') : t('fetch')}
          </button>
        </div>

        <div className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
          {testError && <div className="text-sm text-rose-500 mb-2">{testError}</div>}
          {result ? (
            result.success && src ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 className="w-3 h-3" /> {t('hit')}
                  </span>
                  {result.provider && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-fuchsia-500/15 text-fuchsia-500">
                      {t('provider')}: {result.provider}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">{t('size')}: {formatBytes(result.bytes || 0)}</span>
                  {result.mime && <span className="text-[10px] font-mono text-slate-400">{result.mime}</span>}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={playAudio}
                    disabled={playing}
                    className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-600/20 transition flex items-center gap-1 disabled:opacity-50">
                    {playing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {playing ? t('playing') : t('play')}
                  </button>
                  <audio src={src} controls className="h-9 max-w-full" />
                </div>
                {result.source_id && (
                  <div className="text-[10px] font-mono text-slate-400 break-all">
                    <span className="uppercase tracking-wider mr-1">{t('sourceId')}:</span>{result.source_id}
                  </div>
                )}
                {result.meta && Object.keys(result.meta).length > 0 && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
                    <span className="uppercase tracking-wider mr-1 text-slate-400">{t('meta')}:</span>
                    {JSON.stringify(result.meta)}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                <MinusCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>{result.message_code === MISS_CODE ? t('miss') : (result.message || t('miss'))}</span>
              </div>
            )
          ) : (
            !testError && <div className="text-sm text-slate-400">{t('noResult')}</div>
          )}
        </div>
      </section>
    </div>
  );
}
