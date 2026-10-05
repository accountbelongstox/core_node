/**
 * Task Center — work lanes: the pool of every gap lane per language (missing,
 * leased to a node, free) with the node count per lane, and the live queue
 * counts of every task type that has rows. Lanes and task types come from the
 * server answer and the contract catalog; nothing here lists them by hand
 * (phrase_audio and phrase_extract appear like word_audio / sentence_audio).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '@/core/integrations/laravel';
import type { WorkNodesResponse, WorkPoolEntry } from '../../../../../core/contracts/QueueCenterTypes';
import { commonClasses } from '@/shared/styles/theme';
import { useTaskCenterState } from './TaskCenterState';
import { TaskTypeBadge } from './shared';

interface WorkLanesPanelProps {
  lang: Language;
}

const TYPE_COUNT_STATUSES = ['pending', 'assigned', 'processing', 'completed', 'failed'] as const;

const nf = (value: number | null | undefined): string => (typeof value === 'number' ? value.toLocaleString() : '—');

const WorkLanesPanel: React.FC<WorkLanesPanelProps> = ({ lang }) => {
  const { t: tr } = useTranslation();
  const { globalTasks: snapshot, refreshToken } = useTaskCenterState();
  const stats = TRANSLATIONS[lang].globalTasks.stats as Record<string, string>;
  const [data, setData] = useState<WorkNodesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.serverManager.getWorkNodes();
      if (!mounted.current) return;
      setFailed(!response.success || !response.data);
      if (response.success && response.data) setData(response.data);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  useEffect(() => {
    let revision = -1;
    const off = laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.workNodesChanged, (event) => {
      if (event.revision <= revision) return;
      revision = event.revision;
      void load();
    });
    laravelRealtime.start();
    return () => {
      off();
      laravelRealtime.stop();
    };
  }, [load]);

  const pool: WorkPoolEntry[] = data?.pool ?? [];
  const nodes = data?.nodes ?? [];
  const laneKeys = useMemo(() => Array.from(new Set(pool.map((entry) => entry.lane))), [pool]);
  const nodeCount = useCallback(
    (lane: string): number => nodes.filter((node) => node.online && lane in (node.lanes ?? {})).length,
    [nodes],
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, Record<string, number>>();
    for (const task of snapshot?.tasks ?? []) {
      const row = counts.get(task.task_type) ?? {};
      row[task.status] = (row[task.status] ?? 0) + 1;
      counts.set(task.task_type, row);
    }
    return Array.from(counts.entries());
  }, [snapshot]);

  return (
    <section className={`${commonClasses.card} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{tr('uiTask.work_lanes.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tr('uiTask.work_lanes.hint')}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          title={tr('taskCenter.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {failed && <p className="text-xs text-rose-500">{tr('uiTask.work_lanes.load_failed')}</p>}
      {data && laneKeys.length === 0 && <p className="text-xs text-slate-500">{tr('uiTask.work_lanes.empty')}</p>}

      {laneKeys.map((lane) => (
        <div key={lane} className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TaskTypeBadge taskType={lane} />
            <span className="text-[11px] text-slate-500">
              {tr('uiTask.work_lanes.nodes')} <b className="font-mono">{nodeCount(lane)}</b>
            </span>
          </div>
          <ul className="space-y-1">
            {pool.filter((entry) => entry.lane === lane).map((entry) => {
              const gap = entry.gap ?? entry.count ?? 0;
              const leased = entry.leased ?? 0;
              const share = gap > 0 ? Math.min(100, (leased / gap) * 100) : 0;
              return (
                <li key={`${entry.lane}:${entry.language}`} className="text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono">{entry.language}</span>
                    <span>{tr('uiTask.work_lanes.gap')} <b className="font-mono">{nf(gap)}</b></span>
                    <span>{tr('uiTask.work_lanes.leased')} <b className="font-mono">{nf(leased)}</b></span>
                    <span>{tr('uiTask.work_lanes.free')} <b className="font-mono">{nf(entry.free ?? Math.max(0, gap - leased))}</b></span>
                    {entry.reason_code && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-600 dark:text-amber-300">{entry.reason_code}</span>
                    )}
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true">
                    <div className="h-full bg-sky-500" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {typeCounts.length > 0 && (
        <div className="space-y-1 border-t border-slate-200 dark:border-slate-700 pt-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{tr('uiTask.work_lanes.by_type')}</p>
          <ul className="space-y-1">
            {typeCounts.map(([taskType, counts]) => (
              <li key={taskType} className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                <TaskTypeBadge taskType={taskType} />
                {TYPE_COUNT_STATUSES.map((status) => (
                  <span key={status}>{stats[status] || status} <b className="font-mono">{nf(counts[status] ?? 0)}</b></span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default WorkLanesPanel;
