/**
 * WfNewAdminWordEditor - the create/edit modal for a dictionary word, extracted
 * from WfNewAdminWords so the words panel stays under the 800-line modular limit.
 * Rendered through the shared overlay framework (Portal + OVERLAY_Z scale, same
 * pattern as WfNewApiServerDialog). Mounted fresh per open, so field state
 * initializes straight from the row being edited.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, X, Loader2 } from 'lucide-react';
import Portal from '../../../../components/shared/Portal';
import { OVERLAY_Z, OVERLAY_CONTAINER, OVERLAY_BACKDROP } from '../../../../styles/overlay';
import { ElementTheme } from '../../WfNewTypes';
import type { WfNewAdminWordRow, WfNewAdminWordEditable } from '../../api';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

// Shared control styling (mirrors the words panel's chips - Tailwind needs the
// full literal class strings, so they are duplicated rather than shared).
const CHIP_CLS = 'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40';
const INPUT_BASE_CLS = 'py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none';

export interface WfNewAdminWordEditorProps {
  mode: 'create' | 'edit';
  /** Row being edited (null in create mode). */
  row: WfNewAdminWordRow | null;
  saving: boolean;
  activeTheme: ElementTheme;
  trans: Trans;
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

  // Close on Escape (unless a save is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  const canSave = !saving && (mode === 'edit' || content.trim().length > 0);
  const labelCls = 'text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block';
  const inputCls = `w-full ${INPUT_BASE_CLS} ${activeTheme.inputClass}`;

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

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
        <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={() => { if (!saving) onCancel(); }} />
        <div className={`relative w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl ${
          activeTheme.id === 'nordic' ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-100'
        }`}>
          {/* Header */}
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
            {/* word content - the identity of the row, immutable once created */}
            <div className="space-y-1.5">
              <label className={labelCls}>{trans('admin.w.field.word')}</label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={mode === 'edit'}
                className={`${inputCls} disabled:opacity-50`}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>{trans('admin.w.field.translations')}</label>
              <textarea
                value={translationsText}
                onChange={(e) => setTranslationsText(e.target.value)}
                rows={4}
                className={`${inputCls} resize-y leading-relaxed`}
              />
              <p className="text-[10px] font-mono text-zinc-500">{trans('admin.w.field.translationsHint')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <label className={labelCls}>{trans('admin.w.field.us')}</label>
                <input type="text" value={usPhonetic} onChange={(e) => setUsPhonetic(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{trans('admin.w.field.uk')}</label>
                <input type="text" value={ukPhonetic} onChange={(e) => setUkPhonetic(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{trans('admin.w.field.phonetic')}</label>
                <input type="text" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* validity toggle */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsValid(true)}
                className={isValid
                  ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 transition'
                  : CHIP_CLS}
              >
                {trans('admin.w.valid')}
              </button>
              <button
                type="button"
                onClick={() => setIsValid(false)}
                className={!isValid
                  ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-amber-500/40 bg-amber-500/15 text-amber-300 transition'
                  : CHIP_CLS}
              >
                {trans('admin.w.invalid')}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>{trans('admin.w.field.note')}</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </div>

            {/* actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onCancel} disabled={saving} className={CHIP_CLS}>
                {trans('admin.cancel')}
              </button>
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
        </div>
      </div>
    </Portal>
  );
};
