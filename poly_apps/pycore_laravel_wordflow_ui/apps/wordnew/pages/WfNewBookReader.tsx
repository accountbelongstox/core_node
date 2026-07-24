/**
 * WfNewBookReader — immersive bilingual book reader (Books v3.1).
 * Resume from server progress, configurable play sequence, missing-audio bump.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Layers, Loader2, ChevronLeft, ChevronRight, Settings2,
  AlertTriangle, RefreshCw, LayoutGrid, X, BookOpen,
} from 'lucide-react';
import {
  wfNewApi,
  type WfNewBookChapter,
  type WfNewBookVerse,
  type WfNewBookReadingProgress,
  type WfNewReaderDisplayMode,
  type WfNewReaderPlayStep,
} from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { wfReadingProgressCenter } from '../services/WfReadingProgressCenter';
import { wfReaderSettingsRoamer } from '../services/WfReaderSettingsRoamer';
import { pycoreApi } from '../../../core/api-libs/pycore';
import { WfBookReaderPlayback } from '../services/WfBookReaderPlayback';
import { WfBookReaderProgressSaver } from '../services/WfBookReaderProgressSaver';
import {
  formatBookLangLabel,
  syncPlaySequenceForBook,
  syncSpeedByLangForBook,
  visibleBookLangs,
} from '../utils/WfBookReaderLangUtils';
import { langCodeToBcp47, orderLangsForReadAloud } from '../utils/WfBookReaderA11y';
import { WfBookReaderSettingsPanel } from '../components/reader/WfBookReaderSettingsPanel';
import { WfBookReaderPlayBar } from '../components/reader/WfBookReaderPlayBar';
import { WfBookReaderVerseRow } from '../components/reader/WfBookReaderVerseRow';
import { ElementTheme } from '../WfNewTypes';
import {
  bumpSentenceAudioImmediate,
  requestSentenceAudio,
  resetSentenceAudioScheduler,
  waitForSentenceAudioUrl,
} from '../services/WfBookReaderSentenceAudio';
import { cellKeyOf, ttsStatusToCellState, type WfAudioCellState } from '../utils/WfAudioCellState';
import { pickSentenceAudioUrl, readerPreferredAccent } from '../utils/WfSentenceAudioPick';
import { ensureAudio } from '../cache/WfNewAudioCache';
import { readWordCardsForSentence } from '../services/WfBookReaderWordCards';

interface WfNewBookReaderProps {
  sourceKey: string;
  title: string;
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
}

const PER_PAGE = 200;
const verseKey = (v: WfNewBookVerse) => `${v.grain}-${v.seq}`;

/** Scroll `el` so it sits ~1/3 from the top of `container` (upper-middle), smooth.
 *  Uses bounding rects so it is correct regardless of offsetParent. */
function scrollVerseToUpperMiddle(el: HTMLElement, container: HTMLElement): void {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const top = elRect.top - containerRect.top + container.scrollTop - container.clientHeight / 3;
  container.scrollTo({ top, behavior: 'smooth' });
}

function chapterTitleFor(c: WfNewBookChapter, activeLang: string, trans: WfNewBookReaderProps['trans']): string {
  const t = c.titles?.[activeLang] || Object.values(c.titles || {}).find((v) => !!v);
  return (t as string) || trans('reader.chapterN', { n: c.chapterIndex + 1 });
}

