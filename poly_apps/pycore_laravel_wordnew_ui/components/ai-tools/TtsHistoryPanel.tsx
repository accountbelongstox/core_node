/**
 * TtsHistoryPanel — detailed TTS processing records (laravel-manager). Reads the
 * public GET /ai_tools/tts/queue/stats: by-status distribution + recent per-word
 * logs (content, language, status, retries, error, provider/engine). Read-only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Volume2, RefreshCcw, CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';

interface TtsLog {
  id: number | string;
  task_type?: string;
  content_text?: string;
  language?: string;
  status?: string;
  priority?: number;
  retry_count?: number;
  error_message?: string | null;
  tts_provider?: string | null;
  audio_path?: string | null;
}

interface TtsStats {
  by_status?: Record<string, number>;
  by_type?: Record<string, number>;
  total?: number;
  total_success?: number;
  recent_logs?: TtsLog[];
}

const StatusChip: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${tone} min-w-[72px]`}>
    <span className="text-lg font-bold tabular-nums">{value.toLocaleString()}</span>
    <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
  </div>
);

const TtsHistoryPanel: React.FC = () => {
  const [stats, setStats] = useState<TtsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.appQyV1.getTTSQueueStats();
      const data = (res?.data ?? null) as TtsStats | null;
      setStats(data);
      setError(res?.success === false ? (res?.message || 'Failed to load TTS stats') : null);
    } catch (e: any) {
      setError(e?.message || 'Laravel unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const byStatus = stats?.by_status ?? {};
  const logs = stats?.recent_logs ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Volume2 className="w-5 h-5 text-emerald-400" /> TTS History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Per-word audio generation records — status distribution and the most recent attempts.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-xs font-semibold flex items-center gap-1.5 transition">
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs rounded-xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-500">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span className="break-words">{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <StatusChip label="pending" value={byStatus.pending ?? 0} tone="bg-amber-500/10 text-amber-500" />
        <StatusChip label="processing" value={byStatus.processing ?? 0} tone="bg-sky-500/10 text-sky-500" />
        <StatusChip label="completed" value={byStatus.completed ?? 0} tone="bg-emerald-500/10 text-emerald-500" />
        <StatusChip label="failed" value={byStatus.failed ?? 0} tone="bg-rose-500/10 text-rose-500" />
        <StatusChip label="total" value={stats?.total ?? 0} tone="bg-slate-500/10 text-slate-500 dark:text-slate-300" />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Recent attempts</h3>
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/5 overflow-hidden bg-white/40 dark:bg-white/5">
          {logs.length === 0 && !loading ? (
            <p className="text-xs text-slate-400 text-center py-10">No recent TTS records.</p>
          ) : (
            logs.map((log) => {
              const ok = log.status === 'completed';
              return (
                <div key={log.id} className="flex items-center gap-2 px-3 py-2 border-b border-slate-200/60 dark:border-white/5 last:border-0">
                  {ok
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : log.status === 'failed'
                      ? <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      : <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{log.content_text || '—'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 shrink-0">{log.language || '?'}</span>
                  {log.tts_provider && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0 truncate max-w-[140px]" title={log.tts_provider}>{log.tts_provider}</span>
                  )}
                  {(log.retry_count ?? 0) > 0 && (
                    <span className="text-[10px] text-amber-500 shrink-0">×{log.retry_count}</span>
                  )}
                  {log.status === 'failed' && log.error_message && (
                    <span className="text-[10px] text-rose-400 truncate max-w-[180px] hidden md:inline" title={log.error_message}>{log.error_message}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TtsHistoryPanel;
