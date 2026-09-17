import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Cloud, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CloudClipboardPanel from '../shared/cloud-clipboard/CloudClipboardPanel';
import Portal from '../shared/ui/Portal';
import { OVERLAY_Z } from '../shared/styles/overlay';
import { useShell } from './ShellContext';

const controlClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-slate-500/10';

export const ShellCloudClipboard: React.FC = () => {
  const { clipboard, setClipboard } = useShell();
  const { t } = useTranslation('cloudClipboard');
  const [mounted, setMounted] = useState(clipboard.open);

  useEffect(() => {
    if (clipboard.open) setMounted(true);
  }, [clipboard.open]);

  if (!mounted && !clipboard.open) return null;

  return <Portal lockScroll={false}>
    <aside hidden={!clipboard.open} aria-label={t('title')}
      className={`fixed bottom-3 right-3 ${OVERLAY_Z.clipboard} w-[calc(100vw-1.5rem)] ${clipboard.collapsed ? 'sm:w-80' : 'sm:w-[34rem]'} max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xl ${!clipboard.open ? 'hidden' : ''}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
        <Cloud size={20} className="text-indigo-500" />
        <button type="button" className="flex-1 min-w-0 text-left font-semibold"
          aria-expanded={!clipboard.collapsed} aria-controls="shell-cloud-clipboard-content"
          onClick={() => setClipboard({ collapsed: !clipboard.collapsed })}>{t('title')}</button>
        <span className="max-w-32 truncate text-xs text-slate-500">{clipboard.namespace || t('public')}</span>
        <button type="button" className={controlClass} title={t(clipboard.collapsed ? 'expand' : 'collapse')}
          aria-label={t(clipboard.collapsed ? 'expand' : 'collapse')} aria-expanded={!clipboard.collapsed}
          aria-controls="shell-cloud-clipboard-content" onClick={() => setClipboard({ collapsed: !clipboard.collapsed })}>
          {clipboard.collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button type="button" className={controlClass} title={t('close')} aria-label={t('close')}
          onClick={() => setClipboard({ open: false })}><X size={18} /></button>
      </div>
      <div id="shell-cloud-clipboard-content" hidden={clipboard.collapsed}
        className={`min-h-0 overflow-y-auto overscroll-contain ${clipboard.collapsed ? 'hidden' : ''}`}>
        <CloudClipboardPanel embedded namespace={clipboard.namespace}
          onNamespaceChange={(namespace) => setClipboard({ namespace })} />
      </div>
    </aside>
  </Portal>;
};
