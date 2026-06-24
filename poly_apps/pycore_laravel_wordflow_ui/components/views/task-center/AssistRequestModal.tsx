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
import { Language } from '../../../types';
import { api } from '../../../core/api';
import type { AssistRequestCreateItem } from '../../../core/api/modules/ServerManagerAPI';
import { XCircle, HandHelping, Zap } from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { AlertBox, InlineSpinner } from '../../common';
import Portal from '../../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';

interface AssistRequestModalProps {
  lang: Language;
  /** Prefilled record when opened from a row; null = pick a record by hand. */
  record: { record_type: string; source_key: string } | null;
  onClose: () => void;
  onSubmitted: (created: number, existing: number) => void;
}

/** Common target-language codes offered for add-language / fill-audio. */
const LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'ar', label: 'Arabic' },
  { code: 'he', label: 'Hebrew' },
  { code: 'el', label: 'Greek' },
];

const RECORD_TYPES = ['book', 'subtitle'] as const;

/** Priority presets. 100 = the shared interactive fast lane (remote_fast). */
const PRIORITY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Normal (0)' },
  { value: 10, label: 'High (10)' },
  { value: 50, label: 'Urgent (50)' },
  { value: 100, label: 'Fast lane (100)' },
];

/** Priority that lands a request on the interactive fast lane. */
const FAST_PRIORITY = 100;

const AssistRequestModal: React.FC<AssistRequestModalProps> = ({ record, onClose, onSubmitted }) => {
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
        setError(res.error || 'Failed to file assist requests');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to file assist requests');
    } finally {
      setSubmitting(false);
    }
  };

  const LangPicker: React.FC<{ selected: string[]; onToggle: (code: string) => void }> = ({ selected, onToggle }) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {LANGUAGE_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => onToggle(opt.code)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            selected.includes(opt.code)
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
          title={opt.label}
        >
          {opt.code}
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
                  Request assist
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  File the missing pieces for one record; the task queue completes them one by one.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Record selection */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    Record type
                  </label>
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
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    Source key
                  </label>
                  <input
                    type="text"
                    value={sourceKey}
                    onChange={(e) => setSourceKey(e.target.value)}
                    disabled={prefilled}
                    placeholder="sha1 source key"
                    className={`${commonClasses.input} text-sm w-full font-mono disabled:opacity-60`}
                  />
                </div>
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
                    Add language
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
                    Fill audio
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
                    Generate cover
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
                    Fetch poster
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
                  Interactive / fast-track
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    (priority {FAST_PRIORITY} — workers pick it up immediately)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Priority</label>
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
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <AlertBox variant="error">{error}</AlertBox>}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {items.length} item(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className={`${commonClasses.button} text-sm px-4 py-1.5`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`${commonClasses.buttonPrimary} text-sm px-4 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50`}
                  >
                    {submitting ? <InlineSpinner /> : <HandHelping className="w-4 h-4" />}
                    Submit
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
