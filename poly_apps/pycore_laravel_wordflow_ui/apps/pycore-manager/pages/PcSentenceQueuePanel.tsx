/**
 * PcSentenceQueuePanel — dedicated sentence-audio generation queue (Queue Center tab).
 * Shows Laravel missing rows, pycore worker events, and priority-bump highlights.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageSquareText, RefreshCw, AlertTriangle, Zap, Loader2, Play, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { SentenceAudioQueueSnapshot } from '../../../core/api-libs/pycore/pycoreTypes';

import type { QueueCenterPanelProps } from '../utils/pcQueueCenterTypes';

const REFRESH_MS = 5000;

type PcSentenceQueuePanelProps = QueueCenterPanelProps;

const preview = (text?: string | null, max = 72): string => {
  const t = (text || '').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

export const PcSentenceQueuePanel: React.FC<PcSentenceQueuePanelProps> = ({
  refreshTick = 0,
  onMeta,
}) => {
  const { t } = useTranslation('pc');
  const [snap, setSnap] = useState<SentenceAudioQueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      onMeta?.({ count: null, loading: true });
    }
    try {
      const r = await pycoreApi.getSentenceAudioQueue();
      if (!mounted.current) return;
      if (r && r.success !== false) {
        setSnap(r);
        setErr(null);
        const total = r.queue?.total ?? r.queue?.items?.length ?? 0;
        onMeta?.({ count: total, loading: false });
      } else {
        setErr((r as any)?.error || t('queueCenter.sentenceQueue.unavailable'));
        onMeta?.({ count: null, loading: false });
      }
    } catch (e: any) {
      if (!mounted.current) return;
      setErr(e?.message || t('queueCenter.sentenceQueue.unavailable'));
      onMeta?.({ count: null, loading: false });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [onMeta, t]);

  const fetchRef = useRef(fetchQueue);
  fetchRef.current = fetchQueue;
  useEffect(() => {
    void fetchRef.current(false);
    const id = window.setInterval(() => { void fetchRef.current(true); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { void fetchRef.current(true); }, [refreshTick]);

  const runOnce = async () => {
    setBusy(true);
    try {
      await pycoreApi.runSentenceAudioOnce();
      await fetchQueue(true);
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'run-once failed');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const items = snap?.queue?.items ?? [];
  const events = snap?.worker?.events ?? [];
  const current = snap?.worker?.current_task;
  const reachable = snap?.queue?.laravel_reachable !== false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquareText className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t('queueCenter.sentenceQueue.title')}
        </span>
        <span className="text-[10px] text-slate-400">{t('queueCenter.sentenceQueue.subtitle')}</span>
        {!reachable && (
          <span className="text-[10px] text-amber-500 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Laravel unreachable
          </span>
        )}
        <button type="button" onClick={runOnce} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold pc-glass text-teal-600 hover:bg-teal-500/10 transition disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {t('queueCenter.sentenceAudio.runOnce')}
        </button>
        <button type="button" onClick={() => fetchQueue(false)} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-teal-500/10 text-teal-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {current && (
        <div className="pc-glass p-2.5 text-[11px] font-mono text-teal-600 dark:text-teal-300">
          <span className="text-slate-400 uppercase text-[9px] tracking-wide mr-2">synthesizing</span>
          [{current.language}] p={current.priority} · {preview(current.content as string, 96)}
          {(current as any).variant_count > 1 && (
            <span className="ml-2 text-sky-400">
              · variant {(current as any).current_variant_index}/{(current as any).variant_count}
              {' '}({(current as any).current_variant_key || 'primary'})
              {' '}via <b>{(current as any).current_provider || 'pending'}</b>
            </span>
          )}
        </div>
      )}

      {err && (
        <p className="text-[11px] text-rose-500"><AlertTriangle className="w-3 h-3 inline mr-1" />{err}</p>
      )}

      <div className="pc-glass overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-500/10 text-[10px] uppercase tracking-wide text-slate-400 flex justify-between">
          <span>{t('queueCenter.sentenceQueue.missingRows')} ({snap?.queue?.total ?? items.length})</span>
          <span>Laravel · book-reader bumps</span>
        </div>
        {loading && !items.length ? (
          <p className="p-4 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> loading…</p>
        ) : !items.length ? (
          <p className="p-4 text-xs text-slate-400">{t('queueCenter.sentenceQueue.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-500/10 max-h-[320px] overflow-y-auto">
            {items.map((row) => {
              const key = `${row.language}:${row.content_id}`;
              const bumped = !!row.recently_bumped;
              return (
                <li key={key}
                  className={`px-3 py-2 text-xs ${bumped ? 'ring-2 ring-inset ring-amber-400/50 bg-amber-500/5' : ''}`}>
                  <div className="flex items-start gap-2">
                    {bumped && <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-200 truncate" title={row.text}>{preview(row.text, 120)}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {row.language} · prio <b className="text-amber-500">{row.tts_priority ?? 0}</b>
                        {' · '}{row.tts_status || 'pending'}
                        {row.tts_locked_by ? ` · ${row.tts_locked_by}` : ''}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pc-glass overflow-hidden">
        <button type="button" onClick={() => setLogOpen((v) => !v)}
          className="w-full px-3 py-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 hover:bg-slate-500/5">
          <span>{t('queueCenter.sentenceQueue.workerLog')} ({events.length})</span>
          {logOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {logOpen && (
          <ul className="divide-y divide-slate-500/10 max-h-[220px] overflow-y-auto text-[10px] font-mono">
            {!events.length ? (
              <li className="px-3 py-2 text-slate-400">{t('queueCenter.sentenceQueue.noLog')}</li>
            ) : events.map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="px-3 py-1.5 text-slate-500">
                <span className="text-slate-400">{new Date((ev.at || 0) * 1000).toLocaleTimeString()}</span>
                {' '}[{ev.kind}] {ev.detail}
                {ev.text_preview ? ` · "${ev.text_preview}"` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PcSentenceQueuePanel;
