/**
 * Task Center — per-record "Request assist" modal (CoreBook §6).
 *
 * Pick / confirm a record (record_type + source_key, prefilled when opened from
 * a row), tick the assist items, and file them as assist_requests:
 *   - Add language   (multi-select language codes -> one add_language row each)
 *   - Fill audio     (multi-select language codes -> one fill_audio row each)
 *   - Generate cover (one cover row)
 *   - Fetch poster   (one poster row)
 * Submit -> POST /api/app_qy_v1/assist/requests with the items[] array.
 *
 * Renders through the shared Portal + OVERLAY_Z scale, matching the other
 * Task Center modals (QueuePanel detail modal). All labels English.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import type { AssistRequestCreateItem } from '@/apps/laravel-manager/api';
import { XCircle, HandHelping, Zap } from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox, Field, InlineSpinner } from '../../common';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '@/shared/styles/overlay';
import { GLOBAL_TASK_PRIORITIES } from '@/apps/laravel-manager/integrations/pycore';

interface AssistRequestModalProps {
  lang: Language;
  /** Prefilled record when opened from a row; null = pick a record by hand. */
  record: { record_type: string; source_key: string } | null;
  onClose: () => void;
  onSubmitted: (created: number, existing: number) => void;
}

/** Common target-language codes offered for add-language / fill-audio. */
const LANGUAGE_CODES = ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'vi', 'th', 'ar', 'he', 'el'];

const RECORD_TYPES = ['book', 'subtitle'] as const;

/** Priority presets; shared tiers come from config/queue_center_contract.json. */
const PRIORITY_OPTIONS: Array<{ value: number; labelKey: string }> = [
  { value: GLOBAL_TASK_PRIORITIES.default, labelKey: 'uiTask.assist_modal.priority_normal' },
  { value: 10, labelKey: 'uiTask.assist_modal.priority_high' },
  { value: GLOBAL_TASK_PRIORITIES.manual, labelKey: 'uiTask.assist_modal.priority_urgent' },
  { value: GLOBAL_TASK_PRIORITIES.fast, labelKey: 'uiTask.assist_modal.priority_fast' },
];

/** Priority that lands a request on the interactive fast lane. */
const FAST_PRIORITY = GLOBAL_TASK_PRIORITIES.fast;

