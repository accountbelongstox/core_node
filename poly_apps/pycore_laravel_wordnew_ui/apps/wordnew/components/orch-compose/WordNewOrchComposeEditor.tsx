import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewBookChapter, type WfNewContentGroup } from '../../api';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchPresetStore, type OrchPresetDocument } from '../../services/orchestration/WordNewOrchPresetStore';
import { defaultOrchConfig, ORCH_MAX_STEP_TIMES } from '../../../../shared/orchestration/orchPlanner';
import type {
  OrchComposeConfig,
  OrchComposeLanguages,
  OrchComposeSource,
  OrchComposeStep,
  OrchComposeStepType,
  OrchComposeTask,
} from '../../../../shared/orchestration/orchTypes';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** null creates a new composition. */
  task: OrchComposeTask | null;
  onClose: () => void;
  onSaved: (task: OrchComposeTask) => void;
}

const BOOK_PAGE_SIZE = 60;
const STEP_TYPES: OrchComposeStepType[] = ['sentence_en', 'sentence_zh', 'words_new', 'words_all'];
const LANGUAGES: OrchComposeLanguages[] = ['both', 'en', 'zh'];
const TEXT_LANGUAGES = ['en', 'zh'];
const MAX_SEGMENT_VALUE = 120;
const MAX_READ_COUNT = 100;
const FIELD = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-400/50';
const LABEL = 'block space-y-1 text-[11px] font-bold text-zinc-400';

function clampInt(value: string, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}

