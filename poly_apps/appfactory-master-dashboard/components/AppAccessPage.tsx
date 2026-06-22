import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Download, ArrowLeft, Smartphone } from 'lucide-react';
import { modelService } from '../services/modelService';
import { AppRelease } from '../types';
import { QRCode } from './QRCode';
import { getAppNameById } from '../utils/dataHelpers';
import { useApp } from '../contexts/AppContext';
import { useOrigin } from '../contexts/OriginContext';
import { useClipboard } from '../hooks/useClipboard';

/**
 * APP Access Page
 * Access via encrypted string: /#/${encryptedString}
 */
export const AppAccessPage: React.FC = () => {
  const { t } = useApp();
  const location = useLocation();
  // Extract encrypted string from path (remove leading /)
  const encryptedString = location.pathname.startsWith('/') 
    ? location.pathname.substring(1) 
    : location.pathname;
  
  const [appRelease, setAppRelease] = useState<AppRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Filter out undefined strings
    if (!encryptedString || encryptedString === '' || encryptedString === 'undefined') {
      setLoading(false);
      return;
    }

    // Find corresponding APP release record from modelService
    const releases = modelService.getAppReleases() || [];
    const release = releases.find(r => r.encryptedString === encryptedString);

    if (release) {
      setAppRelease(release);
    }
    setLoading(false);
  }, [encryptedString]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{t('appAccess.loading')}</p>
        </div>
      </div>
    );
  }

  if (!appRelease) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Smartphone className="text-rose-600 dark:text-rose-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('appAccess.notFound')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('appAccess.invalidLink')}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft size={18} />
            {t('appAccess.backToHome')}
          </Link>
        </div>
      </div>
    );
  }

  const qrCodeUrl = appRelease.encryptedString 
    ? `${origin}/#/${appRelease.encryptedString}`
    : `${origin}/#/${encryptedString}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* APP Cover and Basic Information */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
            {appRelease.coverImage && (
              <div className="h-64 bg-gradient-to-r from-indigo-500 to-purple-600 relative overflow-hidden">
                <img
                  src={appRelease.coverImage}
                  alt={getAppNameById(appRelease.appId)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}
            
            <div className="p-8">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">
                {getAppNameById(appRelease.appId)}
              </h1>
              
              {appRelease.description && (
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  {appRelease.description}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={appRelease.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-lg shadow-lg shadow-indigo-500/20"
                >
                  <Download size={24} />
                  {t('appAccess.downloadNow')}
                </a>

                {appRelease.secondaryUrl && (
                  <a
                    href={appRelease.secondaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-600 dark:border-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-bold text-lg"
                  >
                    <Smartphone size={24} />
                    {t('appAccess.visitOfficial')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Promotion QR Code */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 text-center">
              {t('appAccess.promotionQRCode')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 text-center">
              {t('appAccess.scanQRCodeHint')}
            </p>
            
            <div className="flex justify-center mb-6">
              <QRCode value={qrCodeUrl} size={256} />
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                {t('appAccess.accessLink')}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                  {qrCodeUrl}
                </code>
                <button
                  onClick={async () => {
                    await copyToClipboard(qrCodeUrl);
                    alert(t('appAccess.linkCopied'));
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold"
                >
                  {t('appAccess.copy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