export const WfNewBookReader: React.FC<WfNewBookReaderProps> = ({
  sourceKey, title, activeTheme, trans, dark, addToast,
}) => {
  const [languages, setLanguages] = useState<string[]>([]);
  const [chapters, setChapters] = useState<WfNewBookChapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<WfNewBookVerse[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [flat, setFlat] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeVerse, setActiveVerse] = useState<WfNewBookVerse | null>(null);
  const [resumeTarget, setResumeTarget] = useState<WfNewBookReadingProgress | null>(null);
  const [resumeApplied, setResumeApplied] = useState(false);

  const [simul, setSimul] = useState(() => wfNewSettings.get('readerSimul'));
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<WfNewReaderDisplayMode>(() => wfNewSettings.get('readerDisplayMode'));
  const [sequence, setSequence] = useState<WfNewReaderPlayStep[]>(() => wfNewSettings.get('readerPlaySequence'));
  const [speedByLang, setSpeedByLang] = useState<Record<string, number>>(() => ({ ...wfNewSettings.get('readerSpeedByLang') }));
  const [autoAdvance, setAutoAdvance] = useState(() => wfNewSettings.get('readerAutoAdvance'));
  const [repeatOne, setRepeatOne] = useState(() => wfNewSettings.get('readerRepeatOne'));
  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState(() => wfNewSettings.get('readerAutoPlayOnOpen'));
  const [browserTts, setBrowserTts] = useState(() => wfNewSettings.get('readerBrowserTts'));
  const [readerVariantByLang, setReaderVariantByLang] = useState<Record<string, string>>(
    () => ({ ...wfNewSettings.get('readerVariantByLang') }),
  );
  const [wordCards, setWordCards] = useState(() => wfNewSettings.get('readerWordCards'));
  const [wordCardPosition, setWordCardPosition] = useState<'before' | 'after'>(
    () => wfNewSettings.get('readerWordCardPosition'),
  );
  const [wordRepeats, setWordRepeats] = useState(() => wfNewSettings.get('readerWordRepeats'));
  const [wordMode, setWordMode] = useState<'new' | 'all'>(() => wfNewSettings.get('readerWordMode'));

  const syncReaderStateFromStore = useCallback(() => {
    setSimul(wfNewSettings.get('readerSimul'));
    setDisplayMode(wfNewSettings.get('readerDisplayMode'));
    setSequence([...wfNewSettings.get('readerPlaySequence')]);
    setSpeedByLang({ ...wfNewSettings.get('readerSpeedByLang') });
    setAutoAdvance(wfNewSettings.get('readerAutoAdvance'));
    setRepeatOne(wfNewSettings.get('readerRepeatOne'));
    setAutoPlayOnOpen(wfNewSettings.get('readerAutoPlayOnOpen'));
    setBrowserTts(wfNewSettings.get('readerBrowserTts'));
    setReaderVariantByLang({ ...wfNewSettings.get('readerVariantByLang') });
    setWordCards(wfNewSettings.get('readerWordCards'));
    setWordCardPosition(wfNewSettings.get('readerWordCardPosition'));
    setWordRepeats(wfNewSettings.get('readerWordRepeats'));
    setWordMode(wfNewSettings.get('readerWordMode'));
    const prefLangs = (wfNewSettings.get('readerLangs') || []).filter((l) => languages.includes(l));
    if (prefLangs.length) {
      const prefSimul = wfNewSettings.get('readerSimul');
      setSelectedLangs(prefSimul && languages.length > 1 ? languages.filter((l) => prefLangs.includes(l)) : [prefLangs[0]]);
      setSimul(prefSimul && languages.length > 1);
    }
  }, [languages]);

  const persistReaderChange = useCallback(() => {
    wfReaderSettingsRoamer.schedulePush();
  }, []);
  const readerVariantByLangRef = useRef(readerVariantByLang);
  const [liveReadText, setLiveReadText] = useState('');
  const [liveReadLang, setLiveReadLang] = useState('');

  const versesRef = useRef<WfNewBookVerse[]>([]);
  const pageRef = useRef(1);
  const lastPageRef = useRef(1);
  const activeChapterRef = useRef<number | null>(null);
  const flatRef = useRef(false);
  const playbackRef = useRef<WfBookReaderPlayback | null>(null);
  const progressSaverRef = useRef<WfBookReaderProgressSaver | null>(null);
  const playingRef = useRef(false);
  const requestedCellKeys = useRef<Set<string>>(new Set());
  const resolvedAudioUrlsRef = useRef<Record<string, string>>({});
  const lastBumpBatchSigRef = useRef('');
  const reloadRef = useRef<() => void>(() => { });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollPausedUntil = useRef(0);
  const userPickedVerse = useRef(false);
  const [cellStatuses, setCellStatuses] = useState<Record<string, WfAudioCellState>>({});

  // Stable refs for every value the WfBookReaderPlayback engine reads, so the
  // playback instance is created ONCE per sourceKey and never torn down on a
  // re-render. A teardown calls stop() mid-playback, which surfaced as the
  // reader "auto-refreshing" whenever a state change flipped a callback
  // identity (chapter advance rebuilt goNextChapterInternal; an unmemoized
  // trans/addToast rebuilt loadVerses, which in turn re-ran the chapter-load
  // effect and reset verses). The engine reads the LIVE value through the ref.
  const transRef = useRef(trans);
  const addToastRef = useRef(addToast);
  const sequenceRef = useRef(sequence);
  const speedByLangRef = useRef(speedByLang);
  const autoAdvanceRef = useRef(autoAdvance);
  const repeatOneRef = useRef(repeatOne);
  const languagesRef = useRef(languages);
  const wordCardsRef = useRef(wordCards);
  const wordCardPositionRef = useRef(wordCardPosition);
  const wordRepeatsRef = useRef(wordRepeats);
  const wordModeRef = useRef(wordMode);
  useEffect(() => { transRef.current = trans; }, [trans]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
  useEffect(() => { speedByLangRef.current = speedByLang; }, [speedByLang]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { repeatOneRef.current = repeatOne; }, [repeatOne]);
  useEffect(() => { languagesRef.current = languages; }, [languages]);
  useEffect(() => { wordCardsRef.current = wordCards; }, [wordCards]);
  useEffect(() => { wordCardPositionRef.current = wordCardPosition; }, [wordCardPosition]);
  useEffect(() => { wordRepeatsRef.current = wordRepeats; }, [wordRepeats]);
  useEffect(() => { wordModeRef.current = wordMode; }, [wordMode]);

  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { lastPageRef.current = lastPage; }, [lastPage]);
  useEffect(() => { activeChapterRef.current = activeChapter; }, [activeChapter]);
  useEffect(() => { flatRef.current = flat; }, [flat]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    void wfReaderSettingsRoamer.pull().then((changed) => {
      if (changed) syncReaderStateFromStore();
    });
  }, [syncReaderStateFromStore]);

  // Flush any pending reader-settings change on unmount so a fast navigate-away
  // right after a change is never dropped by the roamer's debounce window.
  useEffect(() => () => { wfReaderSettingsRoamer.flush(); }, []);

  const langName = useCallback((code: string) => formatBookLangLabel(code, trans), [trans]);
  const activeLang = selectedLangs[0] || languages[0] || 'en';

  const displayLangs = useMemo(
    () => visibleBookLangs(languages, selectedLangs, simul),
    [languages, selectedLangs, simul],
  );

  const orderedDisplayLangs = useMemo(
    () => orderLangsForReadAloud(displayLangs, sequence),
    [displayLangs, sequence],
  );

  const browserTtsRef = useRef(browserTts);
  useEffect(() => { browserTtsRef.current = browserTts; }, [browserTts]);

  const persistProgress = useCallback((verse: WfNewBookVerse, pageNum: number) => {
    progressSaverRef.current?.schedule(verse, pageNum);
  }, []);

  const loadVerses = useCallback(async (chapterIndex: number | null, pageNum: number): Promise<WfNewBookVerse[]> => {
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
      return res.items;
    } catch (e) {
      console.warn('[wordnew] Failed to load verses.', e);
      addToastRef.current(transRef.current('content.loadFailed'), 'warning');
      setVerses([]);
      return [];
    } finally {
      setLoadingVerses(false);
    }
  }, [sourceKey]);

  useEffect(() => { readerVariantByLangRef.current = readerVariantByLang; }, [readerVariantByLang]);

  const onReaderVariantSelect = useCallback((lang: string, variantKey: string) => {
    setReaderVariantByLang((prev) => {
      const next = { ...prev, [lang]: variantKey };
      wfNewSettings.setField('readerVariantByLang', next);
      persistReaderChange();
      return next;
    });
  }, [persistReaderChange]);

  const setCellStatus = useCallback((verse: WfNewBookVerse, lang: string, state: WfAudioCellState) => {
    const k = cellKeyOf(verse.grain, verse.seq, lang);
    setCellStatuses((prev) => (prev[k] === state ? prev : { ...prev, [k]: state }));
  }, []);

  const requestCellMedia = useCallback((verse: WfNewBookVerse, lang: string, text: string | null, hasAudio: boolean) => {
    const cellKey = `${verse.grain}-${verse.seq}-${lang}:${(text || '').slice(0, 64)}`;
    if (requestedCellKeys.current.has(cellKey) || !text?.trim()) return;
    requestedCellKeys.current.add(cellKey);
    setCellStatus(verse, lang, 'queued');
    requestSentenceAudio(text, lang, {
      onStatus: ({ exists, queued, tts_status }) => {
        setCellStatus(verse, lang, ttsStatusToCellState(exists, tts_status, queued));
      },
      onReady: (url) => {
        setCellStatus(verse, lang, 'ready');
        if (url) resolvedAudioUrlsRef.current[cellKeyOf(verse.grain, verse.seq, lang)] = url;
      },
      onSettled: (url) => {
        if (!url) requestedCellKeys.current.delete(cellKey);
      },
    });
  }, [setCellStatus]);

  const retryCellAudio = useCallback((verse: WfNewBookVerse, lang: string, text: string) => {
    const cellKey = `${verse.grain}-${verse.seq}-${lang}:${text.slice(0, 64)}`;
    requestedCellKeys.current.delete(cellKey);
    setCellStatus(verse, lang, 'queued');
    requestSentenceAudio(text, lang, {
      urgent: true,
      onStatus: ({ exists, queued, tts_status }) => {
        setCellStatus(verse, lang, ttsStatusToCellState(exists, tts_status, queued));
      },
      onReady: (url) => {
        setCellStatus(verse, lang, 'ready');
        if (url) resolvedAudioUrlsRef.current[cellKeyOf(verse.grain, verse.seq, lang)] = url;
      },
      onSettled: (url) => {
        if (!url) requestedCellKeys.current.delete(cellKey);
      },
    });
  }, [setCellStatus]);

  const resolveAudioUrl = useCallback(async (
    verse: WfNewBookVerse,
    lang: string,
    shouldContinue?: () => boolean,
  ): Promise<string | null> => {
    const cell = verse.languages?.[lang];
    const variantKey = readerVariantByLangRef.current[lang] ?? '';
    const preferredAccent = readerPreferredAccent(wfNewSettings.get('voiceAccent'));
    const picked = pickSentenceAudioUrl(cell, { variantKey, preferredAccent });
    if (picked.url) return (await ensureAudio(picked.url)) ?? picked.url;

    const k = cellKeyOf(verse.grain, verse.seq, lang);
    if (resolvedAudioUrlsRef.current[k]) {
      const remoteUrl = resolvedAudioUrlsRef.current[k];
      return (await ensureAudio(remoteUrl)) ?? remoteUrl;
    }

    const text = cell?.text?.trim();
    if (!text) return null;
    return null;
  }, []);

  const goNextChapterInternal = useCallback(async (): Promise<boolean> => {
    const order = chapters.map((c) => c.chapterIndex);
    const pos = activeChapter == null ? -1 : order.indexOf(activeChapter);
    if (pos < 0 || pos >= order.length - 1) return false;
    const next = order[pos + 1];
    setActiveChapter(next);
    setPage(1);
    const items = await loadVerses(next, 1);
    if (items.length && playbackRef.current?.isPlaying()) {
      await playbackRef.current.playFrom(items[0]);
    }
    return true;
  }, [chapters, activeChapter, loadVerses]);

  useEffect(() => {
    progressSaverRef.current = new WfBookReaderProgressSaver({
      sourceKey,
      trans,
      isPlaying: () => playingRef.current,
      isFlat: () => flatRef.current,
      getChapterIndex: () => activeChapterRef.current,
    });
    return () => { progressSaverRef.current?.cancel(); };
  }, [sourceKey, trans]);

  // Refs for the callbacks the engine invokes, synced each render so the
  // single playback instance always calls the LATEST closure without being
  // rebuilt (which would stop() mid-playback).
  const loadVersesRef = useRef(loadVerses);
  const goNextChapterRef = useRef(goNextChapterInternal);
  const resolveAudioUrlRef = useRef(resolveAudioUrl);
  const persistProgressRef = useRef(persistProgress);
  useEffect(() => { loadVersesRef.current = loadVerses; }, [loadVerses]);
  useEffect(() => { goNextChapterRef.current = goNextChapterInternal; }, [goNextChapterInternal]);
  useEffect(() => { resolveAudioUrlRef.current = resolveAudioUrl; }, [resolveAudioUrl]);
  useEffect(() => { persistProgressRef.current = persistProgress; }, [persistProgress]);

  useEffect(() => {
    playbackRef.current = new WfBookReaderPlayback({
      getVerses: () => versesRef.current,
      getSettings: () => ({
        sequence: sequenceRef.current.length ? sequenceRef.current : [{ lang: languagesRef.current[0] || 'en', repeat: 1 }],
        speedByLang: speedByLangRef.current,
        autoAdvance: autoAdvanceRef.current,
        repeatOne: repeatOneRef.current,
      }),
      useBrowserTts: () => browserTtsRef.current,
      onPlayingKey: setPlayingKey,
      onPlaying: setPlaying,
      onPaused: setPaused,
      onVerseActive: setActiveVerse,
      onProgress: (verse, pageNum) => persistProgressRef.current(verse, pageNum),
      onLiveReadText: (text, lang) => {
        setLiveReadText(text);
        setLiveReadLang(lang);
      },
      loadVerses: async (chapterIndex, pageNum, opts) => {
        if (opts?.requirePlaying && !playbackRef.current?.isPlaying()) return null;
        const items = await loadVersesRef.current(chapterIndex, pageNum);
        return items.length ? items : null;
      },
      getChapterIndex: () => activeChapterRef.current,
      getPage: () => pageRef.current,
      getLastPage: () => lastPageRef.current,
      goNextChapter: () => goNextChapterRef.current(),
      resolveAudioUrl: (verse, lang, shouldContinue) => resolveAudioUrlRef.current(verse, lang, shouldContinue),
      bumpMissingAudio: (v, lang, text) => { void bumpSentenceAudioImmediate(text, lang); },
      wordCards: {
        isEnabled: () => wordCardsRef.current,
        getPosition: () => wordCardPositionRef.current,
        readForVerse: async (verse, shouldContinue) => {
          const sentence = verse.languages?.en?.text?.trim() || '';
          if (sentence) await readWordCardsForSentence(
            sentence,
            shouldContinue,
            wordRepeatsRef.current,
            wordModeRef.current,
          );
        },
      },
    });
    return () => { playbackRef.current?.stop(); };
  }, [sourceKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingChapters(true);
    setResumeApplied(false);
    setResumeTarget(null);
    setChapters([]); setVerses([]); setActiveChapter(null); setFlat(false); setPage(1);

    const loadProgress = async (): Promise<WfNewBookReadingProgress | null> => {
      if (wfNewApi.isAuthenticated()) {
        const server = await wfNewApi.getBookReadingProgress(sourceKey);
        if (server) return server;
      }
      const local = await wfReadingProgressCenter.get(sourceKey);
      if (!local) return null;
      return { sourceKey, chapterIndex: null, verseSeq: local.index, grain: 'sentence', page: 1, updatedAt: local.updatedAt };
    };

    void loadProgress().then((prog) => { if (!cancelled && prog) setResumeTarget(prog); });

    wfNewApi.getBookChapters(sourceKey).then(async (res) => {
      if (cancelled) return;
      const langs = res.languages || [];
      setLanguages(langs);
      const prefSimul = wfNewSettings.get('readerSimul');
      const prefLangs = (wfNewSettings.get('readerLangs') || []).filter((l) => langs.includes(l));
      const seed = prefLangs.length
        ? (prefSimul ? langs.filter((l) => prefLangs.includes(l)) : [prefLangs[0]])
        : (langs.length ? [langs[0]] : []);
      setSelectedLangs(seed);
      setSimul(prefSimul && langs.length > 1 ? prefSimul : false);
      setSequence((prev) => {
        const next = syncPlaySequenceForBook(prev.length ? prev : wfNewSettings.get('readerPlaySequence'), langs);
        wfNewSettings.setField('readerPlaySequence', next);
        return next;
      });
      setSpeedByLang((prev) => {
        const next = syncSpeedByLangForBook({ ...prev, ...wfNewSettings.get('readerSpeedByLang') }, langs);
        wfNewSettings.setField('readerSpeedByLang', next);
        return next;
      });
      setChapters(res.chapters || []);

      const prog = await loadProgress();
      if ((res.chapterCount || 0) > 0 && res.chapters.length) {
        let chapterIdx = prog?.chapterIndex ?? res.chapters[0].chapterIndex;
        let pageNum = prog?.page ?? 1;
        setActiveChapter(chapterIdx);
        const items = await loadVerses(chapterIdx, pageNum);
        if (prog) setResumeTarget(prog);
      } else {
        setFlat(true);
        await loadVerses(null, prog?.page ?? 1);
        if (prog) setResumeTarget(prog);
      }
    }).catch(() => {
      if (cancelled) return;
      setFlat(true);
      void loadVerses(null, 1);
    }).finally(() => { if (!cancelled) setLoadingChapters(false); });

    return () => { cancelled = true; };
  }, [sourceKey, loadVerses]);

  useEffect(() => {
    reloadRef.current = () => { void loadVerses(flat ? null : activeChapter, page); };
  }, [loadVerses, flat, activeChapter, page]);

  useEffect(() => {
    const next: Record<string, WfAudioCellState> = {};
    for (const v of verses) {
      for (const lang of orderedDisplayLangs) {
        const cell = v.languages?.[lang];
        if (!cell?.text?.trim()) continue;
        const k = cellKeyOf(v.grain, v.seq, lang);
        if (cell.hasAudio || cell.audioFiles?.some((f) => f.hasFile && f.url)) next[k] = 'ready';
        else if (cell.ttsStatus === 'processing') next[k] = 'processing';
        else if (cell.ttsStatus === 'pending') next[k] = 'queued';
      }
    }
    if (Object.keys(next).length) {
      setCellStatuses((prev) => ({ ...prev, ...next }));
    }
  }, [verses, orderedDisplayLangs]);

  useEffect(() => {
    requestedCellKeys.current = new Set();
    lastBumpBatchSigRef.current = '';
    resetSentenceAudioScheduler();
  }, [sourceKey, activeChapter, flat, page]);

  // On the initial verses load AND on every chapter/page switch (verses change)
  // send ONE high-priority batch hint to laravel for every now-visible sentence
  // that still lacks audio, so pycore bumps those sentences to the FRONT of its
  // queue (qwen3tts-first, per the backend engine order) ahead of the background
  // fill-missing sweep. Fire-and-forget: a failure never blocks the reader
  // (per-cell polling still requests each one). The signature ref dedupes repeat
  // invocations over the same data (e.g. StrictMode/double load), so each
  // distinct missing-audio set is sent exactly once.
  useEffect(() => {
    const seen = new Set<string>();
    const items: { text: string; language: string }[] = [];
    for (const v of verses) {
      for (const lang of orderedDisplayLangs) {
        const cell = v.languages?.[lang];
        const text = cell?.text?.trim();
        if (!text) continue;
        if (cell.hasAudio || cell.audioFiles?.some((f) => f.hasFile && f.url)) continue;
        const key = `${lang}:${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ text, language: lang });
      }
    }
    if (!items.length) return;
    const sig = items.map((it) => `${it.language}:${it.text}`).join('|');
    if (sig === lastBumpBatchSigRef.current) return;
    lastBumpBatchSigRef.current = sig;
    void pycoreApi.prioritizeSentenceAudio(items).catch((e) => {
      console.warn('[wordnew] Failed to prioritize visible sentence audio.', e);
    });
  }, [verses, orderedDisplayLangs]);

  useEffect(() => {
    if (!resumeTarget || resumeApplied || loadingVerses || !verses.length) return;
    const target = verses.find((v) => v.seq === resumeTarget.verseSeq && (!resumeTarget.grain || v.grain === resumeTarget.grain));
    if (target) {
      setActiveVerse(target);
      const el = document.getElementById(`verse-${verseKey(target)}`);
      const container = scrollRef.current;
      if (el && container) scrollVerseToUpperMiddle(el, container);
      if (autoPlayOnOpen) void playbackRef.current?.playFrom(target);
    }
    setResumeApplied(true);
  }, [resumeTarget, resumeApplied, loadingVerses, verses, autoPlayOnOpen]);

  useEffect(() => {
    if (!activeVerse) return;
    if (!userPickedVerse.current && Date.now() < scrollPausedUntil.current) return;
    const container = scrollRef.current;
    const el = container?.querySelector(`#verse-${verseKey(activeVerse)}`) as HTMLElement | null;
    if (el && container) scrollVerseToUpperMiddle(el, container);
    userPickedVerse.current = false;
  }, [activeVerse?.seq, activeVerse?.grain, playingKey]);

  const onScrollUser = useCallback(() => {
    scrollPausedUntil.current = Date.now() + 2500;
  }, []);

  const playCell = useCallback((verse: WfNewBookVerse, lang: string) => {
    userPickedVerse.current = true;
    scrollPausedUntil.current = 0;
    void playbackRef.current?.playFrom(verse, lang);
  }, []);

  const playSection = useCallback((verse: WfNewBookVerse) => {
    userPickedVerse.current = true;
    scrollPausedUntil.current = 0;
    void playbackRef.current?.playFrom(verse);
  }, []);

  const chapterOrder = useMemo(() => chapters.map((c) => c.chapterIndex), [chapters]);
  const activePos = activeChapter == null ? -1 : chapterOrder.indexOf(activeChapter);

  const selectChapter = useCallback((chapterIndex: number) => {
    playbackRef.current?.stop();
    setActiveChapter(chapterIndex);
    setPage(1);
    void loadVerses(chapterIndex, 1);
  }, [loadVerses]);

  const allEmpty = useMemo(() => verses.length > 0 && verses.every((v) => {
    const cells = v.languages ? Object.values(v.languages) : [];
    return !cells.some((c) => c?.text?.trim()) && !(v.text?.trim());
  }), [verses]);

  const goChapter = (delta: number) => {
    if (activePos < 0) return;
    const next = chapterOrder[activePos + delta];
    if (next !== undefined) selectChapter(next);
  };

  const jumpToChapter = (n: number) => {
    if (n < 1 || n > chapters.length) return;
    selectChapter(chapters[n - 1].chapterIndex);
  };

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) => {
      let next: string[];
      if (simul) next = prev.includes(code) ? (prev.length > 1 ? prev.filter((l) => l !== code) : prev) : [...languages.filter((l) => prev.includes(l) || l === code)];
      else next = [code];
      wfNewSettings.setField('readerLangs', next);
      persistReaderChange();
      return next;
    });
  };

  const setMode = (next: boolean) => {
    if (next && languages.length < 2) return;
    setSimul(next);
    wfNewSettings.setField('readerSimul', next);
    persistReaderChange();
    if (!next) setSelectedLangs((prev) => {
      const collapsed = [prev.find((l) => languages.includes(l)) || languages[0]].filter(Boolean) as string[];
      wfNewSettings.setField('readerLangs', collapsed);
      persistReaderChange();
      return collapsed;
    });
  };

  const currentChapterTitle = !flat && activeChapter != null
    ? chapterTitleFor(chapters.find((c) => c.chapterIndex === activeChapter) || { chapterIndex: activeChapter, sentenceCount: 0, titles: {} }, activeLang, trans)
    : title;

  return (
    <div className="space-y-4 pb-4">
      {/* Live region: mirrors the utterance Edge Read Aloud / screen readers hear during play. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        lang={liveReadLang ? langCodeToBcp47(liveReadLang) : undefined}
      >
        {liveReadText}
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">{title}</h2>
            {resumeTarget && !resumeApplied && <p className="text-[10px] font-mono text-amber-400/80">{trans('reader.resuming')}</p>}
          </div>
        </div>
        <button type="button" onClick={() => setShowSettings((v) => !v)} className={`shrink-0 p-2.5 rounded-full border cursor-pointer ${showSettings ? activeTheme.accentBg : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'}`} aria-label={trans('reader.playSettings')}>
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <WfBookReaderSettingsPanel
          activeTheme={activeTheme}
          trans={trans} languages={languages} simul={simul} selectedLangs={selectedLangs}
          displayMode={displayMode} sequence={sequence} speedByLang={speedByLang}
          autoAdvance={autoAdvance} repeatOne={repeatOne} autoPlayOnOpen={autoPlayOnOpen} browserTts={browserTts}
          wordCards={wordCards} wordCardPosition={wordCardPosition} wordRepeats={wordRepeats} wordMode={wordMode}
          onModeChange={setMode} onToggleLang={toggleLang}
          onDisplayModeChange={(m) => { setDisplayMode(m); wfNewSettings.setField('readerDisplayMode', m); persistReaderChange(); }}
          onSequenceChange={(s) => { setSequence(s); wfNewSettings.setField('readerPlaySequence', s); persistReaderChange(); }}
          onSpeedChange={(lang, sp) => { const next = { ...speedByLang, [lang]: sp }; setSpeedByLang(next); wfNewSettings.setField('readerSpeedByLang', next); persistReaderChange(); }}
          onAutoAdvanceChange={(v) => { setAutoAdvance(v); wfNewSettings.setField('readerAutoAdvance', v); persistReaderChange(); }}
          onRepeatOneChange={(v) => { setRepeatOne(v); wfNewSettings.setField('readerRepeatOne', v); persistReaderChange(); }}
          onAutoPlayOnOpenChange={(v) => { setAutoPlayOnOpen(v); wfNewSettings.setField('readerAutoPlayOnOpen', v); persistReaderChange(); }}
          onBrowserTtsChange={(v) => { setBrowserTts(v); wfNewSettings.setField('readerBrowserTts', v); persistReaderChange(); }}
          onWordCardsChange={(v) => { setWordCards(v); wfNewSettings.setField('readerWordCards', v); persistReaderChange(); }}
          onWordCardPositionChange={(v) => { setWordCardPosition(v); wfNewSettings.setField('readerWordCardPosition', v); persistReaderChange(); }}
          onWordRepeatsChange={(v) => { const next = Math.max(1, Math.min(10, v || 1)); setWordRepeats(next); wfNewSettings.setField('readerWordRepeats', next); persistReaderChange(); }}
          onWordModeChange={(v) => { setWordMode(v); wfNewSettings.setField('readerWordMode', v); persistReaderChange(); }}
        />
      )}

      {!flat && (
        <div className="relative">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goChapter(-1)} disabled={activePos <= 0} className="shrink-0 p-2 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 overflow-x-auto flex-1 snap-x snap-mandatory no-scrollbar pb-1">
              <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
              {loadingChapters && !chapters.length ? (
                <span className="text-xs text-zinc-500 font-mono">{trans('reader.loadingChapters')}</span>
              ) : chapters.map((c) => (
                <button key={c.chapterIndex} type="button" onClick={() => selectChapter(c.chapterIndex)} className={`shrink-0 snap-start px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${activeChapter === c.chapterIndex ? activeTheme.accentBg : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'}`}>
                  {chapterTitleFor(c, activeLang, trans)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setChaptersOpen((o) => !o)} className={`shrink-0 p-2 rounded-lg border cursor-pointer ${chaptersOpen ? activeTheme.accentBg : 'bg-white/5 border-white/5 text-zinc-300'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => goChapter(1)} disabled={activePos < 0 || activePos >= chapterOrder.length - 1} className="shrink-0 p-2 rounded-lg bg-white/5 border border-white/5 text-zinc-300 disabled:opacity-30 cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {chaptersOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setChaptersOpen(false)} aria-hidden="true" />
              <div className="absolute z-30 top-full mt-2 left-0 right-0 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-3 shadow-2xl max-h-[55vh] overflow-y-auto">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                  {chapters.map((c) => (
                    <button key={c.chapterIndex} type="button" onClick={() => { selectChapter(c.chapterIndex); setChaptersOpen(false); }} className={`px-2 py-1.5 rounded-lg text-xs font-medium border cursor-pointer truncate ${activeChapter === c.chapterIndex ? activeTheme.accentBg : 'bg-white/5 border-white/5 text-zinc-300'}`}>
                      {chapterTitleFor(c, activeLang, trans)}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setChaptersOpen(false)} className="absolute top-2 right-2 p-1 text-zinc-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </>
          )}
        </div>
      )}

      {loadingVerses ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono">{trans('reader.loadingVerses')}</span>
        </div>
      ) : verses.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-sm">{trans('reader.empty')}</div>
      ) : allEmpty ? (
        <div className="py-12 px-4 text-center space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
          <AlertTriangle className="w-7 h-7 mx-auto text-amber-400" />
          <p className="text-sm font-bold text-amber-200">{trans('reader.noTextTitle')}</p>
          <p className="text-xs text-zinc-400 font-mono flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />{trans('reader.noTextBody')}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="rounded-xl overflow-y-auto overflow-x-hidden space-y-2"
          style={{ maxHeight: 'min(62vh, 560px)' }}
          onWheel={onScrollUser}
          onTouchStart={onScrollUser}
        >
          {verses.map((v, i) => (
            <WfBookReaderVerseRow
              key={verseKey(v)} activeTheme={activeTheme} dark={dark} verse={v} index={i}
              orderedDisplayLangs={orderedDisplayLangs} displayMode={displayMode}
              trans={trans} langName={langName} playingKey={playingKey}
              activeVerseKey={activeVerse ? verseKey(activeVerse) : null}
              cellStatuses={cellStatuses}
              variantByLang={readerVariantByLang}
              onVariantSelect={onReaderVariantSelect}
              onPlay={playCell} onSectionPlay={playSection}
              onNeedMedia={requestCellMedia} onRetryAudio={retryCellAudio}
            />
          ))}
        </div>
      )}

      {!loadingVerses && verses.length > 0 && !allEmpty && (
        <WfBookReaderPlayBar
          activeTheme={activeTheme}
          trans={trans} playing={playing} paused={paused}
          chapterTitle={currentChapterTitle}
          verseRef={activeVerse?.ref || (activeVerse ? String(activeVerse.seq) : '')}
          activePos={activePos} chapterCount={chapters.length}
          onPlayPause={() => {
            if (playing) playbackRef.current?.togglePause();
            else if (activeVerse) void playbackRef.current?.playFrom(activeVerse);
            else if (verses[0]) void playbackRef.current?.playFrom(verses[0]);
          }}
          onStop={() => playbackRef.current?.stop()}
          onPrevChapter={() => goChapter(-1)}
          onNextChapter={() => goChapter(1)}
          onJumpChapter={jumpToChapter}
        />
      )}
    </div>
  );
};
