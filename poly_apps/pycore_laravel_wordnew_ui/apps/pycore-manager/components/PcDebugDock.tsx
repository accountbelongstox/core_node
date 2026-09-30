/**
 * PcDebugDock - the single GLOBAL debug surface of pycore-manager, mounted once
 * in PcLayout's main column (bottom-left, clear of the sidebar and the toasts): one floating button (with the live HTTP-event connection dot)
 * that opens a panel with two tabs, LOG (PcLogPanel) and HTTP (PcHttpPanel).
 * Open state and the active tab persist in localStorage.
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Terminal, X } from 'lucide-react';
import { usePcLive } from '../PcLiveContext';
import { getHttpDebugEntries, subscribeHttpDebug } from '@/apps/pycore-manager/api';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { PcLogPanel } from './PcLogPanel';
import { PcHttpPanel } from './PcHttpPanel';

type DockTab = 'log' | 'http';
const DOCK_TABS: DockTab[] = ['log', 'http'];
const DEFAULT_TAB: DockTab = 'log';
const OPEN_VALUE = '1';
const CLOSED_VALUE = '0';

function readTab(): DockTab {
  const stored = StorageManager.getRaw(StorageKeys.PYCORE_DEBUG_DOCK_TAB);
  return DOCK_TABS.includes(stored as DockTab) ? (stored as DockTab) : DEFAULT_TAB;
}

export const PcDebugDock: React.FC = () => {
  const { t } = useTranslation('pc');
  const { logs, httpConnected } = usePcLive();
  const httpEntries = useSyncExternalStore(subscribeHttpDebug, getHttpDebugEntries);
  const [open, setOpen] = useState<boolean>(() => StorageManager.getRaw(StorageKeys.PYCORE_DEBUG_DOCK_OPEN) === OPEN_VALUE);
  const [tab, setTab] = useState<DockTab>(readTab);

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_DEBUG_DOCK_OPEN, open ? OPEN_VALUE : CLOSED_VALUE);
  }, [open]);

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_DEBUG_DOCK_TAB, tab);
  }, [tab]);

  const counts: Record<DockTab, number> = { log: logs.length, http: httpEntries.length };
  const labels: Record<DockTab, string> = { log: t('debugDock.tabLog'), http: t('debugDock.tabHttp') };
  const icons: Record<DockTab, React.ReactNode> = {
    log: <Terminal className="w-3.5 h-3.5" />,
    http: <Bug className="w-3.5 h-3.5" />,
  };

  return (
    <div className="hide-on-soft-keyboard absolute left-3 bottom-3 z-[70] pointer-events-none flex flex-col items-start gap-2">
      {open && (
        <div
          className="pointer-events-auto flex flex-col overflow-hidden rounded-2xl pc-glass shadow-2xl shadow-black/20 dark:shadow-black/50"
          style={{ width: 'min(calc(100vw - 1.5rem), clamp(320px, 60vw, 960px))', height: 'clamp(260px, 55vh, 75vh)' }}
        >
          <div className="shrink-0 h-10 flex items-center gap-1 px-2 border-b border-[var(--pc-glass-border)]">
            {DOCK_TABS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  tab === key
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-500/10'
                }`}
              >
                {icons[key]}
                {labels[key]}
                <span className="text-[10px] font-mono px-1 rounded bg-slate-500/10">{counts[key]}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('debugDock.close')}
              className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-500/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {tab === 'log' ? <PcLogPanel /> : <PcHttpPanel />}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('debugDock.toggle')}
        title={t('debugDock.toggle')}
        className="pointer-events-auto relative h-11 w-11 rounded-full pc-glass shadow-xl shadow-black/20 dark:shadow-black/50 flex items-center justify-center text-indigo-500 hover:scale-105 transition-transform"
      >
        <Terminal className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
          {httpConnected && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${httpConnected ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
        </span>
      </button>
    </div>
  );
};

export default PcDebugDock;
