import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, QrCode, Image as ImageIcon } from 'lucide-react';
import { modelService } from '../services/modelService';
import { AppRelease } from '../types';
import { QRCode } from './QRCode';
import { useApp } from '../contexts/AppContext';

/**
 * APP发布详情页面
 * 显示推广二维码、URL、第二个访问URL、APP封面等
 */
export const AppReleaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useApp();
  const [appRelease, setAppRelease] = useState<AppRelease | null>(null);

  useEffect(() => {
    if (!id) return;

    const releases = modelService.getAppReleases() || [];
    const release = releases.find(r => r.id === id);

    if (release) {
      setAppRelease(release);
    }
  }, [id]);

  if (!appRelease) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">APP未找到</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const accessUrl = appRelease.encryptedString 
    ? `${window.location.origin}/#/${appRelease.encryptedString}`
    : '';

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      alert('链接不可用');
      return;
    }
    navigator.clipboard.writeText(text);
    alert(`${label}已复制到剪贴板`);
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
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{appRelease.appName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              发布时间: {appRelease.releasedAt} | 发布人: {appRelease.releasedByName}
            </p>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-bold ${
          appRelease.status === 'released' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
          appRelease.status === 'promoting' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
          'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
        }`}>
          {appRelease.status === 'released' ? '已发布' :
           appRelease.status === 'promoting' ? '推广中' : '已完成'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：APP封面和基本信息 */}
        <div className="space-y-6">
          {/* APP封面 */}
          {appRelease.coverImage ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="relative h-64 bg-gradient-to-r from-indigo-500 to-purple-600">
                <img
                  src={appRelease.coverImage}
                  alt={appRelease.appName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12">
              <div className="flex flex-col items-center justify-center text-slate-400">
                <ImageIcon size={48} />
                <p className="mt-4 text-sm">暂无封面图片</p>
              </div>
            </div>
          )}

          {/* APP描述 */}
          {appRelease.description && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">APP描述</h3>
              <p className="text-slate-600 dark:text-slate-400">{appRelease.description}</p>
            </div>
          )}

          {/* 下载链接 */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">下载链接</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                {appRelease.downloadUrl}
              </code>
              <button
                onClick={() => copyToClipboard(appRelease.downloadUrl, '下载链接')}
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

        {/* 右侧：推广二维码和URL信息 */}
        <div className="space-y-6">
          {/* 推广二维码 */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">推广二维码</h3>
            </div>
            {accessUrl ? (
              <>
                <div className="flex justify-center mb-4">
                  <QRCode value={accessUrl} size={256} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  扫描二维码即可访问APP下载页面
                </p>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  该APP尚未生成访问链接，请重新发布以生成加密字符串
                </p>
              </div>
            )}
          </div>

          {/* 访问URL */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">访问URL</h3>
            {accessUrl ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <code className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                    {accessUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(accessUrl, '访问URL')}
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
                  在新窗口打开
                </a>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  访问URL不可用
                </p>
              </div>
            )}
          </div>

          {/* 第二个访问URL */}
          {appRelease.secondaryUrl && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">第二个访问URL</h3>
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white break-all">
                  {appRelease.secondaryUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(appRelease.secondaryUrl!, '第二个访问URL')}
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
                在新窗口打开
              </a>
            </div>
          )}

          {/* 加密字符串 */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
              加密字符串
            </p>
            {appRelease.encryptedString ? (
              <code className="text-sm text-slate-800 dark:text-white font-mono break-all">
                {appRelease.encryptedString}
              </code>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">未生成</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

