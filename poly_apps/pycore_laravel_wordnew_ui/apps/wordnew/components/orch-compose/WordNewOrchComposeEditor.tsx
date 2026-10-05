/**
 * The orchestration panel: creates a composition and edits it again. What to
 * orchestrate comes from the API side (books / prompts tabs); the panel sets
 * the reading pattern (contract default: words with their Chinese meaning, the
 * Chinese sentence, the English sentence twice), what decides new words (word
 * group + virtual / history / real read counts), segmentation (default: one
 * article = one segment), captions and look. Sections collapse to icons. Any
 * plan edit re-resolves the resources (the plan hash changes).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Languages,
  ListOrdered,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { wfNewApi, type WfNewBookChapter } from '../../api';
import { AUDIO_ORCH_MEANING_STEP_TYPES, AUDIO_ORCH_STEP_TYPES, audioOrchDefaultPattern } from '../../../../core/contracts/AudioOrchestrationContract';
import { wordNewOrchTaskStore } from '../../services/orchestration/WordNewOrchTaskStore';
import { wordNewOrchPresetStore, type OrchPresetDocument } from '../../services/orchestration/WordNewOrchPresetStore';
import {
  defaultOrchConfig,
  ORCH_DEFAULT_MINUTES,
  ORCH_MAX_STEP_TIMES,
  orchSkippedLanguages,
  orchTaskVirtualBatch,
} from '../../../../shared/orchestration/orchPlanner';
import type {
  OrchComposeConfig,
  OrchComposeLanguages,
  OrchComposeSentence,
  OrchComposeSource,
  OrchComposeStep,
  OrchComposeStepType,
  OrchComposeTask,
} from '../../../../shared/orchestration/orchTypes';
import { WordNewOrchSourcePicker, type OrchSourceChoice } from './WordNewOrchSourcePicker';
import { WordNewOrchReadStateField } from './WordNewOrchReadStateField';
import { WfNewOrchSection } from './WfNewOrchSection';
import { WordNewOrchMissingLanguageNotice } from './WordNewOrchMissingLanguageNotice';
import { orchFormStyles } from './orchFormStyles';
import { orchSourceTitle } from './orchTaskView';

interface Props {
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** null creates a new composition. */
  task: OrchComposeTask | null;
  onClose: () => void;
  onSaved: (task: OrchComposeTask) => void;
  /** The loaded sentences of the edited task (last resolution): the pattern is checked against their languages. */
  sentences?: OrchComposeSentence[];
}

type SectionId = 'source' | 'pattern' | 'words' | 'output';

const LANGUAGES: OrchComposeLanguages[] = ['both', 'en', 'zh'];
const MAX_SEGMENT_VALUE = 120;
const MAX_READ_COUNT = 100;
const MEANING_STEPS: ReadonlySet<OrchComposeStepType> = new Set(AUDIO_ORCH_MEANING_STEP_TYPES);

function clampInt(value: string, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}

function sourceSelection(source: OrchComposeSource, config: OrchComposeConfig): { source: OrchComposeSource; id: string } | null {
  if (source === 'vocab_book' && config.book) return { source, id: config.book.sourceKey };
  if (source === 'prompt_rewrite' && config.prompt) return { source, id: config.prompt.taskKey };
  return null;
}

