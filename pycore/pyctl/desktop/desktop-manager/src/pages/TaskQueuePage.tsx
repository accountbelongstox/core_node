import { useState, useEffect, useCallback } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { pycoreApi } from '../api/pycore';

interface TaskRow { task_id: string; task_type: string; status: string; progress: number; created_at?: string; }

export default function TaskQueuePage() {
  const { settings, t, toast } = useApp();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await pycoreApi.pyGet('/voice-subtitle/tasks?limit=50');
      setTasks(Array.isArray(r?.tasks) ? r.tasks : Array.isArray(r) ? r : []);
    } catch { toast('Could not load tasks', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-emerald-500' : s === 'failed' ? 'text-rose-500'
      : s === 'processing' ? 'text-sky-500' : 'text-slate-400';

  return (
    <div className={`rounded-3xl p-6 border backdrop-blur-xl transition-all ${
      settings.theme === 'dark' ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-md'}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2"><ListChecks className="w-5 h-5 text-sky-400" /> {t.taskQueue}</h2>
        <button onClick={refresh}
          className="p-2 rounded-lg bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-slate-300/40 dark:border-white/10 transition" title={t.refresh}>
          <RefreshCw className={`w-4 h-4 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="overflow-x-auto min-h-[260px]">
        {tasks.length === 0 ? (
          <p className="text-xs italic text-slate-500 py-10 text-center">No tasks yet.</p>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/50 dark:border-white/5">
                <th className="pb-3">Task ID</th><th className="pb-3">Type</th><th className="pb-3">Status</th><th className="pb-3">Progress</th><th className="pb-3">{t.created}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {tasks.map((tk) => (
                <tr key={tk.task_id} className="hover:bg-slate-300/10 dark:hover:bg-white/5 transition">
                  <td className="py-3 font-mono text-[10px] text-slate-500">{tk.task_id}</td>
                  <td className="py-3">{tk.task_type}</td>
                  <td className={`py-3 font-bold uppercase text-[10px] ${statusColor(tk.status)}`}>{tk.status}</td>
                  <td className="py-3 font-mono">{tk.progress ?? 0}%</td>
                  <td className="py-3 font-mono text-slate-500 text-[10px]">{tk.created_at ? new Date(tk.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
