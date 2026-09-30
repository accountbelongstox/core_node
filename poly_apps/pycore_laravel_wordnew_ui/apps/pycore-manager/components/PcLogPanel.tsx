/**
 * PcLogPanel - the LOG tab of the global PcDebugDock: terminal-style live log
 * (monospace, colour per level) with HTTP-event connection state and Clear.
 * Consumes the shared usePcLive() buffer; it opens no event subscription.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { Trash2, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePcLive } from '../PcLiveContext';
import { PcLogLineRow, pcLogLineKey } from './PcLogLineRow';

export const PcLogPanel: React.FC = () => {
  const { t } = useTranslation('pc');
  const { logs, httpConnected, clearLogs } = usePcLive();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-[var(--pc-glass-border)]">
        <span className={`text-[11px] font-medium inline-flex items-center gap-1 ${httpConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
          {httpConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {httpConnected ? t('floatingLog.connected') : t('floatingLog.disconnected')}
        </span>
        <button
          type="button"
          onClick={clearLogs}
          className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> {t('floatingLog.clear')}
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-slate-950/95 p-3 text-[11px] font-mono leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-slate-600">{t('floatingLog.empty')}</div>
        ) : (
          logs.map((line, index) => <PcLogLineRow key={pcLogLineKey(line, index)} line={line} />)
        )}
      </div>
    </div>
  );
};

export default PcLogPanel;
