import React, { useEffect, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { announceDockOpen, onOtherDockOpen } from './dock/pcDockEvents';
import PcTerminalBackupPanel from './PcTerminalBackupPanel';

const DOCK_ID = 'terminal-backup';
const OPEN_VALUE = '1';
const CLOSED_VALUE = '0';

interface PcTerminalBackupDockProps {
  errorTranslationKey: (errorCode?: string | null) => string;
}

/** Floating terminal-backup dock beside the machine-send dock; stays above the terminal preview dialog. */
export const PcTerminalBackupDock: React.FC<PcTerminalBackupDockProps> = ({ errorTranslationKey }) => {
  const { t } = useTranslation('pc');
  const [open, setOpen] = useState<boolean>(() => StorageManager.getRaw(StorageKeys.PYCORE_TERMINAL_BACKUP_DOCK_OPEN) === OPEN_VALUE);

  useEffect(() => {
    StorageManager.setRaw(StorageKeys.PYCORE_TERMINAL_BACKUP_DOCK_OPEN, open ? OPEN_VALUE : CLOSED_VALUE);
    if (open) announceDockOpen(DOCK_ID);
  }, [open]);

  useEffect(() => onOtherDockOpen(DOCK_ID, () => setOpen(false)), []);

  return (
    <>
      {open && (
        <div
          className="hide-on-soft-keyboard fixed bottom-[4.25rem] right-3 z-[110] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl shadow-black/20 dark:bg-slate-950 dark:shadow-black/50"
          style={{ width: 'min(calc(100vw - 1.5rem), clamp(320px, 50vw, 720px))', maxHeight: 'min(70dvh, 40rem)' }}
        >
          <PcTerminalBackupPanel errorTranslationKey={errorTranslationKey} defaultExpanded />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t(open ? 'terminal.backup.dockClose' : 'terminal.backup.dockOpen')}
        title={t('terminal.backup.title')}
        className="hide-on-soft-keyboard fixed bottom-3 right-[4.25rem] z-[110] inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg shadow-black/30 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        {open ? <ChevronDown className="h-5 w-5" /> : <History className="h-5 w-5" />}
      </button>
    </>
  );
};
