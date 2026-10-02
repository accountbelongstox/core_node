import React from 'react';
import { FileText } from 'lucide-react';
import { ActionButton } from '@/shared/ui/ActionButton';
import { ModalFooter, ModalHeader } from '@/shared/ui/ModalParts';
import { ModalShell } from '@/shared/ui/ModalShell';
import { getUserAgreement } from '../WfNewUserAgreement';

const CARD_CLASS = 'relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-zinc-900/95 shadow-2xl';

/**
 * WfNewAgreementModal — reusable scrollable modal that renders the WordNew User
 * Agreement (Terms of Service) in the current UI language. Built on ModalShell;
 * the content comes from the multi-language WfNewUserAgreement doc. Used at
 * registration behind the "I agree" link and reusable from About / Settings.
 */
interface WfNewAgreementModalProps {
  open: boolean;
  onClose: () => void;
  /** Current UI language (en / zh / ja / ko); falls back to English. */
  lang: string;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewAgreementModal: React.FC<WfNewAgreementModalProps> = ({ open, onClose, lang, trans }) => {
  if (!open) return null;
  const doc = getUserAgreement(lang);

  return (
    <ModalShell onClose={onClose} cardClassName={CARD_CLASS}>
      <ModalHeader
        bordered
        icon={<FileText className="h-4 w-4 shrink-0 text-indigo-400" />}
        title={doc.title}
        subtitle={doc.updated}
        onClose={onClose}
      />
      <div className="space-y-4 overflow-y-auto p-5">
        <p className="text-xs leading-relaxed text-zinc-400">{doc.intro}</p>
        {doc.sections.map((s) => (
          <div key={s.heading} className="space-y-1">
            <h4 className="text-xs font-black text-slate-200">{s.heading}</h4>
            <p className="text-[11px] leading-relaxed text-zinc-400">{s.body}</p>
          </div>
        ))}
      </div>
      <ModalFooter bordered>
        <ActionButton onClick={onClose}>{trans('common.close')}</ActionButton>
      </ModalFooter>
    </ModalShell>
  );
};

export default WfNewAgreementModal;
