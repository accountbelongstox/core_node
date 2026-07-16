import React from 'react';
import { NginxSite, Language } from '../../../types';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { Shield, Power, PowerOff, Settings, Eye, Trash2, Clock, FolderX } from 'lucide-react';

interface NginxSiteCardProps {
  site: NginxSite;
  lang: Language;
  batchMode: boolean;
  selected: boolean;
  renewingCert: string | null;
  onToggleSelected: (siteName: string) => void;
  onRenewCert: (site: NginxSite) => void;
  onEnable: (siteName: string) => void;
  onDisable: (siteName: string) => void;
  onEdit: (site: NginxSite) => void;
  onViewConfig: (siteName: string) => void;
  onDelete: (siteName: string) => void;
  onDeleteFiles: (siteName: string) => void;
}

const NginxSiteCard: React.FC<NginxSiteCardProps> = ({
  site,
  lang,
  batchMode,
  selected,
  renewingCert,
  onToggleSelected,
  onRenewCert,
  onEnable,
  onDisable,
  onEdit,
  onViewConfig,
  onDelete,
  onDeleteFiles
}) => {
  const t = TRANSLATIONS[lang].server;
  const cert = site.cert_expiry;
  const certClass = cert
    ? cert.days_left <= 7
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : cert.days_left <= 30
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : '';
  const certLabel = cert
    ? cert.days_left < 0
      ? t.nginx.cert_expired
      : t.nginx.cert_expires_in.replace('{days}', String(cert.days_left))
    : '';
  return (
    <div className={`${commonClasses.card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {batchMode && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelected(site.site_name)}
              className="w-4 h-4"
            />
          )}
          <div className={`w-3 h-3 rounded-full shrink-0 ${site.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
          <h3 className="font-semibold text-lg truncate">{site.domain || site.server_names?.[0] || site.site_name}</h3>
          <span className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {site.site_type}
          </span>
          {site.config_type && (
            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {site.config_type}
            </span>
          )}
          {Array.isArray(site.listen_ports) && site.listen_ports.length > 0 && (
            <span
              className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-mono"
              title={t.nginx.ports}
            >
              {site.listen_ports.map(p => `:${p}`).join(' ')}
            </span>
          )}
          {cert && (
            <span
              className={`px-2 py-1 text-xs rounded font-medium ${certClass}`}
              title={cert.expires_at}
            >
              SSL · {certLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {site.ssl_enabled && (
            <button
              onClick={() => onRenewCert(site)}
              disabled={renewingCert !== null}
              className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
              title={t.nginx.renew_cert}
            >
              <Shield className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 ${renewingCert === site.site_name ? 'animate-pulse' : ''}`} />
            </button>
          )}
          {site.enabled ? (
            <button
              onClick={() => onDisable(site.site_name)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              title={t.nginx.disable}
            >
              <PowerOff className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          ) : (
            <button
              onClick={() => onEnable(site.site_name)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              title={t.nginx.enable}
            >
              <Power className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          )}
          <button
            onClick={() => onEdit(site)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            title={t.nginx.update}
          >
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => onViewConfig(site.site_name)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            title={t.nginx.view_config}
          >
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => onDelete(site.site_name)}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title={t.nginx.delete}
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
          <button
            onClick={() => onDeleteFiles(site.site_name)}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Delete Files (purge web root)"
          >
            <FolderX className="w-4 h-4 text-red-700 dark:text-red-500" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-slate-500 dark:text-slate-400">{t.nginx.www_dir}:</span>
          <p className="font-mono text-xs mt-1">{site.www_dir || site.config_path || '—'}</p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">{t.nginx.php_mode}:</span>
          <p className="mt-1">{site.php_mode}</p>
        </div>
        {site.swoole_port && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t.nginx.swoole_port}:</span>
            <p className="mt-1">{site.swoole_port}</p>
          </div>
        )}
        <div>
          <span className="text-slate-500 dark:text-slate-400">SSL:</span>
          <p className="mt-1">{site.ssl_enabled ? t.nginx.enabled : t.nginx.disabled}</p>
        </div>
        {Array.isArray(site.server_names) && site.server_names.length > 0 && (
          <div className="col-span-2">
            <span className="text-slate-500 dark:text-slate-400">{t.nginx.domain}:</span>
            <p className="font-mono text-xs mt-1 truncate" title={site.server_names.join(' ')}>
              {site.server_names.join(' ')}
            </p>
          </div>
        )}
        {site.modified_human && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t.nginx.modified}:</span>
            <p className="text-xs mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {site.modified_human}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NginxSiteCard;