const AssistRequestModal: React.FC<AssistRequestModalProps> = ({ record, onClose, onSubmitted }) => {
  const { t } = useTranslation();
  const [recordType, setRecordType] = useState<string>(record?.record_type || 'book');
  const [sourceKey, setSourceKey] = useState<string>(record?.source_key || '');

  const [addLanguageOn, setAddLanguageOn] = useState(false);
  const [addLanguages, setAddLanguages] = useState<string[]>([]);
  const [fillAudioOn, setFillAudioOn] = useState(false);
  const [fillAudioLanguages, setFillAudioLanguages] = useState<string[]>([]);
  const [coverOn, setCoverOn] = useState(false);
  const [posterOn, setPosterOn] = useState(false);

  // Interactive / fast-track: when on, the request is filed at the fast-lane
  // priority (100) so workers pick it up immediately. The explicit priority
  // selector lets the operator override; ticking the checkbox snaps it to 100.
  const [interactive, setInteractive] = useState(false);
  const [priority, setPriority] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefilled = record !== null;

  const toggle = (list: string[], code: string): string[] =>
    list.includes(code) ? list.filter((c) => c !== code) : [...list, code];

  const buildItems = (): AssistRequestCreateItem[] => {
    const items: AssistRequestCreateItem[] = [];
    if (addLanguageOn) {
      for (const code of addLanguages) items.push({ request_type: 'add_language', language: code });
    }
    if (fillAudioOn) {
      for (const code of fillAudioLanguages) items.push({ request_type: 'fill_audio', language: code });
    }
    if (coverOn) items.push({ request_type: 'cover' });
    if (posterOn) items.push({ request_type: 'poster' });
    return items;
  };

  const items = buildItems();
  const canSubmit = sourceKey.trim() !== '' && items.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.serverManager.createAssistRequests({
        record_type: recordType,
        source_key: sourceKey.trim(),
        priority: interactive ? FAST_PRIORITY : priority,
        items,
      });
      if (res.success && res.data) {
        onSubmitted(res.data.created ?? 0, res.data.existing ?? 0);
      } else {
        setError(res.error || t('uiTask.assist_modal.submit_failed'));
      }
    } catch (err: any) {
      setError(err?.message || t('uiTask.assist_modal.submit_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const LangPicker: React.FC<{ selected: string[]; onToggle: (code: string) => void }> = ({ selected, onToggle }) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {LANGUAGE_CODES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onToggle(code)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            selected.includes(code)
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
          title={t(`uiTask.languages.${code}`)}
        >
          {code}
        </button>
      ))}
    </div>
  );

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`} onClick={onClose}>
        <div
          className={`${commonClasses.card} max-w-lg w-full max-h-[85vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                  <HandHelping className="w-5 h-5 text-indigo-500" />
                  {t('uiTask.assist_modal.title')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('uiTask.assist_modal.subtitle')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label={t('uiTask.assist_modal.close')}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Record selection */}
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('uiTask.assist_modal.record_type')}>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                    disabled={prefilled}
                    className={`${commonClasses.input} text-sm w-full disabled:opacity-60`}
                  >
                    {RECORD_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('uiTask.assist_modal.source_key')} className="col-span-2">
                  <input
                    type="text"
                    value={sourceKey}
                    onChange={(e) => setSourceKey(e.target.value)}
                    disabled={prefilled}
                    placeholder={t('uiTask.assist_modal.source_key_placeholder')}
                    className={`${commonClasses.input} text-sm w-full font-mono disabled:opacity-60`}
                  />
                </Field>
              </div>

              {/* Assist items */}
              <div className="space-y-3">
                {/* Add language */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={addLanguageOn}
                      onChange={(e) => setAddLanguageOn(e.target.checked)}
                      className="rounded"
                    />
                    {t('uiTask.assist_modal.add_language')}
                  </label>
                  {addLanguageOn && <LangPicker selected={addLanguages} onToggle={(c) => setAddLanguages((l) => toggle(l, c))} />}
                </div>

                {/* Fill audio */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fillAudioOn}
                      onChange={(e) => setFillAudioOn(e.target.checked)}
                      className="rounded"
                    />
                    {t('uiTask.assist_modal.fill_audio')}
                  </label>
                  {fillAudioOn && (
                    <LangPicker selected={fillAudioLanguages} onToggle={(c) => setFillAudioLanguages((l) => toggle(l, c))} />
                  )}
                </div>

                {/* Generate cover */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={coverOn}
                      onChange={(e) => setCoverOn(e.target.checked)}
                      className="rounded"
                    />
                    {t('uiTask.assist_modal.generate_cover')}
                  </label>
                </div>

                {/* Fetch poster */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={posterOn}
                      onChange={(e) => setPosterOn(e.target.checked)}
                      className="rounded"
                    />
                    {t('uiTask.assist_modal.fetch_poster')}
                  </label>
                </div>
              </div>

              {/* Interactive / fast-track + priority */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={interactive}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setInteractive(on);
                      if (on) setPriority(FAST_PRIORITY);
                    }}
                    className="rounded"
                  />
                  <Zap className="w-4 h-4 text-amber-500" />
                  {t('uiTask.assist_modal.interactive')}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    {t('uiTask.assist_modal.interactive_hint', { priority: FAST_PRIORITY })}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('uiTask.assist_modal.priority')}</label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setPriority(value);
                      // Keep the checkbox truthful: it reflects "is fast lane".
                      setInteractive(value >= FAST_PRIORITY);
                    }}
                    className={`${commonClasses.input} text-sm`}
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey, { value: opt.value })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <AlertBox variant="error">{error}</AlertBox>}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t('uiTask.assist_modal.items_selected', { count: items.length })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className={`${commonClasses.button} text-sm px-4 py-1.5`}
                  >
                    {t('mcp.common.cancel')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`${commonClasses.buttonPrimary} text-sm px-4 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50`}
                  >
                    {submitting ? <InlineSpinner /> : <HandHelping className="w-4 h-4" />}
                    {t('uiTask.assist_modal.submit')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default AssistRequestModal;
