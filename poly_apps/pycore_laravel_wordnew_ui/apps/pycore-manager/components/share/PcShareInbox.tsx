import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FileText, Inbox, Loader2, Mic, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '@/core/utils/formatBytes';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import Portal from '@/shared/ui/Portal';
import { sharedItemFile, shareReceiverSupported, type SharedItem } from '@/shared/share/CapShareReceiver';
import {
  clearShareInbox,
  closeShareInboxPicker,
  markShareInboxPrompted,
  openShareInboxPicker,
  publishShareTargets,
  removeFromShareInbox,
  useShareInbox,
} from '@/shared/share/ShareInbox';
import { PcOsIcon } from '@/apps/pycore-manager/components/terminal/PcOsIcon';
import { listTerminalTabNodes } from '@/apps/pycore-manager/components/terminal/PcTerminalNodeTabs';
import {
  catalogNodeKey,
  refreshTerminalCatalog,
  terminalCatalog,
  type CatalogNode,
} from '@/apps/pycore-manager/components/terminal/terminalCatalog';
import {
  MAX_RECENT_SHARE_TARGETS,
  parseShareTargetId,
  readRecentShareTargets,
  sameShareTarget,
  shareDeliveryRequest,
  shareTargetId,
  type ShareTargetRef,
} from '@/apps/pycore-manager/components/terminal/terminalShareDelivery';

const PUBLISH_DEBOUNCE_MS = 1500;
const IMAGE_MIME = /^image\//i;
const AUDIO_MIME = /^audio\//i;

interface PcShareInboxProps {
  /** Backend URL of the shown node tab; null is this machine. */
  activeUrl: string | null;
  onSelectNode: (url: string | null) => void;
}

function itemPreviewSrc(item: SharedItem): string {
  return IMAGE_MIME.test(item.mimeType) ? Capacitor.convertFileSrc(item.path) : '';
}

