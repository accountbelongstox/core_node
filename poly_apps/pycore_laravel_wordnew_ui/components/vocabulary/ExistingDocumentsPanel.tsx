import React, { useState } from 'react';
import { FileText, Search, RefreshCw, ChevronLeft, ChevronRight, LogIn } from 'lucide-react';
import { api } from '../../core/api';
import type { MediaDocumentListItem } from '../../core/api/modules/MediaQueryAPI';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../core/i18n/supportedLearningLanguages';
import { commonClasses } from '../../styles/theme';
import { LoadingBlock, EmptyState } from '../common';
import { useAppState } from '../../contexts/AppStateContext';
import { useExistingMediaList } from './useExistingMediaList';
import MediaReaderModal from './reader/MediaReaderModal';

/**
 * ExistingDocumentsPanel — read-only browse of the signed-in user's uploaded
 * documents (GET /media/documents via api.mediaQuery.listDocuments). The
 * backend is optional-auth (empty page, not a 401, while logged out), so this
 * panel skips the request entirely and shows a sign-in hint instead — same
 * convention the wordnew home hub uses for the same endpoint.
 */

const PER_PAGE = 20;

const ExistingDocumentsPanel: React.FC = () => {
  const { isLoggedIn } = useAppState();
  const {
    items, total, page, lastPage, loading, error,
    search, setSearch, language, setLanguage, setPage, refresh,
  } = useExistingMediaList<MediaDocumentListItem>({
    perPage: PER_PAGE,
    enabled: isLoggedIn,
    fetchPage: (params) => api.mediaQuery.listDocuments(params),
  });

  // The document opened in the reader (null = closed).
  const [reading, setReading] = useState<MediaDocumentListItem | null>(null);

  const fmtDate = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
  };

  return (
    <div className={`${commonClasses.card} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500" />
          Documents
          {isLoggedIn && (
            <span className="text-xs font-normal text-slate-400">
              · {total} document{total === 1 ? '' : 's'}
            </span>
          )}
        </h3>
        {isLoggedIn && (
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
        )}
      </div>

      {!isLoggedIn ? (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
          <LogIn className="w-8 h-8 opacity-50" />
          <p className="text-sm">Sign in to see your uploaded documents.</p>
        </div>
      ) : loading && items.length === 0 ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState icon={FileText} message={error} />
      ) : items.length === 0 ? (
        <EmptyState icon={FileText} message="No documents uploaded yet." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Language</th>
                  <th className="py-2 pr-3 text-right">Words</th>
                  <th className="py-2 pr-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {items.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setReading(doc)}
                    className="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td
                      className="py-2 pr-3 font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-xs"
                      title={doc.title}
                    >
                      {doc.title}
                    </td>
                    <td className="py-2 pr-3 uppercase text-slate-500 dark:text-slate-400">
                      {doc.language || '-'}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-500 dark:text-slate-400">
                      {(doc.word_count ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">
                      {fmtDate(doc.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          kind="document"
          documentId={reading.id}
          title={reading.title}
        />
      )}
    </div>
  );
};

export default ExistingDocumentsPanel;
