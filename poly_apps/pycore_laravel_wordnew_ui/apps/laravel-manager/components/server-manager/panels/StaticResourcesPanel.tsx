import React, { useState } from 'react';
import {
  AsyncState,
  Language,
  StaticResourcesSummary,
  SystemStorage
} from '@/apps/laravel-manager/uiTypes';
import { commonClasses } from '@/shared/styles/theme';
import { LoadingBlock, AlertBox } from '../../common';
import StaticSubdirFileBrowser from './StaticSubdirFileBrowser';
import {
  HardDrive,
  Music,
  Video,
  Image,
  FileText,
  FolderOpen,
  Database,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

interface StaticResourcesPanelProps {
  lang: Language;
  staticResources: AsyncState<StaticResourcesSummary>;
  systemStorage: AsyncState<SystemStorage[]>;
  onRefresh: () => void;
  onOpenMedia?: () => void;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  audio: { icon: Music, color: 'text-emerald-600 dark:text-emerald-400', label: 'Audio' },
  video: { icon: Video, color: 'text-violet-600 dark:text-violet-400', label: 'Video' },
  image: { icon: Image, color: 'text-sky-600 dark:text-sky-400', label: 'Images' },
  document: { icon: FileText, color: 'text-amber-600 dark:text-amber-400', label: 'Documents' },
  other: { icon: FolderOpen, color: 'text-slate-600 dark:text-slate-400', label: 'Other' },
};

const StaticResourcesPanel: React.FC<StaticResourcesPanelProps> = ({
  lang,
  staticResources,
  systemStorage,
  onRefresh,
  onOpenMedia
}) => {
  const isZh = lang === 'zh';
  const data = staticResources.data;
  const primaryMount = systemStorage.data?.[0];
  const [browser, setBrowser] = useState<{ path: string; label: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-500" />
          {isZh ? '存储总览' : 'Storage Overview'}
        </h3>
        <div className="flex items-center gap-2">
          {onOpenMedia && (
            <button
              onClick={onOpenMedia}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              {isZh ? '管理静态资源' : 'Manage Files'}
            </button>
          )}
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            title={isZh ? '刷新' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${staticResources.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {staticResources.loading && !data && <LoadingBlock size="sm" />}
      {staticResources.error && <AlertBox variant="error">{staticResources.error}</AlertBox>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${commonClasses.card} p-4 bg-slate-50 dark:bg-slate-800/50`}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {isZh ? '系统磁盘' : 'System Disk'}
              </p>
              <p className="text-xl font-bold">{primaryMount?.used ?? '—'} / {primaryMount?.size ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-1">{primaryMount?.use_percent ?? ''} {primaryMount?.mounted_on ?? ''}</p>
            </div>
            <div className={`${commonClasses.card} p-4 bg-indigo-50 dark:bg-indigo-900/20`}>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 mb-1">
                {isZh ? '静态资源 (static/)' : 'Static (static/)'}
              </p>
              <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{data.total_size_human}</p>
              <p className="text-xs text-indigo-500 mt-1">
                {data.total_files.toLocaleString()} {isZh ? '个文件' : 'files'}
                {data.truncated ? ` (${isZh ? '计数已截断' : 'count capped'})` : ''}
              </p>
            </div>
            <div className={`${commonClasses.card} p-4 bg-purple-50 dark:bg-purple-900/20`}>
              <p className="text-xs text-purple-600 dark:text-purple-300 mb-1 flex items-center gap-1">
                <Database className="w-3 h-3" />
                {isZh ? 'Laravel 数据目录 (laravel_db/)' : 'Laravel Data Dir (laravel_db/)'}
              </p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{data.laravel_data_dir_size_human}</p>
              <p className="text-xs text-purple-500 mt-1 truncate" title={data.laravel_data_dir}>{data.laravel_data_dir}</p>
            </div>
            <div className={`${commonClasses.card} p-4 bg-emerald-50 dark:bg-emerald-900/20`}>
              <p className="text-xs text-emerald-600 dark:text-emerald-300 mb-1">
                {isZh ? 'static 占 laravel_db' : 'static / laravel_db'}
              </p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{data.static_percent_of_data_dir}%</p>
              <p className="text-xs text-emerald-500 mt-1 font-mono truncate" title={data.base_path}>{data.base_path}</p>
            </div>
          </div>

          {/* laravel_db breakdown — explains why 1.49 GB != static-only size */}
          {data.data_dir_breakdown && data.data_dir_breakdown.length > 0 && (
            <div className={`${commonClasses.card} p-4`}>
              <h4 className="text-sm font-semibold mb-1">
                {isZh ? 'laravel_db 目录构成' : 'laravel_db Breakdown'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {isZh
                  ? '数据目录包含 static 以外的数据库、缓存、external_data 等；下列各项之和应接近总大小。'
                  : 'laravel_db includes more than static/ (database, cache, external_data, etc.). Items below should sum to the total.'}
                {data.data_dir_unaccounted_human && data.data_dir_unaccounted_bytes !== undefined && data.data_dir_unaccounted_bytes > 0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    {isZh ? '未归类' : 'Unclassified'}: {data.data_dir_unaccounted_human}
                  </span>
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="p-2">{isZh ? '项目' : 'Item'}</th>
                      <th className="p-2">{isZh ? '路径' : 'Path'}</th>
                      <th className="p-2 text-right">{isZh ? '大小' : 'Size'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data_dir_breakdown.map((row) => (
                      <tr key={row.key} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-2 font-medium">{row.label}</td>
                        <td className="p-2 font-mono text-xs text-slate-500 truncate max-w-xs" title={row.path}>{row.path}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.size_human}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold">
                      <td className="p-2" colSpan={2}>{isZh ? '合计（已识别）' : 'Accounted total'}</td>
                      <td className="p-2 text-right">{data.data_dir_accounted_human ?? '—'}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="p-2" colSpan={2}>{isZh ? 'laravel_db 总量' : 'laravel_db total'}</td>
                      <td className="p-2 text-right">{data.laravel_data_dir_size_human}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className={`${commonClasses.card} p-4`}>
            <h4 className="text-sm font-semibold mb-3">{isZh ? 'static/ 按文件类型' : 'static/ By Type'}</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const bucket = data.by_type[key] ?? { count: 0, size_bytes: 0, size_human: '0 B' };
                const Icon = meta.icon;
                return (
                  <div key={key} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <p className="text-lg font-bold">{bucket.count.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{bucket.size_human}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {data.by_subdirectory.length > 0 && (
            <div className={`${commonClasses.card} p-4`}>
              <h4 className="text-sm font-semibold mb-1">
                {isZh ? '词汇 / 媒体子目录' : 'Vocabulary & Media Subdirectories'}
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {isZh ? '点击行浏览文件列表（支持搜索与排序）' : 'Click a row to browse files (search & sort supported)'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="p-2">{isZh ? '路径' : 'Path'}</th>
                      <th className="p-2 text-right">{isZh ? '文件数' : 'Files'}</th>
                      <th className="p-2 text-right">{isZh ? '大小' : 'Size'}</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_subdirectory.map((row) => (
                      <tr
                        key={row.path}
                        onClick={() => row.exists && setBrowser({ path: row.path, label: row.label })}
                        className={`border-b border-slate-100 dark:border-slate-800 ${
                          row.exists
                            ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                            : 'opacity-50'
                        }`}
                      >
                        <td className="p-2">
                          <div className="font-mono text-xs">{row.path}</div>
                          <div className="text-xs text-slate-500">{row.label}</div>
                        </td>
                        <td className="p-2 text-right">{row.exists ? row.files.toLocaleString() : '—'}</td>
                        <td className="p-2 text-right">{row.exists ? row.size_human : '—'}</td>
                        <td className="p-2 text-slate-400">
                          {row.exists && <ChevronRight className="w-4 h-4" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <StaticSubdirFileBrowser
        open={browser !== null}
        onClose={() => setBrowser(null)}
        relativePath={browser?.path ?? ''}
        label={browser?.label ?? ''}
        lang={lang}
      />
    </div>
  );
};

export default StaticResourcesPanel;
