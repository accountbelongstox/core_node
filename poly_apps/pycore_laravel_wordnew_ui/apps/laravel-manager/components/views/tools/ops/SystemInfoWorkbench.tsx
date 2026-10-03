/** System Information: CPU / memory / disk gauges, host facts, directories and mounts, plus service and process tabs. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Cpu, FolderTree, Globe, HardDrive, Layers, ListTree, Server } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Chips, Gauge, Notice, OpsPage, OpsStatusBar, Panel, Seg, StatusDot, ToneBar } from './opsKit';
import { useInterval, useRemote } from './opsHooks';
import { formatBytes, loadPercent, memoryUsage, parseUptime, parseUsePercent, percentTone, pickRootMount, realMounts } from './opsLogic';
import { ProcessesTab, ServicesTab } from './SystemServicesTabs';
import type { StorageData, SystemInfoData } from './opsTypes';

type Tab = 'overview' | 'services' | 'processes';

const REFRESH_CHOICES = [30, 60, 120];
const EXTENSION_PREVIEW = 24;

const Fact: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-700/50">
    <dt className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="min-w-0 truncate text-right font-mono text-xs text-slate-800 dark:text-slate-100">{children}</dd>
  </div>
);

const SystemInfoWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [auto, setAuto] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [allExtensions, setAllExtensions] = useState(false);
  const info = useRemote(() => callToolApi<SystemInfoData>(tool.apiMethod, { fresh: true }), [], tab === 'overview');
  const storage = useRemote(() => callToolApi<StorageData>('serverManagerV1.getStorage'), [], tab === 'overview');
  const refresh = (silent: boolean): void => { void info.reload(silent); void storage.reload(silent); };
  useInterval(() => refresh(true), auto && tab === 'overview' ? seconds * 1000 : null);

  const data = info.data;
  const cores = data?.hardware_info?.cpu_info?.cores ?? 0;
  const load = data?.hardware_info?.load_average ?? [];
  const cpuPercent = loadPercent(load[0], cores);
  const memory = memoryUsage(data?.hardware_info?.memory_info);
  const mounts = realMounts(storage.data?.disk_usage ?? []);
  const root = pickRootMount(storage.data?.disk_usage ?? []);
  const diskPercent = root ? parseUsePercent(root.use_percent) : 0;
  const basic = data?.basic_info;
  const uptime = parseUptime(basic?.uptime);
  const extensions = data?.php_config?.extensions ?? [];
  const cache = data?.laravel_info?.cache_info;

  return (
    <OpsPage>
      <Seg
        accent="teal"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: t('toolsOps.system.tab_overview'), icon: Activity },
          { value: 'services', label: t('toolsOps.system.tab_services'), icon: Layers },
          { value: 'processes', label: t('toolsOps.system.tab_processes'), icon: ListTree },
        ]}
      />

      {tab === 'services' && <ServicesTab />}
      {tab === 'processes' && <ProcessesTab />}

      {tab === 'overview' && (
        <>
          <OpsStatusBar
            accent="teal"
            mode="server"
            updatedAt={info.updatedAt}
            loading={info.loading || storage.loading}
            onRefresh={() => refresh(false)}
            auto={{ on: auto, onChange: setAuto }}
            trailing={auto ? <Chips accent="teal" value={seconds} onChange={setSeconds} options={REFRESH_CHOICES.map((value) => ({ value, label: `${value}s` }))} /> : undefined}
          >
            {basic ? `${basic.hostname ?? ''}${uptime ? ` · ${t('toolsOps.system.uptime', { value: uptime })}` : ''}` : t('toolsOps.common.loading')}
          </OpsStatusBar>
          {info.error && <Notice tone="error">{info.error}</Notice>}
          {storage.error && <Notice tone="warn">{storage.error}</Notice>}
          {auto && <Notice tone="info">{t('toolsOps.system.auto_cost')}</Notice>}

          <div className="grid gap-3 md:grid-cols-3">
            <Gauge
              percent={cpuPercent}
              tone={percentTone(cpuPercent)}
              label={t('toolsOps.system.cpu')}
              detail={data ? `${t('toolsOps.system.load_avg')}: ${load.map((value) => value.toFixed(2)).join(' / ')} · ${t('toolsOps.system.cores', { count: cores })}` : undefined}
            />
            <Gauge
              percent={memory.percent}
              tone={percentTone(memory.percent)}
              label={t('toolsOps.system.memory')}
              detail={data ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}` : undefined}
            />
            <Gauge
              percent={diskPercent}
              tone={percentTone(diskPercent)}
              label={t('toolsOps.system.disk')}
              detail={root ? `${root.used} / ${root.size} · ${root.mounted_on}` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t('toolsOps.system.host')} icon={Server} accent="teal">
              <dl>
                <Fact label={t('toolsOps.system.hostname')}>{basic?.hostname ?? '-'}</Fact>
                <Fact label={t('toolsOps.system.os')}><span title={basic?.operating_system}>{basic?.operating_system ?? '-'}</span></Fact>
                <Fact label={t('toolsOps.system.cpu_model')}><span title={data?.hardware_info?.cpu_info?.model}>{data?.hardware_info?.cpu_info?.model ?? '-'}</span></Fact>
                <Fact label="PHP">{basic?.php_version ?? '-'}</Fact>
                <Fact label="Laravel">{basic?.laravel_version ?? '-'}</Fact>
                <Fact label={t('toolsOps.system.timezone')}>{basic?.timezone ?? '-'}</Fact>
                <Fact label={t('toolsOps.system.server_time')}>{basic?.server_time ?? '-'}</Fact>
              </dl>
            </Panel>

            <Panel title={t('toolsOps.system.runtime')} icon={Cpu} accent="teal">
              <dl>
                <Fact label={t('toolsOps.system.environment')}>{data?.laravel_info?.environment ?? '-'}</Fact>
                <Fact label={t('toolsOps.system.debug')}>
                  {data?.laravel_info ? <Pill tone={data.laravel_info.debug_mode ? 'amber' : 'emerald'} tint>{data.laravel_info.debug_mode ? t('toolsOps.system.on') : t('toolsOps.system.off')}</Pill> : '-'}
                </Fact>
                <Fact label={t('toolsOps.system.app_url')}>{data?.laravel_info?.app_url ?? '-'}</Fact>
                <Fact label="memory_limit">{data?.php_config?.memory_limit ?? '-'}</Fact>
                <Fact label="max_execution_time">{data?.php_config?.max_execution_time ?? '-'}</Fact>
                <Fact label="upload_max_filesize">{data?.php_config?.upload_max_filesize ?? '-'}</Fact>
                <Fact label="post_max_size">{data?.php_config?.post_max_size ?? '-'}</Fact>
              </dl>
              {cache && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(['config_cached', 'routes_cached', 'events_cached', 'views_cached'] as const).map((key) => (
                    <Pill key={key} tone={cache[key] ? 'emerald' : 'neutral'} tint>{t(`toolsOps.system.cache_${key}`)}</Pill>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t('toolsOps.system.storage')} icon={HardDrive} accent="teal" bodyClassName="space-y-3 p-4">
              {mounts.map((mount) => {
                const percent = parseUsePercent(mount.use_percent);
                return (
                  <div key={`${mount.filesystem}-${mount.mounted_on}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate font-mono text-slate-700 dark:text-slate-200" title={mount.filesystem}>{mount.mounted_on}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{mount.used} / {mount.size} · {mount.use_percent}</span>
                    </div>
                    <ToneBar percent={percent} tone={percentTone(percent)} label={mount.mounted_on} />
                  </div>
                );
              })}
              {mounts.length === 0 && <p className="text-sm text-slate-400">{storage.loading ? t('toolsOps.common.loading') : t('toolsOps.system.no_mounts')}</p>}
            </Panel>

            <Panel title={t('toolsOps.system.directories')} icon={FolderTree} accent="teal" bodyClassName="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {Object.entries(data?.directory_status ?? {}).map(([name, dir]) => (
                  <li key={name} className="flex items-center gap-3 px-4 py-2">
                    <StatusDot on={dir.exists} title={dir.exists ? t('toolsOps.system.exists') : t('toolsOps.system.missing')} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800 dark:text-slate-100">{name}</p>
                      <p className="truncate font-mono text-[11px] text-slate-400" title={dir.path}>{dir.path}</p>
                    </div>
                    <span className="flex shrink-0 gap-1">
                      <Pill tone={dir.readable ? 'emerald' : 'rose'}>R</Pill>
                      <Pill tone={dir.writable ? 'emerald' : 'neutral'}>W</Pill>
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">{formatBytes(dir.size)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t('toolsOps.system.network')} icon={Globe} accent="teal">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">{(data?.network_info?.interfaces ?? []).map((name) => <Pill key={name} tone="sky" tint>{name}</Pill>)}</div>
                <dl><Fact label="DNS">{(data?.network_info?.dns_servers ?? []).join(', ') || '-'}</Fact></dl>
              </div>
            </Panel>
            <Panel
              title={t('toolsOps.system.extensions', { count: extensions.length })}
              icon={Layers}
              accent="teal"
              actions={extensions.length > EXTENSION_PREVIEW ? <button type="button" onClick={() => setAllExtensions(!allExtensions)} className="text-xs text-teal-600 hover:underline dark:text-teal-300">{allExtensions ? t('toolsOps.system.show_less') : t('toolsOps.system.show_all')}</button> : undefined}
            >
              <div className="flex flex-wrap gap-1.5">{(allExtensions ? extensions : extensions.slice(0, EXTENSION_PREVIEW)).map((name) => <Pill key={name}>{name}</Pill>)}</div>
            </Panel>
          </div>
        </>
      )}
    </OpsPage>
  );
};

export default SystemInfoWorkbench;
