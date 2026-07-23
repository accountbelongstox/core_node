/**
 * WfNewLibraryPage - the dedicated word-browser for ONE public vocabulary library
 * (e.g. "English Coca 60000"). Opened by clicking a library card on the home hub.
 * The route is fully reflected in the URL hash:
 *
 *   #/library/<libraryId>?page=<n>&view=<dash|table>
 *
 * Audio parity with the book reader (WfNewBookReader):
 *   - three-state icons (queued / processing / ready) via ttsStatusToCellState,
 *   - priority bump on visible/click (bumpSentenceAudioImmediate + wait),
 *   - click row plays it through WfLibraryPlayback (playFrom re-roots current),
 *   - play-all top-to-bottom with auto-advance,
 *   - auto-scroll active word to upper-middle; manual scroll pauses it 2.5s,
 *   - multi-audio variant picker when >1 ready variant.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Maximize2, Minimize2, Play, Pause, Square, Zap,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import {
  wfNewApi,
  type WfNewLibraryWord,
  type WfNewLibraryWordsPage,
  type WfNewWordMedia,
} from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { WfLibraryPlayback } from '../services/WfLibraryPlayback';
import {
  bumpSentenceAudioImmediate,
  requestSentenceAudio,
  resetSentenceAudioScheduler,
  waitForSentenceAudioUrl,
} from '../services/WfBookReaderSentenceAudio';
import { ttsStatusToCellState, type WfAudioCellState } from '../utils/WfAudioCellState';
import { pickSentenceAudioUrl, readerPreferredAccent } from '../utils/WfSentenceAudioPick';
import { buildWordCell } from '../utils/WfLibraryWordCell';
import { WfLibraryWordRow, wordRowKey } from '../components/library/WfLibraryWordRow';
import { useLibraryPuterAudio } from '../hooks/useLibraryPuterAudio';
import { useVisibleWordPriority } from '../hooks/useVisibleWordPriority';
import { pycoreApi } from '../../../core/api-libs/pycore';

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
const EMPTY_WORDS: WfNewLibraryWord[] = [];

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
  const [usePuterAudio, setUsePuterAudio] = useState<boolean>(() => wfNewSettings.get('usePuterAudio'));
  useEffect(() => { wfNewSettings.setField('usePuterAudio', usePuterAudio); }, [usePuterAudio]);
  // Per-word priority-boost tracking: md5 → 'idle'|'boosting'|'done'
  const [boostStatus, setBoostStatus] = useState<Record<string, 'idle' | 'boosting' | 'done'>>({});

  const onBoostPriority = useCallback(async (w: WfNewLibraryWord, lang: string) => {
    const md5 = w.md5 || `${w.index}-${w.word}`;
    if (boostStatus[md5] === 'boosting') return;
    setBoostStatus((prev) => ({ ...prev, [md5]: 'boosting' }));
    try {
      await pycoreApi.boostWordAudioPriority(md5, lang);
      setBoostStatus((prev) => ({ ...prev, [md5]: 'done' }));
    } catch {
      setBoostStatus((prev) => ({ ...prev, [md5]: 'idle' }));
    }
  }, [boostStatus]);

  // ---- On-demand word media (image/audio) --------------------------------- //
  // For a row whose image/audio is missing we call getWordMedia(lang, word) ONCE
  // - that READS current media AND tells the backend to enqueue+prioritize the
  // missing files. Polled a few times until ready, then overlaid on the row.
  const [mediaByMd5, setMediaByMd5] = useState<Record<string, WfNewWordMedia>>({});
  const requestedMd5 = useRef<Set<string>>(new Set());
  const pollTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // ---- Playback (parity with WfNewBookReader) ----------------------------- //
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeWord, setActiveWord] = useState<WfNewLibraryWord | null>(null);
  const [cellStatuses, setCellStatuses] = useState<Record<string, WfAudioCellState>>({});
  const [variantByKey, setVariantByKey] = useState<Record<string, string>>({});

  const wordsRef = useRef<WfNewLibraryWord[]>([]);
  const langRef = useRef('english');
  const variantByKeyRef = useRef<Record<string, string>>({});
  const mediaByMd5Ref = useRef<Record<string, WfNewWordMedia>>({});
  const requestedWordKeys = useRef<Set<string>>(new Set());
  const playbackRef = useRef<WfLibraryPlayback | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollPausedUntil = useRef(0);
  const userPickedWord = useRef(false);

  const libName = data?.library?.name || title || libraryId;
  const libLang = data?.library?.language || language || 'english';
  const nativeLang = wfNewSettings.get('settingNativeLang') || 'zh';
  const bindVisiblePriority = useVisibleWordPriority(libLang, nativeLang);
  langRef.current = libLang;
  const stats = data?.stats;
  const pg = data?.pagination;
  const lastPage = pg?.lastPage ?? 1;
  const currentPage = pg?.currentPage ?? page;

  const wordRows = data?.words ?? EMPTY_WORDS;
  useEffect(() => { wordsRef.current = wordRows; }, [wordRows]);
  useEffect(() => { variantByKeyRef.current = variantByKey; }, [variantByKey]);
  useEffect(() => { mediaByMd5Ref.current = mediaByMd5; }, [mediaByMd5]);

  /**
   * Resolve (+enqueue) media for one word, then poll up to `maxTries` times every
   * ~4s until both image & audio are ready. One in-flight chain per md5.
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
        .catch(() => { requestedMd5.current.delete(md5); });
    };
    attempt(1);
  }, []);

  const setCellStatus = useCallback((key: string, state: WfAudioCellState) => {
    setCellStatuses((prev) => (prev[key] === state ? prev : { ...prev, [key]: state }));
  }, []);

  /** A Puter-synthesized clip landed: flip the word to hasAudio + a playable
   *  blob URL and mark its cell ready so the row icon updates immediately. */
  const onPuterAudioReady = useCallback((md5: string, audioUrl: string) => {
    const lang = langRef.current;
    setData((prev) => {
      if (!prev) return prev;
      let bumped = false;
      const nextWords = prev.words.map((w) => {
        if (w.md5 === md5) {
          if (!w.hasAudio) bumped = true;
          return { ...w, hasAudio: true, audioUrl };
        }
        return w;
      });
      return {
        ...prev,
        words: nextWords,
        stats: bumped ? { ...prev.stats, withAudio: prev.stats.withAudio + 1 } : prev.stats,
      };
    });
    setCellStatus(`${md5}:${lang}`, 'ready');
  }, [setCellStatus]);

  /** Queued (non-urgent) resolve/bump for a word missing audio - drives the
   *  three-state icon from the sentence-audio scheduler. */
  const requestWordAudio = useCallback((w: WfNewLibraryWord, lang: string) => {
    const text = w.word?.trim();
    if (!text) return;
    const key = wordRowKey(w, lang);
    if (requestedWordKeys.current.has(key)) return;
    requestedWordKeys.current.add(key);
    setCellStatus(key, 'queued');
    requestSentenceAudio(text, lang, {
      onStatus: ({ exists, queued, tts_status }) => {
        setCellStatus(key, ttsStatusToCellState(exists, tts_status, queued));
      },
      onReady: () => setCellStatus(key, 'ready'),
      onSettled: (url) => { if (!url) requestedWordKeys.current.delete(key); },
    });
  }, [setCellStatus]);

  /** Urgent re-bump + wait (icon click on a missing/queued word). */
  const retryWordAudio = useCallback((w: WfNewLibraryWord) => {
    const text = w.word?.trim();
    if (!text) return;
    const lang = langRef.current;
    const key = wordRowKey(w, lang);
    const variantKey = variantByKeyRef.current[key];
    requestedWordKeys.current.add(key);
    setCellStatus(key, 'queued');
    void bumpSentenceAudioImmediate(text, lang, variantKey);
    void waitForSentenceAudioUrl(text, lang, {
      urgent: true,
      variantKey: variantKey || undefined,
      onStatus: ({ exists, queued, tts_status }) => {
        setCellStatus(key, ttsStatusToCellState(exists, tts_status, queued));
      },
      onReady: () => setCellStatus(key, 'ready'),
      onSettled: (url) => { if (!url) requestedWordKeys.current.delete(key); },
    });
  }, [setCellStatus]);

  /** Resolve an absolute MP3 url for a word (playback). Pick from ready
   *  variants first; else poll the sentence-audio scheduler. Stable callback
   *  (reads media/variant via refs) so the playback engine is not rebuilt. */
  const resolveAudioUrl = useCallback(async (
    w: WfNewLibraryWord,
    shouldContinue?: () => boolean,
  ): Promise<string | null> => {
    const lang = langRef.current;
    const key = wordRowKey(w, lang);
    const variantKey = variantByKeyRef.current[key];
    const preferredAccent = readerPreferredAccent(wfNewSettings.get('voiceAccent'));
    const resolved = mediaByMd5Ref.current[w.md5 || `${w.index}-${w.word}`];
    const cell = buildWordCell(w, resolved);
    const picked = pickSentenceAudioUrl(cell, { variantKey, preferredAccent });
    if (picked.url) return picked.url;
    const text = w.word?.trim();
    if (!text) return null;
    return waitForSentenceAudioUrl(text, lang, {
      urgent: true,
      shouldContinue,
      variantKey: variantKey || undefined,
      onReady: () => setCellStatus(key, 'ready'),
    });
  }, [setCellStatus]);

  // Build the playback engine once; deps read latest via refs.
  useEffect(() => {
    playbackRef.current = new WfLibraryPlayback({
      getWords: () => wordsRef.current,
      getLang: () => langRef.current,
      autoAdvance: () => true,
      onPlayingKey: setPlayingKey,
      onPlaying: setPlaying,
      onPaused: setPaused,
      onWordActive: setActiveWord,
      resolveAudioUrl,
      bumpMissingAudio: (w, lang) => {
        const key = wordRowKey(w, lang);
        const variantKey = variantByKeyRef.current[key];
        void bumpSentenceAudioImmediate(w.word, lang, variantKey);
      },
    });
    return () => { playbackRef.current?.stop(); };
  }, [resolveAudioUrl]);

  // Cancel polls + reset request guards when the page payload changes.
  useEffect(() => {
    requestedMd5.current = new Set();
    requestedWordKeys.current = new Set();
    setMediaByMd5({});
    setCellStatuses({});
    resetSentenceAudioScheduler();
    playbackRef.current?.stop();
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
      .then((res) => { if (alive) setData(res); })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message ? String(e.message) : 'Failed to load library words.');
        setData(null);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [libraryId, page, perPage]);

  // Seed cell statuses from the page payload + queue resolve for missing audio.
  useEffect(() => {
    if (!wordRows.length) return;
    const next: Record<string, WfAudioCellState> = {};
    for (const w of wordRows) {
      const key = wordRowKey(w, libLang);
      const cell = buildWordCell(w, mediaByMd5[w.md5 || `${w.index}-${w.word}`]);
      if (cell.hasAudio) next[key] = 'ready';
      else if (cell.ttsStatus === 'processing') next[key] = 'processing';
      else if (cell.ttsStatus === 'pending') next[key] = 'queued';
      else if (!cell.hasAudio) {
        // No audio at all -> ask the scheduler to resolve/bump (queued).
        requestWordAudio(w, libLang);
      }
    }
    if (Object.keys(next).length) setCellStatuses((prev) => ({ ...prev, ...next }));
  }, [wordRows, libLang, mediaByMd5, requestWordAudio]);

  // Auto-scroll the active word to upper-middle (~1/3 from top). Manual scroll
  // pauses this for 2.5s; a user-picked playFrom resumes immediately.
  useEffect(() => {
    if (!activeWord) return;
    if (!userPickedWord.current && Date.now() < scrollPausedUntil.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector(`#libword-${activeWord.md5 || activeWord.index}`) as HTMLElement | null;
    if (!el) return;
    container.scrollTo({ top: el.offsetTop - container.clientHeight / 3, behavior: 'smooth' });
    userPickedWord.current = false;
  }, [activeWord, playingKey]);

  const onScrollUser = useCallback(() => {
    scrollPausedUntil.current = Date.now() + 2500;
  }, []);

  const onPlay = useCallback((w: WfNewLibraryWord) => {
    userPickedWord.current = true;
    scrollPausedUntil.current = 0;
    void playbackRef.current?.playFrom(w);
  }, []);

  const onToggleExpand = useCallback((w: WfNewLibraryWord) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(w.index)) {
        next.delete(w.index);
      } else {
        next.add(w.index);
        if (!w.hasImage || !w.hasAudio || w.images.length === 0 || !w.audioUrl) {
          requestWordMedia(w, libLang);
        }
      }
      return next;
    });
  }, [requestWordMedia, libLang]);

  const onVariantSelect = useCallback((wordKey: string, variantKey: string) => {
    setVariantByKey((prev) => ({ ...prev, [wordKey]: variantKey }));
  }, []);

  const playAll = useCallback(() => {
    if (!wordRows.length) return;
    userPickedWord.current = true;
    scrollPausedUntil.current = 0;
    void playbackRef.current?.playFrom(wordRows[0]);
  }, [wordRows]);

  const onPlayPause = useCallback(() => {
    if (playing) playbackRef.current?.togglePause();
    else if (activeWord) void playbackRef.current?.playFrom(activeWord);
    else if (wordRows[0]) void playbackRef.current?.playFrom(wordRows[0]);
  }, [playing, activeWord, wordRows]);

  const goTo = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(p, lastPage));
    if (clamped !== currentPage) onChangePage(clamped);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lastPage, currentPage, onChangePage]);

  // Auto-generate missing word audio via Puter.js (current page + next 3 pages).
  useLibraryPuterAudio({
    libraryId,
    page,
    perPage,
    lastPage,
    lang: libLang,
    words: wordRows,
    enabled: usePuterAudio,
    onAudioReady: onPuterAudioReady,
  });

  // ---- dashboard (collapsible) -------------------------------------------- //
  const dashOpen = view === 'dash';
  const statCards = useMemo(() => ([
    { key: 'total', label: trans('library.stat.total'), value: stats?.total ?? data?.library?.totalWords ?? 0, tone: 'text-slate-100' },
    { key: 'translated', label: trans('library.stat.translated'), value: stats?.translated ?? 0, tone: 'text-emerald-300' },
    { key: 'audio', label: trans('library.stat.audio'), value: stats?.withAudio ?? 0, tone: 'text-sky-300' },
    { key: 'image', label: trans('library.stat.image'), value: stats?.withImage ?? 0, tone: 'text-violet-300' },
  ]), [stats, data, trans]);

  const containerCls = fullscreen
    ? 'fixed inset-0 z-[200] bg-zinc-950/98 backdrop-blur-sm overflow-auto p-4 space-y-4'
    : 'space-y-4';

  const activeKey = activeWord ? wordRowKey(activeWord, libLang) : null;
  const listMaxHeight = fullscreen ? '70vh' : 'min(60vh, 560px)';

  return (
    <div className={containerCls}>
      {/* Toolbar: view toggle + fullscreen (page title lives in the global nav). */}
      <div className="flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => setUsePuterAudio((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 transition"
          title="Auto-generate missing word audio via Puter.js (current page + next 3 pages), saved to backend"
        >
          <span className={`relative inline-block w-7 h-3.5 rounded-full transition ${usePuterAudio ? 'bg-emerald-500/70' : 'bg-white/15'}`}>
            <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${usePuterAudio ? 'left-4' : 'left-0.5'}`} />
          </span>
          <span className={usePuterAudio ? 'text-emerald-200' : 'text-zinc-400'}>Puter Audio</span>
        </button>
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
          <>
            {/* Play-all bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.02]">
              <button
                type="button"
                onClick={onPlayPause}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-indigo-500/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 transition"
              >
                {playing && !paused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {playing && !paused ? trans('content.pause') : trans('content.play')}
              </button>
              <button
                type="button"
                onClick={playAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition"
              >
                <Play className="w-3.5 h-3.5" /> {trans('library.playAll')}
              </button>
              {playing && (
                <button
                  type="button"
                  onClick={() => playbackRef.current?.stop()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition"
                >
                  <Square className="w-3.5 h-3.5" /> {trans('content.stop')}
                </button>
              )}
            </div>
            {/* column header */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_2fr_5rem] gap-3 px-4 py-2 bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              <span>#</span>
              <span>{trans('library.col.word')}</span>
              <span>{trans('library.col.meaning')}</span>
              <span className="text-right">{trans('library.col.actions')}</span>
            </div>
            {/* Scrollable word list (scrollRef here for auto-scroll math). */}
            <div
              ref={scrollRef}
              className="divide-y divide-white/5 overflow-y-auto relative"
              style={{ maxHeight: listMaxHeight }}
              onWheel={onScrollUser}
              onTouchStart={onScrollUser}
            >
              {wordRows.map((w) => {
                const md5 = w.md5 || `${w.index}-${w.word}`;
                const resolved = mediaByMd5[md5];
                const requested = requestedMd5.current.has(md5);
                const effImages = w.images.length > 0
                  ? w.images
                  : (resolved?.imageUrl ? [resolved.imageUrl] : []);
                const imagePending = effImages.length === 0 && requested && resolved?.imageStatus !== 'ready';
                const bs = boostStatus[md5] || 'idle';
                return (
                  <div key={`${w.index}-${w.md5}`} className="relative group">
                    <WfLibraryWordRow
                      word={w}
                      resolved={resolved}
                      lang={libLang}
                      open={expanded.has(w.index)}
                      playingKey={playingKey}
                      activeKey={activeKey}
                      cellStatuses={cellStatuses}
                      variantByKey={variantByKey}
                      onVariantSelect={onVariantSelect}
                      onPlay={onPlay}
                      onRetry={retryWordAudio}
                      onToggleExpand={onToggleExpand}
                      trans={trans}
                      requested={requested}
                      imagePending={imagePending}
                      effImages={effImages}
                      theme={theme}
                      rowRef={bindVisiblePriority({
                        md5,
                        word: w.word,
                        hasTranslation: w.hasTranslation,
                        hasAudio: w.hasAudio,
                      })}
                    />
                    {/* Priority boost button — visible on hover, moves word to front of audio queue */}
                    {!w.hasAudio && (
                      <button
                        type="button"
                        title="Boost audio priority — move this word to the front of the batch queue"
                        onClick={() => onBoostPriority(w, libLang)}
                        disabled={bs === 'boosting'}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
                          p-1 rounded text-[10px] font-bold z-10
                          ${bs === 'done' ? 'text-emerald-400 bg-emerald-900/40' :
                            bs === 'boosting' ? 'text-amber-400 bg-amber-900/40 animate-pulse' :
                            'text-zinc-400 bg-zinc-800/70 hover:text-amber-300 hover:bg-amber-900/40'}`}
                      >
                        <Zap className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
