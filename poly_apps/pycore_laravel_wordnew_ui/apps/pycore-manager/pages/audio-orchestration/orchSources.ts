import { AudioLines, BookOpen, FileVideo, MessageSquareText, Music, type LucideIcon } from 'lucide-react';
import type { OrchOutputMode, OrchTaskSource, OrchTaskSummary } from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';

/** Task source ids come from pycore (tasks/list `sources`); 'all' disables filtering. */
export type OrchSourceFilter = OrchTaskSource | 'all';

export const ORCH_BOOK_SOURCE: OrchTaskSource = 'vocab_book';
export const ORCH_PROMPT_SOURCE: OrchTaskSource = 'prompt_rewrite';
/** Task list tabs in display order: every source has its own paginated list. */
export const ORCH_TASK_TABS: readonly OrchTaskSource[] = [ORCH_BOOK_SOURCE, ORCH_PROMPT_SOURCE];
export const ORCH_TASK_PAGE_SIZE = 20;

export const ORCH_OUTPUT_MODES: readonly OrchOutputMode[] = ['video', 'audio'];
export const ORCH_DEFAULT_OUTPUT_MODE: OrchOutputMode = 'video';
/** A book is cut by audio minutes; a short book stays one segment. Text tasks are always one segment. */
export const ORCH_DEFAULT_SEGMENT_MODE = 'minutes';
export const ORCH_DEFAULT_SEGMENT_MINUTES = 10;

export const ORCH_OUTPUT_ICONS: Record<OrchOutputMode, LucideIcon> = { video: FileVideo, audio: Music };

export function orchTaskOutputMode(task: Pick<OrchTaskSummary, 'output_mode'> | null | undefined): OrchOutputMode {
  return task?.output_mode === 'audio' ? 'audio' : ORCH_DEFAULT_OUTPUT_MODE;
}

export interface OrchSourcePresentation {
  label: () => string;
  Icon: LucideIcon;
  badgeClass: string;
}

const ORCH_SOURCE_PRESENTATION: Record<string, OrchSourcePresentation> = {
  vocab_book: { label: () => ORCH_L.sourceVocabBook, Icon: BookOpen, badgeClass: 'bg-sky-500/15 text-sky-300' },
  prompt_rewrite: { label: () => ORCH_L.sourcePromptRewrite, Icon: MessageSquareText, badgeClass: 'bg-violet-500/15 text-violet-300' },
};

export function orchSourcePresentation(source: OrchTaskSource): OrchSourcePresentation {
  return ORCH_SOURCE_PRESENTATION[source] || { label: () => source, Icon: AudioLines, badgeClass: 'bg-slate-500/15 text-slate-300' };
}

export function orchTaskSource(task: Pick<OrchTaskSummary, 'source'> | null | undefined): OrchTaskSource {
  return task?.source || ORCH_BOOK_SOURCE;
}

/** Book-input tasks use the qy login, book picker and task editor; text-input tasks carry inline sentences. */
export function orchTaskUsesBook(task: Pick<OrchTaskSummary, 'source' | 'input'> | null | undefined): boolean {
  return task?.input ? task.input === 'book' : orchTaskSource(task) === ORCH_BOOK_SOURCE;
}

export function orchFilterUsesBooks(filter: OrchSourceFilter): boolean {
  return filter === 'all' || filter === ORCH_BOOK_SOURCE;
}
