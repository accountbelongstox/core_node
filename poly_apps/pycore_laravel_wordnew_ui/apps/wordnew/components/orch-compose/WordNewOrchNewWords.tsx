/**
 * The new words of a composition (read count in the bound group + the API-side
 * virtual read count within the task's limit), with both counts - the list the
 * stage marks on its word cards.
 */
import React, { useMemo } from 'react';
import type { ElementTheme } from '../../WfNewThemes';
import type { OrchComposePlan, OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';

interface Props {
  task: OrchComposeTask;
  plan: OrchComposePlan | null;
  wordStates: ReadonlyMap<string, OrchWordState>;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const MAX_SHOWN = 200;

/** Words of the plan that are new under the task's limit (plan order). */
export function orchNewWords(
  plan: OrchComposePlan | null,
  wordStates: ReadonlyMap<string, OrchWordState>,
  maxReadCount: number,
): string[] {
  if (!plan) return [];
  return plan.resources
    .filter((resource) => resource.kind === 'word')
    .map((resource) => resource.contentId)
    .filter((word) => (wordStates.get(word)?.readCount ?? 0) <= maxReadCount);
}

export const WordNewOrchNewWords: React.FC<Props> = ({ task, plan, wordStates, trans }) => {
  const words = useMemo(
    () => orchNewWords(plan, wordStates, task.config.newOnlyMaxReadCount),
    [plan, wordStates, task.config.newOnlyMaxReadCount],
  );
  if (!plan) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
        {trans('orchCompose.newWords.title', { count: words.length, batch: task.config.virtualBatch })}
      </p>
      {words.length === 0 ? (
        <p className="text-[11px] text-zinc-500">{trans('orchCompose.newWords.none')}</p>
      ) : (
        <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {words.slice(0, MAX_SHOWN).map((word) => {
            const state = wordStates.get(word);
            return (
              <li
                key={word}
                className="rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 text-[11px]"
                title={trans('orchCompose.newWords.counts', { group: state?.groupReadCount ?? 0, virtual: state?.virtualReadCount ?? 0 })}
              >
                <span className="font-bold text-zinc-800 dark:text-zinc-100">{word}</span>
                {state?.meaning && <span className="ml-1 text-zinc-500 dark:text-zinc-400">{state.meaning}</span>}
                <span className="ml-1 font-mono text-[10px] text-zinc-500">{state?.groupReadCount ?? 0}+{state?.virtualReadCount ?? 0}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
