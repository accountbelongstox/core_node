/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 订单核算 (Order reconciliation) modal.
// Batch-add express/tracking numbers, bidirectionally compare them against the
// tracking numbers of synced orders, see which batch each belongs to and what is
// matched / missing / unaccounted, then one-click print a report. Batches are
// cached in the system (chrome.storage via the bridge, or localStorage in a web
// preview) so previous query batches can be re-opened.

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, ClipboardCheck, Plus, Trash2, Printer, RefreshCw,
  CheckCircle2, AlertTriangle, PackageSearch, Loader2,
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { localizedErrorText, localeFor, reconciliationText } from '@/lib/uiI18n';
import {
  reconcile, parseTrackingInput, buildReportHtml,
  type ReconcileBatch,
} from '@/lib/reconcile';
import {
  inExtension, getAllOrders, listBatches, saveBatch, removeBatch,
} from '@/lib/dashboardBridge';

const LOCAL_KEY = 'dd_reconcile_batches_local';

interface Props {
  open: boolean;
  onClose: () => void;
  lang: 'zh' | 'en';
  fallbackOrders: Order[];
  useAllOrders: boolean;
}

// Local persistence used only in a plain web preview (no extension storage).
function loadLocalBatches(): ReconcileBatch[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveLocalBatches(list: ReconcileBatch[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const ReconciliationModal: React.FC<Props> = ({
  open,
  onClose,
  lang,
  fallbackOrders,
  useAllOrders,
}) => {
  const ui = reconciliationText(lang);
  const [batches, setBatches] = useState<ReconcileBatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'matched' | 'missing' | 'extra'>('missing');

  const ext = inExtension();

  // Load cached batches + the order set to reconcile against, whenever opened.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [b, o] = await Promise.all([
          ext ? listBatches() : Promise.resolve(loadLocalBatches()),
          ext && useAllOrders ? getAllOrders() : Promise.resolve(fallbackOrders),
        ]);
        if (!alive) return;
        setBatches(b);
        setOrders(o && o.length ? o : fallbackOrders);
        setSelectedIds(b.map((x) => x.id));
      } catch (loadError) {
        if (alive) setError(localizedErrorText(lang, loadError, ui.loadFailed));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, ext, fallbackOrders, ui.loadFailed, useAllOrders]);

  const parsed = useMemo(() => parseTrackingInput(text), [text]);

  const selectedBatches = useMemo(
    () => batches.filter((b) => selectedIds.includes(b.id)),
    [batches, selectedIds],
  );

  const result = useMemo(
    () => reconcile(selectedBatches, orders),
    [selectedBatches, orders],
  );

  if (!open) return null;

  const handleAdd = async () => {
    if (parsed.length === 0) return;
    const batch: ReconcileBatch = {
      id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `${ui.batch} ${new Date().toLocaleString(localeFor(lang))}`,
      trackingNumbers: parsed,
      createdAt: Date.now(),
    };
    let next = [batch, ...batches];
    setError('');
    if (ext) {
      try {
        next = await saveBatch(batch);
      } catch (saveError) {
        setError(localizedErrorText(lang, saveError, ui.saveFailed));
        return;
      }
    } else {
      saveLocalBatches(next);
    }
    setBatches(next);
    setSelectedIds((ids) => [...ids, batch.id]);
    setName('');
    setText('');
  };

  const handleRemove = async (id: string) => {
    let next = batches.filter((b) => b.id !== id);
    setError('');
    if (ext) {
      try {
        next = await removeBatch(id);
      } catch (removeError) {
        setError(localizedErrorText(lang, removeError, ui.removeFailed));
        return;
      }
    } else {
      saveLocalBatches(next);
    }
    setBatches(next);
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const handlePrint = () => {
    const html = buildReportHtml(result, selectedBatches, lang);
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      return;
    }
    // Popup blocked: open via a Blob URL instead.
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const rows =
    activeTab === 'matched' ? result.matched : activeTab === 'missing' ? result.missing : result.extra;

  const card = (n: number, label: string, tone: 'blue' | 'emerald' | 'rose' | 'slate') => {
    const tones = {
      blue: 'text-blue-600 dark:text-blue-400',
      emerald: 'text-emerald-600 dark:text-emerald-400',
      rose: 'text-rose-600 dark:text-rose-400',
      slate: 'text-slate-700 dark:text-slate-200',
    };
    return (
      <div className="bg-white/70 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-center">
        <div className={`text-xl font-extrabold font-mono ${tones[tone]}`}>{n}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/95 dark:bg-slate-900/95 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/10">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-500" />
            {ui.title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {ui.print}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {error && (
            <div className="lg:col-span-12 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}
          {/* Left: add batch + cached batches */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white/60 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {ui.add}
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ui.batchName}
                className="w-full text-xs bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder={ui.trackingPlaceholder}
                className="w-full text-xs font-mono bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {ui.parsed(parsed.length)}
                </span>
                <button
                  onClick={handleAdd}
                  disabled={parsed.length === 0}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {ui.save}
                </button>
              </div>
            </div>

            <div className="bg-white/60 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {ui.cached} ({batches.length})
                </span>
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
              </div>
              {batches.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic py-3 text-center">
                  {ui.emptyBatches}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-auto">
                  {batches.map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="w-3.5 h-3.5 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{b.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {b.trackingNumbers.length} {ui.numberUnit}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemove(b.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: result */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {card(result.totals.batchNumbers, ui.batchNumbers, 'slate')}
              {card(result.totals.orderNumbers, ui.orderNumbers, 'blue')}
              {card(result.totals.matched, ui.matched, 'emerald')}
              {card(result.totals.missing, ui.missing, 'rose')}
              {card(result.totals.extra, ui.extra, 'slate')}
            </div>

            {result.batchSummaries.length > 0 && (
              <div className="bg-white/60 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl p-3">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  {ui.perBatch}
                </div>
                <div className="space-y-1">
                  {result.batchSummaries.map((s) => (
                    <div key={s.batchId} className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-slate-600 dark:text-slate-300">{s.batchName}</span>
                      <span className="font-mono shrink-0 ml-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{s.matched}</span>
                        <span className="text-slate-400"> / {s.total}</span>
                        {s.missing > 0 && <span className="text-rose-500 font-bold"> · {ui.missingCount(s.missing)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1.5">
              {([
                { k: 'matched', label: ui.matched, n: result.totals.matched, icon: CheckCircle2, tone: 'emerald' },
                { k: 'missing', label: ui.batchMissing, n: result.totals.missing, icon: AlertTriangle, tone: 'rose' },
                { k: 'extra', label: ui.orderExtra, n: result.totals.extra, icon: PackageSearch, tone: 'slate' },
              ] as const).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.k;
                return (
                  <button
                    key={tab.k}
                    onClick={() => setActiveTab(tab.k)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      active
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300'
                        : 'bg-white/60 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label} ({tab.n})
                  </button>
                );
              })}
            </div>

            <div className="border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="text-left px-2.5 py-1.5 font-bold">{ui.tracking}</th>
                      {activeTab === 'missing' ? (
                        <th className="text-left px-2.5 py-1.5 font-bold">{ui.batches}</th>
                      ) : (
                        <>
                          <th className="text-left px-2.5 py-1.5 font-bold">{ui.order}</th>
                          <th className="text-left px-2.5 py-1.5 font-bold">{ui.account}</th>
                          <th className="text-left px-2.5 py-1.5 font-bold">{ui.status}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-slate-400 italic py-6">
                          {ui.noData}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.key} className="border-t border-black/5 dark:border-white/5">
                          <td className="px-2.5 py-1.5 font-mono">{r.tracking}</td>
                          {activeTab === 'missing' ? (
                            <td className="px-2.5 py-1.5 text-slate-500">
                              {r.batchIds
                                .map((id) => batches.find((b) => b.id === id)?.name || id)
                                .join(' / ')}
                            </td>
                          ) : (
                            <>
                              <td className="px-2.5 py-1.5 font-mono text-slate-500">{r.order?.id}</td>
                              <td className="px-2.5 py-1.5">{r.order?.accountName}</td>
                              <td className="px-2.5 py-1.5">{r.order?.status}</td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <RefreshCw className="w-3 h-3" />
              {ui.compareHint}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
