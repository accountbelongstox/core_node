import React, { useState } from 'react';
import { Rocket, CheckCircle2, Upload, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MOCK_APPS } from '../constants';
import { AppStatus } from '../types';
import { modelService } from '../services/modelService';
import { MOCK_APP_RELEASES } from '../constants';
import { generateEncryptedString } from '../utils/crypto';

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

  // 获取可发布的APP（状态为Live或Pending的）
  const availableApps = MOCK_APPS.filter(app => 
    app.status === AppStatus.LIVE || app.status === AppStatus.PENDING
  );

  const selectedApp = availableApps.find(app => app.id === selectedAppId);

  const handleRelease = async () => {
    if (!selectedAppId || !downloadUrl) {
      alert('请填写APP下载地址');
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
      id: `release-${Date.now()}`,
      appId: selectedApp.id,
      appName: selectedApp.name,
      releasedBy: user?.id || 'tech-universal',
      releasedByName: user?.name || '技术工程师',
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
      secondaryUrl: secondaryUrl || undefined,
      coverImage: coverImage || undefined,
      description: description || undefined,
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
    ? `${window.location.origin}/#/${generatedEncryptedString}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.releaseApp')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">填写APP信息并发布，系统将自动生成访问链接和推广二维码</p>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                APP发布成功！
              </p>
              {accessUrl && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">访问链接：</p>
                  <code className="block text-sm text-emerald-600 dark:text-emerald-400 break-all mb-2">
                    {accessUrl}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(accessUrl);
                      alert('链接已复制到剪贴板');
                    }}
                    className="text-xs px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    复制链接
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="space-y-6">
          {/* 选择APP */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              选择要发布的APP <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            >
              <option value="">请选择APP</option>
              {availableApps.map(app => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.status})
                </option>
              ))}
            </select>
          </div>

          {/* APP下载地址 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <LinkIcon size={16} className="inline mr-1" />
              APP下载地址 <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="https://example.com/downloads/app.apk"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              请输入APP的下载链接（APK、IPA或其他安装包）
            </p>
          </div>

          {/* 第二个访问URL */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <LinkIcon size={16} className="inline mr-1" />
              第二个访问URL（可选）
            </label>
            <input
              type="url"
              value={secondaryUrl}
              onChange={(e) => setSecondaryUrl(e.target.value)}
              placeholder="https://app.example.com"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              可选的绝对URL，如官网、应用商店链接等
            </p>
          </div>

          {/* APP封面 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <ImageIcon size={16} className="inline mr-1" />
              APP封面图片（可选）
            </label>
            <input
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://example.com/images/app-cover.jpg"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              封面图片URL，建议尺寸：800x600
            </p>
            {coverImage && (
              <div className="mt-3">
                <img
                  src={coverImage}
                  alt="封面预览"
                  className="w-full max-w-xs h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* APP描述 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              APP描述（可选）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入APP的简要描述..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none"
            />
          </div>

          {/* 预览信息 */}
          {selectedApp && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">发布预览：</p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <li>• APP名称：{selectedApp.name}</li>
                <li>• 分类：{selectedApp.category}</li>
                <li>• 状态：{selectedApp.status}</li>
                <li>• 发布后将自动生成加密访问链接和推广二维码</li>
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
                <span>发布中...</span>
              </>
            ) : (
              <>
                <Rocket size={18} />
                <span>发布APP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 最近发布的APP */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">最近发布的APP</h3>
        <div className="space-y-3">
          {(modelService.getAppReleases() || MOCK_APP_RELEASES).slice(0, 5).map(release => (
            <div key={release.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex-1">
                <p className="font-bold text-slate-800 dark:text-white">{release.appName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  发布时间: {release.releasedAt} | 发布人: {release.releasedByName}
                </p>
                {release.encryptedString && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                    {window.location.origin}/#/{release.encryptedString.substring(0, 16)}...
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                release.status === 'released' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                release.status === 'promoting' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
              }`}>
                {release.status === 'released' ? '已发布' :
                 release.status === 'promoting' ? '推广中' : '已完成'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
