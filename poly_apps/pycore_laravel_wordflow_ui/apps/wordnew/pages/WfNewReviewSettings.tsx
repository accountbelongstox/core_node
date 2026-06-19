import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Minus, Plus } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import { wfNewSettings } from '../WfNewSettingsStore';

/**
 * WfNewReviewSettings — the Review Settings sub-page (opened from Learning Model).
 * Daily review limit, review ordering, spaced-repetition algorithm, and whether
 * newly-learned words mix into the review queue. Persisted to WfNewSettingsStore.
 */
interface WfNewReviewSettingsProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onBack: () => void;
}

const ORDERS = ['due_first', 'random', 'hardest_first'] as const;
const ALGORITHMS = ['ebbinghaus', 'sm2', 'leitner'] as const;

export const WfNewReviewSettings: React.FC<WfNewReviewSettingsProps> = ({ activeTheme, trans, onBack }) => {
  const [dailyLimit, setDailyLimit] = useState<number>(() => wfNewSettings.get('reviewDailyLimit'));
  const [order, setOrder] = useState<string>(() => wfNewSettings.get('reviewOrder'));
  const [algorithm, setAlgorithm] = useState<string>(() => wfNewSettings.get('reviewAlgorithm'));
  const [includeNew, setIncludeNew] = useState<boolean>(() => wfNewSettings.get('reviewIncludeNew'));

  const orderLabel: Record<string, string> = {
    due_first: trans('rev.orderDueFirst'), random: trans('rev.orderRandom'), hardest_first: trans('rev.orderHardest'),
  };
  const algoLabel: Record<string, string> = {
    ebbinghaus: trans('rev.algoEbbinghaus'), sm2: trans('rev.algoSm2'), leitner: trans('rev.algoLeitner'),
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-400" />
            {trans('rev.title')}
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">{trans('rev.sub')}</p>
        </div>
      </div>

      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} border border-white/5 shadow-lg space-y-1 divide-y divide-white/5`}>
        {/* Daily limit */}
        <div className="flex items-center justify-between py-3">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('rev.dailyLimit')}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { const v = Math.max(5, dailyLimit - 5); setDailyLimit(v); wfNewSettings.setField('reviewDailyLimit', v); }} className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
            <span className="min-w-[40px] text-center text-xs font-black font-mono text-zinc-800 dark:text-slate-100">{dailyLimit}</span>
            <button onClick={() => { const v = Math.min(500, dailyLimit + 5); setDailyLimit(v); wfNewSettings.setField('reviewDailyLimit', v); }} className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Order */}
        <div className="py-3 space-y-2">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('rev.order')}</span>
          <div className="flex flex-wrap gap-2">
            {ORDERS.map((o) => (
              <button key={o} onClick={() => { setOrder(o); wfNewSettings.setField('reviewOrder', o); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border cursor-pointer transition-all ${order === o ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>
                {orderLabel[o]}
              </button>
            ))}
          </div>
        </div>

        {/* Algorithm */}
        <div className="py-3 space-y-2">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('rev.algorithm')}</span>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map((a) => (
              <button key={a} onClick={() => { setAlgorithm(a); wfNewSettings.setField('reviewAlgorithm', a); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border cursor-pointer transition-all ${algorithm === a ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>
                {algoLabel[a]}
              </button>
            ))}
          </div>
        </div>

        {/* Include new */}
        <div className="flex items-center justify-between py-3">
          <span className="text-xs font-bold text-zinc-800 dark:text-slate-200">{trans('rev.includeNew')}</span>
          <button onClick={() => { const v = !includeNew; setIncludeNew(v); wfNewSettings.setField('reviewIncludeNew', v); }}
            className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${includeNew ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${includeNew ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
