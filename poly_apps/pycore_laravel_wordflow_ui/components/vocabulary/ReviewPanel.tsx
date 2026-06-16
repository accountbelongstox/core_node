import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Volume2,
  Eye,
  Calendar,
  AlertCircle,
  RotateCcw,
  Lock
} from 'lucide-react';
import { api } from '../../core/api';
import type { ReviewQueueWord } from '../../core/api/modules/AppQyV1';
import { commonClasses } from '../../styles/theme';
import { TRANSLATIONS } from '../../constants';
import { useAppState } from '../../contexts/AppStateContext';
import { useToast } from '../admin';
import { logError, logInfo, logSuccess } from '../../core/logstore/logStore';

interface ReviewPanelProps {
  userId?: string;
}

/**
 * One card of the review session. The queue itself comes from
 * GET /learning/review-queue (sparse: id/word/word_md5/status/level/counts);
 * translation/phonetic/audio are enriched by joining the rich word cards from
 * GET /learning/words on word_md5 (same shape LearningInterface consumes:
 * native_translation, translations, phonetic, tts_files, correct/wrong counts).
 * `id` is the learning-progress record id used as progress_id for
 * POST /learning/progress.
 */
interface ReviewItem {
  id: number | string;
  word: string;
  wordMd5: string;
  learningStatus: string;
  familiarityLevel: number;
  reviewCount: number;
  nextReviewAt: string | null;
  translation: string;
  phonetic: string | null;
  definition: string | null;
  examples: string[];
  audioUrl: string | null;
  successRate: number | null;
}

interface ReviewSession {
  totalWords: number;
  reviewedWords: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedWords: number;
}

const emptySession = (total: number): ReviewSession => ({
  totalWords: total,
  reviewedWords: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  skippedWords: 0
});

/** Pick the first non-empty string out of a translations map/array. */
const firstTranslation = (translations: any): string => {
  if (!translations) return '';
  if (typeof translations === 'string') return translations;
  if (Array.isArray(translations)) {
    const hit = translations.find(v => typeof v === 'string' && v.trim());
    return hit || '';
  }
  if (typeof translations === 'object') {
    for (const value of Object.values(translations)) {
      if (typeof value === 'string' && value.trim()) return value;
      if (Array.isArray(value)) {
        const hit = value.find(v => typeof v === 'string' && v.trim());
        if (hit) return hit;
      }
    }
  }
  return '';
};

