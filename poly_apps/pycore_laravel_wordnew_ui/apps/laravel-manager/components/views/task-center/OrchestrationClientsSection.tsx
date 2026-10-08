/**
 * Task Center — orchestration monitor sections about wordnew devices and the
 * two schedulers: per-device activity (route, channels, clip counts), wordnew
 * online scheduling (R12 windows a device holds) and Laravel scheduling
 * (plans with app_led / laravel_fallback mode, layout TTL, pool, leases).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { commonClasses } from '@/shared/styles/theme';
import type {
  OrchClientAssignment,
  OrchClientKindCounts,
  OrchClientReport,
  OrchClientTask,
  WorkMonitorPlan,
  WorkNode,
  WorkPoolEntry,
} from '../../../../../core/contracts/QueueCenterTypes';
import { shortId, TaskTypeBadge } from './shared';
import {
  ageSeconds,
  Chip,
  Dot,
  formatAge,
  nf,
  ORCH_CLIENT_TTL_SECONDS,
  SectionTitle,
  Th,
  toMs,
  useAgeText,
} from './orchestrationFormat';

interface OrchClientsSectionProps {
  clients: OrchClientReport[];
  now: number;
  loaded: boolean;
}

interface OrchSchedulingSectionProps {
  clients: OrchClientReport[];
  plans: WorkMonitorPlan[];
  pool: WorkPoolEntry[];
  nodes: WorkNode[];
  now: number;
}

const userLabel = (user: OrchClientReport['user']): string => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  return user.name || user.email || (user.id !== undefined ? String(user.id) : '');
};

const KindRow: React.FC<{ kind: string; counts: OrchClientKindCounts }> = ({ kind, counts }) => {
  const generating = counts.generating ?? {};
  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-2 py-1 font-mono text-[11px]">{kind}</td>
      <td className="px-2 py-1">{counts.lane ? <TaskTypeBadge taskType={counts.lane} /> : '—'}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(counts.total)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(counts.queued)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(counts.loading)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px] text-green-600 dark:text-green-400">{nf(counts.done)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px] text-amber-600 dark:text-amber-400">{nf(counts.missing)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(generating.pycore)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(generating.relay)}</td>
      <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(generating.laravel)}</td>
    </tr>
  );
};

const TaskBlock: React.FC<{ task: OrchClientTask }> = ({ task }) => {
  const { t: tr } = useTranslation();
  const kinds = Object.entries(task.counts ?? {});
  const stages = Object.entries(task.stages ?? {});
  return (
    <div className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono" title={task.task_id}>{shortId(task.task_id)}</span>
        {task.plan_id && <Chip tone="info" title={tr('uiTask.orch.plan')}>{shortId(task.plan_id)}</Chip>}
        {task.state && <Chip tone="warn">{task.state}</Chip>}
        {stages.map(([stage, state]) => (
          <Chip key={stage} tone="off" title={tr('uiTask.orch.stage')}>{stage}: {state}</Chip>
        ))}
      </div>
      {kinds.length === 0 ? (
        <p className="text-[11px] text-slate-500">{tr('uiTask.orch.no_counts')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-slate-700 dark:text-slate-200">
            <thead>
              <tr>
                <Th>{tr('uiTask.orch.col_kind')}</Th>
                <Th>{tr('uiTask.orch.col_lane')}</Th>
                <Th right>{tr('uiTask.orch.col_total')}</Th>
                <Th right>{tr('uiTask.orch.col_queued')}</Th>
                <Th right>{tr('uiTask.orch.col_loading')}</Th>
                <Th right>{tr('uiTask.orch.col_done')}</Th>
                <Th right>{tr('uiTask.orch.col_missing')}</Th>
                <Th right>{tr('uiTask.orch.col_gen_pycore')}</Th>
                <Th right>{tr('uiTask.orch.col_gen_relay')}</Th>
                <Th right>{tr('uiTask.orch.col_gen_laravel')}</Th>
              </tr>
            </thead>
            <tbody>
              {kinds.map(([kind, counts]) => <KindRow key={kind} kind={kind} counts={counts ?? {}} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** Seconds since the page changed: the device's own clock gives the span up to its report, the server's clock the rest. */
