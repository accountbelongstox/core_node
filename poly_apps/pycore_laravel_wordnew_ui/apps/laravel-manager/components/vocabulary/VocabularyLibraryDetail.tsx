/**
 * VocabularyLibraryDetail — the upgraded "Vocabulary Library" detail view.
 *
 * Rendered inside the Library Words modal (and able to go full-viewport). It
 * fetches paginated words for one library and presents:
 *
 *   1. A collapsible word DASHBOARD (whole-library `data.stats`): total /
 *      translated / with audio / with image / invalid, each with a percentage.
 *   2. A VIRTUALIZED word list (react-window v2 `List`) — handles large pages
 *      (libraries up to ~54k words) with a per-page dropdown (50/100/200) +
 *      Prev/Next, PageUp/PageDown and Arrow-at-edge paging.
 *   3. Per-row: index, word, phonetics, short translation, has_audio /
 *      has_image / invalid badges, a Play-audio button (disabled when no audio),
 *      and a click-to-expand inline detail panel (full translations, phonetics,
 *      explanation, image thumbnails) via the parent's renderWordDetail.
 *   4. Invalid words (`is_valid === false`) render as muted, non-playable
 *      PLACEHOLDERS (still shown — the word exists) with a "not found / invalid"
 *      badge and the `validity_note` as a tooltip.
 *   5. A fullscreen (maximize/restore) toggle; Esc exits fullscreen, else closes.
 *
 * Reuses the parent's helpers (passed as props): `playWordAudio`,
 * `renderWordDetail`, plus `api.appQyV1.getLibraryWords`, toast and logStore.
 * All strings are English.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import {
  X, RefreshCw, Volume2, VolumeX, ChevronDown, ChevronUp, ChevronRight,
  Maximize2, Minimize2, AlertTriangle, Image as ImageIcon, Languages,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { logError, logInfo } from '@/core/logstore/logStore';

const nf = (n: number | undefined | null) => (typeof n === 'number' ? n.toLocaleString() : '0');
const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '0%';

/** One word row as returned by GET …/libraries/{id}/words. */
export interface LibraryWordRow {
  index?: number;
  word: string;
  md5?: string;
  translations?: string[];
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
  explanation?: string;
  audio_url?: string;
  audio_available?: boolean;
  images?: { url: string }[];
  has_translation?: boolean;
  has_audio?: boolean;
  has_image?: boolean;
  is_valid?: boolean;
  validity_note?: string;
}

interface LibraryStats {
  total: number;
  translated: number;
  with_audio: number;
  with_image: number;
  invalid: number;
}

interface Props {
  library: any;
  onClose: () => void;
  /** Reuse the parent's audio player (new Audio(url).play()). */
  playWordAudio: (url: string, label?: string) => void;
  /** Reuse the parent's full word-detail renderer (example sentences, metadata…). */
  renderWordDetail: (row: any) => React.ReactNode;
  /** Persisted per-library page cache key (so paging survives reopen). */
  pageCacheKey?: string;
}

const ROW_HEIGHT = 52;          // collapsed row
const EXPANDED_EXTRA = 360;     // extra height when a row's detail is open
const PER_PAGE_OPTIONS = [50, 100, 200];

/** Row props threaded into every virtualized row by react-window v2. */
interface RowProps {
  words: LibraryWordRow[];
  pageBase: number;             // (page-1)*perPage, for absolute index fallback
  expandedKey: string | null;
  onToggleExpand: (key: string) => void;
  onPlay: (w: LibraryWordRow) => void;
  renderWordDetail: (row: any) => React.ReactNode;
}

const keyOf = (w: LibraryWordRow, i: number) => `${w.md5 || w.word || ''}#${i}`;

/** Short, single-line translation summary. */
const shortTranslation = (translations?: string[]): string => {
  const list = Array.isArray(translations) ? translations : [];
  if (!list.length) return '';
  const joined = list.join(', ');
  return joined.length > 80 ? joined.slice(0, 80) + '…' : joined;
};

/**
 * Adapt a contract LibraryWordRow into the shape the parent's renderWordDetail
 * expects (it reads `content`, `image_files`, `translations`, phonetics,
 * `audio_url`, `explanation`, `is_valid`, `validity_note`).
 */
const toDetailRow = (w: LibraryWordRow, library: any): any => ({
  ...w,
  content: w.word,
  language: library?.language,
  image_files: Array.isArray(w.images) ? w.images : [],
  translations: Array.isArray(w.translations) ? w.translations : [],
});

