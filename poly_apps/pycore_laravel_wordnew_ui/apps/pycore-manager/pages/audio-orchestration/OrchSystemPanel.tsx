/**
 * Pycore system panel for the audio-orchestration page: cached ffmpeg probe
 * (available / path / version), the pycore data directory and output root,
 * plus an "open folder" action (resolved + opened on the pycore side).
 */
import React, { useState } from 'react';
import { CheckCircle2, FolderOpen, Loader2, MinusCircle, RefreshCw, Wrench } from 'lucide-react';
import { pycoreApi, type OrchSystemStatus } from '@/apps/pycore-manager/api';
import { humanInt, VocabBanner } from '../vocabulary/vocabShared';
import { ORCH_L, orchErrorMessage } from './orchShared';

const OrchSystemPanel: React.FC<{
  status: OrchSystemStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}> = ({ status, loading, error, onRefresh }) => {
  const ffmpeg = status?.ffmpeg;
  const [actionError, setActionError] = useState<string | null>(null);
  const ffmpegLabel = !ffmpeg ? (loading ? ORCH_L.checking : ORCH_L.unknown)
    : ffmpeg.available ? ORCH_L.available : ffmpeg.probe_error ? ORCH_L.probeFailed : ORCH_L.missing;

  const openFolder = async () => {
    setActionError(null);
    try {
      const response = await pycoreApi.orchOpenOutput();
      if (!response.success) setActionError(ORCH_L.actionFailed);
    } catch (e) {
      setActionError(orchErrorMessage(e));
    }
  };

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-200">{ORCH_L.systemTitle}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openFolder()}
            disabled={!status?.success}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-500/50"
          >
            <FolderOpen className="w-3.5 h-3.5" /> {ORCH_L.openFolder}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-500/50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {ORCH_L.refresh}
          </button>
        </div>
      </div>
      {(error || actionError) && <VocabBanner kind="error" message={error || actionError || ''} />}
      {ffmpeg?.probe_error && <VocabBanner kind="warn" message={ffmpeg.probe_error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2 flex items-center gap-2">
          {!ffmpeg ? <MinusCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : ffmpeg.available
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            : <MinusCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
          <div className="min-w-0">
            <p className="text-slate-300 font-medium">
              {ORCH_L.ffmpeg} {ffmpegLabel}
            </p>
            <p className="text-[10px] font-mono text-slate-500 truncate" title={ffmpeg?.path || ''}>
              {ffmpeg?.version || ffmpeg?.path || '—'}
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2">
          <p className="text-slate-300 font-medium">
            {humanInt(status?.books_cached)} {ORCH_L.booksCached} · {humanInt(status?.sentence_books_cached)} {ORCH_L.sentenceBooks}
          </p>
          <p className="text-[10px] font-mono text-slate-500">
            {humanInt(status?.tasks_total)} {ORCH_L.tasksTitle.toLowerCase()}
          </p>
        </div>
      </div>
      <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
        <p className="break-all">{ORCH_L.dataDir}: {status?.data_dir || '—'}</p>
        <p className="break-all">{ORCH_L.outputRoot}: {status?.output_root || '—'}</p>
      </div>
    </section>
  );
};

export default OrchSystemPanel;
