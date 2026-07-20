/**
 * PcUnifiedVoiceStrip — word + sentence TTS queues (one voice chain).
 * Auto-run follows Assist Laravel → Voice (TTS) capability (no separate auto toggles).
 *
 * Reads the word/sentence auto statuses from the SHARED Queue Center hub
 * (useQueueCenterHub) instead of polling them itself — the hub fetches them once
 * for the whole page, so this strip no longer duplicates the request on every
 * tab it appears on. Run-once actions trigger a shared hub refresh.
 */
import React, { useState } from 'react';
import { AudioLines, Loader2, Play, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '../../../core/api-libs/pycore';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

export const PcUnifiedVoiceStrip: React.FC<{ refreshTick?: number }> = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const word = hub.voiceWord;
  const sentence = hub.voiceSentence;

  const runBoth = async () => {
    setBusy(true);
    setErr(null);
    try {
      await Promise.all([
        pycoreApi.runWordTtsOnce(),
        pycoreApi.runSentenceAudioOnce(),
      ]);
      hub.refreshHub();
    } catch (e: any) {
      setErr(e?.message || 'run-once failed');
    } finally {
      setBusy(false);
    }
  };

  const wordPending = word?.laravel?.pending ?? 0;
  const sentPending = sentence?.laravel?.pending ?? 0;
  const autoOn = !!(word?.auto_start || sentence?.auto_start);
  const hubErr = err || (hub.pycoreReachable ? null : hub.error);

  return (
    <section className="pc-glass p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <AudioLines className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {t('queueCenter.unifiedVoice.title')}
        </span>
        <span className="text-[10px] text-slate-400">{t('queueCenter.unifiedVoice.subtitle')}</span>
        <span className="text-[10px] font-mono text-slate-500">
          words <b className="text-sky-500">{wordPending}</b>
          {' · '}sentences <b className="text-teal-500">{sentPending}</b>
          {' · '}
          <span className={autoOn ? 'text-emerald-500' : 'text-slate-400'}>
            {autoOn ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
          </span>
        </span>
        <button type="button" onClick={runBoth} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold pc-glass text-indigo-600 hover:bg-indigo-500/10 transition disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {t('queueCenter.sentenceAudio.runOnce')}
        </button>
        <button type="button" onClick={() => hub.refreshHub()} disabled={hub.loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${hub.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {hubErr && (
        <p className="text-[11px] text-rose-500"><AlertTriangle className="w-3 h-3 inline mr-1" />{hubErr}</p>
      )}
    </section>
  );
};

export default PcUnifiedVoiceStrip;
