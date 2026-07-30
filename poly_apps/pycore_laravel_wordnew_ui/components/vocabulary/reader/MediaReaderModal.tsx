import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, FileText, List as ListIcon, Rows, Volume2, VolumeX, Pause,
  Play, Square, ChevronLeft, ChevronRight, X as CloseIcon,
} from 'lucide-react';
import { api } from '../../../core/api';
import type { ReaderSentence, ReaderChapter, ReaderDetailParams } from '../../../core/api/modules/MediaQueryAPI';
import { SUPPORTED_LEARNING_LANGUAGES } from '../../../core/i18n/supportedLearningLanguages';
import { commonClasses } from '../../../styles/theme';
import { Modal } from '../../common';
import { LoadingBlock, EmptyState } from '../../common';
import { useToast } from '../../admin';
import { readerAudioUrl, resolveCell, sentenceKey, collectLangs, bestLang, chapterTitle } from './mediaReader';

/**
 * MediaReaderModal — full-screen reader for an ingested book OR uploaded
 * document. Two modes:
 *   - Chapters: pick a chapter, read its verses (books only, when chaptered).
 *   - Sentences: read the whole source, paginated (multi-page).
 * Every sentence shows an audio icon top-right (has_audio-gated; missing → a
 * prompt). Clicking it starts CONTINUOUS playback from that sentence and keeps
 * reading — across pages and chapters — until the user pauses/stops.
 */

interface MediaReaderModalProps {
  open: boolean;
  onClose: () => void;
  kind: 'book' | 'document';
  /** book */
  sourceKey?: string;
  /** document */
  documentId?: number | string;
  title: string;
}

type ReaderMode = 'chapters' | 'sentences';

/** The paging position a continuation must cross from — carried explicitly so it
 * never depends on refs that React has not yet committed after an auto page/chapter turn. */
interface PlayPos {
  page: number;
  lastPage: number;
  chapterIndex: number | null;
}

const SENTENCE_PER_PAGE = 50;   // multi-page sentence mode
const CHAPTER_PER_PAGE = 500;   // a chapter is a natural unit (rarely paged)
// During continuous playback, cross at most this many consecutive audio-less
// pages/chapters before giving up — so a no-TTS source doesn't crawl the whole
// book flipping pages when the user presses Read.
const MAX_EMPTY_CROSS = 3;

const langName = (code: string): string =>
  SUPPORTED_LEARNING_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();

