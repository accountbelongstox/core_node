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
import { api } from '../../core/api';
import type { AssistPendingSnapshot } from '../../core/api/modules/AppQyV1';

const POLL_MS = 10000;

type TrackKey = 'cover' | 'tts' | 'translation';

const TRACK_META: Record<TrackKey, { label: string; Icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  cover: { label: 'Covers', Icon: ImageIcon, accent: 'text-fuchsia-400' },
  tts: { label: 'TTS audio', Icon: Volume2, accent: 'text-emerald-400' },
  translation: { label: 'Translations', Icon: Languages, accent: 'text-cyan-400' },
};

const Stat: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone }) => (
  <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-500/5 dark:bg-white/5 min-w-[64px]">
    <span className={`text-lg font-bold tabular-nums ${tone ?? 'text-slate-700 dark:text-slate-200'}`}>{value.toLocaleString()}</span>
    <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
  </div>
);

const AssistQueuePanel: React.FC = () => {
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
        setError(res?.message || 'Failed to load assist snapshot');
      }
    } catch (e: any) {
      setError(e?.message || 'Laravel unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setNotice(`Reset ${reset} failed cover(s) back to pending for re-generation.`);
      await load();
    } catch (e: any) {
      setNotice(e?.message || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }, [load]);

  const tracks: TrackKey[] = ['cover', 'tts', 'translation'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Boxes className="w-5 h-5 text-indigo-400" /> Assist Distribution Queue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pending work that pycore (or any third-party worker) drains under a {snap?.lease_minutes ?? 60}-minute lease.
            Warmed server-side every tick — cheap to poll.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-xs font-semibold flex items-center gap-1.5 transition">
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {enabled === false && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Assist is <b>disabled</b> on the Laravel side (APPQYV1_ASSIST_ENABLED=false). Workers cannot claim — nothing will be generated.</span>
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
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{meta.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Stat label="pending" value={pending} tone={pending > 0 ? 'text-amber-500' : undefined} />
                <Stat label={key === 'cover' ? 'ready' : 'done'} value={completedOrReady} tone="text-emerald-500" />
                <Stat label="failed" value={failed} tone={failed > 0 ? 'text-rose-500' : undefined} />
                <Stat label="leased" value={leased} tone={leased > 0 ? 'text-indigo-400' : undefined} />
              </div>
              {key === 'cover' && failed > 0 && (
                <button
                  onClick={retryCovers}
                  disabled={retrying}
                  className="mt-3 w-full px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                  <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} /> Retry failed covers
                </button>
              )}
            </div>
          );
        })}
      </div>

      {notice && <p className="text-[11px] text-indigo-500 break-words">{notice}</p>}
      {snap?.generated_at && (
        <p className="text-[10px] text-slate-400 font-mono">snapshot @ {new Date(snap.generated_at).toLocaleTimeString()}</p>
      )}
    </div>
  );
};

export default AssistQueuePanel;
