/* [v4.1-Iris] Learn Practice — word reader with walkman auto-play.
 * When a `library` query param is present, loads all words from that group and
 * renders them as a paginated list with a walkman play/pause control. When a
 * `mode` param is present, redirects to the matching runner. Display settings
 * (font size, translation, words-per-page) come from wfSettingsCenter.walkman.
 *
 * Word Walkman: auto-plays words one by one using TTS audio or Web Speech API.
 * Supports configurable playback delay, pre-delay, per-word play count, and
 * review mode. Scrolls to and highlights the currently-playing word. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, Settings as SettingsIcon,
  BookOpen, Globe, Languages, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Icons, SectionTitle, Button, LoadingState, EmptyState, PageHeader, IconButton } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { apiManager } from '../../../core/api-libs/wordflow/WordflowApiManager';
import type { Word, WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { wfSettingsCenter } from '../services/WfSettingsCenter';

const MODE_ROUTES: Record<string, string> = {
  reading: 'reading_run',
  flashcards: 'flashcard_run',
  quiz: 'quiz_run',
  listening: 'listening_player',
};

const CANONICAL_TTS_PREFIX = '/api/app_qy_v1/ai_tools/tts/audio/';
const TTS_MARKER = 'tts/audio/';
function resolveAudioUrl(audioUrl: string): string {
  if (!audioUrl) return '';
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) return audioUrl;
  const markerIndex = audioUrl.indexOf(TTS_MARKER);
  const rest = markerIndex >= 0
    ? audioUrl.slice(markerIndex + TTS_MARKER.length)
    : audioUrl.replace(/^\/+/, '');
  return `${apiManager.getCurrentBaseUrl()}${CANONICAL_TTS_PREFIX}${rest}`;
}

const TRANSLATION_POLL_INTERVAL = 5000;
const TRANSLATION_MAX_RETRY = 10;

interface WalkmanState {
  playing: boolean;
  currentIndex: number;
  playCount: number;
  mode: 'learn' | 'review';
  reviewIndex: number;
}

const WfLearnPracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang } = useWfApp();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const libraryId = searchParams.get('library');
  const resumeId = searchParams.get('resume');

  // Redirect to runner if mode param is set
  useEffect(() => {
    if (!mode) return;
    const route = MODE_ROUTES[mode];
    if (!route) return;
    const params = new URLSearchParams();
    if (libraryId) params.append('groupId', libraryId);
    if (resumeId) params.append('resume', resumeId);
    const qs = params.toString();
    navigate(`${wfPath(route)}${qs ? `?${qs}` : ''}`);
  }, [mode, libraryId, resumeId, navigate]);

  // Data
  const [library, setLibrary] = useState<WordGroup | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Display settings from walkman
  const [showTranslation, setShowTranslation] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [wordsPerPage, setWordsPerPage] = useState(100);

  // Walkman
  const [walkman, setWalkman] = useState<WalkmanState>({
    playing: false, currentIndex: -1, playCount: 0, mode: 'learn', reviewIndex: 0,
  });
  const walkmanRef = useRef(walkman);
  walkmanRef.current = walkman;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const walkmanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Walkman config
  const [durationDelay, setDurationDelay] = useState(0.5);
  const [preDelay, setPreDelay] = useState(0.5);
  const [maxPlays, setMaxPlays] = useState(1);
  const [maxReview, setMaxReview] = useState(1);

  // Single-word playback highlight
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  // Translation queue
  const [pendingTranslations, setPendingTranslations] = useState<Set<string>>(new Set());
  const pendingTranslationsRef = useRef<Map<string, number>>(new Map());
  const translationPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetLanguageRef = useRef(lang);
  targetLanguageRef.current = lang;

  // Load settings
  useEffect(() => {
    let alive = true;
    wfSettingsCenter.load().then((s) => {
      if (!alive) return;
      setDurationDelay(s.walkman.durationDelay);
      setPreDelay(s.walkman.preDelay);
      setMaxPlays(s.walkman.maxPlays);
      setMaxReview(s.walkman.maxReview);
      setWordsPerPage(s.walkman.wordsPerPage);
      setShowTranslation(s.walkman.showTranslation);
      setFontSize(s.walkman.fontSize);
    });
    return () => { alive = false; };
  }, []);

  // Load words
  useEffect(() => {
    if (!libraryId || mode) return;
    let cancelled = false;
    setCurrentPage(1);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [groups, groupWords] = await Promise.all([
          wordflowApi.getWordGroups().catch(() => [] as WordGroup[]),
          wordflowApi.getWordsForGroup(libraryId).catch(() => [] as Word[]),
        ]);
        if (cancelled) return;
        const g = (Array.isArray(groups) ? groups : []).find((x) => x.id === libraryId) || null;
        setLibrary(g);
        setWords(Array.isArray(groupWords) ? groupWords : []);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load words.');
          setWords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [libraryId, mode]);

  const totalPages = Math.max(1, Math.ceil(words.length / wordsPerPage));
  const pageWords = useMemo(() => {
    const start = (currentPage - 1) * wordsPerPage;
    return words.slice(start, start + wordsPerPage);
  }, [words, currentPage, wordsPerPage]);

  // --- Translation queue ---
  const stopTranslationPolling = () => {
    if (translationPollTimerRef.current) {
      clearInterval(translationPollTimerRef.current);
      translationPollTimerRef.current = null;
    }
  };

  const pollTranslationStatus = async () => {
    const pendingWords = Array.from(pendingTranslationsRef.current.keys(), (k) => String(k));
    if (pendingWords.length === 0) { stopTranslationPolling(); return; }
    try {
      const res = await wordflowApi.translationQueueBatchStatus(pendingWords, targetLanguageRef.current);
      const results = Array.isArray(res?.results) ? res.results : Array.isArray(res?.data?.results) ? res.data.results : [];
      const filled = new Map<string, string>();
      for (const r of results) {
        if (r?.word && r.has_translation && r.translation) {
          filled.set(String(r.word), String(r.translation));
          pendingTranslationsRef.current.delete(String(r.word));
        }
      }
      for (const w of pendingWords) {
        if (filled.has(w)) continue;
        const retries = (pendingTranslationsRef.current.get(w) ?? 0) + 1;
        if (retries >= TRANSLATION_MAX_RETRY) pendingTranslationsRef.current.delete(w);
        else pendingTranslationsRef.current.set(w, retries);
      }
      if (filled.size > 0) {
        setWords((prev) => prev.map((w) => (w.text && filled.has(w.text) ? { ...w, translation: filled.get(w.text)! } : w)));
      }
    } catch {}
    setPendingTranslations(new Set(pendingTranslationsRef.current.keys()));
    if (pendingTranslationsRef.current.size === 0) stopTranslationPolling();
  };

  useEffect(() => {
    pendingTranslationsRef.current.clear();
    setPendingTranslations(new Set());
    stopTranslationPolling();
  }, [libraryId, currentPage]);

  useEffect(() => {
    const needing = pageWords.filter((w) => !!w.text && !w.translation && !pendingTranslationsRef.current.has(w.text));
    if (needing.length === 0) return;
    for (const w of needing) pendingTranslationsRef.current.set(w.text, 0);
    setPendingTranslations(new Set(pendingTranslationsRef.current.keys()));
    (async () => {
      try {
        await wordflowApi.translationQueueBatchAdd(needing.map((w) => w.text), targetLanguageRef.current);
      } catch {}
      if (!translationPollTimerRef.current) {
        translationPollTimerRef.current = setInterval(pollTranslationStatus, TRANSLATION_POLL_INTERVAL);
        pollTranslationStatus();
      }
    })();
  }, [pageWords]);

  useEffect(() => () => { stopTranslationPolling(); pendingTranslationsRef.current.clear(); }, []);

  // --- Walkman engine ---
  const stopWalkman = useCallback(() => {
    if (walkmanTimerRef.current) { clearTimeout(walkmanTimerRef.current); walkmanTimerRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setWalkman((prev) => ({ ...prev, playing: false }));
    setPlayingWordId(null);
  }, []);

  const playWordAudio = useCallback((word: Word): Promise<void> => {
    return new Promise((resolve) => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingWordId(word.id);

      if (word.audioUrl) {
        const audio = new Audio(resolveAudioUrl(word.audioUrl));
        audioRef.current = audio;
        audio.onended = () => { audioRef.current = null; resolve(); };
        audio.onerror = () => { audioRef.current = null; resolve(); };
        audio.play().catch(() => resolve());
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(word.text || '');
        u.lang = 'en-US';
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } else {
        setTimeout(resolve, 1000);
      }
    });
  }, []);

  const scrollToWord = useCallback((index: number) => {
    const el = wordRefs.current.get(index);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const walkmanTick = useCallback(async () => {
    const state = walkmanRef.current;
    if (!state.playing) return;

    if (state.mode === 'learn') {
      const idx = state.currentIndex;
      if (idx >= pageWords.length) {
        // All words played, switch to review
        if (maxReview > 0) {
          setWalkman((prev) => ({ ...prev, mode: 'review', reviewIndex: 0, currentIndex: 0, playCount: 0 }));
          walkmanTimerRef.current = setTimeout(walkmanTick, durationDelay * 1000);
        } else {
          stopWalkman();
        }
        return;
      }
      scrollToWord(idx);
      const word = pageWords[idx];
      await playWordAudio(word);
      setPlayingWordId(null);

      const newPlayCount = state.playCount + 1;
      if (newPlayCount >= maxPlays) {
        setWalkman((prev) => ({ ...prev, currentIndex: idx + 1, playCount: 0 }));
      } else {
        setWalkman((prev) => ({ ...prev, playCount: newPlayCount }));
      }
      walkmanTimerRef.current = setTimeout(walkmanTick, durationDelay * 1000);
    } else {
      // Review mode
      const idx = state.currentIndex;
      if (idx >= pageWords.length) {
        const newReviewIndex = state.reviewIndex + 1;
        if (newReviewIndex >= maxReview) {
          stopWalkman();
          return;
        }
        setWalkman((prev) => ({ ...prev, currentIndex: 0, reviewIndex: newReviewIndex }));
        walkmanTimerRef.current = setTimeout(walkmanTick, durationDelay * 1000);
        return;
      }
      scrollToWord(idx);
      const word = pageWords[idx];
      await playWordAudio(word);
      setPlayingWordId(null);
      setWalkman((prev) => ({ ...prev, currentIndex: idx + 1 }));
      walkmanTimerRef.current = setTimeout(walkmanTick, durationDelay * 1000);
    }
  }, [pageWords, maxPlays, maxReview, durationDelay, stopWalkman, playWordAudio, scrollToWord]);

  const startWalkman = useCallback(() => {
    setWalkman({ playing: true, currentIndex: 0, playCount: 0, mode: 'learn', reviewIndex: 0 });
    walkmanTimerRef.current = setTimeout(walkmanTick, preDelay * 1000);
  }, [preDelay, walkmanTick]);

  const toggleWalkman = useCallback(() => {
    if (walkmanRef.current.playing) {
      stopWalkman();
    } else {
      startWalkman();
    }
  }, [stopWalkman, startWalkman]);

  const skipNext = useCallback(() => {
    if (!walkman.playing) return;
    if (walkmanTimerRef.current) { clearTimeout(walkmanTimerRef.current); walkmanTimerRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingWordId(null);
    setWalkman((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1, playCount: 0 }));
    walkmanTimerRef.current = setTimeout(walkmanTick, 100);
  }, [walkman.playing, walkmanTick]);

  const skipPrev = useCallback(() => {
    if (!walkman.playing) return;
    if (walkmanTimerRef.current) { clearTimeout(walkmanTimerRef.current); walkmanTimerRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingWordId(null);
    setWalkman((prev) => ({ ...prev, currentIndex: Math.max(0, prev.currentIndex - 1), playCount: 0 }));
    walkmanTimerRef.current = setTimeout(walkmanTick, 100);
  }, [walkman.playing, walkmanTick]);

  // Stop walkman on page change or unmount
  useEffect(() => { stopWalkman(); }, [currentPage, stopWalkman]);
  useEffect(() => () => { stopWalkman(); }, [stopWalkman]);

  // Single word tap-to-play
  const playSingleWord = (word: Word) => {
    if (walkman.playing) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (word.audioUrl) {
      const audio = new Audio(resolveAudioUrl(word.audioUrl));
      audioRef.current = audio;
      setPlayingWordId(word.id);
      audio.play().catch(() => setPlayingWordId(null));
      audio.onended = () => { setPlayingWordId(null); audioRef.current = null; };
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word.text || '');
      u.lang = 'en-US';
      setPlayingWordId(word.id);
      u.onend = () => setPlayingWordId(null);
      window.speechSynthesis.speak(u);
    }
  };

  // If no library and no mode, show empty prompt
  if (!libraryId && !mode) {
    return (
      <div className="ds-page ds-section-gap route-fade min-h-screen bg-transparent pb-32">
        <div className="pt-20 w-full">
          <div className="px-1">
            <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
              {t('nav.practice')}
            </h1>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
              Select a library to start reading words
            </p>
          </div>
        </div>
        <EmptyState
          icon={<BookOpen strokeWidth={1.5} />}
          title="No Library Selected"
          description="Go to the Library tab and choose a word group to start practicing."
          action={<Button variant="grad" onClick={() => navigate(wfPath('learn/library'))}>Browse Libraries</Button>}
        />
      </div>
    );
  }

  if (mode) return null; // redirecting

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent">
        <PageHeader title="Loading words..." onBack={() => navigate(wfPath('learn/library'))} />
        <LoadingState label="Loading words..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <PageHeader
        title={library?.name || 'Word Reading'}
        onBack={() => navigate(wfPath('learn/library'))}
        right={<IconButton icon={<SettingsIcon className="w-5 h-5" />} onClick={() => navigate(wfPath('settings_word_reading'))} label="Settings" />}
      />

      <div className="ds-page pt-4">
        {/* Hero info card */}
        {library && (
          <div
            className="mb-5 rounded-[var(--radius-card)] p-5 text-[color:var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold mb-1 line-clamp-2">{library.name}</h2>
                <div className="flex items-center gap-3 text-sm text-white/85 flex-wrap">
                  <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{library.count || words.length} words</span>
                  <span className="flex items-center gap-1"><Globe className="w-4 h-4" />{library.language}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold">{currentPage}</div>
                <div className="text-sm text-white/65">/ {totalPages}</div>
              </div>
            </div>
          </div>
        )}

        {/* Walkman controls */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            onClick={skipPrev}
            disabled={!walkman.playing}
            className="ds-touch-target w-10 h-10 rounded-full ds-glass flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--klein-blue)] disabled:opacity-30 transition-all"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={toggleWalkman}
            className="ds-touch-target w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            {walkman.playing
              ? <Pause className="w-6 h-6" fill="currentColor" />
              : <Play className="w-6 h-6 ml-0.5" fill="currentColor" />}
          </button>

          <button
            onClick={skipNext}
            disabled={!walkman.playing}
            className="ds-touch-target w-10 h-10 rounded-full ds-glass flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--klein-blue)] disabled:opacity-30 transition-all"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {walkman.playing && (
            <div className="ml-3 text-xs text-[var(--color-text-tertiary)]">
              {walkman.mode === 'learn' ? 'Learning' : `Review ${walkman.reviewIndex + 1}/${maxReview}`}
              {' '}{walkman.currentIndex + 1}/{pageWords.length}
            </div>
          )}
        </div>

        {/* View mode pill */}
        <div className="mb-5">
          <div className="ds-pill-nav" role="tablist" aria-label="View mode">
            {[
              { id: 'simple', label: 'Simple View', full: false },
              { id: 'full', label: 'Full View', full: true },
            ].map((v) => (
              <button
                key={v.id} type="button" role="tab" aria-selected={showTranslation === v.full}
                onClick={() => setShowTranslation(v.full)}
                className={`ds-pill-chip ${showTranslation === v.full ? 'is-active' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Word list */}
        {error ? (
          <EmptyState icon={<BookOpen strokeWidth={1.5} />} title={error} />
        ) : pageWords.length > 0 ? (
          <div className="ds-stack-tight flex flex-col mb-6">
            {pageWords.map((word, idx) => {
              const globalIndex = (currentPage - 1) * wordsPerPage + idx;
              const isWalkmanActive = walkman.playing && walkman.currentIndex === idx;
              const isPlaying = playingWordId === word.id;
              const hasTranslation = !!word.translation;
              const isTranslating = showTranslation && !hasTranslation && pendingTranslations.has(word.text);
              return (
                <div
                  key={word.id || globalIndex}
                  ref={(el) => { if (el) wordRefs.current.set(idx, el); else wordRefs.current.delete(idx); }}
                  className={`ds-row group relative p-4 cursor-default transition-all ${
                    isWalkmanActive ? 'ring-2 ring-[var(--klein-blue)] !bg-[var(--klein-blue-soft)]' : ''
                  } ${hasTranslation && showTranslation ? '!border-green-300 dark:!border-green-800' : ''}`}
                  onClick={() => navigate(wfPath(`word_detail?wordId=${encodeURIComponent(word.id)}`))}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-[var(--color-text-tertiary)] font-mono text-sm font-semibold min-w-[3rem] flex-shrink-0 mt-0.5">
                      {globalIndex + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div
                          className="font-bold text-[var(--color-text-primary)] break-words"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {word.text}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); playSingleWord(word); }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                            isPlaying
                              ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]'
                              : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] hover:opacity-80'
                          }`}
                          title="Play audio"
                        >
                          {isPlaying
                            ? <Pause className="w-3.5 h-3.5" fill="currentColor" />
                            : word.audioUrl
                              ? <Play className="w-3.5 h-3.5" fill="currentColor" />
                              : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {word.phonetic && showTranslation && (
                        <div className="text-xs text-[var(--klein-blue)] mt-1 font-mono bg-[var(--klein-blue-soft)] inline-block px-2 py-0.5 rounded-full">
                          {word.phonetic}
                        </div>
                      )}
                      {showTranslation && hasTranslation && (
                        <div className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                          {word.translation}
                        </div>
                      )}
                      {isTranslating && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 animate-pulse">
                          <Languages className="w-3.5 h-3.5" /> translating...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<BookOpen strokeWidth={1.5} />} title="No words yet" />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="ds-card rounded-[var(--radius-card)] p-4 sticky bottom-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="secondary" className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />Previous
              </Button>
              <div className="text-center min-w-[100px]">
                <div className="text-2xl font-bold text-[var(--klein-blue)]">{currentPage}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">of {totalPages}</div>
              </div>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="secondary" className="flex-1"
              >
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WfLearnPracticePage;
