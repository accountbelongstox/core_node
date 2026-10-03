/** System Information tabs that load on demand: service status groups and the process table. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Search, Server } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { callToolApi } from '../toolRunner';
import { Chips, controlClass, EmptyBlock, Metric, Notice, OpsStatusBar, Panel, StatusDot, ToneBar } from './opsKit';
import { useInterval, useRemote } from './opsHooks';
import { percentTone } from './opsLogic';
import type { ProcessesData, ServiceRow, ServicesData } from './opsTypes';

const PROCESS_LIMIT = 40;
const PROCESS_REFRESH_MS = 10000;
type ProcessSort = 'cpu' | 'memory';

const ServiceGroup: React.FC<{ title: string; rows: ServiceRow[] }> = ({ title, rows }) => {
  const { t } = useTranslation();
  return (
    <Panel title={`${title} (${rows.length})`} icon={Server} accent="teal" bodyClassName="p-0">
      {rows.length === 0 ? (
        <EmptyBlock icon={Server}>{t('toolsOps.system.no_services')}</EmptyBlock>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-3 px-4 py-2.5">
              <StatusDot on={row.active} title={row.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-slate-800 dark:text-slate-100">{row.name}</p>
                <p className="truncate text-[11px] text-slate-400">{[row.pid ? `PID ${row.pid}` : null, row.memory, row.uptime].filter(Boolean).join(' · ')}</p>
              </div>
              <Pill tone={row.active ? 'emerald' : 'neutral'} tint>{row.active ? t('toolsOps.system.running') : t('toolsOps.system.stopped')}</Pill>
              <Pill tone={row.enabled ? 'sky' : 'neutral'}>{row.enabled ? t('toolsOps.system.autostart_on') : t('toolsOps.system.autostart_off')}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

export const ServicesTab: React.FC = () => {
  const { t } = useTranslation();
  const services = useRemote(() => callToolApi<ServicesData>('serverManagerV1.getServices'), []);
  const summary = services.data?.summary;
  const list = (group: Record<string, ServiceRow> | undefined): ServiceRow[] => Object.values(group ?? {});
  return (
    <div className="space-y-4">
      <OpsStatusBar accent="teal" mode="server" updatedAt={services.updatedAt} loading={services.loading} onRefresh={() => void services.reload()}>
        {summary ? t('toolsOps.system.services_status', { running: summary.system_running + summary.octane_running + summary.apps_running, total: summary.system_total + summary.octane_total + summary.apps_total }) : t('toolsOps.common.loading')}
      </OpsStatusBar>
      {services.error && <Notice tone="error">{services.error}</Notice>}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Metric label={t('toolsOps.system.group_system')} value={`${summary.system_running} / ${summary.system_total}`} />
          <Metric label={t('toolsOps.system.group_octane')} value={`${summary.octane_running} / ${summary.octane_total}`} />
          <Metric label={t('toolsOps.system.group_apps')} value={`${summary.apps_running} / ${summary.apps_total}`} />
        </div>
      )}
      {services.data && (
        <>
          <ServiceGroup title={t('toolsOps.system.group_system')} rows={list(services.data.system_services)} />
          <ServiceGroup title={t('toolsOps.system.group_octane')} rows={list(services.data.octane_services)} />
          <ServiceGroup title={t('toolsOps.system.group_apps')} rows={list(services.data.application_services)} />
        </>
      )}
    </div>
  );
};

export const ProcessesTab: React.FC = () => {
  const { t } = useTranslation();
  const [sort, setSort] = useState<ProcessSort>('cpu');
  const [search, setSearch] = useState('');
  const [auto, setAuto] = useState(false);
  const processes = useRemote(() => callToolApi<ProcessesData>('serverManagerV1.getProcesses'), []);
  useInterval(() => void processes.reload(true), auto ? PROCESS_REFRESH_MS : null);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (processes.data?.processes ?? [])
      .filter((row) => !query || `${row.command} ${row.user} ${row.pid}`.toLowerCase().includes(query))
      .sort((a, b) => b[sort] - a[sort])
      .slice(0, PROCESS_LIMIT);
  }, [processes.data, search, sort]);
  return (
    <div className="space-y-4">
      <OpsStatusBar accent="teal" mode="server" updatedAt={processes.updatedAt} loading={processes.loading} onRefresh={() => void processes.reload()} auto={{ on: auto, onChange: setAuto }}>
        {t('toolsOps.system.processes_status', { count: processes.data?.total_count ?? 0 })}
      </OpsStatusBar>
      {processes.error && <Notice tone="error">{processes.error}</Notice>}
      <Panel
        title={t('toolsOps.system.top_processes')}
        icon={Cpu}
        accent="teal"
        actions={<Chips accent="teal" value={sort} onChange={setSort} options={[{ value: 'cpu', label: 'CPU %' }, { value: 'memory', label: 'MEM %' }]} />}
        bodyClassName="p-0"
      >
        <div className="relative border-b border-slate-100 p-3 dark:border-slate-700/50">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('toolsOps.common.search')} className={`${controlClass('teal')} pl-9`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-4 py-2">PID</th><th className="px-2 py-2">{t('toolsOps.system.col_user')}</th><th className="w-28 px-2 py-2">CPU %</th><th className="w-28 px-2 py-2">MEM %</th><th className="px-2 py-2">{t('toolsOps.system.col_command')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {rows.map((row) => (
                <tr key={`${row.pid}-${row.command}`}>
                  <td className="px-4 py-1.5 font-mono tabular-nums">{row.pid}</td>
                  <td className="px-2 py-1.5">{row.user}</td>
                  <td className="px-2 py-1.5"><div className="flex items-center gap-2"><span className="w-9 tabular-nums">{row.cpu.toFixed(1)}</span><ToneBar percent={Math.min(100, row.cpu)} tone={percentTone(row.cpu)} /></div></td>
                  <td className="px-2 py-1.5"><div className="flex items-center gap-2"><span className="w-9 tabular-nums">{row.memory.toFixed(1)}</span><ToneBar percent={Math.min(100, row.memory)} tone={percentTone(row.memory)} /></div></td>
                  <td className="max-w-[18rem] truncate px-2 py-1.5 font-mono text-slate-500 dark:text-slate-400" title={row.command}>{row.command}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
