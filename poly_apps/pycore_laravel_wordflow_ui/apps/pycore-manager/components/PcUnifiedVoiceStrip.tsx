/**
 * PcUnifiedVoiceStrip — word + sentence TTS queues (one voice chain).
 * Auto-run follows Assist Laravel → Voice (TTS) capability (no separate auto toggles).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, Play, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { SentenceAudioAutoStatus, WordTtsAutoStatus } from '../../../core/api-libs/pycore/pycoreTypes';

const POLL_MS = 12000;

export const PcUnifiedVoiceStrip: React.FC<{ refreshTick?: number }> = ({ refreshTick = 0 }) => {
  const { t } = useTranslation('pc');
  const [word, setWord] = useState<WordTtsAutoStatus | null>(null);
  const [sentence, setSentence] = useState<SentenceAudioAutoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [w, s] = await Promise.all([
        pycoreApi.getWordTtsAutoStatus(),
        pycoreApi.getSentenceAudioAutoStatus(),
      ]);
      if (!mounted.current) return;
      if (w && typeof w.auto_start === 'boolean') setWord(w);
      if (s && typeof s.auto_start === 'boolean') setSentence(s);
      setErr(null);
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'voice status unavailable');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const fetchRef = useRef(fetchStatus);
  fetchRef.current = fetchStatus;
  useEffect(() => {
    void fetchRef.current(false);
    const id = window.setInterval(() => { void fetchRef.current(true); }, POLL_MS);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { void fetchRef.current(true); }, [refreshTick]);

  const runBoth = async () => {
    setBusy(true);
    try {
      await Promise.all([
        pycoreApi.runWordTtsOnce(),
        pycoreApi.runSentenceAudioOnce(),
      ]);
      await fetchStatus(true);
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'run-once failed');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const wordPending = word?.laravel?.pending ?? 0;
  const sentPending = sentence?.laravel?.pending ?? 0;
  const autoOn = !!(word?.auto_start || sentence?.auto_start);

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
        <button type="button" onClick={() => fetchStatus(false)} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {err && (
        <p className="text-[11px] text-rose-500"><AlertTriangle className="w-3 h-3 inline mr-1" />{err}</p>
      )}
    </section>
  );
};

export default PcUnifiedVoiceStrip;
