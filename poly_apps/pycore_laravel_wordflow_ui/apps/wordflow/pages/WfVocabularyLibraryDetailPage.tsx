/* [v4.1-Iris] Vocabulary Library Detail — ported/adapted from
 * qy_capacitor/pages/Vocabulary/LibraryDetail.tsx. Self-contained for the shell:
 * reads the library id from the route param (:id), loads that group's words via
 * wordflowApi.getWordsForGroup() (the shell's available word surface), and
 * paginates + renders them client-side. Display settings (index / translation /
 * font size / words-per-page) live in a Sheet. Untranslated visible words are
 * enqueued on the backend translation queue (translationQueueBatchAdd) and
 * polled every 5s (translationQueueBatchStatus) until their fills arrive —
 * the FE never translates itself (port of VocabularyTranslationCenter). Audio
 * plays the word's audioUrl (repaired to the canonical TTS route) when present,
 * else the Web Speech API. Uses react-router useNavigate/useParams + wfPath()
 * and the shared Iris primitives in WfUI. Gradient hero info card, Simple/Full
 * view pill row. Faithful to design-reference-{light,dark}.webp. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Pause, Volume2, Languages, Settings as SettingsIcon, ChevronLeft, ChevronRight, BookOpen, Globe, X } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { apiManager } from '../../../core/api-libs/wordflow/WordflowApiManager';
import type { Word, WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { Button, LoadingState, EmptyState, PageHeader, Sheet, IconButton } from '../WfUI';

// TTS audio URL repair — port of qy_capacitor/services/TtsUrl.ts (legacy
// audio_url forms are collapsed onto the one canonical serving route).
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

// Translation-queue poll cadence (mirrors VocabularyTranslationCenter).
const TRANSLATION_POLL_INTERVAL = 5000;
const TRANSLATION_MAX_RETRY = 10;

interface DisplaySettings {
  showIndex: boolean;
  showTranslation: boolean;
  fontSize: number;
  wordsPerPage: number;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  showIndex: true,
  showTranslation: false,
  fontSize: 16,
  wordsPerPage: 100,
};

const WfVocabularyLibraryDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useWfApp();

  const [library, setLibrary] = useState<WordGroup | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Translation-queue tracking (port of VocabularyTranslationCenter): word text
  // -> retry count while we wait for the backend fill. pendingTranslations is
  // the render mirror used for the per-word "translating…" indicator.
  const [pendingTranslations, setPendingTranslations] = useState<Set<string>>(new Set());
  const pendingTranslationsRef = useRef<Map<string, number>>(new Map());
  const translationPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetLanguageRef = useRef(lang);
  targetLanguageRef.current = lang;

  const libraryId = id || '';

  useEffect(() => {
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
          console.error('[WfVocabularyLibraryDetail] Failed to load words:', err);
          setError(err?.message || 'Failed to load words.');
          setWords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  const totalPages = Math.max(1, Math.ceil(words.length / displaySettings.wordsPerPage));

  const pageWords = useMemo(() => {
    const start = (currentPage - 1) * displaySettings.wordsPerPage;
    return words.slice(start, start + displaySettings.wordsPerPage);
  }, [words, currentPage, displaySettings.wordsPerPage]);

  // ---- Translation queue: enqueue + poll (port of VocabularyTranslationCenter) ----

  const stopTranslationPolling = () => {
    if (translationPollTimerRef.current) {
      clearInterval(translationPollTimerRef.current);
      translationPollTimerRef.current = null;
    }
  };

  const pollTranslationStatus = async () => {
    const pendingWords = Array.from(pendingTranslationsRef.current.keys(), (k) => String(k));
    if (pendingWords.length === 0) {
      stopTranslationPolling();
      return;
    }
    try {
      const res = await wordflowApi.translationQueueBatchStatus(pendingWords, targetLanguageRef.current);
      const results = Array.isArray(res?.results)
        ? res.results
        : Array.isArray(res?.data?.results)
          ? res.data.results
          : [];
      const filled = new Map<string, string>();
      for (const r of results) {
        if (r?.word && r.has_translation && r.translation) {
          filled.set(String(r.word), String(r.translation));
          pendingTranslationsRef.current.delete(String(r.word));
        }
      }
      // Count a retry for the still-pending words; drop exhausted ones.
      for (const w of pendingWords) {
        if (filled.has(w)) continue;
        const retries = (pendingTranslationsRef.current.get(w) ?? 0) + 1;
        if (retries >= TRANSLATION_MAX_RETRY) pendingTranslationsRef.current.delete(w);
        else pendingTranslationsRef.current.set(w, retries);
      }
      if (filled.size > 0) {
        setWords((prev) =>
          prev.map((w) => (w.text && filled.has(w.text) ? { ...w, translation: filled.get(w.text)! } : w))
        );
      }
    } catch (err: any) {
      // Best-effort poll — keep pending words for the next tick.
      console.warn('[WfVocabularyLibraryDetail] Translation status poll failed (handled):', err?.message || err);
    }
    setPendingTranslations(new Set(pendingTranslationsRef.current.keys()));
    if (pendingTranslationsRef.current.size === 0) stopTranslationPolling();
  };

  // Context switch (library / page) — clear the pending set like the original
  // center does, so polling never mixes pages.
  useEffect(() => {
    pendingTranslationsRef.current.clear();
    setPendingTranslations(new Set());
    stopTranslationPolling();
  }, [libraryId, currentPage]);

  // Enqueue the visible untranslated words on the backend translation queue and
  // start the 5s poll loop. The FE never translates itself — it only
  // prioritizes visible words and patches the UI as fills arrive.
  useEffect(() => {
    const needing = pageWords.filter(
      (w) => !!w.text && !w.translation && !pendingTranslationsRef.current.has(w.text)
    );
    if (needing.length === 0) return;
    for (const w of needing) pendingTranslationsRef.current.set(w.text, 0);
    setPendingTranslations(new Set(pendingTranslationsRef.current.keys()));
    (async () => {
      try {
        await wordflowApi.translationQueueBatchAdd(
          needing.map((w) => w.text),
          targetLanguageRef.current
        );
      } catch (err: any) {
        console.warn('[WfVocabularyLibraryDetail] Translation enqueue failed (handled):', err?.message || err);
      }
      if (!translationPollTimerRef.current) {
        translationPollTimerRef.current = setInterval(pollTranslationStatus, TRANSLATION_POLL_INTERVAL);
        pollTranslationStatus();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWords]);

  // Stop polling on unmount.
  useEffect(
    () => () => {
      stopTranslationPolling();
      pendingTranslationsRef.current.clear();
    },
    []
  );

  const playAudio = (word: Word) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (word.audioUrl) {
      // Repair any legacy/stale audio_url form before playback (original behavior).
      const audio = new Audio(resolveAudioUrl(word.audioUrl));
      audioRef.current = audio;
      setPlayingAudio(word.id);
      audio.play().catch((err) => {
        console.error('[WfVocabularyLibraryDetail] Audio playback failed:', err);
        setPlayingAudio(null);
      });
      audio.onended = () => {
        setPlayingAudio(null);
        audioRef.current = null;
      };
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word.text || '');
      u.lang = 'en-US';
      setPlayingAudio(word.id);
      u.onend = () => setPlayingAudio(null);
      window.speechSynthesis.speak(u);
    }
  };

  const renderSettingsPanel = () => (
    <Sheet open={showSettings} onClose={() => setShowSettings(false)} position="center" panelClassName="max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="ds-section-title !text-xl">{t('vocabulary.displaySettings') || 'Display Settings'}</h3>
        <IconButton icon={<X className="w-5 h-5" />} onClick={() => setShowSettings(false)} label="Close" />
      </div>

      <div className="space-y-4">
        <label className="ds-row flex items-center justify-between p-4 cursor-pointer">
          <span className="font-semibold text-[var(--color-text-primary)]">{t('vocabulary.showIndex') || 'Show Index'}</span>
          <input
            type="checkbox"
            checked={displaySettings.showIndex}
            onChange={(e) => setDisplaySettings((prev) => ({ ...prev, showIndex: e.target.checked }))}
            className="w-5 h-5 rounded accent-[color:var(--klein-blue)]"
          />
        </label>

        <label className="ds-row flex items-center justify-between p-4 cursor-pointer">
          <span className="font-semibold text-[var(--color-text-primary)]">{t('vocabulary.showTranslation') || 'Show Translation'}</span>
          <input
            type="checkbox"
            checked={displaySettings.showTranslation}
            onChange={(e) => setDisplaySettings((prev) => ({ ...prev, showTranslation: e.target.checked }))}
            className="w-5 h-5 rounded accent-[color:var(--klein-blue)]"
          />
        </label>

        <div className="ds-row p-4">
          <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
            {t('vocabulary.fontSize') || 'Font Size'}: <span className="text-[var(--klein-blue)]">{displaySettings.fontSize}px</span>
          </label>
          <input
            type="range"
            min="12"
            max="24"
            value={displaySettings.fontSize}
            onChange={(e) => setDisplaySettings((prev) => ({ ...prev, fontSize: parseInt(e.target.value, 10) }))}
            className="w-full accent-[color:var(--klein-blue)]"
          />
        </div>

        <div className="ds-row p-4">
          <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">{t('vocabulary.wordsPerPage') || 'Words Per Page'}</label>
          <div className="ds-pill-nav" role="tablist" aria-label="Words per page">
            {[50, 100, 200, 500].map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={displaySettings.wordsPerPage === n}
                onClick={() => {
                  setDisplaySettings((prev) => ({ ...prev, wordsPerPage: n }));
                  setCurrentPage(1);
                }}
                className={`ds-pill-chip ${displaySettings.wordsPerPage === n ? 'is-active' : ''}`}
              >
                {n} / page
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={() => setShowSettings(false)} className="w-full mt-6" variant="grad">
        {t('common.done') || 'Done'}
      </Button>
    </Sheet>
  );

  if (loading && !library && words.length === 0) {
    return (
      <div className="min-h-screen bg-transparent">
        <PageHeader title={t('vocabulary.loadingWords') || 'Loading words…'} onBack={() => navigate(wfPath('courses'))} />
        <LoadingState label={t('vocabulary.loadingWords') || 'Loading words…'} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <PageHeader
        title={library?.name || t('vocabulary.libraryDetails') || 'Library Details'}
        onBack={() => navigate(wfPath('courses'))}
        right={<IconButton icon={<SettingsIcon className="w-5 h-5" />} onClick={() => setShowSettings(true)} label="Display settings" />}
      />

      <div className="ds-page pt-4">
        {/* Gradient hero info card */}
        {library && (
          <div
            className="mb-7 rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold mb-2 line-clamp-2">{library.name}</h2>
                <div className="flex items-center gap-4 text-sm text-white/85 flex-wrap">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    {library.count || words.length} {t('vocabulary.words') || 'words'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {library.language}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold">{currentPage}</div>
                <div className="text-sm text-white/65">/ {totalPages}</div>
              </div>
            </div>
          </div>
        )}

        {/* View mode pill */}
        <div className="mb-5">
          <div className="ds-pill-nav" role="tablist" aria-label="View mode">
            {[
              { id: 'simple', label: t('vocabulary.simpleView') || 'Simple View', full: false },
              { id: 'full', label: t('vocabulary.fullView') || 'Full View', full: true },
            ].map((v) => {
              const active = displaySettings.showTranslation === v.full;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDisplaySettings((prev) => ({ ...prev, showTranslation: v.full }))}
                  className={`ds-pill-chip ${active ? 'is-active' : ''}`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Words list */}
        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : error ? (
          <EmptyState icon={<BookOpen strokeWidth={1.5} />} title={error} />
        ) : pageWords.length > 0 ? (
          <div className="ds-stack-tight flex flex-col mb-6">
            {pageWords.map((word, idx) => {
              const globalIndex = (currentPage - 1) * displaySettings.wordsPerPage + idx;
              const displayTranslation = word.translation;
              const hasTranslation = !!displayTranslation;
              // While untranslated, the backend queue is filling it (enqueue+poll).
              const isTranslating =
                displaySettings.showTranslation && !hasTranslation && pendingTranslations.has(word.text);
              const hasPhonetic = !!word.phonetic;
              return (
                <div
                  key={word.id || globalIndex}
                  className={`ds-row group relative p-4 cursor-default ${
                    hasTranslation && displaySettings.showTranslation ? '!border-green-300 dark:!border-green-800' : ''
                  }`}
                  onClick={() => navigate(wfPath(`word_detail?wordId=${encodeURIComponent(word.id)}`))}
                >
                  <div className="flex items-start gap-3">
                    {displaySettings.showIndex && (
                      <span className="text-[var(--color-text-tertiary)] font-mono text-sm font-semibold min-w-[3rem] flex-shrink-0 mt-0.5">
                        {globalIndex + 1}.
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div
                          className="font-bold text-[var(--color-text-primary)] break-words"
                          style={{ fontSize: `${displaySettings.fontSize}px` }}
                        >
                          {word.text}
                        </div>
                        {displaySettings.showTranslation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudio(word);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                              playingAudio === word.id
                                ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]'
                                : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] hover:opacity-80'
                            }`}
                            title="Play audio"
                            aria-label="Play audio"
                          >
                            {playingAudio === word.id ? (
                              <Pause className="w-3.5 h-3.5" fill="currentColor" />
                            ) : word.audioUrl ? (
                              <Play className="w-3.5 h-3.5" fill="currentColor" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      {hasPhonetic && displaySettings.showTranslation && (
                        <div className="text-xs text-[var(--klein-blue)] mt-1 font-mono bg-[var(--klein-blue-soft)] inline-block px-2 py-0.5 rounded-full">
                          {word.phonetic}
                        </div>
                      )}
                      {displaySettings.showTranslation && hasTranslation && (
                        <div className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                          {displayTranslation}
                        </div>
                      )}
                      {/* Translation pending — backend queue is filling it (same
                          amber/animate-pulse pattern as the original page). */}
                      {isTranslating && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 animate-pulse">
                          <Languages className="w-3.5 h-3.5" /> translating…
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<BookOpen strokeWidth={1.5} />} title={t('vocabulary.noWords') || 'No words yet'} />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="ds-card rounded-[var(--radius-card)] p-4 sticky bottom-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="secondary"
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('common.previous') || 'Previous'}
              </Button>
              <div className="text-center min-w-[100px]">
                <div className="text-2xl font-bold text-[var(--klein-blue)]">{currentPage}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {t('common.of') || 'of'} {totalPages}
                </div>
              </div>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="secondary"
                className="flex-1"
              >
                {t('common.next') || 'Next'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {renderSettingsPanel()}
    </div>
  );
};

export default WfVocabularyLibraryDetailPage;
