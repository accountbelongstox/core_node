import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, QrCode, Image as ImageIcon } from 'lucide-react';
import { modelService } from '../services/modelService';
import { AppRelease } from '../types';
import { QRCode } from './QRCode';
import { useApp } from '../contexts/AppContext';
import { getAppNameById } from '../utils/dataHelpers';
import { encryptedImageService } from '../services/encryptedImageService';
import { usePasswordChange } from '../hooks/usePasswordChange';

/**
 * APP Release Detail Page
 * Displays promotion QR code, URL, second access URL, APP cover, etc.
 */
export const AppReleaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useApp();
  const [appRelease, setAppRelease] = useState<AppRelease | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [splashUrl, setSplashUrl] = useState<string | null>(null);
  // Use React state instead of direct DOM manipulation for error handling
  const [showSplash, setShowSplash] = useState(true);
  const [showCoverImage, setShowCoverImage] = useState(true);
  const [showIcon, setShowIcon] = useState(true);
  const [showSmallIcon, setShowSmallIcon] = useState(true);
  
  // Use React Hook to monitor password changes - reload images when password changes
  const password = usePasswordChange();

  useEffect(() => {
    if (!id) return;

    const releases = modelService.getAppReleases() ?? [];
    const release = releases.find(r => r.id === id);

    if (release) {
      setAppRelease(release);
      
      // Load app icon and splash from centralized mock data
      const app = modelService.getApps().find(a => a.id === release.appId);
      if (app) {
        const loadImages = async () => {
          // Clear previous URLs to force reload with new password
          setIconUrl(null);
          setSplashUrl(null);
          setShowSplash(true);
          setShowCoverImage(true);
          setShowIcon(true);
          setShowSmallIcon(true);
          
          if (app.icon) {
            const icon = await encryptedImageService.loadAppIcon(app.id, app.icon);
            setIconUrl(icon);
          }
          if (app.splash) {
            const splash = await encryptedImageService.loadAppSplash(app.id, app.splash);
            setSplashUrl(splash);
          }
        };
        loadImages();
      }
    }
  }, [id, password]); // Reload when password changes

  if (!appRelease) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">{t('appRelease.appNotFound')}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {t('appRelease.back')}
          </button>
        </div>
      </div>
    );
  }

  const accessUrl = appRelease.encryptedString 
    ? `${origin}/#/${appRelease.encryptedString}`
    : '';

  // Use React Hook for clipboard operations
  const handleCopyToClipboard = async (text: string, label: string) => {
    if (!text) {
      alert(t('appRelease.linkUnavailable'));
      return;
    }
    const success = await copyToClipboardHook(text);
    if (success) {
      alert(t('appRelease.copiedToClipboard', { label }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{getAppNameById(appRelease.appId)}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('appRelease.releasedAt')}: {appRelease.releasedAt} | {t('appRelease.releasedBy')}: {appRelease.releasedByName}
            </p>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-bold ${
          appRelease.status === 'released' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
          appRelease.status === 'promoting' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
          'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
        }`}>
          {appRelease.status === 'released' ? t('appReleaseList.statusReleased') :
           appRelease.status === 'promoting' ? t('appReleaseList.statusPromoting') : t('appReleaseList.statusCompleted')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: APP Cover and Basic Information */}
        <div className="space-y-6">
          {/* APP Cover - Priority: splash, then coverImage, finally icon */}
          {splashUrl && showSplash ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="relative h-64 bg-gradient-to-r from-indigo-500 to-purple-600">
                <img
                  src={splashUrl}
                  alt={`${getAppNameById(appRelease.appId)} splash`}
                  className="w-full h-full object-cover"
                  onError={() => {
                    // Use React state instead of direct DOM manipulation
                    setShowSplash(false);
                  }}
                />
              </div>
            </div>
          ) : appRelease.coverImage && showCoverImage ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="relative h-64 bg-gradient-to-r from-indigo-500 to-purple-600">
                <img
                  src={appRelease.coverImage}
                  alt={getAppNameById(appRelease.appId)}
                  className="w-full h-full object-cover"
                  onError={() => {
                    // Use React state instead of direct DOM manipulation
                    setShowCoverImage(false);
                  }}
                />
              </div>
            </div>
          ) : iconUrl && showIcon ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="relative h-64 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <img
                  src={iconUrl}
                  alt={`${getAppNameById(appRelease.appId)} icon`}
                  className="w-32 h-32 rounded-xl"
                  onError={() => {
                    // Use React state instead of direct DOM manipulation
                    setShowIcon(false);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <ImageIcon size={48} />
                <p className="mt-4 text-sm">{t('appRelease.noCoverImage')}</p>
              </div>
            </div>
          )}
          
          {/* APP Icon and Name */}
          {iconUrl && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center">
                  {showSmallIcon ? (
                    <img
                      src={iconUrl}
                      alt={`${getAppNameById(appRelease.appId)} icon`}
                      className="w-full h-full object-cover"
                      onError={() => {
                        // Use React state instead of direct DOM manipulation
                        setShowSmallIcon(false);
                      }}
                    />
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 font-bold text-xl">
                      {getAppNameById(appRelease.appId).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{getAppNameById(appRelease.appId)}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('appRelease.appIcon')}</p>
                </div>
              </div>
            </div>
          )}

          {/* APP Description */}
          {appRelease.description && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('appRelease.appDescription')}</h3>
              <p className="text-slate-600 dark:text-slate-400">{appRelease.description}</p>
            </div>
          )}

          {/* Download Link */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('appRelease.downloadLink')}</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                {appRelease.downloadUrl}
              </code>
              <button
                onClick={() => handleCopyToClipboard(appRelease.downloadUrl, t('appRelease.downloadLink'))}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Copy size={18} />
              </button>
              <a
                href={appRelease.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </div>

        {/* Right: Promotion QR Code and URL Information */}
        <div className="space-y-6">
          {/* Promotion QR Code */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('appRelease.promotionQRCode')}</h3>
            </div>
            {accessUrl ? (
              <>
                <div className="flex justify-center mb-4">
                  <QRCode value={accessUrl} size={256} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  {t('appRelease.scanQRCode')}
                </p>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('appRelease.noAccessLink')}
                </p>
              </div>
            )}
          </div>

          {/* Access URL */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('appRelease.accessURL')}</h3>
            {accessUrl ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <code className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                    {accessUrl}
                  </code>
                  <button
                    onClick={() => handleCopyToClipboard(accessUrl, t('appRelease.accessURL'))}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <a
                  href={accessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ExternalLink size={16} />
                  {t('appRelease.openInNewWindow')}
                </a>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('appRelease.linkUnavailable')}
                </p>
              </div>
            )}
          </div>

          {/* Secondary Access URL */}
          {appRelease.secondaryUrl && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('appRelease.secondaryURL')}</h3>
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                  {appRelease.secondaryUrl}
                </code>
                <button
                  onClick={() => handleCopyToClipboard(appRelease.secondaryUrl!, t('appRelease.secondaryURL'))}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Copy size={18} />
                </button>
              </div>
              <a
                href={appRelease.secondaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <ExternalLink size={16} />
                {t('appRelease.openInNewWindow')}
              </a>
            </div>
          )}

          {/* Encrypted String */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              {t('appRelease.encryptedString')}
            </p>
            {appRelease.encryptedString ? (
              <code className="text-sm text-slate-800 dark:text-white font-mono break-all">
                {appRelease.encryptedString}
              </code>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('appRelease.notGenerated')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

