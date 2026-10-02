import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { wfNewApi, type WfNewLanguage } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { ActionButton } from '@/shared/ui/ActionButton';
import {
  WfNewLanguageChipSection, saveLearningLanguages, useWfNewLanguageCatalog, type WfNewLanguageSelection,
} from '../components/settings/WfNewLanguagePicker';

/**
 * WfNewLanguages — the learning-language settings page.
 *
 * Source (native) language is a single choice; learning targets are MULTI-select.
 * The selection starts from the local settings store (works offline), is refined
 * by /learning/languages when reachable, and Save persists locally and syncs via
 * setLearningLanguages. Reachable from Settings (see WfNewApp 'languages' tab).
 */
interface WfNewLanguagesProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  /** Mirror the saved selection back into the app (e.g. update the active target). */
  onSaved?: (selection: WfNewLanguageSelection) => void;
}

export const WfNewLanguages: React.FC<WfNewLanguagesProps> = ({ activeTheme, trans, addToast, onSaved }) => {
  const catalog: WfNewLanguage[] = useWfNewLanguageCatalog();
  const [nativeLang, setNativeLang] = useState<string>(() => wfNewSettings.get('settingNativeLang'));
  const [targets, setTargets] = useState<string[]>(() => wfNewSettings.getLearningTargets());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    wfNewApi.getLearningLanguages()
      .then((sel) => {
        if (cancelled) return;
        setNativeLang(sel.native_language || wfNewSettings.get('settingNativeLang'));
        setTargets(sel.learning_languages.length ? sel.learning_languages : wfNewSettings.getLearningTargets());
      })
      .catch(() => { /* unauthenticated / offline — keep the local selection */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleTarget = (code: string): void => {
    setTargets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    if (targets.length === 0) {
      addToast(trans('lang.needTarget'), 'warning');
      return;
    }
    setSaving(true);
    const { saved, error } = await saveLearningLanguages({ native_language: nativeLang, learning_languages: targets });
    setNativeLang(saved.native_language);
    setTargets(saved.learning_languages);
    wfNewSettings.setLearningLanguages(saved);
    onSaved?.(saved);
    addToast(error === null ? trans('lang.saved') : (error || trans('lang.saveFailed')), error === null ? 'success' : 'warning');
    setSaving(false);
  };

  const cardClass = `p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={cardClass}>
        <WfNewLanguageChipSection kind="native" catalog={catalog} selected={[nativeLang]} onPick={setNativeLang} trans={trans} showHint disabled={loading} />
      </div>
      <div className={cardClass}>
        <WfNewLanguageChipSection kind="targets" catalog={catalog} selected={targets} onPick={toggleTarget} trans={trans} showHint disabled={loading} />
      </div>
      <div className="flex justify-end">
        <ActionButton onClick={() => void handleSave()} disabled={loading} loading={saving} icon={<Save className="h-4 w-4" />}>
          {saving ? trans('common.loading') : trans('lang.saveBtn')}
        </ActionButton>
      </div>
    </div>
  );
};
