/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext, useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, LoadingState, EmptyState, Spinner, ProgressBar, Sheet } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import { Play, Pause, Volume2, Lightbulb, Check } from 'lucide-react';
import { Header } from '../../components/Header';
// Header currently only types `title`; this page also passes `showBack` /
// `actions`, which the component ignores at runtime (pre-existing dead props).
// Alias the identical component with a widened prop type so the existing JSX
// type-checks without changing what renders or runs.
const HeaderX = Header as React.ComponentType<{
  title?: string;
  showBack?: boolean;
  actions?: React.ReactNode;
}>;
import { ApiCenter } from '../../services/ApiCenter';
import { mapLanguageCode } from '../../services/languageMapper';
import { BingTranslator, GoogleTranslator, DeepLTranslator } from '../../services/translators';
import { VocabularyLibraryManager } from '../../services/VocabularyLibraryManager';
import { AudioProcessingHook } from '../../services/AudioProcessingHook';
import { EventBus } from '../../services/EventBus';
import { VocabularyAudioCenter } from '../../services/VocabularyAudioCenter';
import { resolveAudioUrl } from '../../services/TtsUrl';

interface VocabularyWord {
  index: number;
  word: string;
  translation?: string;
  translations?: any[] | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  word_details?: any | null;
  has_translation?: boolean;
  audio_url?: string | null;
  audio_available?: boolean; // Backend TTS integration field
}

interface DisplaySettings {
  showIndex: boolean;
  showTranslation: boolean;
  fontSize: number;
  columnCount: number;
  wordsPerPage: number;
  translationProvider: 'none' | 'bing' | 'google' | 'deepl';
  autoTranslate: boolean;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  showIndex: true,
  showTranslation: false,
  fontSize: 16,
  columnCount: 1,
  wordsPerPage: 100,
  translationProvider: 'bing',
  autoTranslate: false,
};

