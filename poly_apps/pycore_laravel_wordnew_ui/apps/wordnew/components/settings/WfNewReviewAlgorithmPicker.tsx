import React from 'react';
import { useWfNewSetting } from '../../useWfNewSettings';
import { REVIEW_ALGORITHMS, type Translate } from './WfNewSettingChoices';

interface WfNewReviewAlgorithmPickerProps {
  trans: Translate;
}

/** Spaced-repetition algorithm radio cards (Settings and Review Settings share this one picker). */
export const WfNewReviewAlgorithmPicker: React.FC<WfNewReviewAlgorithmPickerProps> = ({ trans }) => {
  const [algorithm, setAlgorithm] = useWfNewSetting('reviewAlgorithm');
  return (
    <div role="radiogroup" className="space-y-2 pt-1">
      {REVIEW_ALGORITHMS.map((item) => {
        const selected = algorithm === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setAlgorithm(item.value)}
            className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-all ${
              selected
                ? 'border-indigo-500 bg-indigo-500/5 text-indigo-900 dark:text-white'
                : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/5'
            }`}
          >
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-indigo-500' : 'border-zinc-300 dark:border-zinc-700'}`}>
              {selected && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
            </span>
            <span>
              <span className="block text-xs font-bold">{trans(item.labelKey)}</span>
              {item.hintKey && <span className="mt-0.5 block font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{trans(item.hintKey)}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
};
