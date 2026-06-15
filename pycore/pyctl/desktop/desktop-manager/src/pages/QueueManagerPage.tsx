import { Layers } from 'lucide-react';
import { useApp } from '../state/AppContext';

export default function QueueManagerPage() {
  const { queue, settings, t } = useApp();
  return (
    <div className={`rounded-3xl p-6 border backdrop-blur-xl transition-all ${
      settings.theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white/80 border-slate-200 shadow-md'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-sky-400" /> {t.queueManager}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Review, filter and inspect queued system operations.</p>
        </div>
        <span className="text-xs font-mono text-slate-400">{queue.length} Active Rows</span>
      </div>
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/50 dark:border-white/5">
              <th className="pb-3 text-center w-8">{t.index}</th>
              <th className="pb-3">{t.text}</th>
              <th className="pb-3">{t.category}</th>
              <th className="pb-3">{t.playCount}</th>
              <th className="pb-3">{t.created}</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {queue.map((item) => (
              <tr key={item.id} className="hover:bg-slate-300/10 dark:hover:bg-white/5 transition">
                <td className="py-3 font-mono opacity-50 font-bold">{item.index}</td>
                <td className="py-3 font-medium text-slate-800 dark:text-zinc-200">{item.text}</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded text-[9px] bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-300 uppercase font-semibold">{item.category}</span></td>
                <td className="py-3 font-mono">{item.playCount}</td>
                <td className="py-3 font-mono text-slate-500 text-[10px]">{new Date(item.created).toLocaleString()}</td>
                <td className="py-3 text-emerald-500 font-bold text-[10px]">READY</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