export const WordNewOrchComposeEditor: React.FC<Props> = ({ theme, trans, task, onClose, onSaved, sentences }) => {
  const styles = orchFormStyles(theme);
  const [source, setSource] = useState<OrchComposeSource>(task?.source ?? 'vocab_book');
  const [name, setName] = useState(task?.name ?? '');
  const [language, setLanguage] = useState(task?.language ?? 'en');
  const [config, setConfig] = useState<OrchComposeConfig>(task?.config ?? defaultOrchConfig('vocab_book'));
  const [open, setOpen] = useState<Record<SectionId, boolean>>({ source: task === null, pattern: task === null, words: false, output: false });
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

  const toggle = (id: SectionId): void => setOpen((current) => ({ ...current, [id]: !current[id] }));
  const patch = (next: Partial<OrchComposeConfig>): void => setConfig((current) => ({ ...current, ...next }));
  const setSteps = (steps: OrchComposeStep[]): void => patch({ pattern: steps });
  const setStep = (index: number, next: Partial<OrchComposeStep>): void => setSteps(config.pattern.map((entry, at) => (at === index ? { ...entry, ...next } : entry)));
  const move = (index: number, offset: -1 | 1): void => {
    const steps = [...config.pattern];
    [steps[index + offset], steps[index]] = [steps[index], steps[index + offset]];
    setSteps(steps);
  };

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
    setOpen((current) => ({ ...current, source: false, pattern: true }));
  };

  const missingLanguages = useMemo(() => (sentences ? orchSkippedLanguages(sentences, config.pattern) : null), [sentences, config.pattern]);

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

  const sourceTitle = orchSourceTitle(config) ?? '';
  const patternSummary = config.pattern
    .map((step) => `${trans(`orchCompose.step.${step.type}`)}${step.meaning ? `+${trans('orchCompose.step.meaningShort')}` : ''}${step.times > 1 ? ` x${step.times}` : ''}`)
    .join(' → ');
  const segmented = config.segmentMode === 'minutes' || config.segmentValue > 1;

  return (
    <section className={`space-y-3 rounded-2xl p-4 ${theme.cardClass}`} aria-label={trans(task ? 'orchCompose.edit' : 'orchCompose.new')}>
      <header className="flex items-center gap-2">
        <h3 className={`flex-1 text-sm font-bold ${theme.textPrimaryClass}`}>{trans(task ? 'orchCompose.edit' : 'orchCompose.new')}</h3>
        <button type="button" onClick={onClose} className={styles.iconButton} aria-label={trans('orchCompose.cancel')}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <label className={styles.label}>
        <span>{trans('orchCompose.field.name')}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} className={styles.field} />
      </label>

      <WfNewOrchSection icon={BookOpen} title={trans('orchCompose.field.source')} summary={sourceTitle || trans('orchCompose.source.pick')} open={open.source} onToggle={() => toggle('source')} theme={theme}>
        {sourceTitle && (
          <p className={styles.hint}>
            {trans(source === 'vocab_book' ? 'orchCompose.source.books' : 'orchCompose.source.prompts')} · <span className={theme.textPrimaryClass}>{sourceTitle}</span>
          </p>
        )}
        <WordNewOrchSourcePicker selected={sourceSelection(source, config)} onPick={pick} theme={theme} trans={trans} />
        {source === 'vocab_book' && config.book && (
          <label className={styles.label}>
            <span>{trans('orchCompose.field.chapter')}</span>
            <select
              value={config.book.chapterIndex ?? ''}
              onChange={(event) => config.book && patch({ book: { ...config.book, chapterIndex: event.target.value === '' ? null : Number(event.target.value) } })}
              className={styles.select}
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
      </WfNewOrchSection>

      <WfNewOrchSection icon={ListOrdered} title={trans('orchCompose.field.pattern')} summary={patternSummary} open={open.pattern} onToggle={() => toggle('pattern')} theme={theme}>
        <ol className="space-y-2">
          {config.pattern.map((step, index) => (
            <li key={index} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${theme.borderClass}`}>
              <span className={`w-5 text-center font-mono text-[11px] ${theme.textSecondaryClass}`}>{index + 1}</span>
              <select
                value={step.type}
                onChange={(event) => {
                  const type = event.target.value as OrchComposeStepType;
                  setStep(index, { type, meaning: MEANING_STEPS.has(type) ? step.meaning : undefined });
                }}
                className={`${styles.select} !w-auto flex-1`}
                aria-label={trans('orchCompose.field.pattern')}
              >
                {AUDIO_ORCH_STEP_TYPES.map((type) => <option key={type} value={type}>{trans(`orchCompose.step.${type}`)}</option>)}
              </select>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={ORCH_MAX_STEP_TIMES}
                value={step.times}
                aria-label={trans('orchCompose.field.times')}
                title={trans('orchCompose.field.times')}
                onChange={(event) => setStep(index, { times: clampInt(event.target.value, 1, ORCH_MAX_STEP_TIMES) })}
                className={styles.number}
              />
              {MEANING_STEPS.has(step.type) && (
                <label className={`inline-flex items-center gap-1 text-[11px] ${theme.textSecondaryClass}`}>
                  <input type="checkbox" checked={step.meaning === true} onChange={(event) => setStep(index, { meaning: event.target.checked || undefined })} className="accent-indigo-500" />
                  {trans('orchCompose.step.meaning')}
                </label>
              )}
              <span className="ml-auto flex items-center">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className={styles.iconButton} aria-label={trans('orchCompose.step.up')}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={index === config.pattern.length - 1} onClick={() => move(index, 1)} className={styles.iconButton} aria-label={trans('orchCompose.step.down')}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setSteps(config.pattern.filter((_, at) => at !== index))} className={`${styles.iconButton} text-rose-500`} aria-label={trans('orchCompose.step.remove')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSteps([...config.pattern, { type: 'sentence_en', times: 1 }])} className={`inline-flex items-center gap-1 ${styles.chip}`}>
            <Plus className="h-3 w-3" />{trans('orchCompose.step.add')}
          </button>
          <button type="button" onClick={() => setSteps(audioOrchDefaultPattern())} className={`inline-flex items-center gap-1 ${styles.chip}`}>
            <RotateCcw className="h-3 w-3" />{trans('orchCompose.step.default')}
          </button>
        </div>
        <WordNewOrchMissingLanguageNotice skipped={missingLanguages} trans={trans} />
      </WfNewOrchSection>

      <WfNewOrchSection
        icon={Sparkles}
        title={trans('orchCompose.field.newWords')}
        summary={trans(`orchCompose.readState.${config.readState}`)}
        open={open.words}
        onToggle={() => toggle('words')}
        theme={theme}
      >
        <WordNewOrchReadStateField
          value={{ groupId: config.wordGroupId, readState: config.readState, virtualBatch: config.virtualBatch }}
          taskBatch={task ? orchTaskVirtualBatch(task.id) : ''}
          onChange={({ groupId, readState, virtualBatch }) => patch({ wordGroupId: groupId, readState, virtualBatch })}
          theme={theme}
          trans={trans}
        />
        <label className={`${styles.label} flex items-center gap-2 space-y-0`}>
          <span className="flex-1">{trans('orchCompose.field.maxRead')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_READ_COUNT}
            value={config.newOnlyMaxReadCount}
            onChange={(event) => patch({ newOnlyMaxReadCount: clampInt(event.target.value, 0, MAX_READ_COUNT) })}
            className={styles.number}
          />
        </label>
      </WfNewOrchSection>

      <WfNewOrchSection
        icon={SlidersHorizontal}
        title={trans('orchCompose.field.output')}
        summary={`${trans(segmented ? (config.segmentMode === 'minutes' ? 'orchCompose.segment.minutes' : 'orchCompose.segment.count') : 'orchCompose.segment.single')} · ${trans(`orchCompose.languages.${config.languages}`)}`}
        open={open.output}
        onToggle={() => toggle('output')}
        theme={theme}
      >
        {source === 'vocab_book' && (
          <div className="flex flex-wrap items-end gap-2">
            <label className={`${styles.label} min-w-[10rem] flex-1`}>
              <span>{trans('orchCompose.field.segmentMode')}</span>
              <select
                value={config.segmentMode === 'minutes' ? 'minutes' : segmented ? 'count' : 'single'}
                onChange={(event) => {
                  const mode = event.target.value;
                  if (mode === 'single') patch({ segmentMode: 'count', segmentValue: 1 });
                  else if (mode === 'minutes') patch({ segmentMode: 'minutes', segmentValue: ORCH_DEFAULT_MINUTES });
                  else patch({ segmentMode: 'count', segmentValue: Math.max(2, config.segmentValue) });
                }}
                className={styles.select}
              >
                <option value="single">{trans('orchCompose.segment.single')}</option>
                <option value="count">{trans('orchCompose.segment.count')}</option>
                <option value="minutes">{trans('orchCompose.segment.minutes')}</option>
              </select>
            </label>
            {segmented && (
              <input
                type="number"
                inputMode="numeric"
                min={config.segmentMode === 'minutes' ? 1 : 2}
                max={MAX_SEGMENT_VALUE}
                value={config.segmentValue}
                aria-label={trans(config.segmentMode === 'minutes' ? 'orchCompose.field.minutes' : 'orchCompose.field.count')}
                title={trans(config.segmentMode === 'minutes' ? 'orchCompose.field.minutes' : 'orchCompose.field.count')}
                onChange={(event) => patch({ segmentValue: clampInt(event.target.value, config.segmentMode === 'minutes' ? 1 : 2, MAX_SEGMENT_VALUE) })}
                className={styles.number}
              />
            )}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={styles.label}>
            <span className="inline-flex items-center gap-1"><Languages className="h-3 w-3" />{trans('orchCompose.field.languages')}</span>
            <select value={config.languages} onChange={(event) => patch({ languages: event.target.value as OrchComposeLanguages })} className={styles.select}>
              {LANGUAGES.map((value) => <option key={value} value={value}>{trans(`orchCompose.languages.${value}`)}</option>)}
            </select>
          </label>
          <label className={styles.label}>
            <span>{trans('orchCompose.field.preset')}</span>
            <select value={config.presetId} onChange={(event) => patch({ presetId: event.target.value })} className={styles.select}>
              <option value="">{trans('orchCompose.field.presetActive')}</option>
              {(presets?.presets ?? []).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
        </div>
      </WfNewOrchSection>

      {task && <p className={styles.hint}>{trans('orchCompose.editReloads')}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={styles.chip}>{trans('orchCompose.cancel')}</button>
        <button type="button" disabled={!valid || saving} onClick={() => { void save(); }} className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${styles.chipActive}`}>
          <Save className="h-3.5 w-3.5" />{trans('orchCompose.save')}
        </button>
      </div>
    </section>
  );
};
