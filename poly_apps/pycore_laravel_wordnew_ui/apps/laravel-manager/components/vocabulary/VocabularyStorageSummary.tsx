import React, { type ReactNode, useEffect, useState } from 'react';
import { HardDrive, ExternalLink } from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useUnifiedApp } from '@/apps/laravel-manager/context/useUnifiedApp';
import { ViewType, type StaticResourcesSummary } from '@/apps/laravel-manager/uiTypes';
import { commonClasses } from '@/shared/styles/theme';
import { LoadingBlock } from '../common';
import { TRANSLATIONS } from '@/apps/laravel-manager/constants';

const SERVER_TAB_KEY = 'server_manager_tab';

interface VocabularyStorageSummaryProps {
  children?: ReactNode;
}

/** Compact storage summary for the vocabulary page header. */
const VocabularyStorageSummary: React.FC<VocabularyStorageSummaryProps> = ({ children }) => {
  const { lang, setActiveView } = useUnifiedApp();
  const text = TRANSLATIONS[lang].vocabulary.words_manager;
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

  const audioCount = summary?.by_type?.audio?.count ?? 0;
  const imageCount = summary?.by_type?.image?.count ?? 0;
  const videoCount = summary?.by_type?.video?.count ?? 0;

  return (
    <div className={`${commonClasses.card} p-4 mb-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="font-semibold text-sm">
              {text.static_resources}
            </h3>
            {summary?.base_path && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-md" title={summary.base_path}>
                {summary.base_path}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openMediaFiles}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {text.files}
          </button>
          <button
            type="button"
            onClick={openServerStorage}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
          >
            {text.storage_details}
          </button>
        </div>
      </div>
      {loading && !summary ? (
        <div className="mt-3"><LoadingBlock size="sm" /></div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60">
            <p className="text-xs text-slate-500">{text.total_storage}</p>
            <p className="font-bold">{summary.total_size_human}</p>
            <p className="text-xs text-slate-400">{summary.total_files.toLocaleString()} {text.file_unit}</p>
          </div>
          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{text.audio}</p>
            <p className="font-bold">{audioCount.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-sky-50 dark:bg-sky-900/20">
            <p className="text-xs text-sky-600 dark:text-sky-400">{text.images}</p>
            <p className="font-bold">{imageCount.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded bg-violet-50 dark:bg-violet-900/20">
            <p className="text-xs text-violet-600 dark:text-violet-400">{text.video}</p>
            <p className="font-bold">{videoCount.toLocaleString()}</p>
          </div>
        </div>
      ) : null}
      {children && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default VocabularyStorageSummary;
