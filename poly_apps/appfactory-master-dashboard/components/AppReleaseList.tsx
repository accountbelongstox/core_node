import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, Filter, ExternalLink, QrCode } from 'lucide-react';
import { modelService } from '../services/modelService';
import { AppRelease } from '../types';
import { useApp } from '../contexts/AppContext';

/**
 * APP发布列表页面
 * 在技术端和管理端显示所有发布的APP
 */
export const AppReleaseList: React.FC = () => {
  const { t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'released' | 'promoting' | 'completed'>('all');

  const releases = useMemo(() => {
    return modelService.getAppReleases() || [];
  }, []);

  const filteredReleases = useMemo(() => {
    return releases.filter(release => {
      const matchesSearch = release.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           release.encryptedString?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || release.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [releases, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">已发布的APP</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            共 {filteredReleases.length} 个APP
          </p>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索APP名称或加密字符串..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            >
              <option value="all">全部状态</option>
              <option value="released">已发布</option>
              <option value="promoting">推广中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
        </div>
      </div>

      {/* APP列表 */}
      {filteredReleases.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">暂无发布的APP</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReleases.map(release => {
            const accessUrl = `${window.location.origin}/#/${release.encryptedString}`;
            
            return (
              <div
                key={release.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-xl transition-all"
              >
                {/* 封面图片 */}
                {release.coverImage ? (
                  <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 relative overflow-hidden">
                    <img
                      src={release.coverImage}
                      alt={release.appName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-4xl font-bold">
                      {release.appName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">
                      {release.appName}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                      release.status === 'released' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      release.status === 'promoting' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
                    }`}>
                      {release.status === 'released' ? '已发布' :
                       release.status === 'promoting' ? '推广中' : '已完成'}
                    </span>
                  </div>

                  {release.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                      {release.description}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>发布时间:</span>
                      <span>{release.releasedAt}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>发布人:</span>
                      <span>{release.releasedByName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/app-releases/${release.id}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold"
                    >
                      <Eye size={16} />
                      查看详情
                    </Link>
                    <a
                      href={accessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title="访问APP页面"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

