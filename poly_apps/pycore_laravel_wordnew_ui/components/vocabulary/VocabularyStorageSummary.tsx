import React, { useEffect, useState } from 'react';
import { HardDrive, ExternalLink } from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useAppState } from '../../contexts/AppStateContext';
import { ViewType, type StaticResourcesSummary } from '../../apps/laravel-manager/uiTypes';
import { commonClasses } from '../../styles/theme';
import { LoadingBlock } from '../common';

const SERVER_TAB_KEY = 'server_manager_tab';

/** Compact storage summary for the vocabulary page header. */
const VocabularyStorageSummary: React.FC = () => {
  const { lang, setActiveView } = useAppState();
  const isZh = lang === 'zh';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StaticResourcesSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.serverManagerV1.getStaticResourcesSummary();
        if (!cancelled && res.success && res.data) {
          setSummary(res.data as StaticResourcesSummary);
        }
      } catch {
        /* dashboard is optional on vocabulary page */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openServerStorage = () => {
    try { localStorage.setItem(SERVER_TAB_KEY, 'system'); } catch { /* ignore */ }
    setActiveView(ViewType.SERVER_MANAGER);
  };

  const openMediaFiles = () => {
    setActiveView(ViewType.MEDIA_BROWSER);
  };

  if (loading && !summary) {
    return (
      <div className={`${commonClasses.card} p-3 mb-4`}>
        <LoadingBlock size="sm" />
      </div>
    );
  }

  if (!summary) return null;

  const audioCount = summary.by_type?.audio?.count ?? 0;
  const imageCount = summary.by_type?.image?.count ?? 0;
  const videoCount = summary.by_type?.video?.count ?? 0;

  return (
    <div className={`${commonClasses.card} p-4 mb-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="font-semibold text-sm">
              {isZh ? '静态资源' : 'Static Resources'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-md" title={summary.base_path}>
              {summary.base_path}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openMediaFiles}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {isZh ? '文件管理' : 'Files'}
          </button>
          <button
            type="button"
            onClick={openServerStorage}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
          >
            {isZh ? '存储详情' : 'Storage Details'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500">{isZh ? '总占用' : 'Total'}</p>
          <p className="font-bold">{summary.total_size_human}</p>
          <p className="text-xs text-slate-400">{summary.total_files.toLocaleString()} {isZh ? '文件' : 'files'}</p>
        </div>
        <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-900/20">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{isZh ? '音频' : 'Audio'}</p>
          <p className="font-bold">{audioCount.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded bg-sky-50 dark:bg-sky-900/20">
          <p className="text-xs text-sky-600 dark:text-sky-400">{isZh ? '图片' : 'Images'}</p>
          <p className="font-bold">{imageCount.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded bg-violet-50 dark:bg-violet-900/20">
          <p className="text-xs text-violet-600 dark:text-violet-400">{isZh ? '视频' : 'Video'}</p>
          <p className="font-bold">{videoCount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default VocabularyStorageSummary;