const ReviewPanel: React.FC<ReviewPanelProps> = ({ userId }) => {
  const { lang } = useAppState();
  const toast = useToast();
  const t = TRANSLATIONS[lang].vocabulary;

  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [session, setSession] = useState<ReviewSession>(emptySession(0));
  const [reviewMode, setReviewMode] = useState<'flashcard' | 'typing'>('flashcard');
  const [userAnswer, setUserAnswer] = useState('');
  const [sessionComplete, setSessionComplete] = useState(false);

  const loadReviewWords = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAuthRequired(false);
    setSessionComplete(false);
    setCurrentWordIndex(0);
    setShowAnswer(false);
    setUserAnswer('');

    try {
      const [queueRes, wordsRes] = await Promise.all([
        api.appQyV1.getReviewQueue(),
        // Rich word cards used purely as an enrichment source (translation,
        // phonetics, TTS). Its failure is non-fatal.
        api.appQyV1.getLearningWords({ limit: 100 })
      ]);

      if (!queueRes.success) {
        if (queueRes.status === 401 || queueRes.status === 403) {
          setAuthRequired(true);
          setReviewItems([]);
          setSession(emptySession(0));
          return;
        }
        throw new Error(queueRes.error || t.review_load_failed);
      }

      const queueData: any = queueRes.data || {};
      const queueWords: ReviewQueueWord[] = [
        ...(Array.isArray(queueData.review_words) ? queueData.review_words : []),
        ...(Array.isArray(queueData.new_words) ? queueData.new_words : [])
      ];

      const cardByMd5 = new Map<string, any>();
      const wordsData: any = (wordsRes && wordsRes.success && wordsRes.data) || {};
      const cards: any[] = Array.isArray(wordsData.words)
        ? wordsData.words
        : Array.isArray(wordsData)
          ? wordsData
          : [];
      for (const card of cards) {
        if (card && typeof card.word_md5 === 'string') {
          cardByMd5.set(card.word_md5, card);
        }
      }

      const items: ReviewItem[] = queueWords
        .filter(w => w && w.id !== undefined && w.id !== null && typeof w.word === 'string')
        .map((w) => {
          const card = cardByMd5.get(w.word_md5) || null;

          const details: any = card?.word_details;
          const definition =
            typeof details === 'string'
              ? details
              : (details && typeof details === 'object'
                  ? (typeof details.definition === 'string' ? details.definition
                    : typeof details.def === 'string' ? details.def : null)
                  : null);
          const rawExamples =
            details && typeof details === 'object'
              ? (Array.isArray(details.examples) ? details.examples
                : Array.isArray(details.example_sentences) ? details.example_sentences : [])
              : [];

          const correct = Number(card?.correct_count);
          const wrong = Number(card?.wrong_count);
          const attempts = (Number.isFinite(correct) ? correct : 0) + (Number.isFinite(wrong) ? wrong : 0);
          const successRate = attempts > 0 ? Math.round((correct / attempts) * 100) : null;

          const ttsFiles: any[] = Array.isArray(card?.tts_files) ? card.tts_files : [];
          const audioUrl = typeof ttsFiles[0]?.url === 'string' ? ttsFiles[0].url : null;

          return {
            id: w.id,
            word: w.word,
            wordMd5: w.word_md5,
            learningStatus: w.learning_status,
            familiarityLevel: Number(w.familiarity_level) || 0,
            reviewCount: Number(w.review_count) || 0,
            nextReviewAt: w.next_review_at || null,
            translation: (typeof card?.native_translation === 'string' && card.native_translation)
              || firstTranslation(card?.translations),
            phonetic: card?.phonetic || card?.us_phonetic || card?.uk_phonetic || null,
            definition,
            examples: rawExamples.filter((s: any) => typeof s === 'string'),
            audioUrl,
            successRate
          };
        });

      setReviewItems(items);
      setSession(emptySession(items.length));
      logInfo('vocab', `Review queue loaded: ${items.length} cards (${queueData.review_words?.length ?? 0} due, ${queueData.new_words?.length ?? 0} new)`);
    } catch (error: any) {
      console.error('Failed to load review words:', error);
      setLoadError(error?.message || t.review_load_failed);
      logError('vocab', `Review queue load failed: ${error?.message || 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [t.review_load_failed]);

  useEffect(() => {
    loadReviewWords();
  }, [userId, loadReviewWords]);

  const currentWord = reviewItems[currentWordIndex];

  /**
   * Persist one review outcome. The UI advances optimistically; a failed POST
   * only surfaces a toast (the local session keeps its counts).
   */
  const submitReview = (item: ReviewItem, correct: boolean) => {
    setSession(prev => ({
      ...prev,
      reviewedWords: prev.reviewedWords + 1,
      correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
      incorrectAnswers: prev.incorrectAnswers + (correct ? 0 : 1)
    }));
    nextWord();

    api.appQyV1
      .updateProgress({
        word_id: item.id,
        progress_id: item.id,
        status: correct ? 'learned' : 'difficult',
        correct
      })
      .then(res => {
        if (!res.success) {
          toast.error(`${t.review_submit_failed}: ${res.error || ''}`.trim());
          logError('vocab', `Review submit failed for "${item.word}": ${res.error || 'unknown error'}`);
        } else {
          logSuccess('vocab', `Review saved: "${item.word}" → ${correct ? 'correct' : 'incorrect'}`);
        }
      })
      .catch((error: any) => {
        toast.error(t.review_submit_failed);
        logError('vocab', `Review submit failed for "${item.word}": ${error?.message || 'unknown error'}`);
      });
  };

  const handleCorrect = () => {
    if (!currentWord) return;
    submitReview(currentWord, true);
  };

  const handleIncorrect = () => {
    if (!currentWord) return;
    submitReview(currentWord, false);
  };

  const handleSkip = () => {
    setSession(prev => ({
      ...prev,
      skippedWords: prev.skippedWords + 1
    }));
    nextWord();
  };

  const nextWord = () => {
    setShowAnswer(false);
    setUserAnswer('');

    if (currentWordIndex >= reviewItems.length - 1) {
      setSessionComplete(true);
    } else {
      setCurrentWordIndex(prev => prev + 1);
    }
  };

  const resetSession = () => {
    setCurrentWordIndex(0);
    setShowAnswer(false);
    setUserAnswer('');
    setSessionComplete(false);
    setSession(emptySession(reviewItems.length));
  };

  const checkTypedAnswer = () => {
    if (!currentWord) return;
    const correct =
      userAnswer.trim().toLowerCase() === currentWord.translation.trim().toLowerCase();
    if (correct) {
      handleCorrect();
    } else {
      handleIncorrect();
    }
  };

  const playAudio = (url: string) => {
    try {
      void new Audio(url).play();
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  /** Difficulty badge derived from the server-side familiarity level (0-5). */
  const getDifficulty = (item: ReviewItem): 'easy' | 'medium' | 'hard' => {
    if (item.familiarityLevel >= 4) return 'easy';
    if (item.familiarityLevel >= 2) return 'medium';
    return 'hard';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'hard': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto text-center`}>
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t.login_required}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t.review_login_hint}
          </p>
          <button
            onClick={loadReviewWords}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto text-center`}>
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t.review_load_failed}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{loadError}</p>
          <button
            onClick={loadReviewWords}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const accuracy = session.reviewedWords > 0
      ? Math.round((session.correctAnswers / session.reviewedWords) * 100)
      : 0;

    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto text-center`}>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Review Session Complete!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Great job! Here's how you did:
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {session.totalWords}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Words</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {session.correctAnswers}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Correct</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {session.incorrectAnswers}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Incorrect</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {accuracy}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={resetSession}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
            >
              <RotateCcw className="w-4 h-4" />
              Review Again
            </button>
            <button
              onClick={loadReviewWords}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <RefreshCw className="w-4 h-4" />
              New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 text-center`}>
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t.review_empty}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Check back later for more reviews.
          </p>
          <button
            onClick={loadReviewWords}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Typing mode only works when the card has a translation to check against;
  // cards without one fall back to flashcard controls.
  const typingAvailable = reviewMode === 'typing' && currentWord.translation.trim().length > 0;
  const difficulty = getDifficulty(currentWord);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Review Session
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {session.reviewedWords} / {session.totalWords} words reviewed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setReviewMode(reviewMode === 'flashcard' ? 'typing' : 'flashcard')}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} text-sm`}
          >
            Mode: {reviewMode === 'flashcard' ? 'Flashcard' : 'Typing'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${session.totalWords > 0 ? (session.reviewedWords / session.totalWords) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>Correct: {session.correctAnswers}</span>
          <span>Incorrect: {session.incorrectAnswers}</span>
          <span>Skipped: {session.skippedWords}</span>
        </div>
      </div>

      {/* Flashcard */}
      <div className={`${commonClasses.card} p-8 max-w-3xl mx-auto`}>
        {/* Word Info */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded text-sm font-medium ${getDifficultyColor(difficulty)}`}>
              {difficulty}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Reviewed {currentWord.reviewCount} times
            </span>
            {currentWord.successRate !== null && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Success: {currentWord.successRate}%
              </span>
            )}
          </div>
          {currentWord.audioUrl && (
            <button
              onClick={() => playAudio(currentWord.audioUrl as string)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* Word Display */}
        <div className="text-center mb-8">
          <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {currentWord.word}
          </h3>
          {currentWord.phonetic && (
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
              /{currentWord.phonetic}/
            </p>
          )}
          <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
            {currentWord.learningStatus}
          </span>
        </div>

        {/* Answer Section */}
        {!typingAvailable ? (
          <>
            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className={`w-full ${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center justify-center gap-2 py-4 text-lg`}
              >
                <Eye className="w-5 h-5" />
                Show Answer
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <p className="text-2xl font-semibold text-indigo-900 dark:text-indigo-100 mb-3">
                    {currentWord.translation || '—'}
                  </p>
                  {currentWord.definition && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">
                      {currentWord.definition}
                    </p>
                  )}
                  {currentWord.examples.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Examples:
                      </p>
                      {currentWord.examples.map((sentence, idx) => (
                        <p key={idx} className="text-sm italic text-gray-600 dark:text-gray-400">
                          "{sentence}"
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rating Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleIncorrect}
                    className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 py-3`}
                  >
                    <XCircle className="w-5 h-5" />
                    Hard
                  </button>
                  <button
                    onClick={handleSkip}
                    className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center justify-center gap-2 py-3`}
                  >
                    <AlertCircle className="w-5 h-5" />
                    Skip
                  </button>
                  <button
                    onClick={handleCorrect}
                    className={`${commonClasses.button} bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 py-3`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Easy
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && userAnswer.trim() && checkTypedAnswer()}
              placeholder="Type the translation..."
              className={`${commonClasses.input} text-center text-lg`}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSkip}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} py-3`}
              >
                Skip
              </button>
              <button
                onClick={checkTypedAnswer}
                disabled={!userAnswer.trim()}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} py-3`}
              >
                Check Answer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Next Review Info */}
      {currentWord.nextReviewAt && (
        <div className="max-w-3xl mx-auto text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Next review scheduled for: {new Date(currentWord.nextReviewAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;
