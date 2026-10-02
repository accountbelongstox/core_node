import React, { useState } from 'react';
import { Plus, Pencil, X, Loader2 } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { ElementTheme } from '../../WfNewThemes';
import type { WfNewAdminWordRow, WfNewAdminWordEditable } from '../../api';
import { AdminField, adminInputClass, type AdminTrans } from './adminKit';

export interface WfNewAdminWordEditorProps {
  mode: 'create' | 'edit';
  /** Row being edited (null in create mode). */
  row: WfNewAdminWordRow | null;
  saving: boolean;
  activeTheme: ElementTheme;
  trans: AdminTrans;
  onCancel: () => void;
  onSave: (payload: { content: string } & WfNewAdminWordEditable) => void;
}

export const WfNewAdminWordEditor: React.FC<WfNewAdminWordEditorProps> = ({
  mode, row, saving, activeTheme, trans, onCancel, onSave,
}) => {
  const [content, setContent] = useState(row?.content ?? '');
  const [translationsText, setTranslationsText] = useState((row?.translations ?? []).join('\n'));
  const [usPhonetic, setUsPhonetic] = useState(row?.us_phonetic ?? '');
  const [ukPhonetic, setUkPhonetic] = useState(row?.uk_phonetic ?? '');
  const [phonetic, setPhonetic] = useState(row?.phonetic ?? '');
  const [isValid, setIsValid] = useState(row?.is_valid ?? true);
  const [note, setNote] = useState(row?.validity_note ?? '');

  const canSave = !saving && (mode === 'edit' || content.trim().length > 0);
  const inputCls = adminInputClass(activeTheme, 'w-full');

  const handleSave = (): void => {
    if (!canSave) return;
    onSave({
      content: content.trim(),
      translations: translationsText.split('\n').map((s) => s.trim()).filter(Boolean),
      us_phonetic: usPhonetic.trim() || null,
      uk_phonetic: ukPhonetic.trim() || null,
      phonetic: phonetic.trim() || null,
      is_valid: isValid,
      validity_note: note.trim() || null,
    });
  };

  const cardClass = `relative w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl ${
    activeTheme.id === 'nordic' ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-100'
  }`;

  return (
    <ModalShell onClose={onCancel} locked={saving} cardClassName={cardClass}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-white/10 backdrop-blur bg-inherit rounded-t-3xl">
        <div className="flex items-center gap-2">
          {mode === 'create' ? <Plus className="w-5 h-5 text-indigo-500" /> : <Pencil className="w-5 h-5 text-indigo-500" />}
          <h3 className="text-base font-extrabold tracking-tight">
            {mode === 'create' ? trans('admin.w.add') : trans('admin.w.edit')}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 disabled:opacity-40"
          title={trans('admin.cancel')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        <AdminField label={trans('admin.w.field.word')}>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={mode === 'edit'}
            className={`${inputCls} disabled:opacity-50`}
          />
        </AdminField>

        <AdminField label={trans('admin.w.field.translations')} hint={trans('admin.w.field.translationsHint')}>
          <textarea
            value={translationsText}
            onChange={(e) => setTranslationsText(e.target.value)}
            rows={4}
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </AdminField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <AdminField label={trans('admin.w.field.us')}>
            <input type="text" value={usPhonetic} onChange={(e) => setUsPhonetic(e.target.value)} className={inputCls} />
          </AdminField>
          <AdminField label={trans('admin.w.field.uk')}>
            <input type="text" value={ukPhonetic} onChange={(e) => setUkPhonetic(e.target.value)} className={inputCls} />
          </AdminField>
          <AdminField label={trans('admin.w.field.phonetic')}>
            <input type="text" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} className={inputCls} />
          </AdminField>
        </div>

        <div className="flex items-center gap-1.5">
          <ChipButton variant={isValid ? 'success' : 'default'} onClick={() => setIsValid(true)}>{trans('admin.w.valid')}</ChipButton>
          <ChipButton variant={!isValid ? 'warning' : 'default'} onClick={() => setIsValid(false)}>{trans('admin.w.invalid')}</ChipButton>
        </div>

        <AdminField label={trans('admin.w.field.note')}>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </AdminField>

        <div className="flex items-center justify-end gap-2 pt-1">
          <ChipButton onClick={onCancel} disabled={saving}>{trans('admin.cancel')}</ChipButton>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {trans('admin.w.save')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