const WordRow: React.FC<RowComponentProps<RowProps>> = ({
  index, style, words, pageBase, expandedKey, onToggleExpand, onPlay, renderWordDetail,
}) => {
  const w = words[index];
  if (!w) return null;
  const rowKey = keyOf(w, index);
  const expanded = expandedKey === rowKey;
  const absIndex = (typeof w.index === 'number' ? w.index : pageBase + index + 1);
  const invalid = w.is_valid === false;
  const canPlay = !!w.audio_available && !!w.audio_url && !invalid;
  const tr = shortTranslation(w.translations);

  return (
    <div style={style} className="px-1">
      <div
        className={`rounded-lg border transition-colors ${
          invalid
            ? 'border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 opacity-60'
            : expanded
            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/10'
            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }`}
      >
        {/* collapsed row (fixed height) */}
        <div className="flex items-center gap-3 px-3" style={{ height: ROW_HEIGHT }}>
          <span className="w-12 shrink-0 font-mono text-[11px] text-slate-400 text-right">{nf(absIndex)}</span>

          <button
            type="button"
            onClick={() => onToggleExpand(rowKey)}
            className="flex-1 min-w-0 flex items-center gap-3 text-left"
            title={invalid ? (w.validity_note || 'Not found / invalid') : 'Show details'}
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
            <span className={`shrink-0 font-semibold truncate max-w-[10rem] ${
              invalid ? 'text-slate-400 dark:text-slate-500 line-through decoration-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>
              {w.word}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-slate-400 hidden sm:inline">
              {w.us_phonetic ? `US /${w.us_phonetic}/` : ''}{w.us_phonetic && w.uk_phonetic ? ' ' : ''}
              {w.uk_phonetic ? `UK /${w.uk_phonetic}/` : (!w.us_phonetic && w.phonetic ? `/${w.phonetic}/` : '')}
            </span>
            <span className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300 truncate">
              {invalid ? <span className="italic text-slate-400">not found / invalid</span> : (tr || <span className="text-slate-400">—</span>)}
            </span>
          </button>

          {/* badges */}
          <div className="shrink-0 flex items-center gap-1">
            {invalid && (
              <span title={w.validity_note || 'Not found / invalid'}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                <AlertTriangle className="w-3 h-3" /> invalid
              </span>
            )}
            {!invalid && w.has_image && (
              <span title="Has image" className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <ImageIcon className="w-3 h-3" />
              </span>
            )}
            {!invalid && w.has_audio && (
              <span title="Has audio" className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Volume2 className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* play button */}
          <button
            type="button"
            disabled={!canPlay}
            onClick={() => canPlay && onPlay(w)}
            title={canPlay ? 'Play audio' : 'No audio'}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              canPlay
                ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
          >
            {canPlay ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* expanded inline detail panel */}
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-200/70 dark:border-slate-800 overflow-auto" style={{ maxHeight: EXPANDED_EXTRA - 16 }}>
            {w.explanation && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Explanation</div>
                <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{w.explanation}</p>
              </div>
            )}
            {renderWordDetail((w as any).__detailRow)}
          </div>
        )}
      </div>
    </div>
  );
};

const VocabularyLibraryDetail: React.FC<Props> = ({
  library, onClose, playWordAudio, renderWordDetail, pageCacheKey,
}) => {
  const [words, setWords] = useState<LibraryWordRow[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const listRef = useListRef(null);

  // --- fetch one page ---------------------------------------------------- #
  const load = useCallback(async (targetPage: number, overridePerPage?: number) => {
    if (!library) return;
    const usePer = overridePerPage && overridePerPage > 0 ? overridePerPage : perPage;
    setLoading(true);
    setExpandedKey(null);
    try {
      const r = await api.appQyV1.getLibraryWords(library.id, { page: targetPage, per_page: usePer });
      if (r.success && r.data) {
        const d = r.data as any;
        const list: LibraryWordRow[] = Array.isArray(d.words) ? d.words : (Array.isArray(d.items) ? d.items : []);
        setWords(list);
        if (d.stats) {
          setStats({
            total: Number(d.stats.total) || 0,
            translated: Number(d.stats.translated) || 0,
            with_audio: Number(d.stats.with_audio) || 0,
            with_image: Number(d.stats.with_image) || 0,
            invalid: Number(d.stats.invalid) || 0,
          });
        }
        const pg = d.pagination || {};
        const cur = Number(pg.current_page) || targetPage;
        setPage(cur);
        setPerPage(Number(pg.per_page) || usePer);
        setTotal(Number(pg.total) || (d.stats ? Number(d.stats.total) : 0) || 0);
        setLastPage(Number(pg.last_page) || 1);
        setHasMore(pg.has_more != null ? !!pg.has_more : (cur * usePer < (Number(pg.total) || 0)));
        if (pageCacheKey) { try { localStorage.setItem(pageCacheKey, String(cur)); } catch { /* ignore */ } }
      } else {
        logError('vocab', `Library words load failed: ${r.error || 'unknown error'}`);
      }
    } catch (e: any) {
      logError('vocab', `Library words load error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [library, perPage, pageCacheKey]);

  // initial load (restore cached page if present)
  useEffect(() => {
    let initial = 1;
    if (pageCacheKey) {
      try { const c = parseInt(localStorage.getItem(pageCacheKey) || '', 10); if (c > 0) initial = c; } catch { /* ignore */ }
    }
    void load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library?.id]);

  const canPrev = page > 1 && !loading;
  const canNext = (hasMore || page < lastPage) && !loading;

  const goPrev = useCallback(() => { if (canPrev) void load(page - 1); }, [canPrev, page, load]);
  const goNext = useCallback(() => { if (canNext) void load(page + 1); }, [canNext, page, load]);

  const onChangePerPage = (per: number) => { setPerPage(per); void load(1, per); };

  const onPlay = useCallback((w: LibraryWordRow) => {
    if (w.audio_url) {
      logInfo('vocab', `Play audio: ${w.word}`);
      playWordAudio(w.audio_url, w.word);
    }
  }, [playWordAudio]);

  const onToggleExpand = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  // --- keyboard: Esc, PageUp/Down, Arrow-at-edge paging ------------------ #
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreen) { setFullscreen(false); e.preventDefault(); return; }
        onClose(); e.preventDefault(); return;
      }
      // Don't hijack typing in inputs.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'PageDown') { goNext(); e.preventDefault(); return; }
      if (e.key === 'PageUp') { goPrev(); e.preventDefault(); return; }
      // ArrowDown/Up move pages only at the scroll edges of the list.
      const el = listRef.current?.element;
      if (el) {
        if (e.key === 'ArrowDown' && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { goNext(); e.preventDefault(); }
        else if (e.key === 'ArrowUp' && el.scrollTop <= 2) { goPrev(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, onClose, goNext, goPrev, listRef]);

  // Pre-adapt detail rows (cheap) so the virtualized rowComponent stays simple.
  const rowWords = useMemo(
    () => words.map((w) => ({ ...w, __detailRow: toDetailRow(w, library) })),
    [words, library],
  );

  const rowProps: RowProps = {
    words: rowWords,
    pageBase: (page - 1) * perPage,
    expandedKey,
    onToggleExpand,
    onPlay,
    renderWordDetail,
  };

  // Expanded row is taller; react-window recomputes because rowProps changed.
  const rowHeight = useCallback(
    (index: number): number => {
      const w = rowWords[index];
      const k = w ? keyOf(w, index) : '';
      return (k && k === expandedKey) ? ROW_HEIGHT + EXPANDED_EXTRA : ROW_HEIGHT;
    },
    [rowWords, expandedKey],
  );

  // --- dashboard tile ---------------------------------------------------- #
  const Tile: React.FC<{ label: string; value: number; sub?: string; accent?: string }> =
    ({ label, value, sub, accent }) => (
      <div className="rounded-xl p-3 border bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
        <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className={`text-lg font-bold ${accent || 'text-slate-700 dark:text-slate-200'}`}>{nf(value)}</div>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </div>
    );

  // Fullscreen breaks out of the centered card to fill the viewport. It sits in
  // the Portal's z-[1000] modal container (above the page backdrop), so a local
  // fixed layer is sufficient; the backdrop class lives on the parent container.
  const shell = fullscreen
    ? 'fixed inset-0 z-[1000] bg-white dark:bg-slate-900 flex flex-col'
    : 'relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-slate-700/80';

  return (
    <div className={shell}>
      {/* header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{library?.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {library?.language} · {nf(stats?.total ?? library?.word_count ?? 0)} words · {library?.difficulty || 'intermediate'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* collapsible dashboard */}
      <div className="px-5 pt-3 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setDashboardOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2"
        >
          {dashboardOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Overview
        </button>
        {dashboardOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-3">
            <Tile label="Total" value={stats?.total ?? 0} />
            <Tile label="Translated" value={stats?.translated ?? 0} accent="text-indigo-500"
              sub={stats ? pct(stats.translated, stats.total) : undefined} />
            <Tile label="With audio" value={stats?.with_audio ?? 0} accent="text-sky-500"
              sub={stats ? pct(stats.with_audio, stats.total) : undefined} />
            <Tile label="With image" value={stats?.with_image ?? 0} accent="text-emerald-500"
              sub={stats ? pct(stats.with_image, stats.total) : undefined} />
            <Tile label="Invalid" value={stats?.invalid ?? 0} accent="text-rose-500"
              sub={stats ? pct(stats.invalid, stats.total) : undefined} />
          </div>
        )}
      </div>

      {/* controls */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-slate-400">Page {page} / {lastPage} · {nf(total)} words</span>
          <select
            className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            value={perPage}
            onChange={(e) => onChangePerPage(parseInt(e.target.value, 10) || 100)}
          >
            {PER_PAGE_OPTIONS.map((p) => <option key={p} value={p}>{p} / page</option>)}
          </select>
          <span className="text-slate-400 hidden md:inline">PageUp / PageDown to page</span>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={!canPrev} onClick={goPrev}
            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
            Prev
          </button>
          <button disabled={!canNext} onClick={goNext}
            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
            Next
          </button>
        </div>
      </div>

      {/* virtualized word list (default focus) */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading words...
          </div>
        ) : rowWords.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            <Languages className="w-4 h-4 mr-2" /> No words found for this library.
          </div>
        ) : (
          <List<RowProps>
            listRef={listRef}
            className="h-full"
            style={{ height: '100%' }}
            defaultHeight={480}
            rowComponent={WordRow}
            rowCount={rowWords.length}
            rowHeight={rowHeight}
            rowProps={rowProps}
            overscanCount={6}
          />
        )}
      </div>
    </div>
  );
};

export default VocabularyLibraryDetail;
