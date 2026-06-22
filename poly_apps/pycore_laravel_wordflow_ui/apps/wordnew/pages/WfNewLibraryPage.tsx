/**
 * WfNewLibraryPage — the dedicated word-browser for ONE public vocabulary library
 * (e.g. "English Coca 60000"). Opened by clicking a library card on the home hub
 * (NOT the generic shelf). The route is fully reflected in the URL hash:
 *
 *   #/library/<libraryId>?page=<n>&view=<dash|table>
 *
 * so a refresh / deep-link keeps the exact library, page and view. The parent
 * (WfNewApp) owns that route state and passes it in + change callbacks; this page
 * is otherwise self-contained (fetches its own paginated words from the backend).
 *
 * Layout:
 *   - a COLLAPSIBLE stats dashboard at the top (total / translated / audio / image),
 *   - the WORD TABLE shown by default, which can EXPAND TO FULLSCREEN,
 *   - per-row: play audio, expand definition/explanation, show images,
 *   - up / down (prev / next) pagination driven by the backend page meta.
 *
 * Static files (word images, audio) are already resolved to absolute URLs by the
 * HTTP api layer (absUrl), so the table renders them directly.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Maximize2, Minimize2, Play, Pause, Image as ImageIcon, BookOpen, Volume2, Languages,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewLibraryWord, WfNewLibraryWordsPage, WfNewWordMedia } from '../api';
import { wfNewApi } from '../api';
import { WfNewLoadingDots } from '../components/WfNewLoadingDots';

type LibraryView = 'dash' | 'table';

interface WfNewLibraryPageProps {
  libraryId: string;
  /** Fallback title/language from the home card (until the page payload loads). */
  title?: string;
  language?: string;
  page: number;
  view: LibraryView;
  perPage?: number;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onChangePage: (page: number) => void;
  onChangeView: (view: LibraryView) => void;
}

const DEFAULT_PER_PAGE = 100;

