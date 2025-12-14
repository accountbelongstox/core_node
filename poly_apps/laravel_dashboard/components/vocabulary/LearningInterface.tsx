import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, RefreshCw, Star, Volume2, ArrowLeft, ArrowRight, TrendingUp } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { commonClasses } from '../../styles/theme';

interface LearningInterfaceProps {
  onBack: () => void;
}

const LearningInterface: React.FC<LearningInterfaceProps> = ({ onBack }) => {
  const [words, setWords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadWords();
    loadStats();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    try {
      const response = await apiService.appQyV1GetLearningWords({ limit: 20 });
      if (response.success && response.data) {
        setWords(response.data.words || response.data);
      }
    } catch (err) {
      console.error('Failed to load words:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.appQyV1GetLearningStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleMarkLearned = async (status: 'learned' | 'reviewing' | 'difficult') => {
    if (!words[currentIndex]) return;

    setUpdating(true);
    try {
      const response = await apiService.appQyV1UpdateProgress({
        word_id: words[currentIndex].id,
        status
      });

      if (response.success) {
        const updatedWords = [...words];
        updatedWords[currentIndex] = {
          ...updatedWords[currentIndex],
          status,
          learned: status === 'learned'
        };
        setWords(updatedWords);

        if (currentIndex < words.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setShowAnswer(false);
        } else {
          await loadWords();
          setCurrentIndex(0);
          setShowAnswer(false);
        }

        await loadStats();
      }
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setUpdating(false);
    }
  };

  const currentWord = words[currentIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className={`${commonClasses.card} p-8 text-center`}>
        <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <h3 className="text-xl font-semibold mb-2">No Words to Learn</h3>
        <p className="text-slate-500 mb-4">Select a library to start learning.</p>
        <button onClick={onBack} className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-green-600">{stats.learned_count || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Learned</div>
          </div>
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-blue-600">{stats.studying_count || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Studying</div>
          </div>
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-orange-600">{stats.review_count || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Review</div>
          </div>
          <div className={`${commonClasses.card} p-4 text-center`}>
            <div className="text-2xl font-bold text-purple-600">{stats.daily_goal_progress || 0}%</div>
            <div className="text-xs text-slate-500 mt-1">Daily Goal</div>
          </div>
        </div>
      )}

      <div className={`${commonClasses.card} p-8`}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="text-sm text-slate-500">
            {currentIndex + 1} / {words.length}
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-4">
            <BookOpen className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-4xl font-bold mb-2">{currentWord.word}</h2>
          {currentWord.phonetic && (
            <p className="text-lg text-slate-500 mb-4">/{currentWord.phonetic}/</p>
          )}
          {currentWord.part_of_speech && (
            <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm rounded">
              {currentWord.part_of_speech}
            </span>
          )}
        </div>

        {!showAnswer ? (
          <div className="text-center">
            <button
              onClick={() => setShowAnswer(true)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 py-3`}
            >
              Show Answer
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`${commonClasses.card} p-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20`}>
              <h3 className="font-semibold mb-2">Translation</h3>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {currentWord.translation || 'N/A'}
              </p>
            </div>

            {currentWord.definition && (
              <div>
                <h3 className="font-semibold mb-2">Definition</h3>
                <p className="text-slate-700 dark:text-slate-300">{currentWord.definition}</p>
              </div>
            )}

            {currentWord.example_sentences && currentWord.example_sentences.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Examples</h3>
                <div className="space-y-2">
                  {currentWord.example_sentences.map((sentence: string, idx: number) => (
                    <p key={idx} className="text-sm italic text-slate-600 dark:text-slate-400 pl-4 border-l-2 border-slate-300 dark:border-slate-700">
                      "{sentence}"
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleMarkLearned('difficult')}
                disabled={updating}
                className={`${commonClasses.button} flex-1 py-3 bg-red-600 hover:bg-red-700 text-white`}
              >
                Difficult
              </button>
              <button
                onClick={() => handleMarkLearned('reviewing')}
                disabled={updating}
                className={`${commonClasses.button} flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white`}
              >
                Review Later
              </button>
              <button
                onClick={() => handleMarkLearned('learned')}
                disabled={updating}
                className={`${commonClasses.button} flex-1 py-3 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2`}
              >
                <CheckCircle className="w-4 h-4" />
                Got It!
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                setShowAnswer(false);
              }
            }}
            disabled={currentIndex === 0}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={() => {
              if (currentIndex < words.length - 1) {
                setCurrentIndex(currentIndex + 1);
                setShowAnswer(false);
              }
            }}
            disabled={currentIndex === words.length - 1}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningInterface;
