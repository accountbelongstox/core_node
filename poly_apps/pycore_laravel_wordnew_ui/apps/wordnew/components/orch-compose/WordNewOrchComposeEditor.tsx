/**
 * The orchestration panel: creates a composition and edits it again. What to
 * orchestrate comes from the API side (books / prompts tabs); the panel sets
 * the reading pattern (contract default: words, Chinese, English x2), the word
 * group and virtual read batch that decide new words, segmentation (default:
 * one article = one segment), captions and look. Any plan edit re-resolves the
 * resources (the plan hash changes).
 */
import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewBookChapter } from '../../api';
import { AUDIO_ORCH_STEP_TYPES, audioOrchDefaultPattern } from '../../../../core/contracts/AudioOrchestrationContract';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchPresetStore, type OrchPresetDocument } from '../../services/orchestration/WordNewOrchPresetStore';
import { defaultOrchConfig, ORCH_DEFAULT_MINUTES, ORCH_MAX_STEP_TIMES } from '../../../../shared/orchestration/orchPlanner';
import type {
  OrchComposeConfig,
  OrchComposeLanguages,
  OrchComposeSource,
  OrchComposeStep,
  OrchComposeStepType,
  OrchComposeTask,
} from '../../../../shared/orchestration/orchTypes';
import { WordNewOrchSourcePicker, type OrchSourceChoice } from './WordNewOrchSourcePicker';
import { WordNewOrchWordGroupField } from './WordNewOrchWordGroupField';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** null creates a new composition. */
  task: OrchComposeTask | null;
  onClose: () => void;
  onSaved: (task: OrchComposeTask) => void;
}

const LANGUAGES: OrchComposeLanguages[] = ['both', 'en', 'zh'];
const MAX_SEGMENT_VALUE = 120;
const MAX_READ_COUNT = 100;
const FIELD = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-400/50';
const LABEL = 'block space-y-1 text-[11px] font-bold text-zinc-400';
const SECTION = 'space-y-2 rounded-xl border border-white/5 p-3';

function clampInt(value: string, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}

function sourceSelection(source: OrchComposeSource, config: OrchComposeConfig): { source: OrchComposeSource; id: string } | null {
  if (source === 'vocab_book' && config.book) return { source, id: config.book.sourceKey };
  if (source === 'prompt_rewrite' && config.prompt) return { source, id: config.prompt.taskKey };
  return null;
}