const VocabularyLibraryDetail = () => {
  const { user, navigate, t, settings } = useContext(AppContext);
  const { id } = useParams<{ id: string }>();
  const [library, setLibrary] = useState<any>(null);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get library ID from URL params
  const libraryId = parseInt(id || '1', 10);

  // Reset state when library ID changes
  useEffect(() => {
    setCurrentPage(1);
    setLibrary(null);
    setWords([]);
    setTotalPages(1);
  }, [libraryId]);

  useEffect(() => {
    AudioProcessingHook.initialize();
  }, []);

  useEffect(() => {
    loadLibraryWords(currentPage);
  }, [libraryId, currentPage, displaySettings.wordsPerPage]);

  useEffect(() => {
    if (displaySettings.autoTranslate && words.length > 0) {
      translateAllWords();
    }
  }, [displaySettings.autoTranslate, displaySettings.translationProvider, words.length]);

  useEffect(() => {
    const handleAudioReady = (event: any) => {
      console.log('[LibraryDetail] Audio ready:', event.word);
      const updatedWords = words.map(w => {
        if (w.word === event.word) {
          const library = VocabularyLibraryManager.getLibrary(libraryId);
          const cachedWord = Array.isArray(library?.words) ? library.words.find(cw => cw.word === w.word) : undefined;
          if (cachedWord?.audio_url) {
            return { ...w, audio_url: cachedWord.audio_url };
          }
        }
        return w;
      });
      setWords(updatedWords);
    };

    const unsubscribeAudioReady = EventBus.on('library:audio_ready', handleAudioReady);
    return () => {
      unsubscribeAudioReady();
    };
  }, [words, libraryId]);

  // VocabularyAudioCenter subscription for audio generation updates
  useEffect(() => {
    const unsubscribe = VocabularyAudioCenter.subscribe((word, audioUrl) => {
      console.log('[LibraryDetail] VocabularyAudioCenter: Audio ready for', word, audioUrl);

      // Update word in current page
      setWords((prev) =>
        prev.map((w) => (w.word === word ? { ...w, audio_url: audioUrl, audio_available: true } : w))
      );

      // Update in VocabularyLibraryManager cache
      const library = VocabularyLibraryManager.getLibrary(libraryId);
      if (library && Array.isArray(library.words)) {
        const wordToUpdate = library.words.find(w => w.word === word);
        if (wordToUpdate) {
          wordToUpdate.audio_url = audioUrl;
        }
      }
    });

    return () => {
      unsubscribe();
      // Clear cache when unmounting (user leaving page or switching pages)
      VocabularyAudioCenter.clearCache();
      console.log('[LibraryDetail] Component unmounting, cleared audio cache and polling');
    };
  }, [libraryId]);

  const loadLibraryWords = async (page: number) => {
    setLoading(true);
    try {
      const langCode = settings.language.learningLanguages?.[0] || 'en';
      const language = mapLanguageCode(langCode);

      const response = await ApiCenter.vocabulary.getLibraryWords(
        libraryId,
        {
          page,
          per_page: displaySettings.wordsPerPage,
        }
      );

      console.log('[LibraryDetail] API response:', response);

      if (response.success && response.data) {
        const libraryData = response.data.library;
        const wordsData = Array.isArray(response.data.words) ? response.data.words : [];

        setLibrary(libraryData);
        setWords(wordsData);
        setTotalPages(response.data.pagination?.last_page || 1);

        VocabularyLibraryManager.loadLibrary(
          libraryData.id,
          libraryData.name,
          libraryData.language,
          libraryData.total_words
        );

        // The backend word objects carry the manager/audio-center fields at
        // runtime; ApiCenter's getLibraryWords return type is conservatively
        // under-specified (only index/word). Cast to each method's declared
        // parameter type — runtime data is unchanged.
        VocabularyLibraryManager.addWords(
          libraryData.id,
          wordsData as unknown as Parameters<typeof VocabularyLibraryManager.addWords>[1],
          page
        );

        // Process words for audio generation (with page number for dynamic caching)
        if (wordsData.length > 0) {
          VocabularyAudioCenter.processVocabularyLibrary(
            libraryData.id,
            page, // Pass current page for cache management
            wordsData as unknown as Parameters<typeof VocabularyAudioCenter.processVocabularyLibrary>[2],
            10 // Priority: 10 (auto-loaded words)
          );

          // Full view: populate translations client-side for words the backend
          // dictionary has not enriched yet (cached + client fallback).
          if (displaySettings.showTranslation) {
            void translateAllWords(wordsData as unknown as VocabularyWord[]);
          }
        }
      }
    } catch (err) {
      console.error('[LibraryDetail] Failed to load words:', err);
    } finally {
      setLoading(false);
    }
  };

  // Backend-cached translations win; only client-translate the words the
  // dictionary hasn't enriched yet (cached + client fallback). Idempotent:
  // returns early when nothing needs translating, so it is safe to call from
  // the Full-view toggle and from each page load without looping.
  const wordNeedsTranslation = (w: VocabularyWord): boolean => {
    const hasBackend = Array.isArray(w.translations) && w.translations.length > 0;
    return !hasBackend && !w.translation;
  };

  const translateAllWords = async (targetList?: VocabularyWord[]) => {
    if (!displaySettings.translationProvider || displaySettings.translationProvider === 'none') {
      return;
    }

    const list = targetList || words;
    if (!list.some(wordNeedsTranslation)) {
      return;
    }

    const translator = getTranslator();
    if (!translator) return;

    const sourceLang = mapLanguageCode(settings.language.learningLanguages?.[0] || 'en');
    const targetLang = settings.language.nativeLanguage || 'zh';

    setTranslating(true);
    try {
      const translatedWords = await Promise.all(
        list.map(async (word) => {
          if (!wordNeedsTranslation(word)) return word;

          try {
            const translation = await translator.translate(word.word, sourceLang, targetLang);
            return { ...word, translation };
          } catch (err) {
            console.error(`[Translate] Failed for "${word.word}":`, err);
            return word;
          }
        })
      );

      setWords(translatedWords);
    } catch (err) {
      console.error('[LibraryDetail] Translation failed:', err);
    } finally {
      setTranslating(false);
    }
  };

  const getTranslator = () => {
    switch (displaySettings.translationProvider) {
      case 'bing':
        return new BingTranslator();
      case 'google':
        return new GoogleTranslator();
      case 'deepl':
        return new DeepLTranslator();
      default:
        return null;
    }
  };

  const translateSingleWord = async (index: number, word: string) => {
    if (!displaySettings.translationProvider || displaySettings.translationProvider === 'none') {
      return;
    }

    const translator = getTranslator();
    if (!translator) return;

    const sourceLang = mapLanguageCode(settings.language.learningLanguages?.[0] || 'en');
    const targetLang = settings.language.nativeLanguage || 'zh';

    try {
      const translation = await translator.translate(word, sourceLang, targetLang);
      setWords((prev) =>
        prev.map((w) => (w.index === index ? { ...w, translation } : w))
      );
    } catch (err) {
      console.error(`[Translate] Failed for "${word}":`, err);
    }
  };

  const playAudio = (audioUrl: string, word: string) => {
    if (!audioUrl) return;

    // Stop currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Repair any legacy/stale audio_url form before playback.
    const fullUrl = resolveAudioUrl(audioUrl);

    // Play new audio
    const audio = new Audio(fullUrl);
    audioRef.current = audio;
    setPlayingAudio(word);

    audio.play().catch((err) => {
      console.error('[LibraryDetail] Audio playback failed:', err);
      setPlayingAudio(null);
    });

    audio.onended = () => {
      setPlayingAudio(null);
      audioRef.current = null;
    };
  };

  const renderSettingsPanel = () => {
    return (
      <Sheet open={showSettings} onClose={() => setShowSettings(false)} position="center" panelClassName="max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="ds-section-title !text-xl">Display Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="ds-touch-target flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--klein-blue-soft)] transition-colors"
              aria-label="Close"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Show Index */}
            <label className="ds-row flex items-center justify-between p-4 cursor-pointer">
              <span className="font-semibold text-[var(--color-text-primary)]">Show Index</span>
              <input
                type="checkbox"
                checked={displaySettings.showIndex}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, showIndex: e.target.checked }))
                }
                className="w-5 h-5 rounded accent-[color:var(--klein-blue)]"
              />
            </label>

            {/* Show Translation */}
            <label className="ds-row flex items-center justify-between p-4 cursor-pointer">
              <span className="font-semibold text-[var(--color-text-primary)]">Show Translation</span>
              <input
                type="checkbox"
                checked={displaySettings.showTranslation}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, showTranslation: e.target.checked }))
                }
                className="w-5 h-5 rounded accent-[color:var(--klein-blue)]"
              />
            </label>

            {/* Font Size */}
            <div className="ds-row p-4">
              <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
                Font Size: <span className="text-[var(--klein-blue)]">{displaySettings.fontSize}px</span>
              </label>
              <input
                type="range"
                min="12"
                max="24"
                value={displaySettings.fontSize}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, fontSize: parseInt(e.target.value) }))
                }
                className="w-full accent-[color:var(--klein-blue)]"
              />
            </div>


            {/* Words Per Page */}
            <div className="ds-row p-4">
              <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">Words Per Page</label>
              <select
                value={displaySettings.wordsPerPage}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, wordsPerPage: parseInt(e.target.value) }))
                }
                className="w-full p-3 rounded-[var(--radius-button)] bg-black/5 dark:bg-white/10 text-[var(--color-text-primary)] font-medium outline-none focus:ring-2 focus:ring-[var(--klein-ring)] transition-all"
              >
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
                <option value={500}>500 / page</option>
              </select>
            </div>

            {/* Translation Provider */}
            <div className="ds-row p-4">
              <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">Translation Service</label>
              <select
                value={displaySettings.translationProvider}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({
                    ...prev,
                    translationProvider: e.target.value as DisplaySettings['translationProvider'],
                  }))
                }
                className="w-full p-3 rounded-[var(--radius-button)] bg-black/5 dark:bg-white/10 text-[var(--color-text-primary)] font-medium outline-none focus:ring-2 focus:ring-[var(--klein-ring)] transition-all"
              >
                <option value="none">No translation</option>
                <option value="bing">Bing Translate</option>
                <option value="google">Google Translate</option>
                <option value="deepl">DeepL Translate</option>
              </select>
            </div>

            {/* Auto Translate */}
            {displaySettings.translationProvider !== 'none' && (
              <label className="ds-row flex items-center justify-between p-4 cursor-pointer">
                <span className="font-semibold text-[var(--color-text-primary)]">Auto Translate</span>
                <input
                  type="checkbox"
                  checked={displaySettings.autoTranslate}
                  onChange={(e) =>
                    setDisplaySettings((prev) => ({ ...prev, autoTranslate: e.target.checked }))
                  }
                  className="w-5 h-5 rounded accent-[color:var(--klein-blue)]"
                />
              </label>
            )}
          </div>

          <Button
            onClick={() => setShowSettings(false)}
            className="w-full mt-6"
            variant="grad"
          >
            Done
          </Button>
      </Sheet>
    );
  };

  if (loading && !library) {
    return (
      <div className="min-h-screen bg-transparent">
        <HeaderX title={t('vocabulary.loadingWords')} showBack />
        <LoadingState label={t('vocabulary.loadingWords')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <HeaderX
        title={library?.name || t('vocabulary.libraryDetails')}
        showBack
        actions={
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Icons.Settings className="w-5 h-5" />
          </button>
        }
      />

      <div className="max-w-md mx-auto px-4 pt-20">
        {/* Library Info Card — gradient hero surface */}
        {library && (
          <div className="mb-7 rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}>
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold mb-2 line-clamp-2">{library.name}</h2>
                <div className="flex items-center gap-4 text-sm text-white/85 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Icons.Book className="w-4 h-4" />
                    {library.total_words} {t('vocabulary.words')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Icons.Globe className="w-4 h-4" />
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

        {/* View mode — Simple (default, word only) vs Full (word + phonetic + translation + audio) */}
        <div className="mb-5">
          <PillNav
            items={[
              { id: 'simple', label: 'Simple View' },
              { id: 'full', label: 'Full View' },
            ]}
            activeId={displaySettings.showTranslation ? 'full' : 'simple'}
            onChange={(id) => {
              const full = id === 'full';
              setDisplaySettings(prev => ({ ...prev, showTranslation: full }));
              if (full) {
                void translateAllWords(words);
              }
            }}
            aria-label="View mode"
            className="!px-0"
          />
        </div>

        {/* Translation Status */}
        {translating && (
          <div className="mb-5 p-4 bg-[var(--klein-blue-soft)] rounded-[var(--radius-card)] flex items-center gap-3 border border-[var(--border-highlight)]">
            <Icons.Loader className="w-5 h-5 animate-spin text-[var(--klein-blue)]" />
            <span className="text-sm font-semibold text-[var(--klein-blue)]">Translating words...</span>
          </div>
        )}

        {/* Words List - One per Line */}
        {loading ? (
          <LoadingState label="Loading..." />
        ) : words.length > 0 ? (
          <div className="ds-stack-tight flex flex-col mb-6">
            {words.map((word, idx) => {
              const backendTranslation = word.translations && Array.isArray(word.translations) && word.translations.length > 0
                ? word.translations.join('; ')
                : null;
              const displayTranslation = backendTranslation || word.translation;
              const hasTranslation = !!displayTranslation;
              const canTranslate = displaySettings.showTranslation && displaySettings.translationProvider !== 'none' && !hasTranslation;
              const hasPhonetic = word.us_phonetic || word.uk_phonetic;

              return (
                <div
                  key={word.index}
                  className={`
                    ds-row group relative p-4
                    ${canTranslate
                      ? 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                      : 'cursor-default'
                    }
                    ${hasTranslation && displaySettings.showTranslation
                      ? '!border-green-300 dark:!border-green-800'
                      : ''
                    }
                  `}
                  onClick={() => {
                    if (canTranslate) {
                      translateSingleWord(word.index, word.word);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {displaySettings.showIndex && (
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-sm font-semibold min-w-[3rem] flex-shrink-0 mt-0.5">
                        {word.index + 1}.
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div
                          className="font-bold text-slate-900 dark:text-white break-words"
                          style={{ fontSize: `${displaySettings.fontSize}px` }}
                        >
                          {word.word}
                        </div>
                        {/* Audio — Full view only */}
                        {displaySettings.showTranslation && (
                          <>
                            {/* Audio available - show play button */}
                            {word.audio_available && word.audio_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playAudio(word.audio_url!, word.word);
                                }}
                                className={`
                                  inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                                  transition-all
                                  ${playingAudio === word.word
                                    ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]'
                                    : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] hover:opacity-80'
                                  }
                                `}
                                title="Play audio"
                                aria-label="Play audio"
                              >
                                {playingAudio === word.word
                                  ? <Pause className="w-3.5 h-3.5" fill="currentColor" />
                                  : <Play className="w-3.5 h-3.5" fill="currentColor" />}
                              </button>
                            )}

                            {/* Audio NOT available - show processing indicator */}
                            {!word.audio_available && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 animate-pulse"
                                title="Audio generating..."
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {hasPhonetic && displaySettings.showTranslation && (
                        <div className="text-xs text-[var(--klein-blue)] mt-1 font-mono bg-[var(--klein-blue-soft)] inline-block px-2 py-0.5 rounded-full">
                          {word.us_phonetic && `US ${word.us_phonetic}`}
                          {word.us_phonetic && word.uk_phonetic && ' · '}
                          {word.uk_phonetic && `UK ${word.uk_phonetic}`}
                        </div>
                      )}
                      {displaySettings.showTranslation && hasTranslation && (
                        <div className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                          {displayTranslation}
                          {backendTranslation && (
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full"><Check className="w-3 h-3" /></span>
                          )}
                        </div>
                      )}
                      {canTranslate && (
                        <div className="text-xs text-[var(--klein-blue)] mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-1">
                          <Lightbulb className="w-3.5 h-3.5" /> Tap to translate
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Icons.Book />}
            title="No words yet"
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="sticky bottom-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="secondary"
                className="flex-1"
              >
                <Icons.ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <div className="text-center min-w-[100px]">
                <div className="text-2xl font-bold text-[var(--klein-blue)]">{currentPage}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">of {totalPages}</div>
              </div>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="secondary"
                className="flex-1"
              >
                Next
                <Icons.ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}
      </div>

      {renderSettingsPanel()}
    </div>
  );
};

export default VocabularyLibraryDetail;
