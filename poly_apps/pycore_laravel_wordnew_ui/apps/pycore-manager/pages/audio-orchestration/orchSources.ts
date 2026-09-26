import { AudioLines, BookOpen, MessageSquareText, type LucideIcon } from 'lucide-react';
import type { OrchTaskSource, OrchTaskSummary } from '@/apps/pycore-manager/api';
import { ORCH_L } from './orchShared';

/** Task source ids come from pycore (tasks/list `sources`); 'all' disables filtering. */
export type OrchSourceFilter = OrchTaskSource | 'all';

export const ORCH_BOOK_SOURCE: OrchTaskSource = 'vocab_book';

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
