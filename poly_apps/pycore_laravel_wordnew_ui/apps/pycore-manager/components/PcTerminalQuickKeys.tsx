import React from 'react';
import { AppWindow, ArrowDownToLine, Hand, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { TerminalKeyAction } from '@/apps/pycore-manager/api';

type TerminalScrollMode = 'page_up' | 'page_down' | 'bottom';
type QuickKeyGroup = 'key' | 'window' | 'history' | 'scroll' | 'permission';
type PermissionTone = 'manual' | 'other' | 'unknown';

interface QuickKeyDef {
  id: string;
  group: QuickKeyGroup;
  label: string;
  face: React.ReactNode;
  tone?: PermissionTone;
  onClick: () => void;
}

interface PcTerminalQuickKeysProps {
  disabled: boolean;
  permissionMode?: string | null;
  onActivate: () => void;
  onEnter: () => void;
  onKey: (key: TerminalKeyAction) => void;
  onPermissionManual: () => void;
  onHistory: (direction: 'up' | 'down') => void;
  onScroll: (mode: TerminalScrollMode) => void;
}

const CAP_BASE = 'flex h-8 min-w-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-md border border-b-2 px-0.5 font-mono text-[10px] font-bold leading-none tracking-tight transition-colors disabled:opacity-40';
const GROUP_CLASS: Record<QuickKeyGroup, string> = {
  key: 'border-slate-400/50 bg-slate-500/10 text-slate-700 hover:bg-slate-500/20 dark:border-slate-500/50 dark:text-slate-200',
  window: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300',
  history: 'border-violet-500/40 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 dark:text-violet-300',
  scroll: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300',
  permission: 'border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-300',
};
const MANUAL_PERMISSION_CLASS = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300';
const ICON_CLASS = 'h-3.5 w-3.5 shrink-0';
const SMALL_ICON_CLASS = 'h-3 w-3 shrink-0';

export const PcTerminalQuickKeys: React.FC<PcTerminalQuickKeysProps> = ({
  disabled,
  permissionMode,
  onActivate,
  onEnter,
  onKey,
  onPermissionManual,
  onHistory,
  onScroll,
}) => {
  const { t } = useTranslation('pc');
  const modeLabel = permissionMode ? t(`terminal.permissionMode.modes.${permissionMode}`) : '';
  const defs: QuickKeyDef[] = [
    { id: 'escape', group: 'key', label: t('terminal.keyHints.escape'), face: 'Esc', onClick: () => onKey('escape') },
    { id: 'ctrl_c', group: 'key', label: t('terminal.keyHints.ctrl_c'), face: 'Ctrl C', onClick: () => onKey('ctrl_c') },
    { id: 'tab', group: 'key', label: t('terminal.keyHints.tab'), face: 'Tab ⇥', onClick: () => onKey('tab') },
    { id: 'shift_tab', group: 'key', label: t('terminal.keyHints.shift_tab'), face: '⇧Tab', onClick: () => onKey('shift_tab') },
    { id: 'enter', group: 'key', label: t('terminal.sendEnterHint'), face: 'Enter ↵', onClick: onEnter },
    {
      id: 'manualMode',
      group: 'permission',
      label: permissionMode
        ? t('terminal.permissionMode.switchHint', { mode: modeLabel })
        : t('terminal.permissionMode.switchHintUnknown'),
      tone: permissionMode === 'manual' ? 'manual' : 'other',
      face: <><Hand className={ICON_CLASS} />⇧⇥</>,
      onClick: onPermissionManual,
    },
    { id: 'activate', group: 'window', label: t('terminal.activate'), face: <AppWindow className={ICON_CLASS} />, onClick: onActivate },
    { id: 'previousCommand', group: 'history', label: t('terminal.previousCommand'), face: <><History className={SMALL_ICON_CLASS} />↑</>, onClick: () => onHistory('up') },
    { id: 'nextCommand', group: 'history', label: t('terminal.nextCommand'), face: <><History className={SMALL_ICON_CLASS} />↓</>, onClick: () => onHistory('down') },
    { id: 'pageUp', group: 'scroll', label: t('terminal.pageUp'), face: 'PgUp', onClick: () => onScroll('page_up') },
    { id: 'pageDown', group: 'scroll', label: t('terminal.pageDown'), face: 'PgDn', onClick: () => onScroll('page_down') },
    { id: 'scrollBottom', group: 'scroll', label: t('terminal.scrollBottom'), face: <ArrowDownToLine className={ICON_CLASS} />, onClick: () => onScroll('bottom') },
  ];
  return (
    <div
      className="grid grid-cols-6 gap-1 sm:grid-cols-12"
      role="toolbar"
      aria-label={t('terminal.quickKeys')}
    >
      {defs.map(({ id, group, label, face, tone, onClick }) => (
        <button
          key={id}
          type="button"
          onClick={onClick}
          disabled={disabled}
          title={label}
          aria-label={label}
          className={`${CAP_BASE} ${tone === 'manual' ? MANUAL_PERMISSION_CLASS : GROUP_CLASS[group]}`}
        >
          {face}
        </button>
      ))}
    </div>
  );
};
