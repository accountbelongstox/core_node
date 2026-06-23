import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';
import type {
  VocabularyStatisticsWordRow,
  VocabularyWordsPagination,
} from '../../types';

const TRUNCATE_LENGTH = 80;
const PER_PAGE_OPTIONS = [50, 100, 200];

export interface VocabularyWordListModalProps {
  open: boolean;
  onClose: () => void;
  language: string;
  fetchWords: (
    lang: string,
    page: number,
    perPage: number
  ) => Promise<{
    words: VocabularyStatisticsWordRow[];
    pagination: VocabularyWordsPagination | null;
  }>;
  initialPage?: number;
  initialPerPage?: number;
  onPageChange?: (language: string, page: number, perPage: number) => void;
}

/**
 * Reusable modal that loads and displays a paginated vocabulary word list by language.
 * Calls fetchWords when opened or when page/perPage change. Parent should pass
 * a function that requests GET vocabulary/statistics with include_words=1.
 */
const VocabularyWordListModal: React.FC<VocabularyWordListModalProps> = ({
  open,
  onClose,
  language,
  fetchWords,
  initialPage = 1,
  initialPerPage = 100,
  onPageChange,
}) => {
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [words, setWords] = useState<VocabularyStatisticsWordRow[]>([]);
  const [pagination, setPagination] = useState<VocabularyWordsPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const prevOpenRef = useRef(false);
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (!language) return;
    setPage(initialPage);
    setPerPage(initialPerPage);
  }, [open, language, initialPage, initialPerPage]);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (!language) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const justOpened = prevOpenRef.current === false;
    prevOpenRef.current = true;
    const fetchPage = justOpened ? initialPage : page;
    const fetchPerPage = justOpened ? initialPerPage : perPage;
    if (justOpened) skipNextFetchRef.current = true;
    setLoading(true);
    setWords([]);
    setPagination(null);
    fetchWords(language, fetchPage, fetchPerPage)
      .then(({ words: w, pagination: pgn }) => {
        setWords(w);
        setPagination(pgn);
        if (onPageChange) onPageChange(language, fetchPage, fetchPerPage);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, language, page, perPage]);

  if (!open) return null;

  const translationsDisplay = (w: VocabularyStatisticsWordRow) => {
    const arr = Array.isArray(w.translations) ? w.translations : [];
    const text = arr.join('; ');
    const isLong = text.length > TRUNCATE_LENGTH;
    const id = w.id ?? (w as any).index;
    const showFull = expandedId === id;
    const display = isLong && !showFull ? text.slice(0, TRUNCATE_LENGTH) + '...' : text || '—';
    return (
      <td
        className="px-3 py-2 text-slate-700 dark:text-slate-200 cursor-pointer"
        onClick={() => setExpandedId(showFull ? null : (id ?? null))}
        title={text}
      >
        {display}
      </td>
    );
  };

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}>
        <div className={`relative ${commonClasses.card} w-full max-w-5xl max-h-[80vh] flex flex-col`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h3 className="font-semibold text-lg">Vocabulary Words – {language}</h3>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total: {pagination?.total != null ? pagination.total.toLocaleString() : '0'} words
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              Per page
              <select
                value={perPage}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10) || 100;
                  setPerPage(next);
                  setPage(1);
                }}
                className={`${commonClasses.input} text-xs py-1 px-2`}
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <button
                type="button"
                disabled={loading || (pagination?.current_page ?? 1) <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {pagination?.current_page ?? 1} / {pagination?.last_page ?? 1}
              </span>
              <button
                type="button"
                disabled={loading || !pagination?.has_more}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 w-20">Index</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 w-48">Word</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Translations</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 w-32">US</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 w-32">UK</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 w-56">Library</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {words.map((w) => (
                    <tr key={w.id ?? w.word ?? w.index}>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {w.index ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{w.word}</td>
                      {translationsDisplay(w)}
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{w.us_phonetic ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{w.uk_phonetic ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{w.library_name ?? w.library_id ?? '—'}</td>
                    </tr>
                  ))}
                  {words.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No words found for this language.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      </div>
    </Portal>
  );
};

export default VocabularyWordListModal;
