import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Loader2, MemoryStick, RefreshCw } from 'lucide-react';
import type { WorkNode, WorkPoolEntry } from '@/apps/pycore-manager/api';
import { useWorkNodes } from '../hooks/useWorkNodes';
import { formatElapsed } from '../utils/pcFormat';
import { pcErrorCodeText } from '../utils/pcErrorCodes';

const COMPUTE_CLASSES = ['gpu', 'cpu'] as const;

const nf = (value: number | null | undefined): string => (typeof value === 'number' ? value.toLocaleString() : '—');

function heartbeatAge(iso: string | null): string {
  const ms = Date.parse(iso || '');
  return Number.isFinite(ms) ? formatElapsed((Date.now() - ms) / 1000) : '—';
}

function NodeRow({ node }: { node: WorkNode }): ReactElement {
  const { t } = useTranslation('pc');
  const DeviceIcon = node.compute_class === 'gpu' ? MemoryStick : Cpu;
  return (
    <li className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 space-y-1">
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${node.online ? 'bg-emerald-400' : 'bg-slate-600'}`} title={t(node.online ? 'queueCenter.nodes.online' : 'queueCenter.nodes.offline')} />
        <span className="font-mono text-slate-200 truncate">{node.worker_id}</span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
          <DeviceIcon className="h-3 w-3" />
          {t(`queueCenter.progress.device.${node.compute_class === 'gpu' ? 'gpu' : 'cpu'}`)}
        </span>
        <span className="ml-auto text-[10px] text-slate-500" title={node.last_heartbeat_at ?? ''}>
          {t('queueCenter.nodes.heartbeat', { age: heartbeatAge(node.last_heartbeat_at) })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
        <span>{t('queueCenter.nodes.leased')} <b className="font-mono text-slate-200">{nf(node.items_leased)}</b> / {nf(node.leases)}</span>
        <span>{t('queueCenter.nodes.perHour')} <b className="font-mono text-slate-200">{nf(node.done_per_hour)}</b></span>
        <span>{t('queueCenter.nodes.batch')} <b className="font-mono text-slate-200">{nf(node.batch_size)}</b></span>
        <span>{t('queueCenter.nodes.eta')} <b className="font-mono text-slate-200">{node.eta_seconds == null ? '—' : formatElapsed(node.eta_seconds)}</b></span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
        {Object.entries(node.lanes ?? {}).map(([lane, languages]) => (
          <span key={lane}>
            <span className="text-slate-400">{t(`queueCenter.nodes.lane.${lane}`, { defaultValue: lane })}</span>{' '}
            <span className="font-mono">{(languages ?? []).join(' ') || '—'}</span>
            {node.engines?.[lane]?.length ? <span className="ml-1 text-slate-600">({node.engines[lane].join(', ')})</span> : null}
          </span>
        ))}
      </div>
    </li>
  );
}

function PoolRow({ entry }: { entry: WorkPoolEntry }): ReactElement {
  const { t } = useTranslation('pc');
  const gap = entry.gap ?? entry.count ?? 0;
  const leased = entry.leased ?? 0;
  const share = gap > 0 ? Math.min(100, (leased / gap) * 100) : 0;
  return (
    <li className="space-y-0.5 text-[10px] text-slate-400">
      <div className="flex items-center gap-2">
        <span className="text-slate-300">{t(`queueCenter.nodes.lane.${entry.lane}`, { defaultValue: entry.lane })}</span>
        <span className="font-mono">{entry.language}</span>
        <span>{t('queueCenter.nodes.gap')} <b className="font-mono text-slate-200">{nf(gap)}</b></span>
        <span>{t('queueCenter.nodes.leased')} <b className="font-mono text-slate-200">{nf(leased)}</b></span>
        <span>{t('queueCenter.nodes.free')} <b className="font-mono text-slate-200">{nf(entry.free ?? Math.max(0, gap - leased))}</b></span>
        {entry.reason_code && <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300" title={pcErrorCodeText(entry.reason_code)}>{entry.reason_code}</span>}
      </div>
      <div className="flex h-1 overflow-hidden rounded bg-slate-800" aria-hidden="true">
        <div className="bg-sky-500" style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}

/** Every pycore work node (GPU / CPU) and what it holds, plus the per lane and language pool. */
export function PcWorkNodesPanel(): ReactElement {
  const { t } = useTranslation('pc');
  const { data, loading, failed, reload } = useWorkNodes();
  const nodes = data?.nodes ?? [];
  const pool = data?.pool ?? [];
  return (
    <section className="pc-glass p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.nodes.title')}</span>
        <span className="text-[10px] font-mono text-slate-500">{nodes.filter((node) => node.online).length}/{nodes.length}</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
        <button type="button" onClick={() => void reload()} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass text-rose-500 disabled:opacity-50">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      {failed && !data && <p className="text-[11px] text-rose-400">{t('queueCenter.nodes.unavailable')}</p>}
      {data && nodes.length === 0 && <p className="text-[11px] text-slate-500">{t('queueCenter.nodes.none')}</p>}
      {COMPUTE_CLASSES.map((computeClass) => {
        const group = nodes.filter((node) => (node.compute_class === 'gpu' ? 'gpu' : 'cpu') === computeClass);
        if (group.length === 0) return null;
        return (
          <div key={computeClass} className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {t(`queueCenter.progress.device.${computeClass}`)} · {group.filter((node) => node.online).length}/{group.length}
            </p>
            <ul className="space-y-1.5">{group.map((node) => <NodeRow key={node.worker_id} node={node} />)}</ul>
          </div>
        );
      })}
      {pool.length > 0 && (
        <div className="space-y-1 border-t border-slate-800 pt-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">{t('queueCenter.nodes.pool')}</p>
          <ul className="space-y-1">{pool.map((entry) => <PoolRow key={`${entry.lane}:${entry.language}`} entry={entry} />)}</ul>
        </div>
      )}
    </section>
  );
}