export const WordNewOrchComposeEditor: React.FC<Props> = ({ theme, trans, task, onClose, onSaved }) => {
  const [source, setSource] = useState<OrchComposeSource>(task?.source ?? 'vocab_book');
  const [name, setName] = useState(task?.name ?? '');
  const [language, setLanguage] = useState(task?.language ?? 'en');
  const [config, setConfig] = useState<OrchComposeConfig>(task?.config ?? defaultOrchConfig('vocab_book'));
  const [picking, setPicking] = useState(task === null);
  const [chapters, setChapters] = useState<WfNewBookChapter[]>([]);
  const [presets, setPresets] = useState<OrchPresetDocument | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void wordNewOrchPresetStore.load().then(setPresets); }, []);

  const bookKey = config.book?.sourceKey ?? '';
  useEffect(() => {
    setChapters([]);
    if (!bookKey) return;
    void wfNewApi.getBookChapters(bookKey).then((result) => setChapters(result.chapters)).catch(() => setChapters([]));
  }, [bookKey]);

  const patch = (next: Partial<OrchComposeConfig>): void => setConfig((current) => ({ ...current, ...next }));
  const setSteps = (steps: OrchComposeStep[]): void => patch({ pattern: steps });

  const pick = (choice: OrchSourceChoice): void => {
    setSource(choice.source);
    if (choice.source === 'vocab_book') {
      const { book } = choice;
      setLanguage(book.language || 'en');
      setName((current) => (current.trim() && task ? current : book.title));
      patch({
        book: { sourceKey: book.sourceKey ?? book.id, title: book.title, language: book.language || 'en', targetLanguage: 'zh', chapterIndex: null },
        prompt: null,
      });
    } else {
      const { prompt } = choice;
      setLanguage(prompt.language || 'en');
      setName((current) => (current.trim() && task ? current : prompt.title));
      patch({ prompt: { taskKey: prompt.id, title: prompt.title, language: prompt.language || 'en' }, book: null });
    }
    setPicking(false);
  };

  const valid = name.trim() !== '' && config.pattern.length > 0 && (source === 'vocab_book' ? !!config.book : !!config.prompt);

  const save = async (): Promise<void> => {
    if (!valid || saving) return;
    setSaving(true);
    const finalConfig: OrchComposeConfig = source === 'prompt_rewrite'
      ? { ...config, book: null, segmentMode: 'count', segmentValue: 1 }
      : { ...config, prompt: null };
    const saved = task
      ? await wordNewOrchTaskStore.update(task.id, { name: name.trim(), language, config: finalConfig, source })
      : await wordNewOrchTaskStore.create(source, name.trim(), language, finalConfig);
    setSaving(false);
    if (saved) onSaved(saved);
  };

  const sourceTitle = config.book?.title ?? config.prompt?.title ?? '';

  return (
    <section className={`space-y-3 rounded-2xl border border-indigo-500/20 p-4 ${theme.cardClass}`} aria-label={trans(task ? 'orchCompose.edit' : 'orchCompose.new')}>
      <header className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-bold text-zinc-100">{trans(task ? 'orchCompose.edit' : 'orchCompose.new')}</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10" aria-label={trans('orchCompose.cancel')}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className={SECTION}>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] font-bold text-zinc-400">{trans('orchCompose.field.source')}</span>
          {!picking && (
            <button type="button" onClick={() => setPicking(true)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:bg-white/10">
              {trans('orchCompose.source.change')}
            </button>
          )}
        </div>
        {sourceTitle && !picking && (
          <p className="text-xs text-zinc-200">
            {trans(source === 'vocab_book' ? 'orchCompose.source.books' : 'orchCompose.source.prompts')} · {sourceTitle}
          </p>
        )}
        {picking && (
          <WordNewOrchSourcePicker selected={sourceSelection(source, config)} onPick={pick} theme={theme} trans={trans} />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          <span>{trans('orchCompose.field.name')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </label>
        {source === 'vocab_book' && (
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
        )}
      </div>

      <fieldset className={SECTION}>
        <legend className="px-1 text-[11px] font-bold text-zinc-400">{trans('orchCompose.field.pattern')}</legend>
        {config.pattern.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 text-right font-mono text-[10px] text-zinc-500">{index + 1}</span>
            <select
              value={step.type}
              onChange={(event) => setSteps(config.pattern.map((entry, at) => (at === index ? { ...entry, type: event.target.value as OrchComposeStepType } : entry)))}
              className={`${FIELD} flex-1`}
              aria-label={trans('orchCompose.field.pattern')}
            >
              {AUDIO_ORCH_STEP_TYPES.map((type) => <option key={type} value={type}>{trans(`orchCompose.step.${type}`)}</option>)}
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSteps([...config.pattern, { type: 'sentence_en', times: 1 }])} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 hover:bg-white/10">
            <Plus className="h-3 w-3" />{trans('orchCompose.step.add')}
          </button>
          <button type="button" onClick={() => setSteps(audioOrchDefaultPattern())} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 hover:bg-white/10">
            <RotateCcw className="h-3 w-3" />{trans('orchCompose.step.default')}
          </button>
        </div>
      </fieldset>

      <div className={SECTION}>
        <p className="text-[11px] font-bold text-zinc-400">{trans('orchCompose.field.newWords')}</p>
        <WordNewOrchWordGroupField
          groupId={config.wordGroupId}
          virtualBatch={config.virtualBatch}
          onChange={({ groupId, virtualBatch }) => patch({ wordGroupId: groupId, virtualBatch })}
          trans={trans}
        />
        <label className={`${LABEL} max-w-[14rem]`}>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {source === 'vocab_book' && (
          <label className={LABEL}>
            <span>{trans('orchCompose.field.segmentMode')}</span>
            <select
              value={config.segmentMode === 'minutes' ? 'minutes' : config.segmentValue > 1 ? 'count' : 'single'}
              onChange={(event) => {
                const mode = event.target.value;
                if (mode === 'single') patch({ segmentMode: 'count', segmentValue: 1 });
                else if (mode === 'minutes') patch({ segmentMode: 'minutes', segmentValue: ORCH_DEFAULT_MINUTES });
                else patch({ segmentMode: 'count', segmentValue: Math.max(2, config.segmentValue) });
              }}
              className={FIELD}
            >
              <option value="single">{trans('orchCompose.segment.single')}</option>
              <option value="count">{trans('orchCompose.segment.count')}</option>
              <option value="minutes">{trans('orchCompose.segment.minutes')}</option>
            </select>
          </label>
        )}
        {source === 'vocab_book' && (config.segmentMode === 'minutes' || config.segmentValue > 1) && (
          <label className={LABEL}>
            <span>{trans(config.segmentMode === 'minutes' ? 'orchCompose.field.minutes' : 'orchCompose.field.count')}</span>
            <input
              type="number"
              min={config.segmentMode === 'minutes' ? 1 : 2}
              max={MAX_SEGMENT_VALUE}
              value={config.segmentValue}
              onChange={(event) => patch({ segmentValue: clampInt(event.target.value, config.segmentMode === 'minutes' ? 1 : 2, MAX_SEGMENT_VALUE) })}
              className={FIELD}
            />
          </label>
        )}
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

      {task && <p className="text-[11px] text-zinc-500">{trans('orchCompose.editReloads')}</p>}
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
