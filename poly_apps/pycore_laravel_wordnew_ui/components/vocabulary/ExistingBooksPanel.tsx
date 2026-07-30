import React, { useState } from 'react';
import { BookOpen, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../core/api';
import type { MediaSourceListItem } from '../../core/api/modules/MediaQueryAPI';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../core/i18n/supportedLearningLanguages';
import { mediaUrl } from '../../config/constants';
import { commonClasses } from '../../styles/theme';
import { LoadingBlock, EmptyState } from '../common';
import { useExistingMediaList } from './useExistingMediaList';
import MediaReaderModal from './reader/MediaReaderModal';

/**
 * ExistingBooksPanel — read-only browse of books already ingested into the
 * shared sentence/word library (GET /media/books via api.mediaQuery.listBooks,
 * the same read path the pycore-manager Content tab's media browser uses).
 * Sits above <BooksPanel> ("Books / Add source") in the Libraries tab, so
 * browsing existing books and uploading new ones sit next to each other.
 */

const PER_PAGE = 12;

const ExistingBooksPanel: React.FC = () => {
  const {
    items, total, page, lastPage, loading, error,
    search, setSearch, language, setLanguage, setPage, refresh,
  } = useExistingMediaList<MediaSourceListItem>({
    perPage: PER_PAGE,
    enabled: true,
    fetchPage: (params) => api.mediaQuery.listBooks(params),
  });

  // The book opened in the reader (null = closed).
  const [reading, setReading] = useState<MediaSourceListItem | null>(null);

  return (
    <div className={`${commonClasses.card} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-rose-500" />
          Books Library
          <span className="text-xs font-normal text-slate-400">
            · {total} book{total === 1 ? '' : 's'}
          </span>
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title..."
              className={`${commonClasses.input} pl-8 text-sm w-40`}
            />
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`${commonClasses.input} text-sm`}
          >
            <option value="">All languages</option>
            {SUPPORTED_LEARNING_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} p-2`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState icon={BookOpen} message={error} />
      ) : items.length === 0 ? (
        <EmptyState icon={BookOpen} message="No books ingested yet." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => {
              const label = item.title || item.original_name || item.ascii_name || item.source_key;
              return (
                <div
                  key={item.source_key}
                  onClick={() => setReading(item)}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                >
                  {item.image_url ? (
                    <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={mediaUrl(item.image_url)}
                        alt={label}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 mb-3 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                      <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                  <h4 className="font-semibold text-sm truncate mb-1" title={label}>
                    {label}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    {item.language && <span className="uppercase">{item.language}</span>}
                    {item.sentence_count != null && (
                      <span>{item.sentence_count.toLocaleString()} sentences</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Page {page} of {lastPage}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage || loading}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {reading && (
        <MediaReaderModal
          open={!!reading}
          onClose={() => setReading(null)}
          kind="book"
          sourceKey={reading.source_key}
          title={reading.title || reading.original_name || reading.ascii_name || reading.source_key}
        />
      )}
    </div>
  );
};

export default ExistingBooksPanel;
