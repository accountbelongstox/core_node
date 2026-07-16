/**
 * PcWordTtsStrip — word-dictionary TTS worker (tts_queue_poller) control.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2, RefreshCw, Loader2, AlertTriangle, Power, Check, Play,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { WordTtsAutoStatus } from '../../../core/api-libs/pycore';

const POLL_MS = 12000;

const PcWordTtsStrip: React.FC<{ refreshTick?: number }> = ({ refreshTick = 0 }) => {
  const { t } = useTranslation('pc');
  const [status, setStatus] = useState<WordTtsAutoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const s = await pycoreApi.getWordTtsAutoStatus();
      if (s && typeof s.auto_start === 'boolean') {
        setStatus(s);
        setErr(null);
      } else {
        setErr('word tts status unavailable');
      }
    } catch (e: any) {
      setErr(e?.message || 'word tts unavailable');
    } finally {
      setLoading(false);
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

  const toggleAuto = async () => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const s = await pycoreApi.setWordTtsAutoConfig(!status.auto_start);
      if (s) setStatus(s);
    } catch (e: any) {
      setErr(e?.message || 'toggle failed');
    } finally {
      setBusy(false);
    }
  };

  const runOnce = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await pycoreApi.runWordTtsOnce();
      await fetchStatus(true);
    } catch (e: any) {
      setErr(e?.message || 'run-once failed');
    } finally {
      setBusy(false);
    }
  };

  const pending = status?.laravel?.pending ?? 0;
  const leased = status?.laravel?.leased ?? 0;
  const autoOn = !!status?.auto_start;

  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.wordTts.title')}</span>
        {err ? <span className="truncate text-slate-400">{err}</span> : loading ? (
          <span>{t('queueCenter.overview.loading')}</span>
        ) : null}
      </section>
    );
  }

  return (
    <section className="pc-glass p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.wordTts.title')}</span>
        <span className="text-[10px] text-slate-400">{t('queueCenter.wordTts.subtitle')}</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
          <b className="text-sky-500">{pending}</b> {t('queueCenter.overview.pending')}
          {' · '}<b className="text-violet-500">{leased}</b> {t('queueCenter.overview.leased')}
        </span>
        <button type="button" onClick={toggleAuto} disabled={busy}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition disabled:opacity-50 ${
            autoOn ? 'bg-emerald-500/15 text-emerald-500' : 'pc-glass text-slate-500 hover:bg-amber-500/10 hover:text-amber-500'
          }`}>
          {autoOn ? <Check className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          {t('queueCenter.wordTts.autoStart')} {autoOn ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
        </button>
        <button type="button" onClick={runOnce} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold pc-glass text-amber-600 hover:bg-amber-500/10 transition disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {t('queueCenter.wordTts.runOnce')}
        </button>
        <button onClick={() => fetchStatus(true)} disabled={loading || busy}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-amber-500/10 text-amber-500 transition disabled:opacity-50 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {status.worker?.batch_running && (
        <p className="text-[10px] font-mono text-slate-400">{t('queueCenter.wordTts.processing')}</p>
      )}
      {err && (
        <p className="text-[11px] text-rose-500"><AlertTriangle className="w-3 h-3 inline mr-1" />{err}</p>
      )}
    </section>
  );
};

export default PcWordTtsStrip;
