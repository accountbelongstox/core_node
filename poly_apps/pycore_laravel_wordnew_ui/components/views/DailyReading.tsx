import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { api } from '../../core/api';
import type { DailySentence } from '../../core/api/modules/DailySentenceAPI';
import AudioButton from '../shared/AudioButton';

/**
 * Daily short-sentence reading. Shows the current recommendation (with audio +
 * 3 variants) and the history of known sentences produced by the pycore
 * translation assist. Self-contained: mount anywhere (e.g. the wordnew home).
 */
const DailyReading: React.FC = () => {
  const [recommend, setRecommend] = useState<DailySentence | null>(null);
  const [items, setItems] = useState<DailySentence[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rec, lst] = await Promise.all([
      api.dailySentences.recommend(),
      api.dailySentences.list({ limit: 100 })
    ]);
    if (rec.success && rec.data) setRecommend(rec.data.item);
    if (lst.success && lst.data) setItems(lst.data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
          <BookOpen className="w-5 h-5 text-indigo-500" /> Daily Reading
        </h2>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {recommend ? (
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent p-5 space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-500">
            RECOMMENDED
            <AudioButton url={recommend.audio?.url} />
          </div>
          <p className="text-xl font-semibold text-slate-800 dark:text-white leading-relaxed">{recommend.english}</p>
          {recommend.original && (
            <p className="text-sm text-slate-400">{recommend.original}</p>
          )}
          {recommend.variants?.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
              {recommend.variants.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 p-8 text-center text-slate-400 text-sm">
          {loading ? '…' : 'No daily sentences yet. Non-English prompts get translated and appear here.'}
        </div>
      )}

      {items.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 mb-2">HISTORY ({items.length})</h3>
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id} className="rounded-xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 p-3 flex items-start gap-3">
                <AudioButton url={s.audio?.url} />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{s.english}</p>
                  {s.original && <p className="text-xs text-slate-400 truncate">{s.original}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DailyReading;