export const WfNewLibraryPage: React.FC<WfNewLibraryPageProps> = ({
  libraryId,
  title,
  language,
  page,
  view,
  perPage = DEFAULT_PER_PAGE,
  theme,
  trans,
  onChangePage,
  onChangeView,
}) => {
  const [data, setData] = useState<WfNewLibraryWordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Single shared <audio> element for row playback (no overlapping clips).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // ---- On-demand word media (image/audio) --------------------------------- //
  // For a row whose image/audio is missing we call getWordMedia(lang, word) ONCE
  // — that READS current media AND tells the backend to enqueue+prioritize the
  // missing files. While the resolve reports 'pending' we keep a flashing loader
  // and poll a few times until it flips to 'ready', then overlay the urls.
  // Keyed by md5 so each word is requested at most once (guarded by requestedMd5).
  const [mediaByMd5, setMediaByMd5] = useState<Record<string, WfNewWordMedia>>({});
  const requestedMd5 = useRef<Set<string>>(new Set());
  // Active poll timers, so we can cancel them on page change / unmount.
  const pollTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  /**
   * Resolve (+enqueue) media for one word, then poll up to `maxTries` times every
   * ~4s until both image & audio are ready (or tries run out). One in-flight chain
   * per md5; guarded by requestedMd5 so a re-expand never re-fires.
   */
  const requestWordMedia = useCallback((w: WfNewLibraryWord, lang: string) => {
    const md5 = w.md5 || `${w.index}-${w.word}`;
    if (requestedMd5.current.has(md5)) return;
    requestedMd5.current.add(md5);

    const maxTries = 3;
    const intervalMs = 4000;

    const attempt = (tries: number): void => {
      wfNewApi
        .getWordMedia(lang, w.word)
        .then((m) => {
          setMediaByMd5((prev) => ({ ...prev, [md5]: m }));
          const settled = m.imageStatus === 'ready' && m.audioStatus === 'ready';
          if (!settled && tries < maxTries) {
            const t = setTimeout(() => {
              pollTimers.current.delete(t);
              attempt(tries + 1);
            }, intervalMs);
            pollTimers.current.add(t);
          }
        })
        .catch(() => {
          // Allow a later re-expand to retry after a transient failure.
          requestedMd5.current.delete(md5);
        });
    };
    attempt(1);
  }, []);

  // Cancel any in-flight polls + reset request guards when the page payload changes.
  useEffect(() => {
    requestedMd5.current = new Set();
    setMediaByMd5({});
    const timers = pollTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [libraryId, page, perPage]);

  // Fetch the current page whenever library / page / perPage changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    wfNewApi
      .getLibraryWords(libraryId, { page, perPage })
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message ? String(e.message) : 'Failed to load library words.');
        setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [libraryId, page, perPage]);

  // Stop any playback when the page changes / unmounts.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const libName = data?.library?.name || title || libraryId;
  const libLang = data?.library?.language || language || 'english';
  const stats = data?.stats;
  const pg = data?.pagination;
  const lastPage = pg?.lastPage ?? 1;
  const currentPage = pg?.currentPage ?? page;

  const togglePlay = useCallback((w: WfNewLibraryWord) => {
    if (!w.audioUrl) return;
    const el = audioRef.current;
    if (playingIndex === w.index && el) {
      el.pause();
      setPlayingIndex(null);
      return;
    }
    if (el) el.pause();
    const next = new Audio(w.audioUrl);
    audioRef.current = next;
    next.onended = () => setPlayingIndex((p) => (p === w.index ? null : p));
    next.onerror = () => setPlayingIndex((p) => (p === w.index ? null : p));
    next.play().then(() => setPlayingIndex(w.index)).catch(() => setPlayingIndex(null));
  }, [playingIndex]);

  const toggleExpand = useCallback((w: WfNewLibraryWord) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(w.index)) {
        next.delete(w.index);
      } else {
        next.add(w.index);
        // On first expand, kick off media resolution (enqueue+prioritize) for a
        // row that is still missing its image or audio.
        if (!w.hasImage || !w.hasAudio || w.images.length === 0 || !w.audioUrl) {
          requestWordMedia(w, libLang);
        }
      }
      return next;
    });
  }, [requestWordMedia, libLang]);

  const goTo = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(p, lastPage));
    if (clamped !== currentPage) onChangePage(clamped);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lastPage, currentPage, onChangePage]);

  // ---- dashboard (collapsible) -------------------------------------------- //
  const dashOpen = view === 'dash';
  const statCards = useMemo(() => ([
    { key: 'total', label: trans('library.stat.total'), value: stats?.total ?? data?.library?.totalWords ?? 0, tone: 'text-slate-100' },
    { key: 'translated', label: trans('library.stat.translated'), value: stats?.translated ?? 0, tone: 'text-emerald-300' },
    { key: 'audio', label: trans('library.stat.audio'), value: stats?.withAudio ?? 0, tone: 'text-sky-300' },
    { key: 'image', label: trans('library.stat.image'), value: stats?.withImage ?? 0, tone: 'text-violet-300' },
  ]), [stats, data, trans]);

  const wordRows = data?.words ?? [];

  const containerCls = fullscreen
    ? 'fixed inset-0 z-[200] bg-zinc-950/98 backdrop-blur-sm overflow-auto p-4 space-y-4'
    : 'space-y-4';

  return (
    <div className={containerCls}>
      {/* Toolbar (no header text — page title lives in the global nav): view
          toggle + fullscreen, kept right via the flex-1 spacer. */}
      <div className="flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1" />
        {/* dash / table toggle */}
        <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeView('dash')}
            className={`px-2.5 py-1.5 text-[11px] font-mono font-bold transition ${
              dashOpen ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {trans('library.view.dash')}
          </button>
          <button
            type="button"
            onClick={() => onChangeView('table')}
            className={`px-2.5 py-1.5 text-[11px] font-mono font-bold transition ${
              !dashOpen ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {trans('library.view.table')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((f) => !f)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition"
          title={fullscreen ? trans('library.exitFullscreen') : trans('library.fullscreen')}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsible stats dashboard */}
      <div className="mx-1 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <button
          type="button"
          onClick={() => onChangeView(dashOpen ? 'table' : 'dash')}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.04] transition"
        >
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
            {trans('library.dashboard')}
          </span>
          {dashOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>
        {dashOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pb-4">
            {statCards.map((c) => (
              <div key={c.key} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <p className={`text-xl font-black font-mono ${c.tone}`}>{Number(c.value).toLocaleString()}</p>
                <p className="text-[10px] font-mono text-zinc-500 uppercase mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Word table */}
      <div className="mx-1 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500 animate-pulse">{trans('library.loading')}</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-[12px] font-mono text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => goTo(currentPage)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
            >
              {trans('library.retry')}
            </button>
          </div>
        ) : wordRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[12px] font-mono text-zinc-500">{trans('content.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* column header */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_2fr_5rem] gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              <span>#</span>
              <span>{trans('library.col.word')}</span>
              <span>{trans('library.col.meaning')}</span>
              <span className="text-right">{trans('library.col.actions')}</span>
            </div>
            {wordRows.map((w) => {
              const isOpen = expanded.has(w.index);
              const isPlaying = playingIndex === w.index;
              // Overlay any on-demand resolved media on top of the page payload.
              const resolved = mediaByMd5[w.md5 || `${w.index}-${w.word}`];
              const effAudioUrl = w.audioUrl ?? resolved?.audioUrl ?? null;
              const effImages = w.images.length > 0
                ? w.images
                : (resolved?.imageUrl ? [resolved.imageUrl] : []);
              const requested = requestedMd5.current.has(w.md5 || `${w.index}-${w.word}`);
              // Pending = we've asked for it and it isn't ready yet (no url + not 'ready').
              const audioPending = !effAudioUrl && requested && resolved?.audioStatus !== 'ready';
              const imagePending = effImages.length === 0 && requested && resolved?.imageStatus !== 'ready';
              return (
                <div key={`${w.index}-${w.md5}`} className="px-4 py-2.5 hover:bg-white/[0.03] transition">
                  <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[3rem_1fr_2fr_5rem] gap-3 items-center">
                    <span className="text-[11px] font-mono text-zinc-600">{w.index}</span>
                    {/* word + phonetic */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100 truncate">{w.word}</span>
                        {!w.isValid && (
                          <span className="text-[9px] font-mono text-amber-500/80 border border-amber-500/30 rounded px-1">
                            {trans('library.invalid')}
                          </span>
                        )}
                      </div>
                      {(w.phonetic || w.usPhonetic) && (
                        <span className="text-[10px] font-mono text-zinc-500">/{w.phonetic || w.usPhonetic}/</span>
                      )}
                    </div>
                    {/* meaning (truncated until expanded) */}
                    <div className="hidden sm:block min-w-0">
                      <p className={`text-[12px] text-zinc-300 ${isOpen ? '' : 'truncate'}`}>
                        {w.translations.length > 0 ? w.translations.join('；') : (w.explanation || '—')}
                      </p>
                    </div>
                    {/* actions */}
                    <div className="flex items-center justify-end gap-1">
                      {effAudioUrl ? (
                        <button
                          type="button"
                          onClick={() => togglePlay({ ...w, audioUrl: effAudioUrl })}
                          className={`p-1.5 rounded-lg border transition ${
                            isPlaying
                              ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400'
                          }`}
                          title={trans('library.play')}
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      ) : audioPending ? (
                        <span
                          className="p-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-300/80"
                          title={trans('library.mediaPending')}
                        >
                          <WfNewLoadingDots className="text-sky-300/80" />
                        </span>
                      ) : null}
                      {effImages.length > 0 ? (
                        <span className="p-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300" title={trans('library.hasImage')}>
                          <ImageIcon className="w-3.5 h-3.5" />
                        </span>
                      ) : imagePending ? (
                        <span
                          className="p-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300/80"
                          title={trans('library.mediaPending')}
                        >
                          <WfNewLoadingDots className="text-violet-300/80" />
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleExpand(w)}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 transition"
                        title={trans('library.detail')}
                      >
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* expanded detail: full meaning + explanation + images */}
                  {isOpen && (
                    <div className="mt-2.5 ml-8 sm:ml-12 space-y-2.5 border-l border-white/10 pl-3">
                      {w.translations.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Languages className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <p className="text-[12px] text-zinc-200">{w.translations.join('；')}</p>
                        </div>
                      )}
                      {w.explanation && (
                        <div className="flex items-start gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-[12px] text-zinc-300 whitespace-pre-line">{w.explanation}</p>
                        </div>
                      )}
                      {(w.usPhonetic || w.ukPhonetic) && (
                        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                          {w.usPhonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />US /{w.usPhonetic}/</span>}
                          {w.ukPhonetic && <span><Volume2 className="w-3 h-3 inline mr-1" />UK /{w.ukPhonetic}/</span>}
                        </div>
                      )}
                      {effImages.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {effImages.map((src, i) => (
                            <img
                              key={`${w.index}-img-${i}`}
                              src={src}
                              alt={w.word}
                              loading="lazy"
                              className="w-20 h-20 object-cover rounded-lg border border-white/10 bg-black/30"
                            />
                          ))}
                        </div>
                      ) : imagePending ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="w-20 h-20 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center">
                            <WfNewLoadingDots size="md" className="text-violet-300/80" />
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                            {trans('library.mediaPending')}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Up / down pagination */}
      {!loading && !error && lastPage > 1 && (
        <div className="flex flex-col items-center gap-2 pt-1 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
            </button>
            <span className="px-3 text-[11px] font-mono text-zinc-400">
              {trans('content.pageOf', { page: currentPage, total: lastPage })}
            </span>
            <button
              type="button"
              onClick={() => goTo(currentPage + 1)}
              disabled={currentPage >= lastPage}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
            >
              {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
