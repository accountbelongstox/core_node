/**
 * A pycore orchestration task record as a composer spec and inputs, so the
 * pycore UI composes a task with the same code wordnew uses on the phone.
 */
import type { OrchPatternStep, OrchSentenceRow, OrchTask, OrchTextSentence } from '../../core/integrations/pycore';
import { defaultOrchConfig } from './orchPlanner';
import type { OrchComposeSentence, OrchComposeSpec, OrchComposeStep, OrchComposeStepType } from './orchTypes';

function stepType(step: OrchPatternStep, wordMode: string | undefined): OrchComposeStepType | null {
  if (step.type === 'words') return wordMode === 'new_only' ? 'words_new' : 'words_all';
  return step.type;
}

export function orchSpecFromPycoreTask(task: OrchTask, languages: OrchComposeSpec['config']['languages']): OrchComposeSpec {
  const source = task.source === 'prompt_rewrite' ? 'prompt_rewrite' : 'vocab_book';
  const defaults = defaultOrchConfig(source);
  const pattern = (task.pattern ?? [])
    .map((step): OrchComposeStep | null => {
      const type = stepType(step, task.word_mode);
      return type ? { type, times: Math.max(1, Number(step.times) || 1) } : null;
    })
    .filter((step): step is OrchComposeStep => step !== null);
  return {
    source,
    language: task.book?.language || 'en',
    config: {
      ...defaults,
      pattern: pattern.length > 0 ? pattern : defaults.pattern,
      segmentMode: task.segment_mode === 'minutes' ? 'minutes' : task.segment_mode === 'count' ? 'count' : defaults.segmentMode,
      segmentValue: Math.max(1, Number(task.segment_value) || defaults.segmentValue),
      newOnlyMaxReadCount: Math.max(0, Number(task.new_only_max_read_count) || 0),
      languages,
      presetId: task.video_preset || '',
      book: task.book
        ? {
          sourceKey: task.book.source_key,
          title: task.book.title || task.book.source_key,
          language: task.book.language || 'en',
          targetLanguage: task.book.target_language || 'zh',
          chapterIndex: null,
        }
        : null,
      prompt: null,
      wordGroupId: null,
    },
  };
}

/** pycore sentence rows (book cache or a text task's inline sentences). */
export function orchSentencesFromPycore(rows: ReadonlyArray<OrchSentenceRow | OrchTextSentence>, fallbackLanguage: string): OrchComposeSentence[] {
  return rows
    .map((row, position): OrchComposeSentence => {
      const language = row.language || fallbackLanguage;
      const languages: Record<string, string> = {};
      Object.entries(row.languages ?? {}).forEach(([code, text]) => {
        if (typeof text === 'string' && text.trim()) languages[code] = text.trim();
      });
      const text = (row.text || languages[language] || '').trim();
      if (text && !languages[language]) languages[language] = text;
      return { seq: Number.isFinite(row.seq) ? row.seq : position, text, language, languages, audio: {} };
    })
    .filter((sentence) => sentence.text !== '');
}
