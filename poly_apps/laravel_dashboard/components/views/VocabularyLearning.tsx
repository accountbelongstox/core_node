
import React, { useState, useEffect, useRef } from 'react';
import { 
  TranslationResponse, 
  TTSGenerateResponse, 
  LanguageInfo, 
  AsyncState,
  Language,
  VocabularyTask,
  VocabularyWord
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

  // Learning Tasks State
  const [tasks, setTasks] = useState<AsyncState<VocabularyTask[]>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [selectedTask, setSelectedTask] = useState<VocabularyTask | null>(null);
  const [vocabularyWords, setVocabularyWords] = useState<VocabularyWord[]>([]);

  const t = TRANSLATIONS[lang].vocabulary;

  useEffect(() => {
    loadLanguages();
    loadTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      setVocabularyWords(selectedTask.words);
    }
  }, [selectedTask]);

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
        // Ensure data is an array
        const languageData = Array.isArray(response.data)
          ? response.data
          : ((response.data as any).languages || (response.data as any).items || []);
        setLanguages(languageData);
      } else {
        // Fallback to default languages if API fails
        setLanguages([
          { code: 'en', name: 'English', native_name: 'English' },
          { code: 'zh', name: 'Chinese', native_name: '中文' },
          { code: 'ja', name: 'Japanese', native_name: '日本語' },
          { code: 'ko', name: 'Korean', native_name: '한국어' },
          { code: 'fr', name: 'French', native_name: 'Français' },
          { code: 'de', name: 'German', native_name: 'Deutsch' },
          { code: 'es', name: 'Spanish', native_name: 'Español' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
      // Fallback to default languages on error
      setLanguages([
        { code: 'en', name: 'English', native_name: 'English' },
        { code: 'zh', name: 'Chinese', native_name: '中文' },
        { code: 'ja', name: 'Japanese', native_name: '日本語' },
        { code: 'ko', name: 'Korean', native_name: '한국어' }
      ]);
    }
  };

  const loadTasks = async () => {
    setTasks(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      // Mock data for now - replace with actual API call when available
      const mockTasks: VocabularyTask[] = [
        {
          id: 'task_1',
          title: 'Daily Vocabulary - Day 1',
          description: 'Learn 10 common English words',
          words: [
            {
              id: 'word_1',
              word: 'apple',
              translation: '苹果',
              phonetic: 'ˈæpl',
              part_of_speech: 'noun',
              definition: 'A round fruit with red, green, or yellow skin',
              example_sentences: ['I eat an apple every day.'],
              learned: false,
              proficiency: 0
            },
            {
              id: 'word_2',
              word: 'book',
              translation: '书',
              phonetic: 'bʊk',
              part_of_speech: 'noun',
              definition: 'A written or printed work',
              example_sentences: ['I love reading books.'],
              learned: false,
              proficiency: 0
            }
          ],
          status: 'in_progress',
          progress: 20,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      setTasks({
        data: mockTasks,
        loading: false,
        error: null,
        status: 'success'
      });
      
      if (mockTasks.length > 0 && !selectedTask) {
        setSelectedTask(mockTasks[0]);
      }
    } catch (error) {
      setTasks({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load tasks',
        status: 'error'
      });
    }
  };

  const toggleWordLearned = (wordId: string) => {
    setVocabularyWords(prev => 
      prev.map(word => 
        word.id === wordId 
          ? { ...word, learned: !word.learned, proficiency: word.learned ? 0 : 50 }
          : word
      )
    );
    
    if (selectedTask) {
      const updatedTask = {
        ...selectedTask,
        words: selectedTask.words.map(word =>
          word.id === wordId
            ? { ...word, learned: !word.learned, proficiency: word.learned ? 0 : 50 }
            : word
        ),
        progress: calculateProgress(selectedTask.words.map(word =>
          word.id === wordId
            ? { ...word, learned: !word.learned, proficiency: word.learned ? 0 : 50 }
            : word
        ))
      };
      setSelectedTask(updatedTask);
      setTasks(prev => ({
        ...prev,
        data: prev.data?.map(task =>
          task.id === selectedTask.id ? updatedTask : task
        ) || null
      }));
    }
  };

  const calculateProgress = (words: VocabularyWord[]): number => {
    if (words.length === 0) return 0;
    const learnedCount = words.filter(w => w.learned).length;
    return Math.round((learnedCount / words.length) * 100);
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

        {/* Right Panel - Learning Tasks */}
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t.learning_tasks || 'Learning Tasks'}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={loadTasks}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                title="Refresh tasks"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
              </button>
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
          </div>

          {tasks.loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : tasks.error ? (
            <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
              {tasks.error}
            </div>
          ) : tasks.data && tasks.data.length > 0 ? (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Task List */}
              <div className="flex-shrink-0">
                <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">Tasks</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {tasks.data.map(task => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`w-full text-left p-2 rounded-lg border transition-colors ${
                        selectedTask?.id === task.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{task.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          task.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 mb-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{task.progress}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vocabulary Words */}
              {selectedTask && vocabularyWords.length > 0 && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">
                    Vocabulary ({vocabularyWords.filter(w => w.learned).length}/{vocabularyWords.length})
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {vocabularyWords.map(word => (
                      <div
                        key={word.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          word.learned
                            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-base">{word.word}</span>
                              {word.phonetic && (
                                <span className="text-xs text-slate-500">[{word.phonetic}]</span>
                              )}
                              {word.part_of_speech && (
                                <span className="text-xs px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400">
                                  {word.part_of_speech}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {word.translation}
                            </p>
                            {word.definition && (
                              <p className="text-xs text-slate-500 mt-1">{word.definition}</p>
                            )}
                            {word.example_sentences && word.example_sentences.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {word.example_sentences.map((sentence, idx) => (
                                  <p key={idx} className="text-xs italic text-slate-600 dark:text-slate-400">
                                    "{sentence}"
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => toggleWordLearned(word.id)}
                            className={`ml-2 p-1.5 rounded transition-colors ${
                              word.learned
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600'
                            }`}
                            title={word.learned ? 'Mark as unlearned' : 'Mark as learned'}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                        {word.proficiency !== undefined && word.proficiency > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${word.proficiency}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">{word.proficiency}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask && vocabularyWords.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  No vocabulary words in this task
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks available</p>
                <button
                  onClick={loadTasks}
                  className="mt-2 text-xs text-indigo-500 hover:text-indigo-400"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
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
