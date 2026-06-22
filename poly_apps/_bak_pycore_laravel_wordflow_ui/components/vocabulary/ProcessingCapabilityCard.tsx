import React, { useCallback, useEffect, useState } from 'react';
import {
  Server, Cpu, Activity, Zap, Film, FileText, RefreshCw,
  CheckCircle2, AlertTriangle, HardDrive,
} from 'lucide-react';
import { api } from '../../core/api';
import type { ProcessingCapability, ProcessingRecommendation } from '../../core/api/modules/BooksAPI';

/**
 * ProcessingCapabilityCard — shows THIS Laravel host's load + hardware (CPU,
 * memory, disk, ffmpeg, GPU) and a per-task recommendation of whether Laravel can
 * process directly, or whether the work should go to pycore (the GPU host) and
 * sync back. Laravel is the FALLBACK: documents always run locally; video is
 * recommended to pycore unless this host has ffmpeg + GPU/CPU headroom.
 *
 * Probe source is laravel-host-only (GET /api/app_qy_v1/system/processing-capability).
 * Read-only / advisory — it does not perform any processing itself.
 */
const nf = (n: number | null | undefined, suffix = '') =>
  (typeof n === 'number' ? `${n}${suffix}` : '—');

const RecBadge: React.FC<{ icon: React.ReactNode; label: string; rec?: ProcessingRecommendation }> =
  ({ icon, label, rec }) => {
    if (!rec) return null;
    const local = rec.suggested === 'local';
    return (
      <div className={`rounded-xl p-3 border text-xs ${
        local
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-amber-500/40 bg-amber-500/10'}`}>
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
          {icon}{label}
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
            local ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
            {local ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {local ? 'Laravel direct' : 'Use pycore'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{rec.reason}</p>
      </div>
    );
  };

const ProcessingCapabilityCard: React.FC = () => {
  const [cap, setCap] = useState<ProcessingCapability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.books.getProcessingCapability();
      if (r.success && r.data) setCap(r.data);
      else setError(r.error || 'Probe failed');
    } catch (e: any) {
      setError(e?.message || 'Probe failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metric = (icon: React.ReactNode, label: string, value: string, accent?: string) => (
    <div className="rounded-lg p-2 border border-slate-200/50 dark:border-white/5 bg-slate-100/50 dark:bg-black/20">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">{icon}{label}</div>
      <div className={`text-sm font-bold ${accent || 'text-slate-700 dark:text-slate-200'}`}>{value}</div>
    </div>
  );

  return (
    <div className="rounded-2xl p-4 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-indigo-500" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Server capability {cap && <span className="text-slate-400 normal-case font-normal">· {cap.host} ({cap.os})</span>}
        </h4>
        <button onClick={load} disabled={loading}
          className="ml-auto p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition disabled:opacity-50"
          title="Re-probe">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <p className="text-[11px] text-amber-500">{error}</p>
      ) : !cap ? (
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Probing…</p>
      ) : (
        <>
          {/* live metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {metric(<Cpu className="w-3 h-3" />, 'CPU load',
              `${nf(cap.cpu.load1)}${cap.cpu.count ? ` / ${cap.cpu.count}` : ''}`,
              cap.busy ? 'text-amber-500' : undefined)}
            {metric(<Activity className="w-3 h-3" />, 'Memory',
              cap.memory.used_percent !== null ? `${cap.memory.used_percent}% used` : '—')}
            {metric(<HardDrive className="w-3 h-3" />, 'Disk free',
              cap.disk.free_gb !== null ? `${cap.disk.free_gb} GB` : '—')}
            {metric(<Zap className="w-3 h-3" />, 'GPU',
              cap.gpu.available ? `${cap.gpu.utilization ?? 0}%` : 'none',
              cap.gpu.available ? 'text-emerald-500' : 'text-slate-400')}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-400">
            <span className={cap.ffmpeg.available ? 'text-emerald-500' : 'text-slate-400'}>
              ffmpeg: {cap.ffmpeg.available ? (cap.ffmpeg.version || 'yes') : 'not found'}
            </span>
            {cap.gpu.available && <span className="text-emerald-500">GPU: {cap.gpu.name}</span>}
          </div>

          {/* recommendations */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <RecBadge icon={<FileText className="w-3.5 h-3.5" />} label="Documents" rec={cap.recommendations.document} />
            <RecBadge icon={<Film className="w-3.5 h-3.5" />} label="Video extract" rec={cap.recommendations.video} />
          </div>
          {cap.recommendations.video.suggested === 'pycore' && (
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Tip: route video to pycore (it has whisper/CUDA); results sync back to Laravel automatically. You can still force local processing.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default ProcessingCapabilityCard;
