import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageManager } from '../../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';
import { PcMachineSendPanel } from './PcMachineSendPanel';

const OPEN_VALUE = '1';
const CLOSED_VALUE = '0';
const SCROLL_IDLE_MS = 600;

/** Bottom-right fixed dock for machine operations: collapsed by default, remembers being open, hides while the page scrolls. */
export const PcMachineSendDock: React.FC = () => {
  const { t } = useTranslation('pc');
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<boolean>(() => StorageManager.getRaw(StorageKeys.PYCORE_MACHINE_SEND_DOCK_OPEN) === OPEN_VALUE);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_MACHINE_SEND_DOCK_OPEN, open ? OPEN_VALUE : CLOSED_VALUE);
  }, [open]);

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

  return (
    <div
      ref={dockRef}
      className={`hide-on-soft-keyboard pointer-events-none fixed bottom-3 right-3 z-[80] flex flex-col items-end gap-2 transition-all duration-200 ${
        scrolling ? 'translate-y-4 opacity-0' : ''
      }`}
    >
      <div
        className={`${open ? '' : 'hidden'} overflow-y-auto overscroll-contain rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 ${
          scrolling ? '' : 'pointer-events-auto'
        }`}
        style={{ width: 'min(calc(100vw - 1.5rem), clamp(320px, 50vw, 720px))', maxHeight: 'min(70dvh, 40rem)' }}
      >
        <PcMachineSendPanel />
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
