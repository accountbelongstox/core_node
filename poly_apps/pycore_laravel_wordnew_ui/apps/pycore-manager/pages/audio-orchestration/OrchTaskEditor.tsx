/**
 * Orchestration task editor: segment split (count / minutes), the ordered
 * per-sentence pattern (words / EN sentence / ZH sentence with times; presets
 * EN→ZH, ZH→EN, words→EN), the word selection mode (Word New Only with
 * task-local virtual read vs all words), the output mode (Audio / Video, default
 * Video) with its video style, the automatic-generation switch and plan
 * preview. Saving is enough: pycore's queue generates the task by itself;
 * Regenerate only forces a fresh run of an already saved task.
 */
import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  pycoreApi,
  type OrchBookItem,
  type OrchOutputMode,
  type OrchPatternStep,
  type OrchPatternStepType,
  type OrchSegment,
  type OrchTask,
  type OrchVideoPreset,
} from '@/apps/pycore-manager/api';
import { VocabBanner, humanInt } from '../vocabulary/vocabShared';
import OrchAutoGenerateSwitch from './OrchAutoGenerateSwitch';
import OrchTaskOutputFields from './OrchTaskOutputFields';
import { ORCH_L, ORCH_STEP_LABELS, formatDuration, orchErrorMessage, newOrchTaskName } from './orchShared';
import { ORCH_DEFAULT_OUTPUT_MODE, ORCH_DEFAULT_SEGMENT_MINUTES, ORCH_DEFAULT_SEGMENT_MODE, orchTaskOutputMode } from './orchSources';
import { ORCH_BUTTON_CLASS, ORCH_INPUT_CLASS, ORCH_PRIMARY_BUTTON_CLASS, ORCH_QUIET_BUTTON_CLASS } from './orchStyles';

const STEP_TYPES: OrchPatternStepType[] = ['words_new', 'words_all', 'sentence_en', 'sentence_zh'];
const PRESETS: Array<{ label: string; steps: OrchPatternStep[] }> = [
  { get label() { return ORCH_L.presetEnZh; }, steps: [{ type: 'sentence_en', times: 1 }, { type: 'sentence_zh', times: 1 }] },
  { get label() { return ORCH_L.presetZhEn; }, steps: [{ type: 'sentence_zh', times: 1 }, { type: 'sentence_en', times: 1 }] },
  { get label() { return ORCH_L.presetWordEn; }, steps: [{ type: 'words_new', times: 1 }, { type: 'sentence_en', times: 1 }] },
];