/** Create / edit one composition: source, pattern, word policy, segmentation, look. */
export const WordNewOrchComposeEditor: React.FC<Props> = ({ theme, trans, task, onClose, onSaved }) => {
  const [source, setSource] = useState<OrchComposeSource>(task?.source ?? 'vocab_book');
  const [name, setName] = useState(task?.name ?? '');
  const [language, setLanguage] = useState(task?.language ?? 'en');
  const [config, setConfig] = useState<OrchComposeConfig>(task?.config ?? defaultOrchConfig('vocab_book'));
  const [books, setBooks] = useState<WfNewContentGroup[]>([]);
  const [chapters, setChapters] = useState<WfNewBookChapter[]>([]);
  const [presets, setPresets] = useState<OrchPresetDocument | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void wfNewApi.getBookGroups(1, BOOK_PAGE_SIZE).then(setBooks).catch(() => setBooks([]));
    void wordNewOrchPresetStore.load().then(setPresets);
  }, []);

  const bookKey = config.book?.sourceKey ?? '';
  useEffect(() => {
    setChapters([]);
    if (!bookKey) return;
    void wfNewApi.getBookChapters(bookKey).then((result) => setChapters(result.chapters)).catch(() => setChapters([]));
  }, [bookKey]);

  const patch = (next: Partial<OrchComposeConfig>): void => setConfig((current) => ({ ...current, ...next }));
  const setSteps = (steps: OrchComposeStep[]): void => patch({ pattern: steps });
  const changeSource = (next: OrchComposeSource): void => {
    setSource(next);
    const defaults = defaultOrchConfig(next);
    patch({ segmentMode: defaults.segmentMode, segmentValue: defaults.segmentValue });
  };
  const chooseBook = (sourceKey: string): void => {
    const book = books.find((entry) => entry.sourceKey === sourceKey);
    if (!book?.sourceKey) {
      patch({ book: null });
      return;
    }
    setLanguage(book.language || 'en');
    if (!name.trim()) setName(book.title);
    patch({ book: { sourceKey: book.sourceKey, title: book.title, language: book.language || 'en', targetLanguage: 'zh', chapterIndex: null } });
  };

  const valid = name.trim() !== '' && config.pattern.length > 0
    && (source === 'vocab_book' ? !!config.book : config.sourceText.trim() !== '');

  const save = async (): Promise<void> => {
    if (!valid || saving) return;
    setSaving(true);
    const finalConfig: OrchComposeConfig = source === 'vocab_book'
      ? { ...config, sourceText: '' }
      : { ...config, book: null, segmentMode: 'count', segmentValue: 1 };
    const saved = task
      ? await wordNewOrchTaskStore.update(task.id, { name: name.trim(), language, config: finalConfig })
      : await wordNewOrchTaskStore.create(source, name.trim(), language, finalConfig);
    setSaving(false);
    if (saved) onSaved(saved);
  };

  return (
    <section className={`space-y-4 rounded-2xl border border-indigo-500/20 p-4 ${theme.cardClass}`}>
      <header className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-bold text-zinc-100">{trans(task ? 'orchCompose.edit' : 'orchCompose.new')}</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10" aria-label={trans('orchCompose.cancel')}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          <span>{trans('orchCompose.field.name')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </label>
        <label className={LABEL}>
          <span>{trans('orchCompose.field.source')}</span>
          <select value={source} disabled={!!task} onChange={(event) => changeSource(event.target.value as OrchComposeSource)} className={FIELD}>
            <option value="vocab_book">{trans('orchAudio.source.vocab_book')}</option>
            <option value="prompt_rewrite">{trans('orchCompose.source.text')}</option>
          </select>
        </label>
      </div>

      {source === 'vocab_book' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            <span>{trans('orchCompose.field.book')}</span>
            <select value={bookKey} onChange={(event) => chooseBook(event.target.value)} className={FIELD}>
              <option value="">{trans('orchCompose.field.bookPick')}</option>
              {config.book && !books.some((book) => book.sourceKey === config.book?.sourceKey) && (
                <option value={config.book.sourceKey}>{config.book.title}</option>
              )}
              {books.map((book) => (
                <option key={book.id} value={book.sourceKey ?? ''}>{book.title}</option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            <span>{trans('orchCompose.field.chapter')}</span>
            <select
              value={config.book?.chapterIndex ?? ''}
              disabled={!config.book}
              onChange={(event) => config.book && patch({
                book: { ...config.book, chapterIndex: event.target.value === '' ? null : Number(event.target.value) },
              })}
              className={FIELD}
            >
              <option value="">{trans('orchCompose.field.chapterAll')}</option>
              {chapters.map((chapter) => (
                <option key={chapter.chapterIndex} value={chapter.chapterIndex}>
                  {Object.values(chapter.titles ?? {}).find(Boolean) ?? trans('orchCompose.field.chapterN', { n: chapter.chapterIndex + 1 })}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            <span>{trans('orchCompose.field.segmentMode')}</span>
            <select value={config.segmentMode} onChange={(event) => patch({ segmentMode: event.target.value as OrchComposeConfig['segmentMode'] })} className={FIELD}>
              <option value="minutes">{trans('orchCompose.segment.minutes')}</option>
              <option value="count">{trans('orchCompose.segment.count')}</option>
            </select>
          </label>
          <label className={LABEL}>
            <span>{trans(config.segmentMode === 'minutes' ? 'orchCompose.field.minutes' : 'orchCompose.field.count')}</span>
            <input
              type="number"
              min={1}
              max={MAX_SEGMENT_VALUE}
              value={config.segmentValue}
              onChange={(event) => patch({ segmentValue: clampInt(event.target.value, 1, MAX_SEGMENT_VALUE) })}
              className={FIELD}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <label className={LABEL}>
            <span>{trans('orchCompose.field.text')}</span>
            <textarea
              value={config.sourceText}
              onChange={(event) => patch({ sourceText: event.target.value })}
              rows={6}
              className={FIELD}
              placeholder={trans('orchCompose.field.textPlaceholder')}
            />
          </label>
          <label className={`${LABEL} max-w-[12rem]`}>
            <span>{trans('orchCompose.field.language')}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className={FIELD}>
              {TEXT_LANGUAGES.map((code) => <option key={code} value={code}>{trans(`orchCompose.lang.${code}`)}</option>)}
            </select>
          </label>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-[11px] font-bold text-zinc-400">{trans('orchCompose.field.pattern')}</legend>
        {config.pattern.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={step.type}
              onChange={(event) => setSteps(config.pattern.map((entry, at) => (at === index ? { ...entry, type: event.target.value as OrchComposeStepType } : entry)))}
              className={`${FIELD} flex-1`}
            >
              {STEP_TYPES.map((type) => <option key={type} value={type}>{trans(`orchCompose.step.${type}`)}</option>)}
            </select>
            <input
              type="number"
              min={1}
              max={ORCH_MAX_STEP_TIMES}
              value={step.times}
              aria-label={trans('orchCompose.field.times')}
              onChange={(event) => setSteps(config.pattern.map((entry, at) => (at === index ? { ...entry, times: clampInt(event.target.value, 1, ORCH_MAX_STEP_TIMES) } : entry)))}
              className={`${FIELD} w-16`}
            />
            <button type="button" disabled={index === 0} onClick={() => {
              const steps = [...config.pattern];
              [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
              setSteps(steps);
            }} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 disabled:opacity-30" aria-label={trans('orchCompose.step.up')}>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={index === config.pattern.length - 1} onClick={() => {
              const steps = [...config.pattern];
              [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]];
              setSteps(steps);
            }} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 disabled:opacity-30" aria-label={trans('orchCompose.step.down')}>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setSteps(config.pattern.filter((_, at) => at !== index))} className="rounded-lg p-1.5 text-rose-300 hover:bg-white/10" aria-label={trans('orchCompose.step.remove')}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setSteps([...config.pattern, { type: 'sentence_en', times: 1 }])} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 hover:bg-white/10">
          <Plus className="h-3 w-3" />{trans('orchCompose.step.add')}
        </button>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={LABEL}>
          <span>{trans('orchCompose.field.maxRead')}</span>
          <input
            type="number"
            min={0}
            max={MAX_READ_COUNT}
            value={config.newOnlyMaxReadCount}
            onChange={(event) => patch({ newOnlyMaxReadCount: clampInt(event.target.value, 0, MAX_READ_COUNT) })}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          <span>{trans('orchCompose.field.languages')}</span>
          <select value={config.languages} onChange={(event) => patch({ languages: event.target.value as OrchComposeLanguages })} className={FIELD}>
            {LANGUAGES.map((value) => <option key={value} value={value}>{trans(`orchCompose.languages.${value}`)}</option>)}
          </select>
        </label>
        <label className={LABEL}>
          <span>{trans('orchCompose.field.preset')}</span>
          <select value={config.presetId} onChange={(event) => patch({ presetId: event.target.value })} className={FIELD}>
            <option value="">{trans('orchCompose.field.presetActive')}</option>
            {(presets?.presets ?? []).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3.5 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10">
          {trans('orchCompose.cancel')}
        </button>
        <button type="button" disabled={!valid || saving} onClick={() => { void save(); }} className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${theme.accentBg}`}>
          <Save className="h-3.5 w-3.5" />{trans('orchCompose.save')}
        </button>
      </div>
    </section>
  );
};
