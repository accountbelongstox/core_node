import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Volume2,
  Eye,
  EyeOff,
  Calendar,
  AlertCircle,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { api } from '../../core/api';
import { commonClasses } from '../../styles/theme';

interface ReviewPanelProps {
  userId?: string;
}

interface ReviewWord {
  id: string;
  word: string;
  translation: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  exampleSentences?: string[];
  lastReviewed: string;
  nextReview: string;
  reviewCount: number;
  successRate: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ReviewSession {
  totalWords: number;
  reviewedWords: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedWords: number;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({ userId }) => {
  const [reviewWords, setReviewWords] = useState<ReviewWord[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<ReviewSession>({
    totalWords: 0,
    reviewedWords: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedWords: 0
  });
  const [reviewMode, setReviewMode] = useState<'flashcard' | 'typing'>('flashcard');
  const [userAnswer, setUserAnswer] = useState('');
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    loadReviewWords();
  }, [userId]);

  const loadReviewWords = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockWords: ReviewWord[] = [
        {
          id: 'word_1',
          word: 'serendipity',
          translation: '意外发现美好事物',
          phonetic: 'ˌserənˈdɪpəti',
          partOfSpeech: 'noun',
          definition: 'The occurrence of events by chance in a happy or beneficial way',
          exampleSentences: [
            'A fortunate stroke of serendipity brought the two old friends together.',
            'Finding that job was pure serendipity.'
          ],
          lastReviewed: '2025-12-10',
          nextReview: '2025-12-13',
          reviewCount: 3,
          successRate: 80,
          difficulty: 'medium'
        },
        {
          id: 'word_2',
          word: 'ephemeral',
          translation: '短暂的',
          phonetic: 'ɪˈfɛm(ə)rəl',
          partOfSpeech: 'adjective',
          definition: 'Lasting for a very short time',
          exampleSentences: [
            'The beauty of cherry blossoms is ephemeral.',
            'Fame can be ephemeral in the entertainment industry.'
          ],
          lastReviewed: '2025-12-09',
          nextReview: '2025-12-13',
          reviewCount: 5,
          successRate: 90,
          difficulty: 'easy'
        },
        {
          id: 'word_3',
          word: 'ubiquitous',
          translation: '无处不在的',
          phonetic: 'juːˈbɪkwɪtəs',
          partOfSpeech: 'adjective',
          definition: 'Present, appearing, or found everywhere',
          exampleSentences: [
            'Smartphones have become ubiquitous in modern society.',
            'Coffee shops are ubiquitous in this city.'
          ],
          lastReviewed: '2025-12-08',
          nextReview: '2025-12-13',
          reviewCount: 2,
          successRate: 60,
          difficulty: 'hard'
        }
      ];

      setReviewWords(mockWords);
      setSession(prev => ({ ...prev, totalWords: mockWords.length }));
    } catch (error) {
      console.error('Failed to load review words:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentWord = reviewWords[currentWordIndex];

  const handleCorrect = async () => {
    if (!currentWord) return;

    setSession(prev => ({
      ...prev,
      reviewedWords: prev.reviewedWords + 1,
      correctAnswers: prev.correctAnswers + 1
    }));

    // Update word review data
    try {
      await api.appQyV1.updateWordReview(currentWord.id, {
        correct: true,
        reviewDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to update review:', error);
    }

    nextWord();
  };

  const handleIncorrect = async () => {
    if (!currentWord) return;

    setSession(prev => ({
      ...prev,
      reviewedWords: prev.reviewedWords + 1,
      incorrectAnswers: prev.incorrectAnswers + 1
    }));

    // Update word review data
    try {
      await api.appQyV1.updateWordReview(currentWord.id, {
        correct: false,
        reviewDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to update review:', error);
    }

    nextWord();
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

    if (currentWordIndex >= reviewWords.length - 1) {
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
    setSession({
      totalWords: reviewWords.length,
      reviewedWords: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      skippedWords: 0
    });
  };

  const checkTypedAnswer = () => {
    const correct = userAnswer.trim().toLowerCase() === currentWord?.translation.toLowerCase();
    if (correct) {
      handleCorrect();
    } else {
      handleIncorrect();
    }
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
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
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
            No Words Due for Review
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You're all caught up! Check back later for more reviews.
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
            style={{ width: `${(session.reviewedWords / session.totalWords) * 100}%` }}
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
            <span className={`px-3 py-1 rounded text-sm font-medium ${getDifficultyColor(currentWord.difficulty)}`}>
              {currentWord.difficulty}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Reviewed {currentWord.reviewCount} times
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Success: {currentWord.successRate}%
            </span>
          </div>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
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
          {currentWord.partOfSpeech && (
            <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
              {currentWord.partOfSpeech}
            </span>
          )}
        </div>

        {/* Answer Section */}
        {reviewMode === 'flashcard' ? (
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
                    {currentWord.translation}
                  </p>
                  {currentWord.definition && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">
                      {currentWord.definition}
                    </p>
                  )}
                  {currentWord.exampleSentences && currentWord.exampleSentences.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Examples:
                      </p>
                      {currentWord.exampleSentences.map((sentence, idx) => (
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
              onKeyPress={(e) => e.key === 'Enter' && checkTypedAnswer()}
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
      <div className="max-w-3xl mx-auto text-center text-sm text-gray-600 dark:text-gray-400">
        <p>
          Next review scheduled for: {new Date(currentWord.nextReview).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default ReviewPanel;
