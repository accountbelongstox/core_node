import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageManager } from '../../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';
import { PcMachineSendPanel } from './PcMachineSendPanel';

const OPEN_VALUE = '1';
const CLOSED_VALUE = '0';
const SCROLL_IDLE_MS = 600;
const SEND_TAB_ID = 'send';

/** Extra page-specific panel shown as a tab beside "Send to this machine". */
export interface PcMachineSendDockTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface PcMachineSendDockProps {
  tabs?: PcMachineSendDockTab[];
}

/** Bottom-right fixed dock for machine operations: collapsed by default, remembers being open and its tab, hides while the page scrolls. */
export const PcMachineSendDock: React.FC<PcMachineSendDockProps> = ({ tabs = [] }) => {
  const { t } = useTranslation('pc');
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<boolean>(() => StorageManager.getRaw(StorageKeys.PYCORE_MACHINE_SEND_DOCK_OPEN) === OPEN_VALUE);
  const [activeTab, setActiveTab] = useState<string>(() => StorageManager.getRaw(StorageKeys.PYCORE_MACHINE_SEND_DOCK_TAB) || SEND_TAB_ID);
  const [scrolling, setScrolling] = useState(false);
  const extraTab = tabs.find((tab) => tab.id === activeTab) ?? null;

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_MACHINE_SEND_DOCK_OPEN, open ? OPEN_VALUE : CLOSED_VALUE);
  }, [open]);

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_MACHINE_SEND_DOCK_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && dockRef.current?.contains(event.target)) return;
      setScrolling(true);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setScrolling(false), SCROLL_IDLE_MS);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      clearTimeout(idleTimer);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);

  const tabButton = (id: string, label: string, icon: React.ReactNode) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={(extraTab?.id ?? SEND_TAB_ID) === id}
      onClick={() => setActiveTab(id)}
      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
        (extraTab?.id ?? SEND_TAB_ID) === id
          ? 'bg-indigo-600 text-white'
          : 'text-slate-500 hover:bg-slate-500/10 dark:text-slate-300'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div
      ref={dockRef}
      className={`hide-on-soft-keyboard pointer-events-none fixed bottom-3 right-3 z-[110] flex flex-col items-end gap-2 transition-all duration-200 ${
        scrolling ? 'translate-y-4 opacity-0' : ''
      }`}
    >
      <div
        className={`${open ? '' : 'hidden'} flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/20 dark:bg-slate-950 dark:shadow-black/50 ${
          scrolling ? '' : 'pointer-events-auto'
        }`}
        style={{ width: 'min(calc(100vw - 1.5rem), clamp(320px, 50vw, 720px))', maxHeight: 'min(70dvh, 40rem)' }}
      >
        {tabs.length > 0 && (
          <div role="tablist" className="flex shrink-0 gap-1 border-b border-slate-500/15 p-1.5">
            {tabButton(SEND_TAB_ID, t('machineSend.title'), <Send className="h-3.5 w-3.5 shrink-0" />)}
            {tabs.map((tab) => tabButton(tab.id, tab.label, tab.icon))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {extraTab ? extraTab.content : <PcMachineSendPanel />}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t(open ? 'machineSend.dockClose' : 'machineSend.dockOpen')}
        title={t('machineSend.title')}
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 ${
          scrolling ? '' : 'pointer-events-auto'
        }`}
      >
        {open ? <ChevronDown className="h-5 w-5" /> : <Send className="h-5 w-5" />}
      </button>
    </div>
  );
};
