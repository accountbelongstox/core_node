import React, { useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import { getUserAgreement } from '../WfNewUserAgreement';

/**
 * WfNewAgreementModal — reusable scrollable modal that renders the WordNew User
 * Agreement (Terms of Service) in the current UI language. Self-contained (Portal
 * + OVERLAY framework, like WfNewLanguagePanel); the content comes from the
 * multi-language WfNewUserAgreement doc. Used at registration behind the "I agree"
 * link and reusable from About / Settings.
 */
interface WfNewAgreementModalProps {
  open: boolean;
  onClose: () => void;
  /** Current UI language (en / zh / ja / ko); falls back to English. */
  lang: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewAgreementModal: React.FC<WfNewAgreementModalProps> = ({ open, onClose, lang, trans }) => {
  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const doc = getUserAgreement(lang);

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={onClose} />
        <div className="relative w-full max-w-lg bg-zinc-900/95 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                {doc.title}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{doc.updated}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="p-5 space-y-4 overflow-y-auto">
            <p className="text-xs text-zinc-400 leading-relaxed">{doc.intro}</p>
            {doc.sections.map((s) => (
              <div key={s.heading} className="space-y-1">
                <h4 className="text-xs font-black text-slate-200">{s.heading}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 shrink-0 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-xs font-mono font-black uppercase cursor-pointer shadow-md"
            >
              {trans('common.close')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default WfNewAgreementModal;
