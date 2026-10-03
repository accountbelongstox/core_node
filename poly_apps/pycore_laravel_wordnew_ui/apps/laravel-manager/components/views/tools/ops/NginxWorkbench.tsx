/** Nginx Manager: site status table with enable / disable, config viewer, config test and reload. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Lock, Play, Power, RotateCw, Search, ShieldCheck } from 'lucide-react';
import { Pill } from '@/shared/ui/Pill';
import type { StatusTone } from '@/shared/ui/statusTone';
import { callToolApi } from '../toolRunner';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, Console, controlClass, EmptyBlock, IconBtn, Metric, Notice, OpsPage, OpsStatusBar, Panel, Sheet, Spinner, StatusDot } from './opsKit';
import { describeError, useInterval, useRemote } from './opsHooks';
import { certTone } from './opsLogic';
import type { NginxConfigData, NginxReloadData, NginxSiteRow, NginxSitesData, NginxTestData } from './opsTypes';

type Filter = 'all' | 'enabled' | 'disabled' | 'ssl' | 'expiring';

interface Outcome {
  kind: 'test' | 'reload';
  ok: boolean;
  text: string;
}

const REFRESH_MS = 30000;
const EXPIRING_DAYS = 30;
const CERT_TONE: Record<'ok' | 'warn' | 'crit', StatusTone> = { ok: 'emerald', warn: 'amber', crit: 'rose' };

const NginxWorkbench: React.FC<ToolWorkbenchProps> = ({ tool }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [config, setConfig] = useState<{ site: string; data: NginxConfigData | null; error: string | null } | null>(null);
  const sites = useRemote(() => callToolApi<NginxSitesData>(tool.apiMethod), []);
  useInterval(() => void sites.reload(true), auto ? REFRESH_MS : null);
  const rows = useMemo(() => sites.data?.sites ?? [], [sites.data]);
  const expiring = (row: NginxSiteRow): boolean => Boolean(row.cert_expiry && row.cert_expiry.days_left <= EXPIRING_DAYS);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => (filter === 'all' ? true : filter === 'enabled' ? row.enabled : filter === 'disabled' ? !row.enabled : filter === 'ssl' ? row.ssl_enabled : expiring(row)))
      .filter((row) => !query || `${row.site_name} ${row.domain} ${(row.server_names ?? []).join(' ')} ${row.proxy_pass ?? ''} ${row.www_dir}`.toLowerCase().includes(query));
  }, [rows, filter, search]);

  const guard = async (key: string, task: () => Promise<void>): Promise<void> => {
    setBusy(key);
    setFailure(null);
    try {
      await task();
    } catch (err) {
      setFailure(describeError(t, err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (row: NginxSiteRow): Promise<void> => {
    const message = t(row.enabled ? 'toolsOps.nginx.confirm_disable' : 'toolsOps.nginx.confirm_enable', { name: row.site_name });
    if (!window.confirm(message)) return Promise.resolve();
    return guard(row.site_name, async () => {
      await callToolApi(row.enabled ? 'serverManagerV1.disableNginxSite' : 'serverManagerV1.enableNginxSite', row.site_name);
      await sites.reload(true);
    });
  };

  const testConfig = (): Promise<void> => guard('test', async () => {
    const data = await callToolApi<NginxTestData>('serverManagerV1.testNginxConfig');
    setOutcome({ kind: 'test', ok: data.valid, text: [data.output, data.error].filter(Boolean).join('\n') });
  });

  const reload = (): Promise<void> => {
    if (!window.confirm(t('toolsOps.nginx.confirm_reload'))) return Promise.resolve();
    return guard('reload', async () => {
      const data = await callToolApi<NginxReloadData>('serverManagerV1.reloadNginx');
      setOutcome({ kind: 'reload', ok: data.reloaded, text: [data.test_output, data.output, data.error].filter(Boolean).join('\n') });
    });
  };

  const viewConfig = async (row: NginxSiteRow): Promise<void> => {
    setConfig({ site: row.site_name, data: null, error: null });
    try {
      const data = await callToolApi<NginxConfigData>('serverManagerV1.getNginxSiteConfig', row.site_name);
      setConfig({ site: row.site_name, data, error: null });
    } catch (err) {
      setConfig({ site: row.site_name, data: null, error: describeError(t, err) });
    }
  };

  const filterOptions: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: `${t('toolsOps.nginx.filter_all')} (${rows.length})` },
    { value: 'enabled', label: `${t('toolsOps.nginx.filter_enabled')} (${sites.data?.enabled_sites ?? 0})` },
    { value: 'disabled', label: `${t('toolsOps.nginx.filter_disabled')} (${sites.data?.disabled_sites ?? 0})` },
    { value: 'ssl', label: `SSL (${rows.filter((row) => row.ssl_enabled).length})` },
    { value: 'expiring', label: `${t('toolsOps.nginx.filter_expiring')} (${rows.filter(expiring).length})` },
  ];

  return (
    <OpsPage>
      <OpsStatusBar
        accent="teal"
        mode="server"
        updatedAt={sites.updatedAt}
        loading={sites.loading}
        onRefresh={() => void sites.reload()}
        auto={{ on: auto, onChange: setAuto }}
        trailing={(
          <>
            <Btn size="sm" icon={ShieldCheck} loading={busy === 'test'} onClick={() => void testConfig()} disabled={busy !== null}>{t('toolsOps.nginx.test')}</Btn>
            <Btn size="sm" variant="dangerSoft" icon={RotateCw} loading={busy === 'reload'} onClick={() => void reload()} disabled={busy !== null}>{t('toolsOps.nginx.reload')}</Btn>
          </>
        )}
      >
        {sites.data ? t('toolsOps.nginx.status', { enabled: sites.data.enabled_sites, total: sites.data.total_sites }) : t('toolsOps.common.loading')}
      </OpsStatusBar>
      {sites.error && <Notice tone="error">{sites.error}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
      {outcome && (
        <Panel title={t(outcome.kind === 'test' ? 'toolsOps.nginx.test_result' : 'toolsOps.nginx.reload_result')} icon={ShieldCheck} accent="teal" actions={<Pill tone={outcome.ok ? 'emerald' : 'rose'} tint>{outcome.ok ? t('toolsOps.nginx.ok') : t('toolsOps.nginx.failed')}</Pill>}>
          <Console tone={outcome.ok ? 'out' : 'err'}>{outcome.text || t('toolsOps.nginx.no_output')}</Console>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={t('toolsOps.nginx.filter_all')} value={rows.length} icon={Power} />
        <Metric label={t('toolsOps.nginx.filter_enabled')} value={sites.data?.enabled_sites ?? 0} valueClassName="text-emerald-600 dark:text-emerald-400" />
        <Metric label="SSL" value={rows.filter((row) => row.ssl_enabled).length} icon={Lock} />
        <Metric label={t('toolsOps.nginx.filter_expiring')} value={rows.filter(expiring).length} valueClassName={rows.some(expiring) ? 'text-amber-600 dark:text-amber-400' : undefined} />
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('toolsOps.common.search')} className={`${controlClass('teal')} pl-9`} />
        </div>
        <Chips accent="teal" value={filter} onChange={setFilter} options={filterOptions} nowrap />
      </div>

      <Panel bodyClassName="p-0">
        {visible.length === 0 ? (
          <EmptyBlock icon={Power}>{sites.loading ? t('toolsOps.common.loading') : t('toolsOps.nginx.empty')}</EmptyBlock>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {visible.map((row) => {
              const days = row.cert_expiry?.days_left;
              const target = row.proxy_pass || row.www_dir;
              return (
                <li key={row.site_name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <StatusDot on={row.enabled} title={row.enabled ? t('toolsOps.nginx.filter_enabled') : t('toolsOps.nginx.filter_disabled')} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.domain || row.site_name}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400" title={target}>{row.site_name}{target ? ` → ${target}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone="sky" tint>{row.site_type}</Pill>
                    {(row.listen_ports ?? []).slice(0, 3).map((port) => <Pill key={port}>{port}</Pill>)}
                    {row.ssl_enabled && (
                      <Pill icon={Lock} tone={days !== undefined ? CERT_TONE[certTone(days)] : 'neutral'} tint>
                        {days === undefined ? 'SSL' : days < 0 ? t('toolsOps.nginx.cert_expired') : t('toolsOps.nginx.cert_days', { days })}
                      </Pill>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconBtn icon={FileCode} title={t('toolsOps.nginx.view_config')} onClick={() => void viewConfig(row)} />
                    {busy === row.site_name ? <Spinner className="h-4 w-4 text-teal-500" /> : (
                      <IconBtn icon={row.enabled ? Power : Play} title={row.enabled ? t('toolsOps.nginx.disable') : t('toolsOps.nginx.enable')} active={row.enabled} onClick={() => void toggle(row)} disabled={busy !== null} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Sheet open={config !== null} onClose={() => setConfig(null)} title={config?.site ?? ''} subtitle={config?.data ? `${config.data.config_file} · ${config.data.lines} ${t('toolsOps.nginx.lines')} · ${config.data.modified_human ?? ''}` : undefined}>
        {config?.error && <Notice tone="error">{config.error}</Notice>}
        {config && !config.data && !config.error && <p className="py-8 text-center text-sm text-slate-400">{t('toolsOps.common.loading')}</p>}
        {config?.data && <Console className="max-h-none">{config.data.content}</Console>}
      </Sheet>
    </OpsPage>
  );
};

export default NginxWorkbench;
