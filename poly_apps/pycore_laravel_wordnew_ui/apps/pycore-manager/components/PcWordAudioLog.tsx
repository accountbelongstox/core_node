import React from 'react';

export interface PcWordAudioLogRow {
  at: number;
  kind: string;
  text: string;
  detail?: string;
  blobUrl?: string;
  lang?: string;
  md5?: string;
  live?: boolean;
  playable?: boolean;
  taskDisplayId?: string;
  stage?: string;
  progress?: number;
  progressTotal?: number;
}

interface PcWordAudioLogProps {
  rows: PcWordAudioLogRow[];
  progressLabel: string;
  stageLabel: (stage: string) => string;
  onClear: () => void;
  onPlay: (row: PcWordAudioLogRow) => void;
}

export const PcWordAudioLog: React.FC<PcWordAudioLogProps> = ({
  rows, progressLabel, stageLabel, onClear, onPlay,
}) => {
  if (rows.length === 0) return null;
  return (
    <div className="mt-1 max-h-56 overflow-y-auto rounded border border-slate-800 bg-slate-950/60">
      <div className="sticky top-0 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-500 flex items-center gap-2">
        <span>Unified log ({rows.length})</span>
        <button onClick={onClear}
          className="ml-auto rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600">
          Clear
        </button>
      </div>
      {rows.map((row, index) => (
        <div key={`${row.md5 || row.kind}-${row.at}-${index}`}
          className="flex items-center gap-2 px-2 py-1 text-xs border-b border-slate-800/60">
          <span className={`px-1 rounded text-[9px] font-bold uppercase shrink-0 ${
            row.kind === 'ok' ? 'bg-emerald-500/15 text-emerald-400'
              : row.kind === 'fail' ? 'bg-rose-500/15 text-rose-400'
                : row.kind === 'pending' ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-sky-500/15 text-sky-400'}`}>{row.kind}</span>
          <span className="text-[10px] text-slate-500 shrink-0">{row.at ? new Date(row.at).toLocaleTimeString() : '—'}</span>
          <span className="font-mono text-slate-300 truncate flex-1" title={row.text || row.detail}>{row.text || row.detail || '—'}</span>
          {row.taskDisplayId && <span className="font-mono text-[10px] text-slate-500 shrink-0">{row.taskDisplayId}</span>}
          {row.progress != null && (
            <span className="text-[10px] text-sky-400 shrink-0" title={row.stage ? stageLabel(row.stage) : progressLabel}>
              {row.stage ? stageLabel(row.stage) : progressLabel}{' '}
              {Math.round(row.progress)}/{Math.max(1, Math.round(row.progressTotal || 100))}
            </span>
          )}
          {row.lang && <span className="text-[10px] text-slate-500 shrink-0">{row.lang}</span>}
          {row.detail && row.text && <span className="text-[10px] text-slate-500 truncate shrink-0 max-w-[40%]" title={row.detail}>{row.detail}</span>}
          {(row.playable || row.md5) && row.lang && <button onClick={() => onPlay(row)}
            className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
            title="Play audio">▶</button>}
          {row.live && <span className="text-[9px] text-sky-400 shrink-0">live</span>}
        </div>
      ))}
    </div>
  );
};
