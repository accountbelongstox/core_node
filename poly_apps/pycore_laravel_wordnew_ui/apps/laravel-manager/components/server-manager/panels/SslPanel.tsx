import React from 'react';
import {
  SSLCertificate,
  AsyncState,
  Language,
  CertbotStatus,
  DnsProviderStatus
} from '@/apps/laravel-manager/uiTypes';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';
import { commonClasses } from '@/shared/styles/theme';
import { LoadingBlock, AlertBox, StatusBadge } from '../../common';
import { Shield, CheckCircle, AlertTriangle, RefreshCw, Globe } from 'lucide-react';

interface SslPanelProps {
  lang: Language;
  certbotStatus: AsyncState<CertbotStatus>;
  sslCertificates: AsyncState<SSLCertificate[]>;
  dnsProvider: AsyncState<DnsProviderStatus>;
  renewingAll: boolean;
  ensuringDomain: string | null;
  onInstallCertbot: () => void;
  onShowGenerateCert: () => void;
  onRenewAll: () => void;
  onEnsureCert: (domain: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
}

const SslPanel: React.FC<SslPanelProps> = ({
  lang,
  certbotStatus,
  sslCertificates,
  dnsProvider,
  renewingAll,
  ensuringDomain,
  onInstallCertbot,
  onShowGenerateCert,
  onRenewAll,
  onEnsureCert,
  getStatusIcon
}) => {
  const t = TRANSLATIONS[lang].server;

  return (
    <div className="space-y-4">
      {/* Certbot Status */}
      {certbotStatus.data && (
        <div className={`${commonClasses.card} p-4 ${certbotStatus.data.installed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {certbotStatus.data.installed ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              )}
              <div>
                <p className="font-semibold">Certbot Status</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {certbotStatus.data.installed
                    ? `Installed${certbotStatus.data.version ? ` (v${certbotStatus.data.version})` : ''}`
                    : 'Not Installed'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onRenewAll}
                disabled={renewingAll || !certbotStatus.data.installed}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${renewingAll ? 'animate-spin' : ''}`} />
                {t.ssl.renew}
              </button>
              {!certbotStatus.data.installed && (
                <button
                  onClick={onInstallCertbot}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  {t.ssl.certbot_install}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DNS Provider Status */}
      {dnsProvider.data && (
        <div className={`${commonClasses.card} p-4 ${dnsProvider.data.configured ? '' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
          <div className="flex items-center gap-3">
            <Globe className={`w-5 h-5 ${dnsProvider.data.configured ? 'text-green-500' : 'text-yellow-500'}`} />
            <div>
              <p className="font-semibold">{t.ssl.dns_provider}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {dnsProvider.data.provider}
                {dnsProvider.data.email ? ` (${dnsProvider.data.email})` : ''}
                {' — '}
                {dnsProvider.data.configured ? t.ssl.dns_configured : t.ssl.dns_not_configured}
              </p>
            </div>
          </div>
        </div>
      )}

      {sslCertificates.loading && (
        <LoadingBlock />
      )}
      {sslCertificates.error && (
        <AlertBox variant="error">{sslCertificates.error}</AlertBox>
      )}
      {sslCertificates.data && sslCertificates.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {sslCertificates.data.map(cert => (
            <div key={cert.domain} className={`${commonClasses.card} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(cert.status)}
                  <h3 className="font-semibold text-lg">{cert.domain}</h3>
                  <StatusBadge
                    status={cert.status}
                    tone={cert.status === 'ok' ? 'success' : cert.status === 'warning' ? 'warning' : 'error'}
                    withDot={false}
                  />
                </div>
                <button
                  onClick={() => onEnsureCert(cert.domain)}
                  disabled={ensuringDomain !== null}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ensuringDomain === cert.domain ? 'animate-spin' : ''}`} />
                  {t.ssl.ensure}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">{t.ssl.expiry_date}:</span>
                  <p className="mt-1">{cert.expiry_date}</p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">{t.ssl.days_until_expiry}:</span>
                  <p className="mt-1">{cert.days_until_expiry} days</p>
                </div>
                {cert.certificate_path && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Certificate Path:</span>
                    <p className="font-mono text-xs mt-1">{cert.certificate_path}</p>
                  </div>
                )}
              </div>
              {cert.domains && cert.domains.length > 0 && (
                <div className="mt-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t.ssl.covered_domains}:</span>
                  <p className="mt-1 font-mono text-xs break-all">{cert.domains.join(', ')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {sslCertificates.data && sslCertificates.data.length === 0 && (
        <div className={`${commonClasses.card} p-12 text-center`}>
          <Shield className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-500 dark:text-slate-400">No SSL certificates found</p>
          <button
            onClick={onShowGenerateCert}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            {t.ssl.generate}
          </button>
        </div>
      )}
    </div>
  );
};

export default SslPanel;
