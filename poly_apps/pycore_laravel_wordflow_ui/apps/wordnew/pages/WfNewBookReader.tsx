/**
 * WfNewBookReader — book → chapter → verses reading surface (Books v3.1).
 *
 * Opened from the home Books rail (a content card with a `sourceKey`). It loads
 * the book's chapter list (GET /media/books/{key}/chapters), then a chapter's
 * verses (GET /media/books/{key}?chapter_index=&page=&per_page=&grain=) and reads
 * the REAL per-language text/audio off `verse.languages[lang]` (never the empty
 * top-level placeholder).
 *
 * Features:
 *  - Chapter navigator (rail + prev/next) when chapter_count > 0; flat read else.
 *  - Multi-language control over the source's languages[]: SINGLE (one active lang)
 *    or SIMULTANEOUS (several stacked per verse). Missing cells render a subtle
 *    blank, not a hard "—".
 *  - Per-verse audio: plays mediaUrl(cell.audio) when cell.hasAudio; disabled +
 *    "generating" tooltip otherwise (book audio is filled over time by the pycore
 *    sentence-TTS worker). Play-settings panel: speed, which language to play,
 *    auto-advance, repeat-one.
 *  - Large chapters (e.g. Genesis ~1533 verses) are paginated via the API (PER_PAGE
 *    verses/page); each page renders as a plain auto-height flow list so wrapped
 *    multi-line verses never overlap on narrow/mobile widths.
 *  - Language mode (single/对照) + selected languages are GLOBAL prefs (wfNewSettings)
 *    restored on next open. Chapters: a swipeable rail + an expandable floating grid.
 *  - Empty-book notice for legacy v2 books whose synced text is all empty.
 *
 * All data flows through the single wfNewApi gateway (mock ⇄ real). English-only
 * in code; all copy via trans().
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BookOpen, Layers, Volume2, VolumeX, Loader2, ChevronLeft, ChevronRight,
  Settings2, Plus, Check, Languages as LanguagesIcon, AlertTriangle, RefreshCw,
  LayoutGrid, X,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import {
  wfNewApi,
  type WfNewBookChapter,
  type WfNewBookVerse,
  type WfNewBookVerseLang,
} from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { mediaUrl } from '../../../config/constants';

interface WfNewBookReaderProps {
  sourceKey: string;
  title: string;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
}

const PER_PAGE = 200;
const SPEEDS = [0.75, 1, 1.25, 1.5];

/** Resolve the display title of a chapter in the active language (fallback: first
 *  non-null title, then "Chapter N"). */
function chapterTitleFor(c: WfNewBookChapter, activeLang: string, trans: WfNewBookReaderProps['trans']): string {
  const t = c.titles?.[activeLang] || Object.values(c.titles || {}).find((v) => !!v);
  return (t as string) || trans('reader.chapterN', { n: c.chapterIndex + 1 });
}

/** A verse cell's text for a language (real per-language text, never the placeholder). */
function cellText(v: WfNewBookVerse, lang: string): string | null {
  return v.languages?.[lang]?.text ?? null;
}

/** Shared payload for every verse row. */
interface RowProps {
  selectedLangs: string[];
  trans: WfNewBookReaderProps['trans'];
  langName: (code: string) => string;
  playingKey: string | null;
  onPlay: (verse: WfNewBookVerse, lang: string) => void;
  /** Fire an on-demand resolve/enqueue for a cell that lacks audio or a translation
   *  (mirrors WfNewLibraryPage.requestWordMedia; deduped once per cell upstream). */
  onNeedMedia: (verse: WfNewBookVerse, lang: string, text: string | null, hasAudio: boolean) => void;
}

const keyOf = (v: WfNewBookVerse, lang: string) => `${v.grain}-${v.seq}-${lang}`;

