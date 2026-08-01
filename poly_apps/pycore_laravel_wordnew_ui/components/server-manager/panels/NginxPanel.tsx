import React from 'react';
import {
  NginxSite,
  AsyncState,
  Language,
  NginxStatusOverview,
  NginxServiceAction,
  NginxLogsResponse,
  NginxBackup,
  NginxMetrics,
  NginxBatchAction
} from '../../../apps/laravel-manager/uiTypes';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, StatusBadge } from '../../common';
import {
  Network,
  Server,
  RefreshCw,
  Plus,
  Power,
  PowerOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Play,
  Download,
  Square,
  RotateCw,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Copy,
  Activity,
  Archive,
  FileCode,
  ListChecks,
  Wrench
} from 'lucide-react';
import NginxSiteCard from './NginxSiteCard';

interface NginxPanelProps {
  lang: Language;
  nginxStatus: AsyncState<NginxStatusOverview>;
  nginxMetrics: AsyncState<NginxMetrics>;
  nginxSites: AsyncState<NginxSite[]>;
  nginxNotInstalled: boolean;
  installBusy: boolean;
  serviceBusy: NginxServiceAction | null;
  showConfigTestOutput: boolean;
  setShowConfigTestOutput: React.Dispatch<React.SetStateAction<boolean>>;
  batchMode: boolean;
  setBatchMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSiteNames: string[];
  setSelectedSiteNames: React.Dispatch<React.SetStateAction<string[]>>;
  batchBusy: NginxBatchAction | null;
  renewingCert: string | null;
  showNginxLogs: boolean;
  setShowNginxLogs: React.Dispatch<React.SetStateAction<boolean>>;
  nginxLogType: 'access' | 'error';
  setNginxLogType: React.Dispatch<React.SetStateAction<'access' | 'error'>>;
  nginxLogLines: number;
  setNginxLogLines: React.Dispatch<React.SetStateAction<number>>;
  nginxLogFollow: boolean;
  setNginxLogFollow: React.Dispatch<React.SetStateAction<boolean>>;
  nginxLogFilterInput: string;
  setNginxLogFilterInput: React.Dispatch<React.SetStateAction<string>>;
  nginxLogs: AsyncState<NginxLogsResponse>;
  nginxLogPreRef: React.RefObject<HTMLPreElement>;
  showNginxBackups: boolean;
  setShowNginxBackups: React.Dispatch<React.SetStateAction<boolean>>;
  nginxBackups: AsyncState<NginxBackup[]>;
  onOpenMainConfig: () => void;
  onLoadNginxStatus: () => void;
  onLoadNginxMetrics: () => void;
  onInstallNginx: () => void;
  onCopyInstallHint: (hint: string) => void;
  onNginxService: (action: NginxServiceAction) => void;
  onRepairConfig: () => void;
  onLoadNginxLogs: (type?: 'access' | 'error', lines?: number, filter?: string) => void;
  onLoadNginxBackups: () => void;
  onRestoreBackup: (backup: NginxBackup) => void;
  onBatchAction: (action: NginxBatchAction) => void;
  onToggleSiteSelected: (siteName: string) => void;
  onShowCreateSite: () => void;
  onRenewSiteCert: (site: NginxSite) => void;
  onEnableSite: (siteName: string) => void;
  onDisableSite: (siteName: string) => void;
  onEditSite: (site: NginxSite) => void;
  onViewConfig: (siteName: string) => void;
  onDeleteSite: (siteName: string) => void;
  onDeleteFilesSite: (siteName: string) => void;
}