const routeAge = (client: OrchClientReport, now: number): number => {
  const changed = toMs(client.route?.changed_at);
  const sent = toMs(client.sent_at);
  const sinceReport = ageSeconds(client.last_seen_at ?? client.sent_at, now);
  if (!Number.isFinite(changed) || !Number.isFinite(sent) || !Number.isFinite(sinceReport)) return ageSeconds(client.route?.changed_at, now);
  return sinceReport + Math.max(0, Math.floor((sent - changed) / 1000));
};

const DeviceCard: React.FC<{ client: OrchClientReport; now: number }> = ({ client, now }) => {
  const { t: tr } = useTranslation();
  const ageText = useAgeText();
  const seen = client.last_seen_at ?? client.sent_at;
  const online = client.online ?? ageSeconds(seen, now) <= ORCH_CLIENT_TTL_SECONDS;
  const channels = client.channels ?? {};
  const pycore = channels.selected_pycore;
  const route = client.route;
  const user = userLabel(client.user);
  const channelItems: Array<[string, boolean | undefined]> = [
    ['direct', channels.direct],
    ['lan', channels.lan],
    ['relay', channels.relay],
    ['laravel', channels.laravel],
  ];
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Dot on={online} title={tr(online ? 'uiTask.orch.online' : 'uiTask.orch.offline')} />
        <span className="font-mono font-semibold" title={client.device_id}>{shortId(client.device_id)}</span>
        {user && <span className="text-slate-600 dark:text-slate-300">{user}</span>}
        {client.platform && <Chip tone="info">{tr(`uiTask.orch.platform_${client.platform}`, { defaultValue: client.platform })}</Chip>}
        {client.app_version && <span className="font-mono text-[11px] text-slate-500">v{client.app_version}</span>}
        <Chip on={client.foreground === true} tone={client.foreground === true ? 'ok' : 'off'}>
          {tr(client.foreground === true ? 'uiTask.orch.foreground' : 'uiTask.orch.background')}
        </Chip>
        <span className="ml-auto text-[11px] text-slate-500" title={typeof seen === 'string' ? seen : undefined}>
          {tr('uiTask.orch.last_seen')} {ageText(seen, now)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {tr('uiTask.orch.active_page')}{' '}
          <b className="font-mono text-slate-700 dark:text-slate-200">{route?.tab || '—'}</b>
          {route?.item ? <span className="font-mono"> / {route.item}</span> : null}
          {route?.changed_at !== undefined && route?.changed_at !== null && (
            <span> ({formatAge(routeAge(client, now), tr('uiTask.shared.never'))})</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {tr('uiTask.orch.channels')}
          {channelItems.map(([key, on]) => (
            <Chip key={key} on={on === true}>{tr(`uiTask.orch.channel_${key}`)}</Chip>
          ))}
        </span>
        <span>
          {tr('uiTask.orch.selected_pycore')}{' '}
          <b className="font-mono text-slate-700 dark:text-slate-200">{pycore?.host || '—'}</b>
          {pycore?.node_sid ? <span className="font-mono"> ({pycore.node_sid})</span> : null}
        </span>
        {channels.laravel_endpoint_id && (
          <span>{tr('uiTask.orch.laravel_endpoint')} <b className="font-mono text-slate-700 dark:text-slate-200">{channels.laravel_endpoint_id}</b></span>
        )}
      </div>

      {(client.tasks ?? []).length === 0
        ? <p className="text-[11px] text-slate-500">{tr('uiTask.orch.no_tasks')}</p>
        : (client.tasks ?? []).map((task) => <TaskBlock key={task.task_id} task={task} />)}
    </div>
  );
};

export const OrchClientsSection: React.FC<OrchClientsSectionProps> = ({ clients, now, loaded }) => {
  const { t: tr } = useTranslation();
  return (
    <section className={`${commonClasses.card} p-4 space-y-3`}>
      <SectionTitle title={tr('uiTask.orch.devices_title')} hint={tr('uiTask.orch.devices_hint')} count={clients.length} />
      {loaded && clients.length === 0 && <p className="text-xs text-slate-500">{tr('uiTask.orch.no_devices')}</p>}
      <div className="space-y-2">
        {clients.map((client) => <DeviceCard key={`${client.device_id}:${client.instance_id ?? ''}`} client={client} now={now} />)}
      </div>
    </section>
  );
};

const AssignmentBlock: React.FC<{ client: OrchClientReport; assignment: OrchClientAssignment; now: number }> = ({ client, assignment, now }) => {
  const { t: tr } = useTranslation();
  const reported = ageSeconds(client.last_seen_at ?? client.sent_at, now);
  const remaining = typeof assignment.expires_in === 'number'
    ? Math.max(0, assignment.expires_in - (Number.isFinite(reported) ? reported : 0))
    : null;
  const share = Object.entries(assignment.direct_share ?? {});
  const windows = assignment.windows ?? [];
  return (
    <div className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono" title={client.device_id}>{shortId(client.device_id)}</span>
        <Chip tone="info" title={assignment.plan_id}>{shortId(assignment.plan_id)}</Chip>
        <Chip tone={assignment.fresh ? 'ok' : 'warn'}>{tr(assignment.fresh ? 'uiTask.orch.fresh' : 'uiTask.orch.stale')}</Chip>
        <span className="text-slate-500">
          {tr('uiTask.orch.expires')} <b className="font-mono">{remaining === null ? '—' : formatAge(remaining, '—')}</b>
        </span>
        <span className="text-slate-500">{tr('uiTask.orch.direct_share')}</span>
        {share.length === 0 && <span className="text-slate-400">—</span>}
        {share.map(([lane, count]) => (
          <span key={lane} className="inline-flex items-center gap-1"><TaskTypeBadge taskType={lane} /><b className="font-mono">{nf(count)}</b></span>
        ))}
      </div>
      {windows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-slate-700 dark:text-slate-200">
            <thead>
              <tr>
                <Th>{tr('uiTask.orch.col_sid')}</Th>
                <Th>{tr('uiTask.orch.col_lane')}</Th>
                <Th>{tr('uiTask.orch.col_language')}</Th>
                <Th right>{tr('uiTask.orch.col_count')}</Th>
                <Th right>{tr('uiTask.orch.col_assigned')}</Th>
                <Th right>{tr('uiTask.orch.col_generating')}</Th>
                <Th right>{tr('uiTask.orch.col_done')}</Th>
              </tr>
            </thead>
            <tbody>
              {windows.map((window, index) => (
                <tr key={`${window.sid}:${window.lane}:${window.language}:${index}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 font-mono text-[11px]">{window.sid ? shortId(window.sid) : '—'}</td>
                  <td className="px-2 py-1">{window.lane ? <TaskTypeBadge taskType={window.lane} /> : '—'}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{window.language ?? '—'}</td>
                  <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(window.count)}</td>
                  <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(window.assigned)}</td>
                  <td className="px-2 py-1 text-right font-mono text-[11px]">{nf(window.generating)}</td>
                  <td className="px-2 py-1 text-right font-mono text-[11px] text-green-600 dark:text-green-400">{nf(window.done)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PlanRow: React.FC<{ plan: WorkMonitorPlan; now: number }> = ({ plan, now }) => {
  const { t: tr } = useTranslation();
  const ageText = useAgeText();
  const layout = plan.layout;
  const led = plan.mode === 'app_led';
  const counters = Object.entries(plan.counters ?? {});
  const deviceIds = layout?.device_ids ?? [];
  return (
    <div className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono" title={plan.plan_id}>{shortId(plan.plan_id)}</span>
        {plan.source_key && <span className="font-mono text-slate-500">{plan.source_key}</span>}
        <Chip tone={led ? 'ok' : 'warn'}>{tr(`uiTask.orch.mode_${led ? 'app_led' : 'laravel_fallback'}`)}</Chip>
        {(plan.languages ?? []).map((language) => <Chip key={language} tone="off">{language}</Chip>)}
        {plan.include_words && <Chip tone="info">{tr('uiTask.orch.words')}</Chip>}
        {plan.include_phrases && <Chip tone="info">{tr('uiTask.orch.phrases')}</Chip>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{tr('uiTask.orch.layout_applied')} <b className="font-mono">{layout?.applied_at ? ageText(layout.applied_at, now) : '—'}</b></span>
        <span>{tr('uiTask.orch.layout_ttl')} <b className="font-mono">{typeof layout?.expires_in === 'number' ? formatAge(layout.expires_in, '—') : '—'}</b></span>
        <span title={deviceIds.join(', ')}>{tr('uiTask.orch.layout_devices')} <b className="font-mono">{deviceIds.length}</b></span>
        <span>{tr('uiTask.orch.layout_ranges')} <b className="font-mono">{layout?.ranges?.length ?? 0}</b></span>
        {counters.map(([key, value]) => (
          <span key={key}>{key} <b className="font-mono">{nf(value)}</b></span>
        ))}
      </div>
    </div>
  );
};

export const OrchSchedulingSection: React.FC<OrchSchedulingSectionProps> = ({ clients, plans, pool, nodes, now }) => {
  const { t: tr } = useTranslation();
  const assignments = clients.flatMap((client) => (client.assignments ?? []).map((assignment) => ({ client, assignment })));
  const leaseNodes = nodes.filter((node) => (node.leases ?? 0) > 0);
  const leaseCount = leaseNodes.reduce((sum, node) => sum + (node.leases ?? 0), 0);
  const leasedItems = leaseNodes.reduce((sum, node) => sum + (node.items_leased ?? 0), 0);
  return (
    <>
      <section className={`${commonClasses.card} p-4 space-y-3`}>
        <SectionTitle title={tr('uiTask.orch.wordnew_title')} hint={tr('uiTask.orch.wordnew_hint')} count={assignments.length} />
        {assignments.length === 0 && <p className="text-xs text-slate-500">{tr('uiTask.orch.no_assignments')}</p>}
        <div className="space-y-2">
          {assignments.map(({ client, assignment }) => (
            <AssignmentBlock key={`${client.device_id}:${assignment.plan_id}`} client={client} assignment={assignment} now={now} />
          ))}
        </div>
      </section>

      <section className={`${commonClasses.card} p-4 space-y-3`}>
        <SectionTitle title={tr('uiTask.orch.laravel_title')} hint={tr('uiTask.orch.laravel_hint')} count={plans.length} />
        {plans.length === 0 && <p className="text-xs text-slate-500">{tr('uiTask.orch.no_plans')}</p>}
        <div className="space-y-2">
          {plans.map((plan) => <PlanRow key={plan.plan_id} plan={plan} now={now} />)}
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{tr('uiTask.orch.pool_title')}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {tr('uiTask.orch.leases_total')} <b className="font-mono">{nf(leaseCount)}</b>
            {' · '}{tr('uiTask.orch.leases_items')} <b className="font-mono">{nf(leasedItems)}</b>
            {' · '}{tr('uiTask.orch.leases_nodes')} <b className="font-mono">{leaseNodes.length}</b>
          </p>
          {pool.length === 0 && <p className="text-[11px] text-slate-500">{tr('uiTask.orch.no_pool')}</p>}
          <ul className="space-y-1">
            {pool.map((entry) => {
              const gap = entry.gap ?? entry.count ?? 0;
              const leased = entry.leased ?? 0;
              const share = gap > 0 ? Math.min(100, (leased / gap) * 100) : 0;
              return (
                <li key={`${entry.lane}:${entry.language}`} className="text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3 flex-wrap">
                    <TaskTypeBadge taskType={entry.lane} />
                    <span className="font-mono">{entry.language}</span>
                    <span>{tr('uiTask.work_lanes.gap')} <b className="font-mono">{nf(gap)}</b></span>
                    <span>{tr('uiTask.work_lanes.leased')} <b className="font-mono">{nf(leased)}</b></span>
                    <span>{tr('uiTask.work_lanes.free')} <b className="font-mono">{nf(entry.free ?? Math.max(0, gap - leased))}</b></span>
                    {entry.reason_code && <Chip tone="warn">{entry.reason_code}</Chip>}
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true">
                    <div className="h-full bg-sky-500" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
};
