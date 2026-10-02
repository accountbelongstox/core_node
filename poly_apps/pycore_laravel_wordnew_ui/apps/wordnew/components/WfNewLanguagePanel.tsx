import React, { useEffect, useState } from 'react';
import { Languages, Save } from 'lucide-react';
import { ActionButton } from '@/shared/ui/ActionButton';
import { ModalFooter, ModalHeader } from '@/shared/ui/ModalParts';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { WfNewLanguage } from '../api';
import {
  WfNewLanguageChipSection, saveLearningLanguages, useWfNewLanguageCatalog, type WfNewLanguageSelection,
} from './settings/WfNewLanguagePicker';

const CARD_CLASS = 'relative w-full max-w-md max-h-[85vh] overflow-y-auto space-y-5 rounded-3xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl';

/**
 * WfNewLanguagePanel — the SHARED floating language picker, usable anywhere.
 *
 * One reusable popup (ModalShell) that lets the user choose their NATIVE/source
 * language (single) and MULTIPLE learning targets. Self-contained: it loads the
 * backend-aligned catalog on open (built-in list offline) and, on Save, syncs to
 * the backend AND calls onSave so the host updates its own local state. Drop it
 * in any page: render it controlled (open/onClose) behind a button.
 */
interface WfNewLanguagePanelProps {
  open: boolean;
  onClose: () => void;
  nativeLang: string;
  targetLangs: string[];
  /** Optional preloaded options; when omitted the panel fetches them itself. */
  options?: WfNewLanguage[];
  /** Called with the saved selection (host updates its local display). */
  onSave: (sel: WfNewLanguageSelection) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Optional toast for validation/feedback. */
  addToast?: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  /** Hide the native/source section (e.g. registration only needs targets). */
  hideNative?: boolean;
  /** Skip the backend sync on Save and just hand the selection to onSave — for
   *  PRE-AUTH use (registration) where there is no session to persist against. */
  localOnly?: boolean;
}

export const WfNewLanguagePanel: React.FC<WfNewLanguagePanelProps> = ({
  open, onClose, nativeLang, targetLangs, options, onSave, trans, addToast, hideNative, localOnly,
}) => {
  const catalog = useWfNewLanguageCatalog(options, open);
  const [native, setNative] = useState(nativeLang);
  const [targets, setTargets] = useState<string[]>(targetLangs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setNative(nativeLang); setTargets(targetLangs); }
  }, [open, nativeLang, targetLangs]);

  const toggleTarget = (code: string): void =>
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    if (targets.length === 0) { addToast?.(trans('lang.needTarget'), 'warning'); return; }
    const selection = { native_language: native, learning_languages: targets };
    if (localOnly) { onSave(selection); onClose(); return; }
    setSaving(true);
    const { saved, error } = await saveLearningLanguages(selection);
    onSave(saved);
    addToast?.(error === null ? trans('lang.saved') : (error || trans('lang.saveFailed')), error === null ? 'success' : 'warning');
    setSaving(false);
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} cardClassName={CARD_CLASS}>
      <ModalHeader icon={<Languages className="h-4 w-4 text-indigo-400" />} title={trans('lang.title')} onClose={onClose} />
      {!hideNative && (
        <WfNewLanguageChipSection kind="native" catalog={catalog} selected={[native]} onPick={setNative} trans={trans} />
      )}
      <WfNewLanguageChipSection kind="targets" catalog={catalog} selected={targets} onPick={toggleTarget} trans={trans} />
      <ModalFooter className="gap-3">
        <ActionButton variant="secondary" onClick={onClose} size="sm">{trans('common.cancel')}</ActionButton>
        <ActionButton onClick={() => void handleSave()} loading={saving} icon={<Save className="h-4 w-4" />}>
          {saving ? trans('common.loading') : trans('lang.saveBtn')}
        </ActionButton>
      </ModalFooter>
    </ModalShell>
  );
};
