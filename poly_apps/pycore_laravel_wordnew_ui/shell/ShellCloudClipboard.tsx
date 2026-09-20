import React, { useEffect, useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Cloud, Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CloudClipboardPanel from '../shared/cloud-clipboard/CloudClipboardPanel';
import PromptDerivedPanel from '../shared/prompt-derived/PromptDerivedPanel';
import Portal from '../shared/ui/Portal';
import { OVERLAY_Z } from '../shared/styles/overlay';
import { useShell } from './ShellContext';
import { SHELL_CLIPBOARD_HOST_ATTRIBUTE } from './shellChrome';
import type { ShellClipboardTab } from './shellTypes';

const controlClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-slate-500/10';

const tabClass = (active: boolean) =>
  `inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
    active ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-500/10'
  }`;

export const ShellCloudClipboard: React.FC = () => {
  const { clipboard, setClipboard } = useShell();
  const { t } = useTranslation('cloudClipboard');
  const [mounted, setMounted] = useState(clipboard.open);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);
  const expanded = clipboard.expanded && !clipboard.collapsed && contentHost !== null;
  const tab: ShellClipboardTab = clipboard.tab === 'prompts' ? 'prompts' : 'clipboard';

  useEffect(() => {
    const findContentHost = (): void => {
      const next = document.querySelector<HTMLElement>(`[${SHELL_CLIPBOARD_HOST_ATTRIBUTE}]`);
      setContentHost((previous) => previous === next ? previous : next);
    };
    const observer = new MutationObserver(findContentHost);
    findContentHost();
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (clipboard.open) setMounted(true);
  }, [clipboard.open]);

  if (!mounted && !clipboard.open) return null;

  return <Portal lockScroll={false} container={expanded ? contentHost : null}>
    <aside hidden={!clipboard.open} aria-label={t('title')}
      className={`${expanded ? 'absolute inset-0' : `fixed bottom-3 right-3 w-[calc(100vw-1.5rem)] ${clipboard.collapsed ? 'sm:w-80' : 'sm:w-[34rem]'} max-h-[calc(100dvh-1.5rem)] rounded-2xl`} ${OVERLAY_Z.clipboard} flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xl ${!clipboard.open ? 'hidden' : ''}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
        <Cloud size={20} className="text-indigo-500" />
        <button type="button" className="flex-1 min-w-0 text-left font-semibold"
          aria-expanded={!clipboard.collapsed} aria-controls="shell-cloud-clipboard-content"
          onClick={() => setClipboard({ collapsed: !clipboard.collapsed })}>{t('title')}</button>
        <span className="max-w-32 truncate text-xs text-slate-500">{clipboard.namespace || t('public')}</span>
        {/* Two embedded tabs: the cloud clipboard itself and the AI-derived
            prompt feed (opened on the prompts tab by the corner toast). */}
        {!clipboard.collapsed && (
          <div role="tablist" className="flex items-center gap-1">
            <button type="button" role="tab" aria-selected={tab === 'clipboard'}
              className={tabClass(tab === 'clipboard')}
              onClick={() => setClipboard({ tab: 'clipboard' })}>
              <Cloud size={12} />{t('tabClipboard')}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'prompts'}
              className={tabClass(tab === 'prompts')}
              onClick={() => setClipboard({ tab: 'prompts' })}>
              <Bot size={12} />{t('tabPrompts')}
            </button>
          </div>
        )}
        {!clipboard.collapsed && contentHost && <button type="button" className={controlClass}
          title={t(clipboard.expanded ? 'restoreFloating' : 'expandContentArea')}
          aria-label={t(clipboard.expanded ? 'restoreFloating' : 'expandContentArea')}
          aria-pressed={clipboard.expanded} onClick={() => setClipboard({ expanded: !clipboard.expanded })}>
          {clipboard.expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>}
        <button type="button" className={controlClass} title={t(clipboard.collapsed ? 'expand' : 'collapse')}
          aria-label={t(clipboard.collapsed ? 'expand' : 'collapse')} aria-expanded={!clipboard.collapsed}
          aria-controls="shell-cloud-clipboard-content" onClick={() => setClipboard({ collapsed: !clipboard.collapsed })}>
          {clipboard.collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button type="button" className={controlClass} title={t('close')} aria-label={t('close')}
          onClick={() => setClipboard({ open: false })}><X size={18} /></button>
      </div>
      <div id="shell-cloud-clipboard-content" hidden={clipboard.collapsed}
        className={`min-h-0 ${expanded ? 'flex-1' : ''} overflow-y-auto overscroll-contain ${clipboard.collapsed ? 'hidden' : ''}`}>
        {tab === 'prompts' ? (
          <PromptDerivedPanel />
        ) : (
          <CloudClipboardPanel embedded namespace={clipboard.namespace}
            onNamespaceChange={(namespace) => setClipboard({ namespace })} />
        )}
      </div>
    </aside>
  </Portal>;
};
