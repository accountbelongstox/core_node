import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, Filter, ExternalLink, QrCode } from 'lucide-react';
import { modelService } from '../services/modelService';
import { AppRelease, AppInstance } from '../types';
import { useApp } from '../contexts/AppContext';
import { getAppNameById } from '../utils/dataHelpers';
import { encryptedImageService } from '../services/encryptedImageService';
import { usePasswordChange } from '../hooks/usePasswordChange';

/**
 * APP Release List Page
 * Displays all released APPs in both Technical and Admin dashboards
 */
export const AppReleaseList: React.FC = () => {
  const { t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'released' | 'promoting' | 'completed'>('all');

  const releases = useMemo(() => modelService.getAppReleases() ?? [], []);

  const filteredReleases = useMemo(() => {
    return releases.filter(release => {
      // Get app name from central data source
      const appName = getAppNameById(release.appId);
      const matchesSearch = appName.toLowerCase().includes(searchQuery.toLowerCase()) ? true :
                           (release.encryptedString !== null && release.encryptedString !== undefined ? release.encryptedString.toLowerCase().includes(searchQuery.toLowerCase()) : false);
      const matchesStatus = statusFilter === 'all' ? true : release.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [releases, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('appReleaseList.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('appReleaseList.totalApps', { count: filteredReleases.length })}
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('appReleaseList.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'released' | 'promoting' | 'completed')}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            >
              <option value="all">{t('appReleaseList.statusAll')}</option>
              <option value="released">{t('appReleaseList.statusReleased')}</option>
              <option value="promoting">{t('appReleaseList.statusPromoting')}</option>
              <option value="completed">{t('appReleaseList.statusCompleted')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* APP List */}
      {filteredReleases.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">{t('appReleaseList.noReleases')}</p>
        </div>
      ) : (
        <AppReleaseListContent releases={filteredReleases} />
      )}
    </div>
  );
};

/**
 * Separate component to use hooks (hooks must be called at component level)
 */
const AppReleaseListContent: React.FC<{ releases: AppRelease[] }> = ({ releases }) => {
  // Use React Context for origin instead of direct window.location access
  const origin = useOrigin();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {releases.map(release => {
        const accessUrl = `${origin}/#/${release.encryptedString}`;
        const app = modelService.getApps().find(a => a.id === release.appId);
            
            return (
              <AppReleaseCard
                key={release.id}
                release={release}
                app={app}
                accessUrl={accessUrl}
                appName={getAppNameById(release.appId)}
              />
            );
          })}
    </div>
  );
};

/**
 * App Release Card Component with encrypted image support
 */
const AppReleaseCard: React.FC<{
  release: AppRelease;
  app: AppInstance | undefined;
  accessUrl: string;
  appName: string;
}> = ({ release, app, accessUrl, appName }) => {
  const { t } = useApp();
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
    const loadImages = async () => {
      // Clear previous URLs to force reload with new password
      setIconUrl(null);
      setSplashUrl(null);
      setShowSplash(true);
      setShowCoverImage(true);
      setShowIcon(true);
      setShowSmallIcon(true);
      
      if (app?.icon) {
        const icon = await encryptedImageService.loadAppIcon(app.id, app.icon);
        if (icon) {
          setIconUrl(icon);
          setShowIcon(true);
          setShowSmallIcon(true);
        }
      }
      if (app?.splash) {
        const splash = await encryptedImageService.loadAppSplash(app.id, app.splash);
        if (splash) {
          setSplashUrl(splash);
          setShowSplash(true);
        }
      }
    };
    loadImages();
  }, [app?.id, app?.icon, app?.splash, password]); // Reload when password changes

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-xl transition-all">
      {/* Splash Screen or Cover Image */}
      {splashUrl && showSplash ? (
        <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 relative overflow-hidden">
          <img
            src={splashUrl}
            alt={`${appName} splash`}
            className="w-full h-full object-cover"
            onError={() => {
              // Use React state instead of direct DOM manipulation
              setShowSplash(false);
            }}
          />
        </div>
      ) : release.coverImage && showCoverImage ? (
        <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 relative overflow-hidden">
          <img
            src={release.coverImage}
            alt={appName}
            className="w-full h-full object-cover"
            onError={() => {
              // Use React state instead of direct DOM manipulation
              setShowCoverImage(false);
            }}
          />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
          {iconUrl && showIcon ? (
            <img
              src={iconUrl}
              alt={`${appName} icon`}
              className="w-24 h-24 rounded-xl"
              onError={() => {
                // Use React state instead of direct DOM manipulation
                setShowIcon(false);
              }}
            />
          ) : (
            <span className="text-white text-4xl font-bold">
              {appName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {iconUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center">
                {showSmallIcon ? (
                  <img
                    src={iconUrl}
                    alt={`${appName} icon`}
                    className="w-full h-full object-cover"
                    onError={() => {
                      // Use React state instead of direct DOM manipulation
                      setShowSmallIcon(false);
                    }}
                  />
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-bold text-lg">
                    {appName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            <h3 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1 flex-1">
              {appName}
            </h3>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
            release.status === 'released' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
            release.status === 'promoting' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
            'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
          }`}>
            {release.status === 'released' ? t('appReleaseList.statusReleased') :
             release.status === 'promoting' ? t('appReleaseList.statusPromoting') : t('appReleaseList.statusCompleted')}
          </span>
        </div>

        {release.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
            {release.description}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t('appReleaseList.releasedAt')}:</span>
            <span>{release.releasedAt}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t('appReleaseList.releasedBy')}:</span>
            <span>{release.releasedByName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/app-releases/${release.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold"
          >
            <Eye size={16} />
            {t('appReleaseList.viewDetails')}
          </Link>
          <a
            href={accessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            title={t('appReleaseList.viewDetails')}
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
};

