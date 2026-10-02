/**
 * AssistQueuePanel — laravel-manager view of the third-party assist distribution
 * (the Laravel side of pycore-manager's "Assist Laravel" strip).
 *
 * Reads the cache-backed pending snapshot (GET /assist/pending, warmed every
 * tick by the Octane cover timer) + the live assist status, and shows the
 * pending-work distribution across all three tracks — cover / TTS / translation
 * — with leased counts and a "Retry failed covers" action. This is the queue
 * that pycore (or any third party) drains; if every track shows pending>0 with
 * no worker running, covers/audio never appear.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Boxes, RefreshCcw, ImageIcon, Volume2, Languages, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { Trans, useTranslation } from '@/apps/laravel-manager/i18n';
import type { AssistPendingSnapshot } from '@/apps/laravel-manager/api';

const POLL_MS = 10000;

type TrackKey = 'cover' | 'tts' | 'translation';

const TRACK_META: Record<TrackKey, { Icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  cover: { Icon: ImageIcon, accent: 'text-fuchsia-400' },
  tts: { Icon: Volume2, accent: 'text-emerald-400' },
  translation: { Icon: Languages, accent: 'text-cyan-400' },
};

const Stat: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone }) => (
  <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-500/5 dark:bg-white/5 min-w-[64px]">
    <span className={`text-lg font-bold tabular-nums ${tone ?? 'text-slate-700 dark:text-slate-200'}`}>{value.toLocaleString()}</span>
    <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
  </div>
);

const AssistQueuePanel: React.FC = () => {
  const { t: tr } = useTranslation();
  const [snap, setSnap] = useState<AssistPendingSnapshot | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.appQyV1.getAssistPending();
      const s = res?.data?.snapshot ?? null;
      if (s) {
        setSnap(s);
        setEnabled(s.enabled);
        setError(null);
      } else if (res?.success === false) {
        setError(res?.message || tr('uiAi.assist_queue.load_failed'));
      }
    } catch (e: any) {
      setError(e?.message || tr('uiAi.assist_queue.laravel_unreachable'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    void load();
    const tick = () => { timer.current = setTimeout(async () => { await load(); tick(); }, POLL_MS); };
    tick();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  const retryCovers = useCallback(async () => {
    setRetrying(true);
    setNotice(null);
    try {
      const res = await api.appQyV1.retryCover({ all: true });
      const reset = res?.data?.reset ?? 0;
      setNotice(tr('uiAi.assist_queue.retry_notice', { count: reset }));
      await load();
    } catch (e: any) {
      setNotice(e?.message || tr('uiAi.assist_queue.retry_failed'));
    } finally {
      setRetrying(false);
    }
  }, [load, tr]);

  const tracks: TrackKey[] = ['cover', 'tts', 'translation'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Boxes className="w-5 h-5 text-indigo-400" /> {tr('uiAi.assist_queue.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tr('uiAi.assist_queue.description', { minutes: snap?.lease_minutes ?? 60 })}
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-xs font-semibold flex items-center gap-1.5 transition">
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {tr('uiAi.assist_queue.refresh')}
        </button>
      </div>

      {enabled === false && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span><Trans i18nKey="uiAi.assist_queue.disabled_banner" components={{ b: <b /> }} /></span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-500">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span className="break-words">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tracks.map((key) => {
          const t = snap?.[key];
          const meta = TRACK_META[key];
          const Icon = meta.Icon;
          const pending = (t as any)?.pending ?? 0;
          const leased = (t as any)?.leased ?? 0;
          const failed = (t as any)?.failed ?? 0;
          const completedOrReady = key === 'cover' ? (t as any)?.ready ?? 0 : (t as any)?.completed ?? 0;
          return (
            <div key={key} className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${meta.accent}`} />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{tr(`uiAi.assist_queue.track.${key}`)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Stat label={tr('uiAi.assist_queue.stat.pending')} value={pending} tone={pending > 0 ? 'text-amber-500' : undefined} />
                <Stat label={key === 'cover' ? tr('uiAi.assist_queue.stat.ready') : tr('uiAi.assist_queue.stat.done')} value={completedOrReady} tone="text-emerald-500" />
                <Stat label={tr('uiAi.assist_queue.stat.failed')} value={failed} tone={failed > 0 ? 'text-rose-500' : undefined} />
                <Stat label={tr('uiAi.assist_queue.stat.leased')} value={leased} tone={leased > 0 ? 'text-indigo-400' : undefined} />
              </div>
              {key === 'cover' && failed > 0 && (
                <button
                  onClick={retryCovers}
                  disabled={retrying}
                  className="mt-3 w-full px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                  <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} /> {tr('uiAi.assist_queue.retry_covers')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {notice && <p className="text-[11px] text-indigo-500 break-words">{notice}</p>}
      {snap?.generated_at && (
        <p className="text-[10px] text-slate-400 font-mono">{tr('uiAi.assist_queue.snapshot_at', { time: new Date(snap.generated_at).toLocaleTimeString() })}</p>
      )}
    </div>
  );
};

export default AssistQueuePanel;