const NginxPanel: React.FC<NginxPanelProps> = ({
  lang,
  nginxStatus,
  nginxMetrics,
  nginxSites,
  nginxNotInstalled,
  installBusy,
  serviceBusy,
  showConfigTestOutput,
  setShowConfigTestOutput,
  batchMode,
  setBatchMode,
  selectedSiteNames,
  setSelectedSiteNames,
  batchBusy,
  renewingCert,
  showNginxLogs,
  setShowNginxLogs,
  nginxLogType,
  setNginxLogType,
  nginxLogLines,
  setNginxLogLines,
  nginxLogFollow,
  setNginxLogFollow,
  nginxLogFilterInput,
  setNginxLogFilterInput,
  nginxLogs,
  nginxLogPreRef,
  showNginxBackups,
  setShowNginxBackups,
  nginxBackups,
  onOpenMainConfig,
  onLoadNginxStatus,
  onLoadNginxMetrics,
  onInstallNginx,
  onCopyInstallHint,
  onNginxService,
  onRepairConfig,
  onLoadNginxLogs,
  onLoadNginxBackups,
  onRestoreBackup,
  onBatchAction,
  onToggleSiteSelected,
  onShowCreateSite,
  onRenewSiteCert,
  onEnableSite,
  onDisableSite,
  onEditSite,
  onViewConfig,
  onDeleteSite,
  onDeleteFilesSite
}) => {
  const t = TRANSLATIONS[lang].server;
  return (
    <div className="space-y-4">
      {/* Nginx Status Card */}
      <div className={`${commonClasses.card} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-500" />
            {t.nginx.status}
          </h3>
          <div className="flex items-center gap-2">
            {nginxStatus.data?.installed && (
              <button
                onClick={onOpenMainConfig}
                className="px-2 py-1.5 text-xs font-mono flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
                title={t.nginx.main_config}
              >
                <FileCode className="w-4 h-4" />
                {t.nginx.main_config}
              </button>
            )}
            <button
              onClick={onLoadNginxStatus}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              title={t.nginx.refresh_status}
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${nginxStatus.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {nginxStatus.loading && !nginxStatus.data && (
          <LoadingBlock size="sm" />
        )}

        {nginxStatus.error && (
          <AlertBox variant="error">{nginxStatus.error}</AlertBox>
        )}

        {nginxStatus.data && (
          <div className="space-y-3">
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1 ${
                nginxStatus.data.installed
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {nginxStatus.data.installed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {nginxStatus.data.installed ? t.nginx.installed : t.nginx.not_installed}
              </span>
              {nginxStatus.data.version && (
                <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  {t.nginx.version}: {nginxStatus.data.version}
                </span>
              )}
              {nginxStatus.data.installed && (
                <span className={`px-2 py-1 text-xs rounded font-medium ${
                  nginxStatus.data.running
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {nginxStatus.data.running
                    ? `${t.nginx.running} · ${nginxStatus.data.process_count} ${t.nginx.processes}`
                    : t.nginx.stopped}
                </span>
              )}
              {nginxStatus.data.config_test && (
                <button
                  onClick={() => setShowConfigTestOutput(prev => !prev)}
                  title={nginxStatus.data.config_test.output}
                  className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1 ${
                    nginxStatus.data.config_test.valid
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {t.nginx.config_test}: {nginxStatus.data.config_test.valid ? t.nginx.valid : t.nginx.invalid}
                  {showConfigTestOutput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t.nginx.sites_count}: {nginxStatus.data.sites.total} / {t.nginx.enabled} {nginxStatus.data.sites.enabled} / {t.nginx.disabled} {nginxStatus.data.sites.disabled}
              </span>
              {nginxStatus.data.service_manager && (
                <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-mono">
                  {t.nginx.service_manager}: {nginxStatus.data.service_manager}
                </span>
              )}
            </div>

            {/* Config Test Output (expandable) */}
            {showConfigTestOutput && nginxStatus.data.config_test && (
              <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                {nginxStatus.data.config_test.output}
              </pre>
            )}

            {/* Not Installed Callout */}
            {!nginxStatus.data.installed && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-amber-900 dark:text-amber-100">{t.nginx.install_hint_title}</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={onInstallNginx}
                    disabled={installBusy}
                    className={`px-4 py-2 ${installBusy ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                  >
                    {installBusy ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {t.nginx.install}
                  </button>
                  {installBusy && (
                    <span className="text-xs text-amber-700 dark:text-amber-300">{t.nginx.installing}</span>
                  )}
                </div>
                {nginxStatus.data.install_hint && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-3 py-2 rounded overflow-x-auto">
                      {nginxStatus.data.install_hint}
                    </code>
                    <button
                      onClick={() => onCopyInstallHint(nginxStatus.data!.install_hint!)}
                      className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded"
                      title={t.nginx.copy}
                    >
                      <Copy className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Runtime Metrics (stub_status + process totals) */}
            {nginxStatus.data.installed && nginxStatus.data.running && (
              <div className="flex flex-wrap items-center gap-2">
                {nginxMetrics.data?.stub_status ? (
                  <>
                    <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                      {t.nginx.metrics_active}: {nginxMetrics.data.stub_status.active_connections}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                      {t.nginx.metrics_requests}: {nginxMetrics.data.stub_status.requests}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                      {t.nginx.metrics_memory}: {((nginxMetrics.data.totals?.memory_kb ?? 0) / 1024).toFixed(1)} MB
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono">
                      {t.nginx.metrics_cpu}: {(nginxMetrics.data.totals?.cpu_percent ?? 0).toFixed(1)}%
                    </span>
                  </>
                ) : nginxMetrics.data && !nginxMetrics.data.stub_status ? (
                  <span
                    className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 cursor-help"
                    title={nginxMetrics.data.hint || t.nginx.metrics_unavailable}
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </span>
                ) : null}
                <button
                  onClick={onLoadNginxMetrics}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  title={t.nginx.refresh}
                >
                  <Activity className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${nginxMetrics.loading ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            )}

            {/* Service Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {([
                { action: 'start' as NginxServiceAction, label: t.nginx.start, icon: Play, color: 'bg-green-600 hover:bg-green-700', disabledColor: 'bg-green-400' },
                { action: 'stop' as NginxServiceAction, label: t.nginx.stop, icon: Square, color: 'bg-red-600 hover:bg-red-700', disabledColor: 'bg-red-400' },
                { action: 'restart' as NginxServiceAction, label: t.nginx.restart, icon: RotateCw, color: 'bg-yellow-600 hover:bg-yellow-700', disabledColor: 'bg-yellow-400' },
                { action: 'reload' as NginxServiceAction, label: t.nginx.reload, icon: RefreshCw, color: 'bg-indigo-600 hover:bg-indigo-700', disabledColor: 'bg-indigo-400' }
              ]).map(({ action, label, icon: Icon, color, disabledColor }) => {
                const disabled = nginxNotInstalled || serviceBusy !== null;
                return (
                  <button
                    key={action}
                    onClick={() => onNginxService(action)}
                    disabled={disabled}
                    className={`px-3 py-1.5 ${disabled ? `${disabledColor} cursor-not-allowed opacity-60` : color} text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                  >
                    <Icon className={`w-4 h-4 ${serviceBusy === action ? 'animate-spin' : ''}`} />
                    {label}
                  </button>
                );
              })}
              <button
                onClick={onRepairConfig}
                disabled={nginxNotInstalled || serviceBusy !== null}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
                title="Repair + reset all nginx config (ensure log dirs, quarantine broken sites, reload)"
              >
                <Wrench className="w-4 h-4" />
                Repair
              </button>
              <button
                onClick={() => {
                  setShowNginxLogs(prev => {
                    const next = !prev;
                    if (next && !nginxLogs.data && !nginxLogs.loading) onLoadNginxLogs();
                    return next;
                  });
                }}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <ScrollText className="w-4 h-4" />
                {t.nginx.logs}
              </button>
            </div>
          </div>
        )}
      </div>

      {nginxNotInstalled ? (
        /* When nginx is not installed the sites area shows install guidance */
        <div className={`${commonClasses.card} p-12 text-center`}>
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <p className="text-slate-500 dark:text-slate-400">{t.nginx.install_guidance}</p>
        </div>
      ) : (
        <>
          {nginxSites.loading && (
            <LoadingBlock />
          )}
          {nginxSites.error && (
            <AlertBox variant="error">{nginxSites.error}</AlertBox>
          )}
          {nginxSites.data && nginxSites.data.length > 0 && (
            <>
              {/* Sites list header with batch-mode toggle + action bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Network className="w-4 h-4 text-indigo-500" />
                  {t.nginx.sites}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {batchMode && (
                    <>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t.nginx.batch_selected.replace('{n}', String(selectedSiteNames.length))}
                      </span>
                      <button
                        onClick={() => onBatchAction('enable')}
                        disabled={selectedSiteNames.length === 0 || batchBusy !== null}
                        className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1 ${
                          selectedSiteNames.length === 0 || batchBusy !== null
                            ? 'bg-green-400 cursor-not-allowed opacity-60'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        <Power className={`w-3.5 h-3.5 ${batchBusy === 'enable' ? 'animate-pulse' : ''}`} />
                        {t.nginx.batch_enable}
                      </button>
                      <button
                        onClick={() => onBatchAction('disable')}
                        disabled={selectedSiteNames.length === 0 || batchBusy !== null}
                        className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1 ${
                          selectedSiteNames.length === 0 || batchBusy !== null
                            ? 'bg-slate-400 cursor-not-allowed opacity-60'
                            : 'bg-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        <PowerOff className={`w-3.5 h-3.5 ${batchBusy === 'disable' ? 'animate-pulse' : ''}`} />
                        {t.nginx.batch_disable}
                      </button>
                      <button
                        onClick={() => onBatchAction('test')}
                        disabled={selectedSiteNames.length === 0 || batchBusy !== null}
                        className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1 ${
                          selectedSiteNames.length === 0 || batchBusy !== null
                            ? 'bg-yellow-400 cursor-not-allowed opacity-60'
                            : 'bg-yellow-600 hover:bg-yellow-700'
                        }`}
                      >
                        <CheckCircle className={`w-3.5 h-3.5 ${batchBusy === 'test' ? 'animate-pulse' : ''}`} />
                        {t.nginx.batch_test}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setBatchMode(prev => {
                        if (prev) setSelectedSiteNames([]);
                        return !prev;
                      });
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1 ${
                      batchMode
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ListChecks className="w-4 h-4" />
                    {t.nginx.batch}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {nginxSites.data.map(site => (
                  <NginxSiteCard
                    key={site.site_name || site.config_path}
                    site={site}
                    lang={lang}
                    batchMode={batchMode}
                    selected={selectedSiteNames.includes(site.site_name)}
                    renewingCert={renewingCert}
                    onToggleSelected={onToggleSiteSelected}
                    onRenewCert={onRenewSiteCert}
                    onEnable={onEnableSite}
                    onDisable={onDisableSite}
                    onEdit={onEditSite}
                    onViewConfig={onViewConfig}
                    onDelete={onDeleteSite}
                    onDeleteFiles={onDeleteFilesSite}
                  />
                ))}
              </div>
            </>
          )}
          {nginxSites.data && nginxSites.data.length === 0 && !nginxSites.loading && (
            <div className={`${commonClasses.card} p-12 text-center`}>
              <Network className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">{t.nginx.no_sites}</p>
              <button
                onClick={onShowCreateSite}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.nginx.create}
              </button>
            </div>
          )}
        </>
      )}

      {/* Nginx Logs (collapsible) */}
      <div className={commonClasses.card}>
        <button
          onClick={() => {
            setShowNginxLogs(prev => {
              const next = !prev;
              if (next && !nginxLogs.data && !nginxLogs.loading) onLoadNginxLogs();
              return next;
            });
          }}
          className="w-full flex items-center justify-between p-4"
        >
          <span className="font-semibold flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-indigo-500" />
            {t.nginx.logs}
          </span>
          {showNginxLogs ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {showNginxLogs && (
          <div className="px-4 pb-4 space-y-3">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
                {(['access', 'error'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setNginxLogType(type);
                      onLoadNginxLogs(type, nginxLogLines);
                    }}
                    className={`px-3 py-1.5 text-sm font-medium ${
                      nginxLogType === type
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {type === 'access' ? t.nginx.access_log : t.nginx.error_log}
                  </button>
                ))}
              </div>
              <label className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.lines}</label>
              <select
                value={nginxLogLines}
                onChange={(e) => {
                  const lines = parseInt(e.target.value, 10);
                  setNginxLogLines(lines);
                  onLoadNginxLogs(nginxLogType, lines);
                }}
                className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {[100, 200, 500, 1000].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <input
                type="text"
                value={nginxLogFilterInput}
                onChange={(e) => setNginxLogFilterInput(e.target.value)}
                placeholder={t.nginx.filter_placeholder}
                className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-44"
              />
              <button
                onClick={() => setNginxLogFollow(prev => !prev)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1 ${
                  nginxLogFollow
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title={t.nginx.auto_follow}
              >
                <Play className={`w-3.5 h-3.5 ${nginxLogFollow ? 'animate-pulse' : ''}`} />
                {t.nginx.auto_follow}
              </button>
              <button
                onClick={() => onLoadNginxLogs()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                title={t.nginx.refresh}
              >
                <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${nginxLogs.loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {nginxLogs.loading && !nginxLogs.data && (
              <LoadingBlock size="sm" />
            )}

            {nginxLogs.error && (
              <AlertBox variant="error">{nginxLogs.error}</AlertBox>
            )}

            {nginxLogs.data && !nginxLogs.data.exists && (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.no_log_file}</p>
                <p className="text-xs font-mono text-slate-400 mt-1">{nginxLogs.data.file}</p>
              </div>
            )}

            {nginxLogs.data && nginxLogs.data.exists && (
              <>
                <pre
                  ref={nginxLogPreRef}
                  className="text-xs font-mono bg-slate-900 text-slate-200 p-3 rounded h-64 overflow-y-auto overflow-x-auto whitespace-pre-wrap"
                >
                  {nginxLogs.data.lines.length > 0 ? nginxLogs.data.lines.join('\n') : '(empty)'}
                </pre>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{nginxLogs.data.file}</span>
                  <span>
                    {nginxLogs.data.filter && nginxLogs.data.scanned_lines !== undefined && (
                      <span className="mr-2">{t.nginx.scanned_lines.replace('{n}', String(nginxLogs.data.scanned_lines))}</span>
                    )}
                    {(nginxLogs.data.size_bytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Nginx Config Backups (collapsible) */}
      {!nginxNotInstalled && (
        <div className={commonClasses.card}>
          <button
            onClick={() => {
              setShowNginxBackups(prev => {
                const next = !prev;
                if (next && !nginxBackups.loading) onLoadNginxBackups();
                return next;
              });
            }}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="font-semibold flex items-center gap-2">
              <Archive className="w-4 h-4 text-indigo-500" />
              {t.nginx.backups}
            </span>
            {showNginxBackups ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {showNginxBackups && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={onLoadNginxBackups}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  title={t.nginx.refresh}
                >
                  <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${nginxBackups.loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {nginxBackups.loading && (!nginxBackups.data || nginxBackups.data.length === 0) && (
                <LoadingBlock size="sm" />
              )}

              {nginxBackups.error && (
                <AlertBox variant="error">{nginxBackups.error}</AlertBox>
              )}

              {!nginxBackups.loading && !nginxBackups.error && nginxBackups.data && nginxBackups.data.length === 0 && (
                <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded">
                  <Archive className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.nginx.backups_empty}</p>
                </div>
              )}

              {nginxBackups.data && nginxBackups.data.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {nginxBackups.data.map(backup => (
                    <div
                      key={backup.file}
                      className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge
                          className="shrink-0"
                          status={backup.type === 'delete' ? t.nginx.backup_type_delete : t.nginx.backup_type_update}
                          tone={backup.type === 'delete' ? 'error' : 'info'}
                          withDot={false}
                        />
                        <span className="text-sm font-medium shrink-0">{backup.site}</span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={backup.file}>
                          {backup.file}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        <span>{(backup.size_bytes / 1024).toFixed(1)} KB</span>
                        <span>{backup.created_at}</span>
                        <button
                          onClick={() => onRestoreBackup(backup)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          {t.nginx.backup_restore}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NginxPanel;
