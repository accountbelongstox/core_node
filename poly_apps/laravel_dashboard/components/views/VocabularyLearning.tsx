
import React, { useState, useEffect, useRef } from 'react';
import { 
  TranslationResponse, 
  TTSGenerateResponse, 
  LanguageInfo, 
  AsyncState,
  Language 
} from '../../types';
import { apiService } from '../../services/apiService';
import { TRANSLATIONS } from '../../constants';
import { 
  Languages, 
  ArrowLeftRight, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Copy, 
  RefreshCw,
  X,
  BookOpen,
  CheckCircle
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface VocabularyLearningProps {
  lang?: Language;
}

const VocabularyLearning: React.FC<VocabularyLearningProps> = ({ lang = 'en' }) => {
  const [translation, setTranslation] = useState<AsyncState<TranslationResponse>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [tts, setTTS] = useState<AsyncState<TTSGenerateResponse>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string>('en');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh');
  const [inputText, setInputText] = useState<string>('');
  const [history, setHistory] = useState<TranslationResponse[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const t = TRANSLATIONS[lang].vocabulary;

  useEffect(() => {
    loadLanguages();
  }, []);

  useEffect(() => {
    if (tts.data?.audio_url && audioRef.current) {
      audioRef.current.src = tts.data.audio_url;
      audioRef.current.load();
    }
  }, [tts.data]);

  const loadLanguages = async () => {
    try {
      const response = await apiService.getLanguages();
      if (response.success && response.data) {
        setLanguages(response.data);
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setTranslation(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.translate({
        text: inputText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        type: 'learning'
      });

      if (response.success && response.data) {
        setTranslation({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setHistory(prev => [response.data!, ...prev.slice(0, 9)]);
      } else {
        throw new Error(response.error || 'Translation failed');
      }
    } catch (error: any) {
      setTranslation({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleDetectAndTranslate = async () => {
    if (!inputText.trim()) return;

    setTranslation(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.detectAndTranslate(inputText, targetLanguage);
      if (response.success && response.data) {
        setTranslation({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        if (response.data.detected_language) {
          setSourceLanguage(response.data.detected_language);
        }
        setHistory(prev => [response.data!, ...prev.slice(0, 9)]);
      } else {
        throw new Error(response.error || 'Translation failed');
      }
    } catch (error: any) {
      setTranslation({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const handleGenerateTTS = async () => {
    if (!translation.data?.translated_text) return;

    setTTS(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.generateTTS({
        text: translation.data.translated_text,
        language: targetLanguage,
        voice_type: 'female',
        speed: 1.0
      });

      if (response.success && response.data) {
        setTTS({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'TTS generation failed');
      }
    } catch (error: any) {
      setTTS({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = parseFloat(e.target.value);
      setCurrentTime(parseFloat(e.target.value));
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const loadHistoryItem = (item: TranslationResponse) => {
    setInputText(item.original_text);
    setSourceLanguage(item.source_language);
    setTargetLanguage(item.target_language);
    setTranslation({
      data: item,
      loading: false,
      error: null,
      status: 'success'
    });
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Translate, learn, and practice vocabulary</p>
      </div>

      {/* Main Content - Three Panel Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* Left Panel - Translation */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Translation</h3>
            <button
              onClick={swapLanguages}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Swap languages"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Language Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className={`${commonClasses.input} text-sm`}
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.native_name} ({lang.name})
                </option>
              ))}
            </select>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className={`${commonClasses.input} text-sm`}
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.native_name} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          {/* Input Text Area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.input_placeholder}
            rows={6}
            className={`${commonClasses.input} flex-1 mb-4 resize-none`}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleTranslate}
              disabled={translation.loading || !inputText.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {translation.loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
              {t.translate}
            </button>
            <button
              onClick={handleDetectAndTranslate}
              disabled={translation.loading || !inputText.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              {t.auto_detect}
            </button>
            <button
              onClick={() => {
                setInputText('');
                setTranslation({ data: null, loading: false, error: null, status: 'idle' });
              }}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <X className="w-4 h-4" />
              {t.clear}
            </button>
          </div>

          {/* Translation Result */}
          {translation.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm mb-4">
              {translation.error}
            </div>
          )}

          {translation.data && (
            <div className="flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Translation</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(translation.data!.translated_text)}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGenerateTTS}
                    disabled={tts.loading}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Generate TTS"
                  >
                    {tts.loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
                <p className="text-slate-900 dark:text-slate-100">{translation.data.translated_text}</p>
              </div>
              {translation.data.phonetic && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  /{translation.data.phonetic}/
                </p>
              )}
              {translation.data.alternatives && translation.data.alternatives.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Alternatives:</p>
                  <div className="flex flex-wrap gap-1">
                    {translation.data.alternatives.map((alt, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          setTranslation(prev => ({
                            ...prev,
                            data: { ...prev.data!, translated_text: alt }
                          }));
                        }}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {translation.data.confidence && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confidence: {(translation.data.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </div>

        {/* Center Panel - TTS Player */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <h3 className="font-semibold mb-4">Audio Player</h3>

          {tts.data ? (
            <>
              {/* Audio Element */}
              <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDuration(audioRef.current.duration);
                  }
                }}
                className="hidden"
              />

              {/* Progress Bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  disabled
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  disabled
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Audio Info */}
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <p>Duration: {tts.data.duration}s</p>
                <p>Format: {tts.data.format.toUpperCase()}</p>
                {tts.data.cache_hit && (
                  <p className="text-emerald-600 dark:text-emerald-400">✓ Cached</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Volume2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No audio generated</p>
                <p className="text-xs">Translate text and click TTS button</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Learning Tasks (Placeholder) */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Learning Tasks</h3>
            <BookOpen className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Coming Soon</p>
              <p className="text-xs">Vocabulary learning tasks will be available here</p>
            </div>
          </div>
        </div>
      </div>

      {/* History Bar */}
      {history.length > 0 && (
        <div className={`mt-4 ${commonClasses.card} overflow-hidden`}>
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => setHistoryCollapsed(!historyCollapsed)}
          >
            <h4 className="font-semibold text-sm">{t.history} ({history.length})</h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHistory([]);
              }}
              className="text-xs text-slate-500 hover:text-red-500"
            >
              Clear
            </button>
          </div>
          {!historyCollapsed && (
            <div className="max-h-32 overflow-y-auto p-3 space-y-2">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => loadHistoryItem(item)}
                  className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">{item.original_text}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-800 dark:text-slate-200">{item.translated_text}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.source_language} → {item.target_language}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VocabularyLearning;
