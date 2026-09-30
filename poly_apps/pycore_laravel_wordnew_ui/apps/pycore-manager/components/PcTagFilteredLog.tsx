/**
 * PcTagFilteredLog — reusable tag-filtered live log terminal.
 *
 * Consumes the shared usePcLive() pycore_log buffer and renders only the lines
 * whose message contains one of `tags` (substring match), newest last,
 * auto-scrolling to the bottom (same terminal styling as PcLogPanel).
 * The Clear button hides the entries currently shown (by identity) — it does
 * NOT clear the global buffer.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePcLive, type PcLogLine } from '../PcLiveContext';
import { PcLogLineRow, pcLogLineKey } from './PcLogLineRow';

const VIEW_CAP = 1000;

interface PcTagFilteredLogProps {
  tags: string[];
  title: string;
  emptyHint?: string;
  /** Render without the outer card chrome (embedded inside a parent card). */
  bare?: boolean;
}

export const PcTagFilteredLog: React.FC<PcTagFilteredLogProps> = ({ tags, title, emptyHint, bare }) => {
  const { t } = useTranslation('pc');
  const { logs } = usePcLive();
  const [cleared, setCleared] = useState<WeakSet<PcLogLine>>(() => new WeakSet());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tagsKey = tags.join('');

  const filtered = useMemo(
    () => logs
      .filter((l) => !cleared.has(l) && tags.some((tag) => l.message.includes(tag)))
      .slice(-VIEW_CAP),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, cleared, tagsKey],
  );

  // Auto-scroll to bottom whenever new matching lines arrive.
  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filtered]);

  const header = (
    <div className={`${bare ? 'px-1 py-1' : 'px-3 py-2 border-b border-slate-500/10'} flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400`}>
      <Terminal className="w-3.5 h-3.5 shrink-0" />
      <span>{title}</span>
      <span className="font-mono">({filtered.length})</span>
      <button
        type="button"
        onClick={() => setCleared(new WeakSet(logs))}
        className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors normal-case tracking-normal"
      >
        <Trash2 className="w-3.5 h-3.5" /> {t('floatingLog.clear')}
      </button>
    </div>
  );

  const terminal = (
    <div ref={containerRef} className="m-2 rounded-xl bg-slate-950 border border-white/5 overflow-auto p-3 text-[11px] font-mono leading-relaxed max-h-64">
      {filtered.length === 0 ? (
        <div className="text-slate-600">{emptyHint || 'No matching log lines yet.'}</div>
      ) : (
        filtered.map((l, i) => <PcLogLineRow key={pcLogLineKey(l, i)} line={l} />)
      )}
    </div>
  );

  if (bare) {
    return (
      <div>
        {header}
        {terminal}
      </div>
    );
  }

  return (
    <div className="pc-glass overflow-hidden">
      {header}
      {terminal}
    </div>
  );
};

export default PcTagFilteredLog;
