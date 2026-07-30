import React, { useEffect } from 'react';
import { Layers, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '../../../styles/overlay';
import type { PreviewAddLibraryResult } from '../api/types/api';

/**
 * WfNewConfirmAddLibraryModal — confirmation dialog shown BEFORE a vocabulary
 * library's words are copied into the user's Default Vocabulary Group. It renders a
 * non-mutating preview: how many words the library has, how many are already in the
 * group, how many are new (to add), the projected total, the duplicate count, and
 * the group's current read / memorized / due-for-review breakdown. Uses the shared
 * Portal + OVERLAY framework, mirroring WfNewAgreementModal.
 */
interface WfNewConfirmAddLibraryModalProps {
  open: boolean;
  groupTitle: string;
  loading: boolean;
  submitting: boolean;
  preview: PreviewAddLibraryResult | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewConfirmAddLibraryModal: React.FC<WfNewConfirmAddLibraryModalProps> = ({
  open, groupTitle, loading, submitting, preview, error, onCancel, onConfirm, trans,
}) => {
  // Esc to close (ignored while the add is in flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  const canConfirm = !!preview && !loading && !submitting && preview.language_match && preview.to_add > 0;

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={() => { if (!submitting) onCancel(); }} />
        <div className="relative w-full max-w-md bg-zinc-900/95 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 truncate">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                {trans('library.confirmTitle')}
              </h3>
              {groupTitle && <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">{groupTitle}</p>}
            </div>
            <button
              onClick={onCancel}
              disabled={submitting}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer shrink-0 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-400 font-mono">
                <Loader2 className="w-4 h-4 animate-spin" /> {trans('library.confirmCalculating')}
              </div>
            )}

            {!loading && error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {!loading && !error && preview && (
              <>
                {/* Add summary tiles */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: trans('library.confirmLibraryTotal'), value: preview.library_total, accent: 'text-slate-200' },
                    { label: trans('library.confirmCurrentInGroup'), value: preview.current_in_group, accent: 'text-slate-200' },
                    { label: trans('library.confirmToAdd'), value: preview.to_add, accent: 'text-cyan-400' },
                    { label: trans('library.confirmProjected'), value: preview.projected_total, accent: 'text-emerald-400' },
                  ].map((t) => (
                    <div key={t.label} className="rounded-2xl bg-white/5 border border-white/5 p-3">
                      <div className={`text-lg font-mono font-black ${t.accent}`}>{t.value}</div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{t.label}</div>
                    </div>
                  ))}
                </div>

                {/* Duplicates already present */}
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500 uppercase tracking-wider">{trans('library.confirmDuplicates')}</span>
                  <span className="text-amber-400 font-bold">{preview.duplicates_count}</span>
                </div>

                {/* Current default-group progress */}
                <div className="space-y-2">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{trans('library.confirmStatusTitle')}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: trans('library.confirmRead'), value: preview.status_breakdown.read, accent: 'text-sky-400' },
                      { label: trans('library.confirmMemorized'), value: preview.status_breakdown.memorized, accent: 'text-emerald-400' },
                      { label: trans('library.confirmDue'), value: preview.status_breakdown.due, accent: 'text-amber-400' },
                    ].map((t) => (
                      <div key={t.label} className="rounded-xl bg-white/5 border border-white/5 p-2 text-center">
                        <div className={`text-sm font-mono font-black ${t.accent}`}>{t.value}</div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{t.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {preview.already_linked && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{trans('library.confirmAlreadyLinked')}</span>
                  </div>
                )}
                {!preview.language_match && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{trans('library.confirmLangMismatch')}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 shrink-0 flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono font-bold cursor-pointer disabled:opacity-40"
            >
              {trans('library.confirmCancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-black uppercase cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {trans('library.confirmAdd', { count: preview?.to_add ?? 0 })}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default WfNewConfirmAddLibraryModal;