// Natural-height verse row (NOT virtualized with a fixed height): the card grows
// with its WRAPPED text, so on a narrow/mobile width multi-line sentences no
// longer overlap the next verse. Each chapter page is capped to PER_PAGE verses,
// so a plain flow list stays performant.
const VerseRow: React.FC<RowProps & { verse: WfNewBookVerse; index: number }> = ({
  verse: v, index, selectedLangs, trans, langName, playingKey, onPlay, onNeedMedia,
}) => {
  // On render, for every selected language cell that is genuinely missing content
  // (text present but no audio, OR no translation at all), fire ONE on-demand
  // resolve so the backend enqueues a TOP-priority fast task. Dedup + polling is
  // owned upstream (onNeedMedia is a no-op after the first fire per cell key).
  useEffect(() => {
    if (!v) return;
    for (const lang of selectedLangs) {
      const cell = v.languages?.[lang];
      const text = cell?.text ?? null;
      const hasAudio = !!cell?.hasAudio;
      const needsTranslation = !text || !text.trim();
      const needsAudio = !!(text && text.trim()) && !hasAudio;
      if (needsTranslation || needsAudio) onNeedMedia(v, lang, text, hasAudio);
    }
  }, [v, selectedLangs, onNeedMedia]);

  if (!v) return null;
  return (
    <div className="px-0.5">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3 sm:p-4 flex gap-3">
        {/* ref + book label */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className="min-w-7 h-7 px-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono flex items-center justify-center">
            {v.ref || index + 1}
          </span>
          {v.book && <span className="text-[8px] font-mono uppercase text-zinc-600 max-w-12 truncate" title={v.book}>{v.book}</span>}
        </div>

        {/* stacked language cells (SINGLE = one; SIMULTANEOUS = several) */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {selectedLangs.map((lang, li) => {
            const cell = v.languages?.[lang];
            const text = cell?.text ?? null;
            const hasAudio = !!cell?.hasAudio;
            const isPlaying = playingKey === keyOf(v, lang);
            return (
              <div key={lang} className="flex items-start gap-2 group">
                <span className="shrink-0 mt-1 text-[9px] font-mono uppercase text-zinc-600 w-6" title={langName(lang)}>{lang}</span>
                <p className={li === 0 ? 'flex-1 text-zinc-100 leading-relaxed' : 'flex-1 text-zinc-400 text-sm leading-relaxed'}>
                  {text || <span className="text-zinc-700/70 italic select-none">{' '}</span>}
                </p>
                {/* per-cell audio play */}
                <button
                  type="button"
                  disabled={!text || !hasAudio}
                  onClick={() => onPlay(v, lang)}
                  title={!text ? '' : hasAudio ? trans('reader.playAudio') : trans('reader.audioGenerating')}
                  className={`shrink-0 mt-0.5 p-1 rounded transition-all cursor-pointer ${
                    !text
                      ? 'opacity-0 pointer-events-none'
                      : hasAudio
                        ? (isPlaying ? 'text-amber-300' : 'text-zinc-500 hover:text-amber-300 opacity-0 group-hover:opacity-100')
                        : 'text-zinc-700 cursor-not-allowed opacity-50'
                  }`}
                  aria-label={trans('reader.playAudio')}
                >
                  {hasAudio ? <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`} /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const WfNewBookReader: React.FC<WfNewBookReaderProps> = ({
  sourceKey, title, trans, addToast,
}) => {
  const [languages, setLanguages] = useState<string[]>([]);
  const [chapters, setChapters] = useState<WfNewBookChapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<WfNewBookVerse[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [flat, setFlat] = useState(false);

  // pagination for large chapters (Genesis ~1533 verses)
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // language selection: SINGLE vs SIMULTANEOUS; selectedLangs drives what renders.
  // The mode + languages are GLOBAL prefs (wfNewSettings) restored on next open.
  const [simul, setSimul] = useState<boolean>(() => wfNewSettings.get('readerSimul'));
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  // Floating chapter grid (the expandable chapter picker).
  const [chaptersOpen, setChaptersOpen] = useState(false);

  // play settings
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playLang, setPlayLang] = useState<string>('');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Live settings mirror: the play / onended path reads ALL playback settings
  // (speed, playLang, autoAdvance, repeatOne) from this ref, so changing any of
  // them mid-playback applies on the very next play()/auto-advance with no
  // one-render lag. `versesRef` lets the stable onended closure see the latest page.
  const versesRef = useRef<WfNewBookVerse[]>([]);
  useEffect(() => { versesRef.current = verses; }, [verses]);
  const settingsRef = useRef({ speed, autoAdvance, repeatOne, playLang });
  useEffect(() => { settingsRef.current = { speed, autoAdvance, repeatOne, playLang }; }, [speed, autoAdvance, repeatOne, playLang]);

  const langName = useCallback((code: string) => trans('lang.name.' + code) || code.toUpperCase(), [trans]);

  // The active language for chapter-title display = first selected (or first source lang).
  const activeLang = selectedLangs[0] || languages[0] || 'en';

  // --- on-demand media resolve/enqueue for missing cells ------------------- #
  // A reader cell missing audio/translation is otherwise passive (just a tooltip);
  // here we mirror WfNewLibraryPage.requestWordMedia: for such a cell we batch its
  // words through wfNewApi.getWordMedia(targetLang, word) — which READS current
  // media AND tells the backend to enqueue+prioritize a TOP-priority fast task
  // (bumpFront) — then poll a few times until ready and refresh the page so the
  // cell flips. Deduped once per cell key so it never re-fires per render/scroll.
  const requestedCellKeys = useRef<Set<string>>(new Set());
  const mediaPollTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Latest loadVerses + active page, read live by the poll closure (kept stable).
  const reloadRef = useRef<() => void>(() => {});

  const requestCellMedia = useCallback(
    (verse: WfNewBookVerse, lang: string, text: string | null, _hasAudio: boolean) => {
      const cellKey = `${keyOf(verse, lang)}:${(text || '').slice(0, 64)}`;
      if (requestedCellKeys.current.has(cellKey)) return;
      requestedCellKeys.current.add(cellKey);

      // Batch this cell's words (the sentence split on whitespace) through the SAME
      // api the library page uses. The first word's resolve is enough to create the
      // fast task; we resolve a small, de-duplicated set to cover the sentence.
      const words = (text || '')
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
        .filter(Boolean);
      const uniqueWords = Array.from(new Set(words)).slice(0, 8);
      // Translation-only cells (no source text) still need a task: fall back to the
      // verse's primary-language text so the backend has something to resolve.
      const fallback = (verse.text || '').trim();
      const targets = uniqueWords.length ? uniqueWords : (fallback ? [fallback] : []);
      if (!targets.length) return;

      const maxTries = 3;
      const intervalMs = 4000;

      const fireOnce = () => Promise.allSettled(
        targets.map((w) => wfNewApi.getWordMedia(lang, w)),
      );

      const attempt = (tries: number): void => {
        fireOnce()
          .then((results) => {
            const anyReady = results.some(
              (r) => r.status === 'fulfilled'
                && (r.value.audioStatus === 'ready' || r.value.imageStatus === 'ready'),
            );
            // Refresh the page so a now-ready cell flips from "generating" to playable.
            if (anyReady) reloadRef.current();
            if (!anyReady && tries < maxTries) {
              const t = setTimeout(() => {
                mediaPollTimers.current.delete(t);
                attempt(tries + 1);
              }, intervalMs);
              mediaPollTimers.current.add(t);
            }
          })
          .catch(() => {
            // Allow a later render to retry after a transient failure.
            requestedCellKeys.current.delete(cellKey);
          });
      };
      attempt(1);
    },
    [],
  );

  // --- load verses for a chapter (or flat) at a given page ----------------- #
  const loadVerses = useCallback(
    async (chapterIndex: number | null, pageNum: number) => {
      setLoadingVerses(true);
      try {
        const res = await wfNewApi.getBookVerses(sourceKey, {
          chapterIndex: chapterIndex ?? undefined,
          page: pageNum,
          perPage: PER_PAGE,
        });
        setVerses(res.items);
        setPage(res.currentPage || pageNum);
        setLastPage(res.lastPage || 1);
        setTotal(res.total || res.items.length);
      } catch (e) {
        console.warn('[wordnew] Failed to load verses.', e);
        addToast(trans('content.loadFailed'), 'warning');
        setVerses([]);
      } finally {
        setLoadingVerses(false);
      }
    },
    [sourceKey, addToast, trans],
  );

  // --- on book change: load chapters, seed languages, open chapter 1 ------- #
  useEffect(() => {
    let cancelled = false;
    setLoadingChapters(true);
    setChapters([]); setVerses([]); setActiveChapter(null); setFlat(false); setPage(1);

    wfNewApi.getBookChapters(sourceKey)
      .then((res) => {
        if (cancelled) return;
        const langs = res.languages || [];
        setLanguages(langs);
        // Restore the GLOBAL language prefs, intersected with THIS book's available
        // languages (source order). Fall back to the primary language when none of
        // the preferred languages exist in this book. (We READ the pref here but
        // never overwrite it from the auto-seed — only explicit user toggles save.)
        const prefSimul = wfNewSettings.get('readerSimul');
        const prefLangs = (wfNewSettings.get('readerLangs') || []).filter((l) => langs.includes(l));
        const seed = prefLangs.length
          ? (prefSimul ? langs.filter((l) => prefLangs.includes(l)) : [prefLangs[0]])
          : (langs.length ? [langs[0]] : []);
        setSelectedLangs(seed);
        setSimul(prefSimul);
        setPlayLang(seed[0] || langs[0] || '');
        setChapters(res.chapters || []);
        if ((res.chapterCount || 0) > 0 && res.chapters.length) {
          const first = res.chapters[0].chapterIndex;
          setActiveChapter(first);
          void loadVerses(first, 1);
        } else {
          setFlat(true);
          void loadVerses(null, 1);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn('[wordnew] Failed to load chapters.', e);
        setFlat(true);
        void loadVerses(null, 1);
      })
      .finally(() => { if (!cancelled) setLoadingChapters(false); });

    return () => { cancelled = true; };
  }, [sourceKey, loadVerses]);

  // Keep the reload closure pointed at the CURRENT chapter/page so the media poll
  // can refresh in place when a fast task completes.
  useEffect(() => {
    reloadRef.current = () => { void loadVerses(flat ? null : activeChapter, page); };
  }, [loadVerses, flat, activeChapter, page]);

  // Reset the per-cell request guards + cancel in-flight media polls whenever the
  // visible set of verses changes (book / chapter / page), so a fresh page can
  // re-resolve its own missing cells.
  useEffect(() => {
    requestedCellKeys.current = new Set();
    const timers = mediaPollTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [sourceKey, activeChapter, flat, page]);

  // Stop audio on unmount.
  useEffect(() => () => { try { audioRef.current?.pause(); } catch { /* ignore */ } }, []);

  // --- chapter navigation -------------------------------------------------- #
  const chapterOrder = useMemo(() => chapters.map((c) => c.chapterIndex), [chapters]);
  const activePos = activeChapter == null ? -1 : chapterOrder.indexOf(activeChapter);

  const selectChapter = useCallback((chapterIndex: number) => {
    setActiveChapter(chapterIndex);
    setPage(1);
    void loadVerses(chapterIndex, 1);
  }, [loadVerses]);

  const goChapter = (delta: number) => {
    if (activePos < 0) return;
    const next = chapterOrder[activePos + delta];
    if (next !== undefined) selectChapter(next);
  };

  const goPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > lastPage) return;
    void loadVerses(flat ? null : activeChapter, pageNum);
  };

  // --- language selection -------------------------------------------------- #
  const toggleLang = (code: string) => {
    setSelectedLangs((prev) => {
      let next: string[];
      if (simul) {
        // SIMULTANEOUS: add/remove, but never drop the last one.
        if (prev.includes(code)) next = prev.length > 1 ? prev.filter((l) => l !== code) : prev;
        else next = [...languages.filter((l) => prev.includes(l) || l === code)]; // keep source order
      } else {
        // SINGLE: exactly one active language.
        next = [code];
      }
      wfNewSettings.setField('readerLangs', next); // persist the GLOBAL pref (user choice)
      return next;
    });
  };

  const setMode = (next: boolean) => {
    setSimul(next);
    wfNewSettings.setField('readerSimul', next); // persist the GLOBAL pref
    // Leaving SIMULTANEOUS → collapse to the first selected language.
    if (!next) setSelectedLangs((prev) => {
      const collapsed = [prev[0] || languages[0]].filter(Boolean) as string[];
      wfNewSettings.setField('readerLangs', collapsed);
      return collapsed;
    });
  };

  // --- audio playback ------------------------------------------------------ #
  const stopAudio = useCallback(() => {
    try { audioRef.current?.pause(); } catch { /* ignore */ }
    setPlayingKey(null);
  }, []);

  // Stable across renders: every playback setting is read LIVE from settingsRef
  // at play time (not captured at definition), so mid-playback changes to speed /
  // play-language / auto-advance / repeat take effect on the very next play() and
  // each auto-advance step — no one-render lag, no compensating effect needed.
  const playCell = useCallback((verse: WfNewBookVerse, lang: string) => {
    const cell = verse.languages?.[lang];
    if (!cell?.hasAudio || !cell.audio) return;
    const url = mediaUrl(cell.audio); // already absolute from the http impl; mediaUrl is a no-op then
    let audio = audioRef.current;
    if (!audio) { audio = new Audio(); audioRef.current = audio; }
    audio.pause();
    audio.src = url;
    audio.playbackRate = settingsRef.current.speed; // live speed at play time
    const thisKey = keyOf(verse, lang);
    setPlayingKey(thisKey);
    audio.onended = () => {
      const { repeatOne: ro, autoAdvance: aa, playLang: pl, speed: sp } = settingsRef.current;
      if (ro) { audio!.currentTime = 0; audio!.playbackRate = sp; void audio!.play().catch(() => setPlayingKey(null)); return; }
      if (aa) {
        // Advance to the next verse that has audio in the chosen play language.
        const list = versesRef.current;
        const useLang = pl || lang;
        const startIdx = list.findIndex((x) => x.seq === verse.seq && x.grain === verse.grain);
        for (let i = startIdx + 1; i < list.length; i += 1) {
          const c = list[i].languages?.[useLang];
          if (c?.hasAudio && c.audio) { playCell(list[i], useLang); return; }
        }
      }
      setPlayingKey(null);
    };
    void audio.play().catch(() => { setPlayingKey(null); });
  }, []);

  // Apply a speed change to audio that is ALREADY mid-utterance (a new play() /
  // auto-advance already reads the live speed from settingsRef). Not a staleness
  // compensator — just retunes the currently-playing element in place.
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);

  // --- empty-book detection (legacy v2 books: all verses have no text) ------ #
  const allEmpty = useMemo(
    () => verses.length > 0 && verses.every((v) => {
      const cells: WfNewBookVerseLang[] = v.languages ? Object.values(v.languages) : [];
      const anyCell = cells.some((c) => c && c.text && c.text.trim());
      return !anyCell && !(v.text && v.text.trim());
    }),
    [verses],
  );

  // Shared per-row props (a plain flow list — no fixed row height to overflow).
  const rowProps: RowProps = { selectedLangs, trans, langName, playingKey, onPlay: playCell, onNeedMedia: requestCellMedia };

  return (
    <div className="space-y-5">
      {/* Toolbar (no header text — page title lives in the global nav): play-settings toggle. */}
      <div className="flex items-center justify-end border-b border-white/5 pb-4">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`shrink-0 p-2.5 rounded-full border cursor-pointer transition-colors ${showSettings ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'}`}
          title={trans('reader.playSettings')}
          aria-label={trans('reader.playSettings')}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Language control: mode toggle + language chips */}
      {languages.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <LanguagesIcon className="w-3.5 h-3.5" />
              {trans('reader.languages')}
            </div>
            <div className="flex rounded-lg bg-white/5 border border-white/5 p-0.5">
              <button onClick={() => setMode(false)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer transition-colors ${!simul ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-400 hover:text-zinc-200'}`}>
                {trans('reader.modeSingle')}
              </button>
              <button onClick={() => setMode(true)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer transition-colors ${simul ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-400 hover:text-zinc-200'}`}>
                {trans('reader.modeSimul')}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {languages.map((l) => {
              const on = selectedLangs.includes(l);
              return (
                <button
                  key={l}
                  onClick={() => toggleLang(l)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border cursor-pointer transition-colors flex items-center gap-1 ${
                    on ? 'bg-amber-500/15 border-amber-500/30 text-amber-200' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
                  title={langName(l)}
                >
                  {on ? <Check className="w-3 h-3" /> : (simul ? <Plus className="w-3 h-3" /> : null)}
                  <span className="uppercase">{l}</span>
                  <span className="font-normal opacity-70 normal-case hidden sm:inline">{langName(l)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Play settings panel */}
      {showSettings && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-zinc-400">{trans('reader.speed')}</span>
            <div className="flex rounded-lg bg-white/5 border border-white/5 p-0.5">
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono cursor-pointer transition-colors ${speed === s ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-zinc-400">{trans('reader.playLanguage')}</span>
            <select
              value={playLang}
              onChange={(e) => setPlayLang(e.target.value)}
              className="bg-slate-900/80 text-zinc-200 font-mono text-[11px] border border-white/10 rounded-lg py-1 px-2 cursor-pointer outline-none"
            >
              {languages.map((l) => <option key={l} value={l}>{langName(l)} ({l})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-4 flex-wrap font-mono text-zinc-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
              {trans('reader.autoAdvance')}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={repeatOne} onChange={(e) => setRepeatOne(e.target.checked)} />
              {trans('reader.repeatOne')}
            </label>
            {playingKey && (
              <button onClick={stopAudio} className="ml-auto px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 cursor-pointer">
                {trans('reader.stop')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chapter navigator: a swipeable (snap) horizontal rail + an expand button
          that opens a floating chapter GRID. */}
      {!flat && (
        <div className="relative">
          <div className="flex items-center gap-2">
            <button onClick={() => goChapter(-1)} disabled={activePos <= 0} className="shrink-0 p-2 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" aria-label={trans('reader.prevChapter')}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1 snap-x snap-mandatory scroll-smooth no-scrollbar">
              <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
              {loadingChapters && chapters.length === 0 ? (
                <span className="text-xs text-zinc-500 font-mono">{trans('reader.loadingChapters')}</span>
              ) : (
                chapters.map((c) => (
                  <button
                    key={c.chapterIndex}
                    onClick={() => selectChapter(c.chapterIndex)}
                    className={`shrink-0 snap-start px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      activeChapter === c.chapterIndex ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                    title={`${chapterTitleFor(c, activeLang, trans)} · ${c.sentenceCount}`}
                  >
                    {chapterTitleFor(c, activeLang, trans)}
                  </button>
                ))
              )}
            </div>
            {/* expand → floating chapter grid */}
            <button
              onClick={() => setChaptersOpen((o) => !o)}
              disabled={chapters.length === 0}
              className={`shrink-0 p-2 rounded-lg border cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                chaptersOpen ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
              }`}
              title={trans('reader.allChapters')}
              aria-label={trans('reader.allChapters')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => goChapter(1)} disabled={activePos < 0 || activePos >= chapterOrder.length - 1} className="shrink-0 p-2 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" aria-label={trans('reader.nextChapter')}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Floating chapter grid (distributed display) */}
          {chaptersOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setChaptersOpen(false)} aria-hidden="true" />
              <div className="absolute z-30 top-full mt-2 left-0 right-0 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-3 shadow-2xl max-h-[55vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> {trans('reader.allChapters')} · {chapters.length}
                  </span>
                  <button onClick={() => setChaptersOpen(false)} className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer" aria-label={trans('api.close')}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                  {chapters.map((c) => (
                    <button
                      key={c.chapterIndex}
                      onClick={() => { selectChapter(c.chapterIndex); setChaptersOpen(false); }}
                      title={`${chapterTitleFor(c, activeLang, trans)} · ${c.sentenceCount}`}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors truncate ${
                        activeChapter === c.chapterIndex ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {chapterTitleFor(c, activeLang, trans)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Verses */}
      {loadingVerses ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono">{trans('reader.loadingVerses')}</span>
        </div>
      ) : verses.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-sm">{trans('reader.empty')}</div>
      ) : allEmpty ? (
        /* Empty-book notice (legacy v2 books with no synced text). */
        <div className="py-12 px-4 text-center space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
          <AlertTriangle className="w-7 h-7 mx-auto text-amber-400" />
          <p className="text-sm font-bold text-amber-200">{trans('reader.noTextTitle')}</p>
          <p className="text-xs text-zinc-400 font-mono max-w-md mx-auto leading-relaxed flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> {trans('reader.noTextBody')}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-y-auto overflow-x-hidden space-y-1"
          style={{ maxHeight: 'min(70vh, 640px)' }}
        >
          {verses.map((v, i) => (
            <VerseRow key={`${v.grain}-${v.seq}`} verse={v} index={i} {...rowProps} />
          ))}
        </div>
      )}

      {/* Page navigation (large chapters) */}
      {!loadingVerses && verses.length > 0 && !allEmpty && lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs font-mono">
          <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            {trans('reader.prevPage')}
          </button>
          <span className="text-zinc-500">{trans('reader.pageOf', { page, total: lastPage })}</span>
          <button onClick={() => goPage(page + 1)} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
            {trans('reader.nextPage')}
          </button>
        </div>
      )}
    </div>
  );
};
