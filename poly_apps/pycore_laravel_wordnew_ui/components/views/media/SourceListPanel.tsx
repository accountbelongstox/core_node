import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../core/api';
import { formatTime } from './mbShared';
import type { MediaSourceListItem } from './mbShared';
import {
  Film,
  BookOpen,
  Loader2,
  WifiOff,
  Languages,
} from 'lucide-react';

// ----------------------------------------------------------- source list item

const SourceListItem: React.FC<{
  item: MediaSourceListItem;
  isMovie: boolean;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isMovie, isActive, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        isActive
          ? 'bg-indigo-500/15 border-indigo-500/40 dark:bg-indigo-500/20'
          : 'bg-white/40 dark:bg-white/5 border-black/5 dark:border-white/10 hover:border-indigo-500/30'
      }`}
    >
      <div className="flex items-center gap-2">
        {isMovie ? (
          <Film size={14} className="shrink-0 text-pink-500" />
        ) : (
          <BookOpen size={14} className="shrink-0 text-amber-500" />
        )}
        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {item.title || item.original_name || item.source_key}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500">
        {item.language && (
          <span className="inline-flex items-center gap-0.5">
            <Languages size={9} /> {item.language}
          </span>
        )}
        {item.sentence_count !== undefined && <span>{item.sentence_count} sent.</span>}
        {isMovie && item.segment_count !== undefined && <span>{item.segment_count} seg.</span>}
        {isMovie && item.duration_sec !== undefined && (
          <span>{formatTime(item.duration_sec)}</span>
        )}
      </div>
    </button>
  );
};

// ------------------------------------------------------------- source list panel

interface SourceListPanelProps {
  kind: 'movies' | 'books';
  search: string;
  selectedKey: string | null;
  onSelect: (item: MediaSourceListItem) => void;
  reloadSignal: number;
}

const SourceListPanel: React.FC<SourceListPanelProps> = ({
  kind,
  search,
  selectedKey,
  onSelect,
  reloadSignal,
}) => {
  const { t } = useTranslation();

  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sources, setSources] = useState<MediaSourceListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const isMovie = kind === 'movies';

  // Debounce search input.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Load the source list whenever kind / search changes.
  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    setOffline(false);
    const res = isMovie
      ? await api.mediaQuery.listSubtitles({ per_page: 100, search: debouncedSearch })
      : await api.mediaQuery.listBooks({ per_page: 100, search: debouncedSearch });
    if (res.success && res.data) {
      setSources(Array.isArray(res.data.items) ? res.data.items : []);
    } else {
      setSources([]);
      if ((res as any).isNetworkError || (res as any).isTimeout) setOffline(true);
      else setListError(res.error ? res.error : t('moviesBooksView.loadError'));
    }
    setListLoading(false);
  }, [isMovie, debouncedSearch, t]);

  useEffect(() => {
    loadList();
  }, [loadList, reloadSignal]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
      {offline ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <WifiOff size={28} />
          <p className="text-xs">{t('moviesBooksView.offline')}</p>
        </div>
      ) : listLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : listError ? (
        <div className="py-8 px-2 text-center text-xs text-rose-500">{listError}</div>
      ) : sources.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          {t('moviesBooksView.emptyList')}
        </div>
      ) : (
        sources.map((item) => (
          <SourceListItem
            key={item.source_key}
            item={item}
            isMovie={isMovie}
            isActive={item.source_key === selectedKey}
            onClick={() => onSelect(item)}
          />
        ))
      )}
    </div>
  );
};

export default SourceListPanel;
