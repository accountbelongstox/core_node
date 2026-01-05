import React, { useState, useMemo } from 'react';
import { Rocket, CheckCircle2, Upload, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { modelService } from '../services/modelService';
import { AppStatus } from '../types';
import { generateEncryptedString } from '../utils/crypto';
import { generateId } from '../utils/idGenerator';
import { useImageError } from '../hooks/useImageError';
import { useOrigin } from '../contexts/OriginContext';
import { useClipboard } from '../hooks/useClipboard';

export const AppReleaseForm: React.FC = () => {
  const { user, t } = useApp();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [secondaryUrl, setSecondaryUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedEncryptedString, setGeneratedEncryptedString] = useState('');
  // Use React Hook for image error handling instead of direct DOM manipulation
  const [coverImageError, handleCoverImageError] = useImageError();
  // Use React Context for origin instead of direct window.location access
  const origin = useOrigin();
  // Use React Hook for clipboard instead of direct navigator.clipboard access
  const [copyToClipboard] = useClipboard();

  // Get available apps (status is Live or Pending)
  const apps = useMemo(() => modelService.getApps(), []);
  const availableApps = apps.filter(app => 
    app.status === AppStatus.LIVE || app.status === AppStatus.PENDING
  );

  const selectedApp = availableApps.find(app => app.id === selectedAppId);

  const handleRelease = async () => {
    if (!selectedAppId || !downloadUrl) {
      alert(t('appRelease.fillDownloadUrl'));
      return;
    }

    setIsSubmitting(true);
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!selectedApp) {
      setIsSubmitting(false);
      return;
    }

    // 生成加密字符串
    const encryptedString = generateEncryptedString(selectedApp.id);
    setGeneratedEncryptedString(encryptedString);

    // 创建发布记录
    const release = {
      id: generateId('release'),
      appId: selectedApp.id,
      appName: selectedApp.name,
      releasedBy: user?.id ?? 'tech-universal',
      releasedByName: user?.name ?? t('roles.tech'),
      releasedAt: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).replace(/\//g, '-'),
      status: 'released' as const,
      downloadUrl,
      encryptedString,
      secondaryUrl: secondaryUrl ? secondaryUrl : undefined,
      coverImage: coverImage ? coverImage : undefined,
      description: description ? description : undefined,
    };

    // 保存到modelService
    modelService.addAppRelease(release);

    setIsSubmitting(false);
    setShowSuccess(true);
    
    // 清空表单
    setSelectedAppId('');
    setDownloadUrl('');
    setSecondaryUrl('');
    setCoverImage('');
    setDescription('');

    // 5秒后隐藏成功提示
    setTimeout(() => {
      setShowSuccess(false);
      setGeneratedEncryptedString('');
    }, 5000);
  };

  const accessUrl = generatedEncryptedString 
    ? `${origin}/#/${generatedEncryptedString}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.releaseApp')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('appRelease.subtitle')}</p>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                {t('appRelease.successTitle')}
              </p>
              {accessUrl && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('appRelease.accessLink')}：</p>
                  <code className="block text-sm text-emerald-600 dark:text-emerald-400 break-all mb-2">
                    {accessUrl}
                  </code>
                  <button
                    onClick={async () => {
                      await copyToClipboard(accessUrl);
                      alert(t('appRelease.linkCopied'));
                    }}
                    className="text-xs px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    {t('appRelease.copyLink')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="space-y-6">
          {/* Select APP */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              {t('appRelease.selectApp')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            >
              <option value="">{t('appRelease.selectAppPlaceholder')}</option>
              {availableApps.map(app => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.status})
                </option>
              ))}
            </select>
          </div>

          {/* APP Download URL */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <LinkIcon size={16} className="inline mr-1" />
              {t('appRelease.downloadUrl')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder={t('appRelease.downloadUrlPlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('appRelease.downloadUrlHint')}
            </p>
          </div>

          {/* Secondary Access URL */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <LinkIcon size={16} className="inline mr-1" />
              {t('appRelease.secondaryUrl')}
            </label>
            <input
              type="url"
              value={secondaryUrl}
              onChange={(e) => setSecondaryUrl(e.target.value)}
              placeholder={t('appRelease.secondaryUrlPlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('appRelease.secondaryUrlHint')}
            </p>
          </div>

          {/* APP Cover Image */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <ImageIcon size={16} className="inline mr-1" />
              {t('appRelease.coverImage')}
            </label>
            <input
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder={t('appRelease.coverImagePlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('appRelease.coverImageHint')}
            </p>
            {coverImage && !coverImageError && (
              <div className="mt-3">
                <img
                  src={coverImage}
                  alt={t('appRelease.coverImage')}
                  className="w-full max-w-xs h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                  onError={handleCoverImageError}
                />
              </div>
            )}
          </div>

          {/* APP Description */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              {t('appRelease.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('appRelease.descriptionPlaceholder')}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none"
            />
          </div>

          {/* Release Preview */}
          {selectedApp && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">{t('appRelease.releasePreview')}：</p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <li>• {t('appRelease.appName')}：{selectedApp.name}</li>
                <li>• {t('appRelease.category')}：{selectedApp.category}</li>
                <li>• {t('appRelease.status')}：{selectedApp.status}</li>
                <li>• {t('appRelease.autoGenerateHint')}</li>
              </ul>
            </div>
          )}

          <button
            onClick={handleRelease}
            disabled={!selectedAppId || !downloadUrl || isSubmitting}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('appRelease.releasing')}</span>
              </>
            ) : (
              <>
                <Rocket size={18} />
                <span>{t('appRelease.releaseButton')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 最近发布的APP */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t('appRelease.recentReleases')}</h3>
        <div className="space-y-3">
          {modelService.getAppReleases().slice(0, 5).map(release => (
            <div key={release.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex-1">
                <p className="font-bold text-slate-800 dark:text-white">{release.appName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('appRelease.releasedAt')}: {release.releasedAt} | {t('appRelease.releasedBy')}: {release.releasedByName}
                </p>
                {release.encryptedString && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                    {origin}/#/{release.encryptedString.substring(0, 16)}...
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                release.status === 'released' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                release.status === 'promoting' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
              }`}>
                {release.status === 'released' ? t('appReleaseList.statusReleased') :
                 release.status === 'promoting' ? t('appReleaseList.statusPromoting') : t('appReleaseList.statusCompleted')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