const ItemRow: React.FC<{ item: SharedItem; busy: boolean; onRemove: () => void }> = ({ item, busy, onRemove }) => {
  const { t } = useTranslation('pc');
  const src = itemPreviewSrc(item);
  return (
    <li className="flex items-center gap-3 rounded-xl bg-slate-500/10 p-2">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-500/15">
        {src
          ? <img src={src} alt="" className="h-full w-full object-cover" />
          : AUDIO_MIME.test(item.mimeType)
            ? <Mic className="h-5 w-5 text-indigo-500" />
            : <FileText className="h-5 w-5 text-indigo-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.name}</span>
        <span className="block font-mono text-[11px] text-slate-500 dark:text-slate-400">{formatBytes(item.size)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        title={t('terminal.share.removeItem')}
        aria-label={t('terminal.share.removeItem')}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
      >
        <X className="h-5 w-5" />
      </button>
    </li>
  );
};

/** Recently used targets first, then the online terminals of the catalog, capped for the sharing shortcuts. */
function shortcutTargets(catalog: Record<string, CatalogNode>): Array<ShareTargetRef & { name: string }> {
  const known = new Map<string, ShareTargetRef & { name: string }>();
  Object.values(catalog).forEach((node) => node.terminals.forEach((terminal) => {
    if (terminal.online) known.set(shareTargetId({ nodeUrl: node.nodeUrl, terminalNumber: terminal.number }), { nodeUrl: node.nodeUrl, terminalNumber: terminal.number, name: terminal.name });
  }));
  const ordered: Array<ShareTargetRef & { name: string }> = [];
  readRecentShareTargets().forEach((target) => {
    const entry = known.get(shareTargetId(target));
    if (entry) { ordered.push(entry); known.delete(shareTargetId(target)); }
  });
  return [...ordered, ...known.values()].slice(0, MAX_RECENT_SHARE_TARGETS);
}

/**
 * Receiver side of files shared to the app: an unobtrusive badge in the terminal tabs bar and the picker that
 * assigns the waiting files to a terminal under a node tab. Delivery adds them to that terminal's composer.
 */
export const PcShareInbox: React.FC<PcShareInboxProps> = ({ activeUrl, onSelectNode }) => {
  const { t } = useTranslation('pc');
  const { entries, pickerOpen } = useShareInbox();
  const catalog = terminalCatalog.use();
  const [selected, setSelected] = useState<ShareTargetRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const touchedRef = useRef(false);
  const open = pickerOpen && entries.length > 0;
  const tRef = useRef(t);
  tRef.current = t;
  const activeUrlRef = useRef(activeUrl);
  activeUrlRef.current = activeUrl;

  const refresh = useCallback(() => {
    setLoading(true);
    void refreshTerminalCatalog(activeUrlRef.current, tRef.current('terminal.nodes.thisMachine'), tRef.current('terminal.untitled'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!pickerOpen || entries.length > 0) return;
    closeShareInboxPicker();
  }, [entries.length, pickerOpen]);

  useEffect(() => {
    if (!open) return;
    touchedRef.current = false;
    setNotice('');
    markShareInboxPrompted();
    refresh();
  }, [open, refresh]);

  const preferred = useMemo((): ShareTargetRef | null => {
    const named = entries.map((entry) => parseShareTargetId(entry.targetId)).find(Boolean) ?? null;
    return named ?? readRecentShareTargets()[0] ?? null;
  }, [entries]);

  useEffect(() => {
    if (!open || touchedRef.current || !preferred) return;
    const node = catalog[catalogNodeKey(preferred.nodeUrl)];
    if (node?.terminals.some((terminal) => terminal.number === preferred.terminalNumber)) setSelected(preferred);
  }, [catalog, open, preferred]);

  useEffect(() => {
    if (!shareReceiverSupported()) return undefined;
    const timer = window.setTimeout(() => {
      void publishShareTargets(shortcutTargets(catalog).map((target) => ({
        id: shareTargetId(target),
        label: t('terminal.share.shortcutLabel', { number: target.terminalNumber, name: target.name }),
      })));
    }, PUBLISH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [catalog, t]);

  const tabNodes = open ? listTerminalTabNodes(activeUrl, t('terminal.nodes.thisMachine')) : [];
  const recents = open
    ? readRecentShareTargets().flatMap((target) => {
      const node = catalog[catalogNodeKey(target.nodeUrl)];
      const terminal = node?.terminals.find((entry) => entry.number === target.terminalNumber);
      return node && terminal ? [{ target, node, terminal }] : [];
    })
    : [];

  const pick = (target: ShareTargetRef) => {
    touchedRef.current = true;
    setSelected(target);
  };

  const confirm = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setNotice('');
    const files: File[] = [];
    const entryIds: string[] = [];
    const failed: string[] = [];
    for (const entry of entries) {
      try {
        files.push(await sharedItemFile(entry.item));
        entryIds.push(entry.item.id);
      } catch {
        failed.push(entry.item.name);
      }
    }
    setBusy(false);
    if (failed.length) setNotice(t('terminal.share.readFailed', { names: failed.join(', ') }));
    if (!files.length) return;
    shareDeliveryRequest.set({ ...selected, files, entryIds });
    if (selected.nodeUrl !== activeUrl) onSelectNode(selected.nodeUrl);
    closeShareInboxPicker();
  };

  const removeItem = (id: string) => { void removeFromShareInbox([id]); };
  const discardAll = () => { void clearShareInbox(); };

  const terminalButton = (node: CatalogNode, number: number, name: string, online: boolean) => {
    const target = { nodeUrl: node.nodeUrl, terminalNumber: number };
    const active = selected !== null && sameShareTarget(selected, target);
    return (
      <button
        key={`${catalogNodeKey(node.nodeUrl)}:${number}`}
        type="button"
        onClick={() => pick(target)}
        aria-pressed={active}
        className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
          active
            ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
            : 'border-slate-500/20 text-slate-700 hover:bg-slate-500/10 dark:text-slate-200'
        }`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} title={online ? undefined : t('terminal.share.terminalOffline')} />
        <span className="shrink-0 font-mono text-xs opacity-80">#{number}</span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
      </button>
    );
  };

  return (
    <>
      {entries.length > 0 && !open && (
        <button
          type="button"
          onClick={openShareInboxPicker}
          title={t('terminal.share.badge', { count: entries.length })}
          aria-label={t('terminal.share.badge', { count: entries.length })}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-amber-500/15 px-2 text-[11px] font-bold tabular-nums text-amber-600 hover:bg-amber-500/25 dark:text-amber-300"
        >
          <Inbox className="h-3.5 w-3.5" />
          <span>{entries.length}</span>
        </button>
      )}
      {open && (
        <Portal>
          <div className={`fixed inset-0 ${OVERLAY_Z.login} flex items-end justify-center bg-black/50 p-4 pt-[max(1rem,var(--wf-safe-top))] pb-[max(1rem,var(--wf-safe-bottom))] backdrop-blur-sm sm:items-center`}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t('terminal.share.title')}
              className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
            >
              <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-4">
                <Inbox className="h-5 w-5 shrink-0 text-amber-500" />
                <h3 className="min-w-0 flex-1 truncate text-base font-bold text-slate-800 dark:text-slate-100">{t('terminal.share.title')}</h3>
                <button
                  type="button"
                  onClick={closeShareInboxPicker}
                  title={t('terminal.share.keep')}
                  aria-label={t('terminal.share.close')}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-500/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('terminal.share.intro')}</p>
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('terminal.share.received', { count: entries.length })}</h4>
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto overscroll-contain">
                    {entries.map((entry) => (
                      <ItemRow key={entry.item.id} item={entry.item} busy={busy} onRemove={() => removeItem(entry.item.id)} />
                    ))}
                  </ul>
                </section>
                <section className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('terminal.share.sendTo')}
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label={t('terminal.share.loading')} />}
                  </h4>
                  {recents.length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] text-slate-500">{t('terminal.share.lastUsed')}</p>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {recents.map(({ node, terminal }) => terminalButton(node, terminal.number, `${terminal.name} · ${node.label}`, terminal.online))}
                      </div>
                    </div>
                  )}
                  {tabNodes.map((tab, index) => {
                    const node = catalog[catalogNodeKey(tab.url)];
                    return (
                      <div key={tab.url ?? 'primary'}>
                        <p className="mb-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <PcOsIcon os={tab.os} />
                          <span className="shrink-0 tabular-nums">{index + 1}</span>
                          <span className="min-w-0 truncate">{tab.label}</span>
                          {node && !node.reachable && <span className="shrink-0 font-normal text-rose-500">{t('terminal.share.nodeUnreachable')}</span>}
                        </p>
                        {!node
                          ? <p className="text-xs text-slate-500">{t('terminal.share.loading')}</p>
                          : node.terminals.length === 0
                            ? <p className="text-xs text-slate-500">{t('terminal.share.noTerminals')}</p>
                            : (
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                {node.terminals.map((terminal) => terminalButton(node, terminal.number, terminal.name, terminal.online))}
                              </div>
                            )}
                      </div>
                    );
                  })}
                </section>
                {notice && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{notice}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={discardAll}
                  disabled={busy}
                  title={t('terminal.share.discardAll')}
                  aria-label={t('terminal.share.discardAll')}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={closeShareInboxPicker}
                  disabled={busy}
                  className="h-12 shrink-0 rounded-xl border border-slate-500/25 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-500/10 disabled:opacity-50 dark:text-slate-300"
                >
                  {t('terminal.share.keep')}
                </button>
                <button
                  type="button"
                  onClick={() => { void confirm(); }}
                  disabled={!selected || busy}
                  className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="truncate">{selected ? t('terminal.share.confirm', { number: selected.terminalNumber }) : t('terminal.share.pickTerminal')}</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};

export default PcShareInbox;
