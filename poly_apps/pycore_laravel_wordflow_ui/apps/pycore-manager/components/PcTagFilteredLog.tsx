/**
 * PcTagFilteredLog — reusable tag-filtered live log terminal.
 *
 * Consumes the shared usePcLive() pycore_log buffer and renders only the lines
 * whose message contains one of `tags` (substring match), newest last,
 * auto-scrolling to the bottom (same terminal styling as PcFloatingLog).
 * The Clear button hides the entries currently shown via a local cutoff — it
 * does NOT clear the global buffer.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { usePcLive, type PcLogLine } from '../PcLiveContext';

const VIEW_CAP = 1000;

function lineColor(l: PcLogLine): string {
  if (l.color) return l.color;
  const lvl = l.level.toLowerCase();
  if (lvl === 'error' || lvl === 'critical') return '#f87171';
  if (lvl === 'warn' || lvl === 'warning') return '#fbbf24';
  if (lvl === 'success') return '#4ade80';
  if (lvl === 'debug') return '#818cf8';
  return '#d4d4d8';
}

interface PcTagFilteredLogProps {
  tags: string[];
  title: string;
  emptyHint?: string;
}

export const PcTagFilteredLog: React.FC<PcTagFilteredLogProps> = ({ tags, title, emptyHint }) => {
  const { logs } = usePcLive();
  const [clearedAt, setClearedAt] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const tagsKey = tags.join('');

  const filtered = useMemo(
    () => logs
      .filter((l) => l.ts > clearedAt && tags.some((tag) => l.message.includes(tag)))
      .slice(-VIEW_CAP),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, clearedAt, tagsKey],
  );

  // Auto-scroll to bottom whenever new matching lines arrive.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [filtered]);

  return (
    <div className="pc-glass overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-500/10 text-[10px] uppercase tracking-wide text-slate-400">
        <Terminal className="w-3.5 h-3.5 shrink-0" />
        <span>{title}</span>
        <span className="font-mono">({filtered.length})</span>
        <button
          type="button"
          onClick={() => setClearedAt(Date.now())}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors normal-case tracking-normal"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
      <div className="m-2 rounded-xl bg-slate-950 border border-white/5 overflow-auto p-3 text-[11px] font-mono leading-relaxed max-h-64">
        {filtered.length === 0 ? (
          <div className="text-slate-600">{emptyHint || 'No matching log lines yet.'}</div>
        ) : (
          filtered.map((l, i) => (
            <div
              key={`${l.ts}-${i}`}
              className="whitespace-pre-wrap break-all"
              style={{ color: lineColor(l) }}
            >
              {l.message}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default PcTagFilteredLog;
