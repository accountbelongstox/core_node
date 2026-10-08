/**
 * Task Center — orchestration monitor: every pycore work node (Colab CPU /
 * Colab GPU / Kaggle / local) with lane rates, leases, throughput and the
 * resource load it attached to its last claim or renew.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { commonClasses } from '@/shared/styles/theme';
import type { WorkNode, WorkNodeGpuLoad } from '../../../../../core/contracts/QueueCenterTypes';
import { shortId, TaskTypeBadge } from './shared';
import {
  ageSeconds,
  Chip,
  Dot,
  formatAge,
  Meter,
  nf,
  nodePlatformKey,
  ORCH_LOAD_STALE_SECONDS,
  SectionTitle,
  Th,
} from './orchestrationFormat';

interface OrchNodesSectionProps {
  nodes: WorkNode[];
  now: number;
  loaded: boolean;
}

const mb = (value: number | null | undefined): string => (typeof value === 'number' ? `${(value / 1024).toFixed(1)}G` : '—');

const GpuLine: React.FC<{ gpu: WorkNodeGpuLoad }> = ({ gpu }) => {
  const used = gpu.mem_used_mb;
  const total = gpu.mem_total_mb;
  const vramPercent = typeof used === 'number' && typeof total === 'number' && total > 0 ? (used / total) * 100 : null;
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={gpu.name}>#{gpu.index} {gpu.name ?? ''}</div>
      <Meter value={gpu.util_percent} label="GPU" />
      <div className="flex items-center gap-1">
        <Meter value={vramPercent} label="VRAM" />
        <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">{mb(used)}/{mb(total)}</span>
      </div>
    </div>
  );
};

const NodeRow: React.FC<{ node: WorkNode; now: number }> = ({ node, now }) => {
  const { t: tr } = useTranslation();
  const load = node.load;
  const loadAge = ageSeconds(load?.sampled_at ?? node.load_at, now);
  const receivedAge = ageSeconds(node.load_at, now);
  const loadStale = !load || Math.min(loadAge, receivedAge) > ORCH_LOAD_STALE_SECONDS;
  const heartbeatAge = ageSeconds(node.last_heartbeat_at, now);
  const never = tr('uiTask.shared.never');
  const gpus = load?.gpus ?? [];
  const loadLanes = Object.entries(load?.lanes ?? {});
  const rates = Object.entries(node.lane_rates ?? {});
  const platformKey = nodePlatformKey(node);
  return (
    <tr className="border-t border-slate-100 dark:border-slate-800 align-top">
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <Dot on={node.online} title={tr(node.online ? 'uiTask.orch.online' : 'uiTask.orch.offline')} />
          <span className="font-mono text-[11px]" title={node.worker_id}>{node.sid || shortId(node.worker_id)}</span>
        </div>
        {node.label && <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={node.label}>{node.label}</div>}
      </td>
      <td className="px-2 py-2 space-y-1">
        <Chip tone={platformKey === 'local' ? 'off' : 'info'}>{tr(`uiTask.orch.node_platform_${platformKey}`)}</Chip>
        <div><Chip tone={node.compute_class === 'gpu' ? 'ok' : 'off'}>{node.compute_class === 'gpu' ? 'GPU' : 'CPU'}</Chip></div>
      </td>
      <td className="px-2 py-2 space-y-0.5">
        {Object.entries(node.lanes ?? {}).map(([lane, languages]) => (
          <div key={lane} className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
            <TaskTypeBadge taskType={lane} />
            <span className="font-mono">{(languages ?? []).join(' ') || '—'}</span>
            {typeof node.lane_rates?.[lane] === 'number' && <span className="font-mono">{nf(node.lane_rates?.[lane])}/h</span>}
          </div>
        ))}
        {rates.length === 0 && Object.keys(node.lanes ?? {}).length === 0 && <span className="text-slate-400">—</span>}
      </td>
      <td className="px-2 py-2 text-right font-mono text-[11px]">
        {nf(node.leases)}
        <div className="text-[10px] text-slate-500">{nf(node.items_leased)} {tr('uiTask.orch.col_items')}</div>
      </td>
      <td className="px-2 py-2 text-right font-mono text-[11px]">{nf(node.done_per_hour)}</td>
      <td className="px-2 py-2"><Meter value={load?.cpu_percent} label="CPU" /></td>
      <td className="px-2 py-2"><Meter value={load?.mem_percent} label="MEM" /></td>
      <td className="px-2 py-2 space-y-1.5">
        {gpus.length === 0 ? <span className="text-slate-400">—</span> : gpus.map((gpu) => <GpuLine key={gpu.index} gpu={gpu} />)}
      </td>
      <td className="px-2 py-2 space-y-0.5">
        {loadLanes.length === 0 && <span className="text-slate-400">—</span>}
        {loadLanes.map(([lane, state]) => (
          <div key={lane} className="flex items-center gap-1 text-[10px] text-slate-500">
            <TaskTypeBadge taskType={lane} />
            <b className="font-mono text-slate-700 dark:text-slate-200">{nf(state?.in_flight)}</b>
            <span className="font-mono" title={tr('uiTask.orch.part1_part2')}>({nf(state?.part1)}/{nf(state?.part2)})</span>
          </div>
        ))}
      </td>
      <td className="px-2 py-2 text-[10px] text-slate-500 space-y-0.5 whitespace-nowrap">
        <div title={node.load_at ?? undefined}>
          {tr('uiTask.orch.load_at')}{' '}
          <span className={loadStale ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'font-mono'}>
            {formatAge(Math.min(loadAge, receivedAge), never)}
          </span>
        </div>
        <div title={node.last_heartbeat_at ?? undefined}>
          {tr('uiTask.orch.heartbeat')} <span className="font-mono">{formatAge(heartbeatAge, never)}</span>
        </div>
        {loadStale && load !== undefined && load !== null && <Chip tone="warn">{tr('uiTask.orch.load_stale')}</Chip>}
        {!load && <Chip tone="off">{tr('uiTask.orch.load_none')}</Chip>}
      </td>
    </tr>
  );
};

export const OrchNodesSection: React.FC<OrchNodesSectionProps> = ({ nodes, now, loaded }) => {
  const { t: tr } = useTranslation();
  return (
    <section className={`${commonClasses.card} p-4 space-y-3`}>
      <SectionTitle title={tr('uiTask.orch.nodes_title')} hint={tr('uiTask.orch.nodes_hint')} count={nodes.length} />
      {loaded && nodes.length === 0 && <p className="text-xs text-slate-500">{tr('uiTask.orch.no_nodes')}</p>}
      {nodes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-slate-700 dark:text-slate-200">
            <thead>
              <tr>
                <Th>{tr('uiTask.orch.col_node')}</Th>
                <Th>{tr('uiTask.orch.col_platform')}</Th>
                <Th>{tr('uiTask.orch.col_lanes')}</Th>
                <Th right>{tr('uiTask.orch.col_leases')}</Th>
                <Th right>{tr('uiTask.orch.col_done_hour')}</Th>
                <Th>CPU</Th>
                <Th>{tr('uiTask.orch.col_mem')}</Th>
                <Th>GPU</Th>
                <Th>{tr('uiTask.orch.col_in_flight')}</Th>
                <Th>{tr('uiTask.orch.col_staleness')}</Th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => <NodeRow key={node.worker_id} node={node} now={now} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
