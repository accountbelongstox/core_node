import React, { useContext, useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { Header } from '../../components/Header';
import { ApiCenter } from '../../services/ApiCenter';
import { mapLanguageCode } from '../../services/languageMapper';
import { BingTranslator, GoogleTranslator, DeepLTranslator } from '../../services/translators';
import { VocabularyLibraryManager } from '../../services/VocabularyLibraryManager';
import { AudioProcessingHook } from '../../services/AudioProcessingHook';
import { EventBus } from '../../services/EventBus';
import { VocabularyAudioCenter } from '../../services/VocabularyAudioCenter';
import { apiManager } from '../../services/ApiManager';

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
          const cachedWord = library?.words.find(cw => cw.word === w.word);
          if (cachedWord?.audio_url) {
            return { ...w, audio_url: cachedWord.audio_url };
          }
        }
        return w;
      });
      setWords(updatedWords);
    };

    EventBus.on('library:audio_ready', handleAudioReady);
    return () => {
      EventBus.off('library:audio_ready', handleAudioReady);
    };
  }, [words, libraryId]);

  // VocabularyAudioCenter subscription for audio generation updates
  useEffect(() => {
    const unsubscribe = VocabularyAudioCenter.subscribe((word, audioUrl) => {
      console.log('[LibraryDetail] VocabularyAudioCenter: Audio ready for', word, audioUrl);

      // Update word in current page
      setWords((prev) =>
        prev.map((w) => (w.word === word ? { ...w, audio_url: audioUrl } : w))
      );

      // Update in VocabularyLibraryManager cache
      const library = VocabularyLibraryManager.getLibrary(libraryId);
      if (library) {
        const wordToUpdate = library.words.find(w => w.word === word);
        if (wordToUpdate) {
          wordToUpdate.audio_url = audioUrl;
        }
      }
    });

    return () => {
      unsubscribe();
      VocabularyAudioCenter.clearPending();
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
        const wordsData = response.data.words || [];

        setLibrary(libraryData);
        setWords(wordsData);
        setTotalPages(response.data.pagination?.last_page || 1);

        VocabularyLibraryManager.loadLibrary(
          libraryData.id,
          libraryData.name,
          libraryData.language,
          libraryData.total_words
        );

        VocabularyLibraryManager.addWords(libraryData.id, wordsData, page);

        // Process words for audio generation
        if (wordsData.length > 0) {
          VocabularyAudioCenter.processVocabularyLibrary(libraryData.id, wordsData);
        }
      }
    } catch (err) {
      console.error('[LibraryDetail] Failed to load words:', err);
    } finally {
      setLoading(false);
    }
  };

  const translateAllWords = async () => {
    if (!displaySettings.translationProvider || displaySettings.translationProvider === 'none') {
      return;
    }

    setTranslating(true);
    try {
      const translator = getTranslator();
      if (!translator) return;

      const sourceLang = mapLanguageCode(settings.language.learningLanguages?.[0] || 'en');
      const targetLang = settings.language.nativeLanguage || 'zh';

      const translatedWords = await Promise.all(
        words.map(async (word) => {
          if (word.translation) return word;

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

    // Build full URL
    const baseUrl = apiManager.getCurrentBaseUrl();
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${baseUrl}${audioUrl}`;

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
    if (!showSettings) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <Card className="w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-800 shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">显示设置</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Show Index */}
            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="font-medium text-slate-700 dark:text-slate-300">显示序号</span>
              <input
                type="checkbox"
                checked={displaySettings.showIndex}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, showIndex: e.target.checked }))
                }
                className="w-5 h-5 rounded accent-blue-600"
              />
            </label>

            {/* Show Translation */}
            <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="font-medium text-slate-700 dark:text-slate-300">显示翻译</span>
              <input
                type="checkbox"
                checked={displaySettings.showTranslation}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, showTranslation: e.target.checked }))
                }
                className="w-5 h-5 rounded accent-blue-600"
              />
            </label>

            {/* Font Size */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <label className="block mb-3 font-medium text-slate-700 dark:text-slate-300">
                字体大小: <span className="text-blue-600 dark:text-blue-400">{displaySettings.fontSize}px</span>
              </label>
              <input
                type="range"
                min="12"
                max="24"
                value={displaySettings.fontSize}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, fontSize: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-600"
              />
            </div>


            {/* Words Per Page */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <label className="block mb-3 font-medium text-slate-700 dark:text-slate-300">每页单词数</label>
              <select
                value={displaySettings.wordsPerPage}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({ ...prev, wordsPerPage: parseInt(e.target.value) }))
                }
                className="w-full p-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
                <option value={50}>50 词/页</option>
                <option value={100}>100 词/页</option>
                <option value={200}>200 词/页</option>
                <option value={500}>500 词/页</option>
              </select>
            </div>

            {/* Translation Provider */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <label className="block mb-3 font-medium text-slate-700 dark:text-slate-300">翻译服务</label>
              <select
                value={displaySettings.translationProvider}
                onChange={(e) =>
                  setDisplaySettings((prev) => ({
                    ...prev,
                    translationProvider: e.target.value as DisplaySettings['translationProvider'],
                  }))
                }
                className="w-full p-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
                <option value="none">不翻译</option>
                <option value="bing">必应翻译</option>
                <option value="google">谷歌翻译</option>
                <option value="deepl">DeepL 翻译</option>
              </select>
            </div>

            {/* Auto Translate */}
            {displaySettings.translationProvider !== 'none' && (
              <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span className="font-medium text-slate-700 dark:text-slate-300">自动翻译</span>
                <input
                  type="checkbox"
                  checked={displaySettings.autoTranslate}
                  onChange={(e) =>
                    setDisplaySettings((prev) => ({ ...prev, autoTranslate: e.target.checked }))
                  }
                  className="w-5 h-5 rounded accent-blue-600"
                />
              </label>
            )}
          </div>

          <Button
            onClick={() => setShowSettings(false)}
            className="w-full mt-6"
            variant="primary"
          >
            完成
          </Button>
        </Card>
      </div>
    );
  };

  if (loading && !library) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header title={t('vocabulary.loadingWords')} showBack />
        <div className="p-4 flex items-center justify-center">
          <div className="text-center">
            <Icons.Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>{t('vocabulary.loadingWords')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      <Header
        title={library?.name || t('vocabulary.libraryDetails')}
        showBack
        actions={
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Icons.Settings className="w-5 h-5" />
          </button>
        }
      />

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-4 pt-20">
        {/* Library Info Card */}
        {library && (
          <Card className="mb-6 bg-gradient-to-br from-blue-500 to-purple-600 text-white border-none shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">{library.name}</h2>
                <div className="flex items-center gap-4 text-sm text-white/80">
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
              <div className="text-right">
                <div className="text-3xl font-bold">{currentPage}</div>
                <div className="text-sm text-white/60">/ {totalPages}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Settings Bar */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDisplaySettings(prev => ({ ...prev, showTranslation: !prev.showTranslation }))}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              displaySettings.showTranslation
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {displaySettings.showTranslation ? '全面显示' : '简章显示'}
          </button>
          <button
            onClick={() => setDisplaySettings(prev => ({ ...prev, showIndex: !prev.showIndex }))}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              displaySettings.showIndex
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            序号 {displaySettings.showIndex ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Translation Status */}
        {translating && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center gap-3 border border-blue-200 dark:border-blue-800">
            <Icons.Loader className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">正在翻译单词...</span>
          </div>
        )}

        {/* Words List - One per Line */}
        {loading ? (
          <div className="text-center py-12">
            <Icons.Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600 dark:text-slate-400">加载中...</p>
          </div>
        ) : words.length > 0 ? (
          <div className="space-y-2 mb-6">
            {words.map((word, idx) => {
              const backendTranslation = word.translations && Array.isArray(word.translations) && word.translations.length > 0
                ? word.translations.join('; ')
                : null;
              const displayTranslation = backendTranslation || word.translation;
              const hasTranslation = !!displayTranslation;
              const canTranslate = displaySettings.translationProvider !== 'none' && !hasTranslation;
              const hasPhonetic = word.us_phonetic || word.uk_phonetic;

              return (
                <div
                  key={word.index}
                  className={`
                    group relative p-4 rounded-xl border-2 transition-all duration-200
                    ${canTranslate
                      ? 'cursor-pointer hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                      : 'cursor-default'
                    }
                    ${hasTranslation && displaySettings.showTranslation
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-300 dark:border-green-800'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/10'
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
                        {word.audio_url && word.audio_url !== 'null' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudio(word.audio_url!, word.word);
                            }}
                            className={`
                              inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                              transition-all
                              ${playingAudio === word.word
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                              }
                            `}
                          >
                            {playingAudio === word.word ? '⏸️' : '▶️'}
                          </button>
                        )}
                        {VocabularyAudioCenter.isPending(word.word, library?.language || 'en') && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                            ⏳
                          </span>
                        )}
                      </div>
                      {hasPhonetic && displaySettings.showTranslation && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono bg-blue-50 dark:bg-blue-900/20 inline-block px-2 py-0.5 rounded">
                          {word.us_phonetic && `🇺🇸 ${word.us_phonetic}`}
                          {word.us_phonetic && word.uk_phonetic && ' · '}
                          {word.uk_phonetic && `🇬🇧 ${word.uk_phonetic}`}
                        </div>
                      )}
                      {displaySettings.showTranslation && hasTranslation && (
                        <div className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                          {displayTranslation}
                          {backendTranslation && (
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-green-500 text-white rounded-full">✓</span>
                          )}
                        </div>
                      )}
                      {canTranslate && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                          💡 点击翻译
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <Icons.Book className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400">暂无单词</p>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="sticky bottom-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="flex-1"
              >
                <Icons.ChevronLeft className="w-4 h-4 mr-1" />
                上一页
              </Button>
              <div className="text-center min-w-[100px]">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentPage}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">共 {totalPages} 页</div>
              </div>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                className="flex-1"
              >
                下一页
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