const MediaReaderModal: React.FC<MediaReaderModalProps> = ({ open, onClose, kind, sourceKey, documentId, title }) => {
  const toast = useToast();

  const [mode, setMode] = useState<ReaderMode>('sentences');
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const [readLang, setReadLang] = useState<string>('');
  const [activeChapter, setActiveChapter] = useState<number | null>(null);

  const [sentences, setSentences] = useState<ReaderSentence[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // `playing` reflects playingRef for the toolbar Read/Stop button — it stays
  // true even while continuous playback crosses an audio-less page (when no
  // sentence key is set yet), so the button always agrees with the action.
  const [playing, setPlaying] = useState(false);

  // --- live refs (read synchronously by the stable playback callbacks) ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const readLangRef = useRef('');
  const modeRef = useRef<ReaderMode>('sentences');
  const pageRef = useRef(1);
  const lastPageRef = useRef(1);
  const activeChapterRef = useRef<number | null>(null);
  const chaptersRef = useRef<ReaderChapter[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Monotonic token: every user navigation / load bumps it so a stale in-flight
  // continuation load resolves into a no-op (never overwrites newer view/intent).
  const loadSeqRef = useRef(0);
  // Count of in-flight load()s — `loading` is (count > 0). Decoupled from
  // loadSeqRef so a superseded/aborted load still clears its own loading share.
  const loadCountRef = useRef(0);
  // Per-play token: incremented on every playAt so a stale media handler
  // (onerror + play().catch double-fire, or a pause/replace AbortError) can't
  // trigger a spurious advance.
  const playTokenRef = useRef(0);
  // Count of consecutive audio-less page/chapter crossings during one playback
  // run; reset whenever a sentence actually plays. Bounds the audio hunt.
  const emptyCrossRef = useRef(0);
  const playForwardRef = useRef<(list: ReaderSentence[], fromIndex: number, pos: PlayPos) => void>(() => {});
  readLangRef.current = readLang;
  modeRef.current = mode;
  pageRef.current = page;
  lastPageRef.current = lastPage;
  activeChapterRef.current = activeChapter;
  chaptersRef.current = chapters;

  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  };

  /** Fully release the audio element: abort any in-flight download + drop handlers. */
  const releaseAudio = useCallback(() => {
    loadSeqRef.current += 1;
    playTokenRef.current += 1;
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch { /* ignore */ }
      a.onended = null;
      a.onerror = null;
      a.onplaying = null;
      try { a.removeAttribute('src'); a.load(); } catch { /* ignore */ }
    }
    playingRef.current = false;
    pausedRef.current = false;
    setPlayingKey(null);
    setPaused(false);
    setPlaying(false);
  }, []);

  /** Stop continuous playback (pause audio, drop the playing highlight, cancel pending loads). */
  const stopPlayback = useCallback(() => {
    loadSeqRef.current += 1;               // cancel any pending auto-advance page/chapter load
    playTokenRef.current += 1;             // invalidate any pending media-handler advance
    playingRef.current = false;
    pausedRef.current = false;
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch { /* ignore */ } a.onended = null; a.onerror = null; a.onplaying = null; }
    setPlayingKey(null);
    setPaused(false);
    setPlaying(false);
  }, []);

  // --- data loading (one loader; per_page depends on chapter vs sentence mode) ---
  //  keepOnError    : a continuation (auto page/chapter turn) — on failure keep the
  //                   current page visible + toast, never blank the reader.
  //  requirePlaying : a continuation — if the user stopped mid-load, discard the
  //                   result (don't flip the visible page/chapter after a Stop).
  const load = useCallback(
    async (opts: { page: number; chapterIndex: number | null; keepOnError?: boolean; requirePlaying?: boolean }): Promise<{ items: ReaderSentence[]; pos: PlayPos } | null> => {
      const myTurn = (loadSeqRef.current += 1);
      loadCountRef.current += 1;
      setLoading(true);
      if (!opts.keepOnError) setError(null);
      const params: ReaderDetailParams = {
        page: opts.page,
        per_page: opts.chapterIndex != null ? CHAPTER_PER_PAGE : SENTENCE_PER_PAGE,
      };
      if (opts.chapterIndex != null) params.chapter_index = opts.chapterIndex;
      try {
        const res = kind === 'book'
          ? await api.mediaQuery.getBookDetail(sourceKey as string, params)
          : await api.mediaQuery.getDocumentDetail(documentId as string | number, params);
        if (loadSeqRef.current !== myTurn) return null;                          // superseded by a newer nav/stop
        if (opts.requirePlaying && (!playingRef.current || pausedRef.current)) return null;  // user stopped/paused mid-load
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to load content');
        const s = res.data.sentences;
        const items = Array.isArray(s?.items) ? s.items : [];
        const resolvedPage = s?.current_page ?? opts.page;
        const resolvedLast = s?.last_page ?? 1;
        setSentences(items);
        setPage(resolvedPage);
        setLastPage(resolvedLast);
        setTotal(s?.total ?? 0);
        setError(null);
        // On a user-initiated load, ensure the reading language actually has
        // content on THIS page/chapter — otherwise the whole view would blank
        // (resolveCell has no cross-language fallback). Continuation loads keep
        // the language fixed (they must not switch language mid-playback).
        if (!opts.keepOnError) {
          const cl = collectLangs(items);
          if (cl.length && !cl.includes(readLangRef.current)) setReadLang(bestLang(items, cl));
        }
        // pos.page uses the REQUESTED page (not the backend-echoed current_page) so
        // the continuation always advances monotonically and can never re-request
        // the same page forever if a paginator normalizes/clamps current_page.
        return { items, pos: { page: opts.page, lastPage: resolvedLast, chapterIndex: opts.chapterIndex } };
      } catch (e: any) {
        if (loadSeqRef.current !== myTurn) return null;                // stale failure — stay quiet
        if (opts.keepOnError) {
          // continuation failed — keep the current page visible. If the user has
          // paused, preserve the pause (resuming re-attempts the crossing) and say
          // so; otherwise end playback cleanly. Never converts a pause into a stop.
          if (pausedRef.current) {
            toast.error('Could not load the next page — resume to retry');
          } else {
            toast.error('Could not load the next page — playback stopped');
            stopPlayback();
          }
        } else {
          setSentences([]);
          setLastPage(1);              // hide the now-meaningless pager under the error
          setTotal(0);
          setError(e?.message || 'Failed to load content');
        }
        return null;
      } finally {
        loadCountRef.current = Math.max(0, loadCountRef.current - 1);
        setLoading(loadCountRef.current > 0);
      }
    },
    [kind, sourceKey, documentId, toast, stopPlayback]
  );

  // --- playback (stable callbacks; moving state via refs, paging pos passed explicitly) ---
  const playAt = useCallback((list: ReaderSentence[], index: number, pos: PlayPos) => {
    const s = list[index];
    if (!s) { stopPlayback(); return; }
    const cell = resolveCell(s, readLangRef.current);
    const url = cell.hasAudio ? readerAudioUrl(cell.audioBare) : undefined;
    if (!url) { playForwardRef.current(list, index, pos); return; }   // skip un-playable, keep reading
    const audio = ensureAudio();
    const myToken = (playTokenRef.current += 1);
    // Advance only if THIS play is still the active one and we're not paused —
    // stops a pause/replace AbortError being mistaken for a broken file. Consuming
    // the token (single-shot) also dedupes onended/onerror/play().catch all firing
    // for the same play (e.g. a 404 fires both onerror and play()-reject), which
    // would otherwise launch two continuation loads at a page boundary.
    const skipForward = () => {
      if (playTokenRef.current !== myToken) return;
      if (!playingRef.current || pausedRef.current) return;   // don't consume; may still resume
      playTokenRef.current += 1;
      playForwardRef.current(list, index, pos);
    };
    try { audio.pause(); } catch { /* ignore */ }
    audio.src = url;
    // Reset the audio-less hunt bound only when audio ACTUALLY starts (the browser
    // fires `playing`), NOT merely because a URL exists — otherwise a source whose
    // has_audio cells all 404 would reset the counter on every attempt and crawl the
    // whole book (the counter would never reach MAX_EMPTY_CROSS).
    audio.onplaying = () => { emptyCrossRef.current = 0; };
    audio.onended = skipForward;
    audio.onerror = skipForward;
    pausedRef.current = false;
    setPaused(false);
    setPlayingKey(sentenceKey(s));
    audio.play().catch(skipForward);
  }, [stopPlayback]);

  /**
   * Continuous reader: play the first sentence WITH audio at index > fromIndex in
   * `list`; when the list is exhausted, page/chapter FORWARD from the EXPLICIT
   * `pos` (skipping fully audio-less pages/chapters) until audio runs out or the
   * user stops/pauses. `fromIndex = -1` reads from the start of the list.
   */
  const playForward = useCallback((list: ReaderSentence[], fromIndex: number, pos: PlayPos) => {
    if (!playingRef.current || pausedRef.current) return;
    for (let i = fromIndex + 1; i < list.length; i += 1) {
      if (resolveCell(list[i], readLangRef.current).hasAudio) { playAt(list, i, pos); return; }
    }
    // No audio on this page — bound the hunt so a no-TTS source doesn't crawl the
    // whole book flipping pages/chapters looking for audio that isn't there.
    emptyCrossRef.current += 1;
    if (emptyCrossRef.current > MAX_EMPTY_CROSS) { toast.error('No more audio to read'); stopPlayback(); return; }
    // Exhausted this page — advance into the next page, then the next chapter.
    // `pos` is authoritative (refs may not be committed yet after a prior turn).
    if (pos.page < pos.lastPage) {
      load({ page: pos.page + 1, chapterIndex: pos.chapterIndex, keepOnError: true, requirePlaying: true })
        .then((r) => { if (r && playingRef.current && !pausedRef.current) playForwardRef.current(r.items, -1, r.pos); });
      return;
    }
    if (pos.chapterIndex != null) {
      const chs = chaptersRef.current;
      const at = chs.findIndex((c) => c.chapter_index === pos.chapterIndex);
      const next = at >= 0 ? chs[at + 1] : undefined;
      if (next) {
        load({ page: 1, chapterIndex: next.chapter_index, keepOnError: true, requirePlaying: true })
          .then((r) => {
            if (r && playingRef.current && !pausedRef.current) { setActiveChapter(next.chapter_index); playForwardRef.current(r.items, -1, r.pos); }
          });
        return;
      }
    }
    stopPlayback();   // nothing playable left anywhere
  }, [playAt, load, stopPlayback, toast]);
  playForwardRef.current = playForward;

  /** The paging position the currently-visible list occupies (built from committed state). */
  const currentPos = (): PlayPos => ({ page, lastPage, chapterIndex: mode === 'chapters' ? activeChapter : null });

  /** Click a sentence's audio icon: pause/resume the current one, else read from here. */
  const onSentenceAudio = (index: number) => {
    const s = sentences[index];
    if (!s) return;
    const cell = resolveCell(s, readLang);
    if (!cell.hasAudio) { toast.error('No audio available for this sentence'); return; }
    if (playingKey === sentenceKey(s)) {
      const audio = audioRef.current;
      if (pausedRef.current) {                       // resume
        pausedRef.current = false; setPaused(false);
        if (audio && !audio.ended && audio.currentSrc) {
          audio.play().catch(() => { /* transient resume failure — user can retry */ });
        } else {
          emptyCrossRef.current = 0;                      // fresh user intent → reset the hunt bound
          playForward(sentences, index, currentPos());   // paused in a page-turn gap → continue forward
        }
      } else {                                       // pause, keep position + highlight
        pausedRef.current = true; setPaused(true);
        try { audio?.pause(); } catch { /* ignore */ }
      }
      return;
    }
    loadSeqRef.current += 1;                          // a manual pick supersedes any pending auto-advance
    emptyCrossRef.current = 0;                        // fresh user intent → reset the hunt bound
    playingRef.current = true;
    pausedRef.current = false; setPaused(false); setPlaying(true);
    playAt(sentences, index, currentPos());
  };

  const toggleReadAll = () => {
    if (playingRef.current) { stopPlayback(); return; }
    // Read starts only where there is audio ON THIS page — otherwise it would
    // crawl forward hunting (bad for a no-TTS source). Continuous playback still
    // crosses into later pages/chapters once started.
    const anyHere = sentences.some((s) => resolveCell(s, readLang).hasAudio);
    if (!anyHere) { toast.error('No audio available to read yet'); return; }
    loadSeqRef.current += 1;                          // supersede any in-flight navigation load
    emptyCrossRef.current = 0;
    playingRef.current = true;
    pausedRef.current = false; setPaused(false); setPlaying(true);
    playForward(sentences, -1, currentPos());
  };

  /** Change reading/audio language — stop playback (positions/keys differ per language). */
  const changeReadLang = (l: string) => {
    if (playingRef.current) stopPlayback();
    setReadLang(l);
  };

  // --- open / source change: init chapters + first page ---
  // The reading language is chosen and kept valid by load() itself (it switches
  // to a content-bearing language whenever the current one is empty on the loaded
  // page), so this effect only wires up chapters + the first page.
  useEffect(() => {
    if (!open) return;
    stopPlayback();
    setError(null);
    setSentences([]);
    setChapters([]);
    setActiveChapter(null);
    setReadLang('');
    // Show the loading state across the WHOLE open sequence — including the
    // chapters fetch that precedes the first load() — so a slow backend renders a
    // spinner, not a transient "no readable content" empty. load()'s finally
    // (loadCountRef-driven) clears it once the first page resolves.
    const willLoad = (kind === 'book' && !!sourceKey) || (kind === 'document' && documentId != null);
    if (willLoad) setLoading(true);
    let cancelled = false;

    (async () => {
      if (kind === 'book' && sourceKey) {
        let chs: ReaderChapter[] = [];
        try {
          const chRes = await api.mediaQuery.getBookChapters(sourceKey);
          if (chRes.success && chRes.data) {
            chs = Array.isArray(chRes.data.chapters) ? chRes.data.chapters : [];
          }
        } catch { /* chapterless / offline — fall through to flat sentences */ }
        if (cancelled) return;
        setChapters(chs);
        if (chs.length > 0) {
          setMode('chapters');
          setActiveChapter(chs[0].chapter_index);
          await load({ page: 1, chapterIndex: chs[0].chapter_index });
        } else {
          setMode('sentences');
          await load({ page: 1, chapterIndex: null });
        }
      } else if (kind === 'document' && documentId != null) {
        setMode('sentences');
        await load({ page: 1, chapterIndex: null });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, sourceKey, documentId]);

  // Release audio (abort download + drop handlers) when the modal closes / unmounts.
  useEffect(() => {
    if (!open) releaseAudio();
    return () => releaseAudio();
  }, [open, releaseAudio]);

  // Keep the currently-playing sentence in view during continuous reading.
  useEffect(() => {
    if (!playingKey || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-skey="${playingKey}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [playingKey, sentences]);

  // Safety net for the reading language: when NOT playing, ensure readLang has
  // content on the visible page. load() already revalidates on user navigation,
  // but a continuous-playback continuation keeps readLang fixed and can stop on a
  // page where that language is empty (all verses blank) — this restores a
  // content-bearing language once playback ends. Gated on !playing so it never
  // switches language out from under an active read.
  useEffect(() => {
    if (playing || sentences.length === 0) return;
    const cl = collectLangs(sentences);
    if (cl.length && !cl.includes(readLang)) setReadLang(bestLang(sentences, cl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences, playing]);

  // --- mode + chapter + page controls ---
  const switchMode = (next: ReaderMode) => {
    if (next === mode) return;
    stopPlayback();
    setMode(next);
    if (next === 'chapters') {
      const ch = activeChapter ?? (chapters[0]?.chapter_index ?? 0);
      setActiveChapter(ch);
      void load({ page: 1, chapterIndex: ch });
    } else {
      // Keep activeChapter so returning to Chapters mode restores the last chapter
      // (currentPos/goToPage already scope to null while mode==='sentences').
      void load({ page: 1, chapterIndex: null });
    }
  };

  const selectChapter = (chIndex: number) => {
    stopPlayback();
    setActiveChapter(chIndex);
    void load({ page: 1, chapterIndex: chIndex });
  };

  const goToPage = (p: number) => {
    stopPlayback();
    const clamped = Math.max(1, Math.min(lastPage, p));
    void load({ page: clamped, chapterIndex: mode === 'chapters' ? activeChapter : null });
  };

  const hasChapters = kind === 'book' && chapters.length > 0;
  // Offer only the languages present ON THE CURRENT PAGE, so a pick can never
  // blank the view (resolveCell has no cross-language fallback); load() switches
  // readLang to one of these whenever a navigation lands on a page without it.
  const pageLangs = useMemo(() => collectLangs(sentences), [sentences]);
  const showLangSelect = pageLangs.length > 1;
  const Icon = kind === 'book' ? BookOpen : FileText;
  const emptyMsg = kind === 'document'
    ? 'No readable content yet — extract sentences for this document first.'
    : 'No readable content in this source.';

  return (
    <Modal isOpen={open} onClose={onClose} size="full" showCloseButton={false} className="h-[90vh]">
      <div className="flex flex-col h-full -my-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-lg flex items-center gap-2 min-w-0">
            <Icon className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span className="truncate" title={title}>{title}</span>
          </h2>

          {/* Mode toggle */}
          {hasChapters && (
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => switchMode('chapters')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === 'chapters' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
              >
                <ListIcon className="w-4 h-4" /> Chapters
              </button>
              <button
                type="button"
                onClick={() => switchMode('sentences')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === 'sentences' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
              >
                <Rows className="w-4 h-4" /> Sentences
              </button>
            </div>
          )}

          {showLangSelect && (
            <select
              value={readLang}
              onChange={(e) => changeReadLang(e.target.value)}
              className={`${commonClasses.input} text-sm py-1.5`}
              title="Reading / audio language"
            >
              {pageLangs.map((l) => (
                <option key={l} value={l}>{langName(l)}</option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          {/* Read-all / stop — driven by `playing` (not playingKey) so it stays a
              working Stop even while playback crosses an audio-less page. */}
          <button
            type="button"
            onClick={toggleReadAll}
            disabled={!playing && sentences.length === 0}
            className={`${commonClasses.button} ${playing ? 'bg-rose-600 hover:bg-rose-700 text-white' : commonClasses.buttonPrimary} flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50`}
          >
            {playing ? <><Square className="w-4 h-4" /> Stop</> : <><Play className="w-4 h-4" /> Read</>}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Chapter rail */}
          {mode === 'chapters' && hasChapters && (
            <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-700 py-2 pr-2">
              {chapters.map((ch) => (
                <button
                  key={ch.chapter_index}
                  type="button"
                  onClick={() => selectChapter(ch.chapter_index)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-0.5 truncate ${
                    activeChapter === ch.chapter_index
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                  title={chapterTitle(ch.titles, readLang, ch.chapter_index)}
                >
                  {chapterTitle(ch.titles, readLang, ch.chapter_index)}
                  {ch.sentence_count > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">({ch.sentence_count})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Sentence list */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 pl-1 pr-2">
              {loading && sentences.length === 0 ? (
                <LoadingBlock />
              ) : error ? (
                <EmptyState icon={Icon} message={error} />
              ) : sentences.length === 0 ? (
                <EmptyState icon={Icon} message={emptyMsg} />
              ) : (
                <div className="space-y-1.5">
                  {sentences.map((s, index) => {
                    const cell = resolveCell(s, readLang);
                    const key = sentenceKey(s);
                    const isCurrent = playingKey === key;
                    const isActivePlay = isCurrent && !paused;
                    const label = s.ref || String(s.seq + 1);
                    return (
                      <div
                        key={key}
                        data-skey={key}
                        className={`rounded-lg border px-3 py-2 flex items-start gap-3 transition-colors ${
                          isCurrent
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        <span className="text-[11px] font-mono text-slate-400 w-10 flex-shrink-0 text-right pt-0.5">
                          {label}
                        </span>
                        <p className={`flex-1 text-sm leading-relaxed break-words ${isCurrent ? 'text-amber-800 dark:text-amber-200' : 'text-slate-700 dark:text-slate-200'}`}>
                          {cell.text || <span className="italic text-slate-400">— (no text)</span>}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSentenceAudio(index)}
                          className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                            !cell.hasAudio
                              ? 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                              : isCurrent
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40'
                              : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                          }`}
                          title={!cell.hasAudio ? 'No audio available' : isCurrent ? (paused ? 'Resume' : 'Pause') : 'Play from here'}
                        >
                          {!cell.hasAudio
                            ? <VolumeX className="w-4 h-4" />
                            : isActivePlay ? <Pause className="w-4 h-4" />
                            : isCurrent ? <Play className="w-4 h-4" />
                            : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pager */}
            <div className="flex items-center justify-between gap-2 py-2.5 px-1 border-t border-slate-200 dark:border-slate-700 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {total > 0 ? `${total.toLocaleString()} sentences` : ''}{lastPage > 1 ? ` · Page ${page} of ${lastPage}` : ''}
              </span>
              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= lastPage || loading}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MediaReaderModal;
