import React, { useCallback, useEffect, useState } from 'react';
import { Languages, Play } from 'lucide-react';
import { Language } from '../../../types';
import { api } from '../../../core/api';
import type { DevHistoryAssistTask } from '../../../core/api/modules/DevHistoryAPI';

interface Props {
  lang: Language;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  refreshToken: number;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-500',
  assigned: 'text-sky-500',
  processing: 'text-indigo-500',
  completed: 'text-emerald-500',
  failed: 'text-rose-500'
};

/**
 * Translation Assist Distribution — non-English dev-history prompts dispatched
 * to pycore for English translation (3 variants + audio). Reads /api/dev-history/assist.
 */
const AssistDistributionPanel: React.FC<Props> = ({ autoRefresh, refreshIntervalSec, refreshToken }) => {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<DevHistoryAssistTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.devHistory.getAssist();
    if (res.success && res.data) {
      setSummary(res.data.summary || {});
      setRecent(res.data.recent || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!autoRefresh) return;
    const h = setInterval(load, Math.max(3, refreshIntervalSec) * 1000);
    return () => clearInterval(h);
  }, [autoRefresh, refreshIntervalSec, load]);

  const scan = async () => {
    setScanning(true);
    await api.devHistory.assistScan();
    await load();
    setScanning(false);
  };

  const cards: Array<[string, string]> = [
    ['pending', 'Pending'],
    ['processing', 'Processing'],
    ['completed', 'Completed'],
    ['failed', 'Failed']
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Languages className="w-4 h-4 text-indigo-500" /> Translation Assist Distribution
        </h3>
        <button
          onClick={scan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" /> {scanning ? 'Scanning…' : 'Scan & enqueue'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(([k, label]) => (
          <div key={k} className="rounded-xl border border-black/5 dark:border-white/10 p-3 bg-white/40 dark:bg-slate-900/40">
            <div className="text-[11px] text-slate-400">{label}</div>
            <div className={`text-xl font-bold ${STATUS_COLOR[k] || 'text-slate-500'}`}>{summary[k] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-black/5 dark:bg-white/5 text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Lang</th>
              <th className="text-left px-3 py-2">Prompt</th>
              <th className="text-left px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {recent.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  {loading ? '…' : 'No assist tasks yet.'}
                </td>
              </tr>
            ) : (
              recent.map((r) => (
                <tr key={r.task_id}>
                  <td className={`px-3 py-2 font-medium ${STATUS_COLOR[r.status] || ''}`}>{r.status}</td>
                  <td className="px-3 py-2">{r.source_lang}</td>
                  <td className="px-3 py-2 truncate max-w-md text-slate-600 dark:text-slate-300">{r.text}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{r.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssistDistributionPanel;
