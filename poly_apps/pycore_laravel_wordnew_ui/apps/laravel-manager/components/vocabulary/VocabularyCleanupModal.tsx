/**
 * VocabularyCleanupModal — one-click cleanup flow for the Words tab.
 *
 * Two kinds share this modal:
 *   - words:        junk-content rows (CJK text, keyboard mash) — the whole
 *                   row is DELETED;
 *   - translations: rows whose translation is a provider error payload or
 *                   echoes the word itself — ONLY the translations field is
 *                   cleared (the entry stays, the translation lane refills it).
 *
 * Flow (server-authoritative): the backend computes the matching id set once
 * per language (10 min cache), this modal pages through the preview, and the
 * purge runs only after the operator types "delete". The client never decides
 * WHAT is invalid — it only pages and confirms.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eraser, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import { api, type DictionaryCleanupRow } from '@/apps/laravel-manager/api';
import { logError, logSuccess } from '@/core/logstore/logStore';
import { VocabularyWordsModel } from './words/VocabularyWordsModel';

const CLEANUP_PAGE_SIZE = 50;

export type VocabularyCleanupKind = 'words' | 'translations';

interface VocabularyCleanupLabels {
  title_words: string;
  title_translations: string;
  subtitle_words: string;
  subtitle_translations: string;
  preview_failed: string;
  confirm_hint_words: string;
  confirm_hint_translations: string;
  confirm_placeholder: string;
  purge: string;
  purging: string;
  purged_words: string;
  purged_translations: string;
  purge_failed: string;
  nothing_to_clean: string;
  reason_invalid_content: string;
  reason_error_marker: string;
  reason_same_as_word: string;
}

interface VocabularyCleanupModalProps {
  open: boolean;
  onClose: () => void;
  kind: VocabularyCleanupKind;
  language: string;
  labels: VocabularyCleanupLabels;
  cancelText: string;
  /** Called after a successful purge so the word list + stats reload. */
  onPurged: () => void;
}

/** Translation values rendered compactly for the preview cell. */
const translationPreview = (row: DictionaryCleanupRow): string => {
  const t = row.translations;
  if (!t || typeof t !== 'object') return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(t)) {
    if (typeof value === 'string') {
      parts.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      const texts = value
        .map((pair) => (Array.isArray(pair) ? pair.slice(1).join(' ') : String(pair)))
        .filter((s) => s.trim() !== '');
      if (texts.length > 0) parts.push(`${key}: ${texts.join(' | ')}`);
    }
    if (parts.join(' ').length > 160) break;
  }
  return parts.join(' · ');
};

const VocabularyCleanupModal: React.FC<VocabularyCleanupModalProps> = ({
  open,
  onClose,
  kind,
  language,
  labels,
  cancelText,
  onPurged,
}) => {
  const [start, setStart] = useState(0);
  const [rows, setRows] = useState<DictionaryCleanupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const requestIdRef = useRef(0);

  const languageCode = VocabularyWordsModel.languageCode(language);
  const title = kind === 'words' ? labels.title_words : labels.title_translations;
  const subtitle = kind === 'words' ? labels.subtitle_words : labels.subtitle_translations;
  const reasonLabel = (reason: string): string => {
    if (reason === 'error_marker') return labels.reason_error_marker;
    if (reason === 'same_as_word') return labels.reason_same_as_word;
    return labels.reason_invalid_content;
  };

  const load = useCallback(async (nextStart: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = { language: languageCode, start: nextStart, limit: CLEANUP_PAGE_SIZE };
      const r = kind === 'words'
        ? await api.books.getInvalidWords(params)
        : await api.books.getInvalidTranslations(params);
      if (requestId !== requestIdRef.current) return;
      const d: any = r.success ? r.data : null;
      setRows(Array.isArray(d?.rows) ? d.rows : []);
      setTotal(Number(d?.total ?? 0));
      setStart(nextStart);
      if (!r.success) {
        setError(VocabularyWordsModel.format(labels.preview_failed, { error: r.error || 'unknown' }));
      }
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;
      setRows([]);
      setError(VocabularyWordsModel.format(labels.preview_failed, { error: e?.message || e }));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [kind, languageCode, labels.preview_failed]);

  useEffect(() => {
    if (!open) return;
    setConfirmInput('');
    void load(0);
  }, [open, load]);

  const purge = useCallback(async () => {
    if (confirmInput.trim().toLowerCase() !== 'delete' || purging) return;
    setPurging(true);
    setError(null);
    try {
      const payload = { language: languageCode, confirm: confirmInput.trim() };
      const r = kind === 'words'
        ? await api.books.purgeInvalidWords(payload)
        : await api.books.purgeInvalidTranslations(payload);
      if (r.success) {
        const affected = Number((r.data as any)?.affected ?? 0);
        const message = VocabularyWordsModel.format(
          kind === 'words' ? labels.purged_words : labels.purged_translations,
          { count: affected },
        );
        logSuccess('vocab', message);
        onPurged();
        onClose();
      } else {
        setError(VocabularyWordsModel.format(labels.purge_failed, { error: r.error || 'unknown' }));
      }
    } catch (e: any) {
      const message = VocabularyWordsModel.format(labels.purge_failed, { error: e?.message || e });
      setError(message);
      logError('vocab', message);
    } finally {
      setPurging(false);
    }
  }, [confirmInput, purging, kind, languageCode, labels, onPurged, onClose]);

  if (!open) return null;

  const from = total === 0 ? 0 : start + 1;
  const to = start + rows.length;
  const hasPrev = start > 0;
  const hasNext = start + CLEANUP_PAGE_SIZE < total;
  const confirmReady = confirmInput.trim().toLowerCase() === 'delete';

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`} onClick={() => { if (!purging) onClose(); }}>
        <div
          className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200/80 dark:border-slate-700/80"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Eraser className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span className="truncate">{title}</span>
                <span className="text-xs font-normal text-slate-400">({total.toLocaleString()})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={purging}
              className="flex-shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-500 text-sm px-4 text-center">{error}</div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">{labels.nothing_to_clean}</div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-14">#</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-44">Word</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">Translation</th>
                    <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-36">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row, idx) => {
                    const preview = translationPreview(row);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono">{start + idx + 1}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200 font-medium break-all">{row.content}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[20rem] truncate" title={preview}>
                          {preview || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            {reasonLabel(row.reason)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination + confirm footer */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {from.toLocaleString()}–{to.toLocaleString()} / {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev || loading}
                  onClick={() => load(Math.max(0, start - CLEANUP_PAGE_SIZE))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  type="button"
                  disabled={!hasNext || loading}
                  onClick={() => load(start + CLEANUP_PAGE_SIZE)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {total > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-rose-600 dark:text-rose-400">
                  {VocabularyWordsModel.format(
                    kind === 'words' ? labels.confirm_hint_words : labels.confirm_hint_translations,
                    { count: total.toLocaleString() },
                  )}
                </span>
                <input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={labels.confirm_placeholder}
                  disabled={purging}
                  className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 w-32 font-mono focus:outline-none focus:ring-2 focus:ring-rose-400/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={purge}
                  disabled={!confirmReady || purging}
                  className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {purging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {purging ? labels.purging : labels.purge}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default VocabularyCleanupModal;
