import React, { useState } from 'react';
import {
  AsyncState,
  Language,
  StaticResourcesSummary,
  SystemStorage
} from '@/apps/laravel-manager/uiTypes';
import { useTranslation } from '@/apps/laravel-manager/i18n';
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

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  audio: { icon: Music, color: 'text-emerald-600 dark:text-emerald-400' },
  video: { icon: Video, color: 'text-violet-600 dark:text-violet-400' },
  image: { icon: Image, color: 'text-sky-600 dark:text-sky-400' },
  document: { icon: FileText, color: 'text-amber-600 dark:text-amber-400' },
  other: { icon: FolderOpen, color: 'text-slate-600 dark:text-slate-400' },
};

const StaticResourcesPanel: React.FC<StaticResourcesPanelProps> = ({
  lang,
  staticResources,
  systemStorage,
  onRefresh,
  onOpenMedia
}) => {
  const { t } = useTranslation();
  const data = staticResources.data;
  const primaryMount = systemStorage.data?.[0];
  const [browser, setBrowser] = useState<{ path: string; label: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-500" />
          {t('uiServer.static_resources.storage_overview')}
        </h3>
        <div className="flex items-center gap-2">
          {onOpenMedia && (
            <button
              onClick={onOpenMedia}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              {t('uiServer.static_resources.manage_files')}
            </button>
          )}
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            title={t('uiServer.static_resources.refresh')}
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
                {t('uiServer.static_resources.system_disk')}
              </p>
              <p className="text-xl font-bold">{primaryMount?.used ?? '—'} / {primaryMount?.size ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-1">{primaryMount?.use_percent ?? ''} {primaryMount?.mounted_on ?? ''}</p>
            </div>
            <div className={`${commonClasses.card} p-4 bg-indigo-50 dark:bg-indigo-900/20`}>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 mb-1">
                {t('uiServer.static_resources.static_card')}
              </p>
              <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{data.total_size_human}</p>
              <p className="text-xs text-indigo-500 mt-1">
                {t(data.truncated ? 'uiServer.static_resources.files_count_capped' : 'uiServer.static_resources.files_count', { total: data.total_files.toLocaleString() })}
              </p>
            </div>
            <div className={`${commonClasses.card} p-4 bg-purple-50 dark:bg-purple-900/20`}>
              <p className="text-xs text-purple-600 dark:text-purple-300 mb-1 flex items-center gap-1">
                <Database className="w-3 h-3" />
                {t('uiServer.static_resources.laravel_data_dir')}
              </p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{data.laravel_data_dir_size_human}</p>
              <p className="text-xs text-purple-500 mt-1 truncate" title={data.laravel_data_dir}>{data.laravel_data_dir}</p>
            </div>
            <div className={`${commonClasses.card} p-4 bg-emerald-50 dark:bg-emerald-900/20`}>
              <p className="text-xs text-emerald-600 dark:text-emerald-300 mb-1">
                {t('uiServer.static_resources.static_ratio')}
              </p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{data.static_percent_of_data_dir}%</p>
              <p className="text-xs text-emerald-500 mt-1 font-mono truncate" title={data.base_path}>{data.base_path}</p>
            </div>
          </div>

          {/* laravel_db breakdown — explains why 1.49 GB != static-only size */}
          {data.data_dir_breakdown && data.data_dir_breakdown.length > 0 && (
            <div className={`${commonClasses.card} p-4`}>
              <h4 className="text-sm font-semibold mb-1">
                {t('uiServer.static_resources.breakdown_title')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('uiServer.static_resources.breakdown_desc')}
                {data.data_dir_unaccounted_human && data.data_dir_unaccounted_bytes !== undefined && data.data_dir_unaccounted_bytes > 0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    {t('uiServer.static_resources.unclassified')}: {data.data_dir_unaccounted_human}
                  </span>
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="p-2">{t('uiServer.static_resources.col_item')}</th>
                      <th className="p-2">{t('uiServer.static_resources.col_path')}</th>
                      <th className="p-2 text-right">{t('uiServer.static_resources.col_size')}</th>
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
                      <td className="p-2" colSpan={2}>{t('uiServer.static_resources.accounted_total')}</td>
                      <td className="p-2 text-right">{data.data_dir_accounted_human ?? '—'}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="p-2" colSpan={2}>{t('uiServer.static_resources.laravel_db_total')}</td>
                      <td className="p-2 text-right">{data.laravel_data_dir_size_human}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className={`${commonClasses.card} p-4`}>
            <h4 className="text-sm font-semibold mb-3">{t('uiServer.static_resources.by_type_title')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const bucket = data.by_type[key] ?? { count: 0, size_bytes: 0, size_human: '0 B' };
                const Icon = meta.icon;
                return (
                  <div key={key} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className="text-sm font-medium">{t(`uiServer.static_resources.type_${key}`)}</span>
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
                {t('uiServer.static_resources.subdirs_title')}
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {t('uiServer.static_resources.subdirs_hint')}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="p-2">{t('uiServer.static_resources.col_path')}</th>
                      <th className="p-2 text-right">{t('uiServer.static_resources.col_files')}</th>
                      <th className="p-2 text-right">{t('uiServer.static_resources.col_size')}</th>
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