const OrchTaskEditor: React.FC<{
  book: OrchBookItem | null;
  books: OrchBookItem[];
  task: OrchTask | null;
  presets: OrchVideoPreset[];
  activePresetId: string;
  onSaved: (taskId: string) => void;
  onClose: () => void;
  onSyncStarted: (sourceKey: string) => void;
}> = ({ book, books, task, presets, activePresetId, onSaved, onClose, onSyncStarted }) => {
  const [name, setName] = useState('');
  const [segmentMode, setSegmentMode] = useState<'count' | 'minutes'>(ORCH_DEFAULT_SEGMENT_MODE);
  const [segmentValue, setSegmentValue] = useState(ORCH_DEFAULT_SEGMENT_MINUTES);
  const [outputMode, setOutputMode] = useState<OrchOutputMode>(ORCH_DEFAULT_OUTPUT_MODE);
  const [videoPreset, setVideoPreset] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [pattern, setPattern] = useState<OrchPatternStep[]>(PRESETS[0].steps);
  const [bookKey, setBookKey] = useState(task?.book?.source_key || book?.source_key || '');
  const [savedTaskId, setSavedTaskId] = useState<string | null>(task?.task_id || null);
  const [addStepType, setAddStepType] = useState<OrchPatternStepType>('words_new');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ segments: OrchSegment[]; sentence_total?: number } | null>(null);

  useEffect(() => {
    setSavedTaskId(task?.task_id || null);
    setBookKey(task?.book?.source_key || book?.source_key || '');
    setName(task?.name || (book ? newOrchTaskName(book) : ''));
    setSegmentMode(!task || task.segment_mode === 'minutes' ? 'minutes' : 'count');
    setSegmentValue(Number(task?.segment_value) || ORCH_DEFAULT_SEGMENT_MINUTES);
    setOutputMode(orchTaskOutputMode(task));
    setVideoPreset(task?.video_preset || '');
    setAutoGenerate(task?.auto_generate !== false);
    setPattern(task?.pattern?.length ? task.pattern.map((step) => ({
      ...step, type: step.type === 'words' ? task.word_mode === 'new_only' ? 'words_new' : 'words_all' : step.type,
    })) : PRESETS[0].steps.map((step) => ({ ...step })));
    setPlan(null);
  }, [task, book?.source_key]);

  const activeBook = books.find((item) => item.source_key === bookKey)
    || (book?.source_key === bookKey ? book : null)
    || (task?.book?.source_key === bookKey ? task.book : null);

  const selectBook = async (sourceKey: string) => {
    setBookKey(sourceKey);
    setPlan(null);
    if (!sourceKey) return;
    try {
      const response = await pycoreApi.orchBookSentences(sourceKey, true);
      if (!response.success) throw new Error(response.error || ORCH_L.loadFailed);
      if (response.syncing) onSyncStarted(sourceKey);
    } catch (failure) {
      setError(orchErrorMessage(failure, ORCH_L.loadFailed));
    }
  };

  const updateStep = (index: number, patch: Partial<OrchPatternStep>) => {
    setPattern((steps) => steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const moveStep = (index: number, delta: number) => {
    setPattern((steps) => {
      const next = [...steps];
      const target = index + delta;
      if (target < 0 || target >= next.length) return steps;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async (): Promise<string | null> => {
    if (!activeBook?.source_key) {
      setError(ORCH_L.pickBook);
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: name.trim() || newOrchTaskName(activeBook),
        book: {
          source_key: activeBook.source_key,
          title: activeBook.title,
          language: activeBook.language || 'en',
          target_language: 'zh',
        },
        segment_mode: segmentMode,
        segment_value: segmentValue,
        pattern,
        word_mode: pattern.some((step) => step.type === 'words_all') ? 'all' as const
          : pattern.some((step) => step.type === 'words_new') ? 'new_only' as const
          : task?.word_mode === 'new_only' ? 'new_only' as const : 'all' as const,
        new_only_max_read_count: task?.new_only_max_read_count || 0,
        output_mode: outputMode,
        video_preset: videoPreset,
        auto_generate: autoGenerate,
      };
      const r = savedTaskId
        ? await pycoreApi.orchTaskUpdate(savedTaskId, payload)
        : await pycoreApi.orchTaskCreate(payload);
      if (!r.success || !r.task) {
        setError(orchErrorMessage(r, ORCH_L.saveFailed));
        return null;
      }
      setSavedTaskId(String(r.task.task_id));
      setName(r.task.name);
      onSaved(String(r.task.task_id));
      return String(r.task.task_id);
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.saveFailed));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    const taskId = await save();
    if (!taskId) return;
    setBusy(true);
    try {
      const r = await pycoreApi.orchTaskPlan(taskId);
      if (!r.success) {
        setError(orchErrorMessage(r.error, ORCH_L.planFailed));
        return;
      }
      setPlan({ segments: r.segments || [], sentence_total: r.sentence_total });
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.planFailed));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    const taskId = await save();
    if (!taskId) return;
    setBusy(true);
    try {
      const r = await pycoreApi.orchTaskGenerate(taskId, true);
      if (!r.success) {
        setError(orchErrorMessage(r.error, ORCH_L.generateFailed));
        return;
      }
      onClose();
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.generateFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-sky-700/40 bg-slate-900/60 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-200">
        {task ? ORCH_L.editorTitleEdit : ORCH_L.editorTitleNew}
      </h3>
      {error && <VocabBanner kind="error" message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          {ORCH_L.taskName}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1 ${ORCH_INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          {ORCH_L.book}
          <select value={bookKey} onChange={(event) => void selectBook(event.target.value)}
            className={`mt-1 ${ORCH_INPUT_CLASS}`}>
            <option value="">{ORCH_L.pickBook}</option>
            {activeBook && !books.some((item) => item.source_key === activeBook.source_key) && (
              <option value={activeBook.source_key}>{activeBook.title || activeBook.source_key}</option>
            )}
            {books.map((item) => <option key={item.source_key} value={item.source_key}>{item.title || item.original_name || item.source_key}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          {ORCH_L.segmentMode}
          <select
            value={segmentMode}
            onChange={(e) => setSegmentMode(e.target.value as 'count' | 'minutes')}
            className={`mt-1 ${ORCH_INPUT_CLASS}`}
          >
            <option value="count">{ORCH_L.segmentCount}</option>
            <option value="minutes">{ORCH_L.segmentMinutes}</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">
          {segmentMode === 'minutes' ? ORCH_L.segmentMinutes : ORCH_L.segmentCount}
          <input
            type="number"
            min={1}
            value={segmentValue}
            onChange={(e) => setSegmentValue(Math.max(1, Number(e.target.value) || 1))}
            className={`mt-1 ${ORCH_INPUT_CLASS}`}
          />
        </label>
      </div>

      <OrchTaskOutputFields
        value={{ outputMode, videoPreset }}
        presets={presets}
        activePresetId={activePresetId}
        onChange={(value) => { setOutputMode(value.outputMode); setVideoPreset(value.videoPreset); }}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">{ORCH_L.pattern}</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setPattern(preset.steps.map((s) => ({ ...s })))}
              className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-500/50"
            >
              {preset.label}
            </button>
          ))}
        </div>
        {pattern.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={step.type}
              onChange={(e) => updateStep(index, { type: e.target.value as OrchPatternStepType })}
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-200"
            >
              {STEP_TYPES.map((type) => (
                <option key={type} value={type}>{ORCH_STEP_LABELS[type]}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={5}
              value={step.times}
              onChange={(e) => updateStep(index, { times: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
              className="w-16 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-200"
            />
            <span className="text-[11px] text-slate-500">{ORCH_L.times}</span>
            <button type="button" onClick={() => moveStep(index, -1)} className="p-1 text-slate-400 hover:text-slate-200" title={ORCH_L.moveUp}>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => moveStep(index, 1)} className="p-1 text-slate-400 hover:text-slate-200" title={ORCH_L.moveDown}>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPattern((steps) => steps.filter((_, i) => i !== index))}
              className="p-1 text-rose-400 hover:text-rose-300"
              title={ORCH_L.remove}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <select value={addStepType} aria-label={ORCH_L.addStep}
          onChange={(event) => setAddStepType(event.target.value as OrchPatternStepType)}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-200">
          {STEP_TYPES.map((type) => <option key={type} value={type}>{ORCH_STEP_LABELS[type]}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setPattern((steps) => [...steps, { type: addStepType, times: 1 }])}
          className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-500/50"
        >
          <Plus className="w-3 h-3" /> {ORCH_L.addStep}
        </button>
      </div>

      {pattern.some((step) => step.type === 'words_new') && (
        <p className="text-[11px] text-amber-400/80">{ORCH_L.loginRequiredForNewOnly}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className={ORCH_PRIMARY_BUTTON_CLASS}
        >
          {savedTaskId ? ORCH_L.save : ORCH_L.create}
        </button>
        <button
          type="button"
          onClick={() => void preview()}
          disabled={busy}
          className={ORCH_BUTTON_CLASS}
        >
          {ORCH_L.planPreview}
        </button>
        <OrchAutoGenerateSwitch checked={autoGenerate} onChange={setAutoGenerate} disabled={busy} />
        {savedTaskId && (
          <button
            type="button"
            title={ORCH_L.regenerateHint}
            onClick={() => void regenerate()}
            disabled={busy}
            className={ORCH_QUIET_BUTTON_CLASS}
          >
            {ORCH_L.regenerate}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
          {ORCH_L.cancel}
        </button>
      </div>

      {plan && (
        <div className="rounded-lg border border-slate-700/60 p-3 space-y-1">
          <p className="text-xs text-slate-400">
            {humanInt(plan.sentence_total)} {ORCH_L.sentences} → {plan.segments.length} {ORCH_L.segments}
          </p>
          <div className="max-h-40 overflow-y-auto">
            {plan.segments.map((segment) => (
              <p key={segment.index} className="text-[11px] font-mono text-slate-500">
                segment_{String(segment.index).padStart(3, '0')}: {segment.sentence_count} {ORCH_L.sentences}
                {' · '}{formatDuration(segment.est_seconds)}
                {' · '}{humanInt(segment.item_count)} {ORCH_L.items}
                {' · '}{humanInt(segment.word_count)} {ORCH_L.words}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default OrchTaskEditor;
