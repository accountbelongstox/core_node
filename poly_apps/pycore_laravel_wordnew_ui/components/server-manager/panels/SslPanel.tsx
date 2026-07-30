import React from 'react';
import {
  SSLCertificate,
  AsyncState,
  Language,
  CertbotStatus
} from '../../../types';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, StatusBadge } from '../../common';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';

interface SslPanelProps {
  lang: Language;
  certbotStatus: AsyncState<CertbotStatus>;
  sslCertificates: AsyncState<SSLCertificate[]>;
  onInstallCertbot: () => void;
  onShowGenerateCert: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
}

const SslPanel: React.FC<SslPanelProps> = ({
  lang,
  certbotStatus,
  sslCertificates,
  onInstallCertbot,
  onShowGenerateCert,
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
