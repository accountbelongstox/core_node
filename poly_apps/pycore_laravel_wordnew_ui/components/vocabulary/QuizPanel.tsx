import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Trophy,
  RotateCcw,
  RefreshCw,
  List,
  AlertCircle
} from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface QuizPanelProps {
  userId?: string;
  libraryId?: string;
}

interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'fill_blank' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  word: string;
}

interface QuizState {
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  selectedAnswer: string;
  userAnswers: { questionId: string; answer: string; correct: boolean }[];
  timeRemaining: number;
  quizStarted: boolean;
  quizCompleted: boolean;
  showExplanation: boolean;
}

const QuizPanel: React.FC<QuizPanelProps> = ({ userId, libraryId }) => {
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentQuestionIndex: 0,
    selectedAnswer: '',
    userAnswers: [],
    timeRemaining: 0,
    quizStarted: false,
    quizCompleted: false,
    showExplanation: false
  });
  const [quizSettings, setQuizSettings] = useState({
    questionCount: 10,
    timeLimit: 300, // seconds
    quizType: 'mixed' as 'mixed' | 'multiple_choice' | 'fill_blank'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (quizState.quizStarted && !quizState.quizCompleted && quizState.timeRemaining > 0) {
      timer = setInterval(() => {
        setQuizState(prev => {
          const newTime = prev.timeRemaining - 1;
          if (newTime <= 0) {
            return { ...prev, timeRemaining: 0, quizCompleted: true };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [quizState.quizStarted, quizState.quizCompleted, quizState.timeRemaining]);

  const generateQuiz = async () => {
    setLoading(true);
    try {
      // Mock quiz generation - replace with actual API call
      const allQuestions: QuizQuestion[] = [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What does "serendipity" mean?',
          options: [
            'A fortunate accident',
            'A difficult situation',
            'A planned event',
            'A disappointing outcome'
          ],
          correctAnswer: 'A fortunate accident',
          explanation: 'Serendipity refers to finding something good by chance.',
          word: 'serendipity'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Which word means "lasting for a very short time"?',
          options: ['Ephemeral', 'Eternal', 'Permanent', 'Continuous'],
          correctAnswer: 'Ephemeral',
          explanation: 'Ephemeral describes something that lasts for a very brief period.',
          word: 'ephemeral'
        },
        {
          id: 'q3',
          type: 'fill_blank',
          question: 'Complete: "Smartphones have become _____ in modern society."',
          correctAnswer: 'ubiquitous',
          explanation: 'Ubiquitous means present everywhere.',
          word: 'ubiquitous'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'What is the best synonym for "melancholy"?',
          options: ['Joyful', 'Sadness', 'Angry', 'Excited'],
          correctAnswer: 'Sadness',
          explanation: 'Melancholy refers to a deep, pensive sadness.',
          word: 'melancholy'
        },
        {
          id: 'q5',
          type: 'multiple_choice',
          question: 'Which word describes someone who is very talkative?',
          options: ['Taciturn', 'Loquacious', 'Reserved', 'Shy'],
          correctAnswer: 'Loquacious',
          explanation: 'Loquacious means tending to talk a great deal.',
          word: 'loquacious'
        }
      ];
      const mockQuestions = allQuestions.slice(0, quizSettings.questionCount);

      setQuizState({
        questions: mockQuestions,
        currentQuestionIndex: 0,
        selectedAnswer: '',
        userAnswers: [],
        timeRemaining: quizSettings.timeLimit,
        quizStarted: true,
        quizCompleted: false,
        showExplanation: false
      });
    } catch (error) {
      console.error('Failed to generate quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (!quizState.showExplanation) {
      setQuizState(prev => ({ ...prev, selectedAnswer: answer }));
    }
  };

  const submitAnswer = () => {
    const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
    const isCorrect = quizState.selectedAnswer.trim().toLowerCase() ===
                      currentQuestion.correctAnswer.trim().toLowerCase();

    setQuizState(prev => ({
      ...prev,
      userAnswers: [
        ...prev.userAnswers,
        {
          questionId: currentQuestion.id,
          answer: prev.selectedAnswer,
          correct: isCorrect
        }
      ],
      showExplanation: true
    }));
  };

  const nextQuestion = () => {
    const isLastQuestion = quizState.currentQuestionIndex >= quizState.questions.length - 1;

    if (isLastQuestion) {
      setQuizState(prev => ({ ...prev, quizCompleted: true }));
    } else {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        selectedAnswer: '',
        showExplanation: false
      }));
    }
  };

  const resetQuiz = () => {
    setQuizState({
      questions: [],
      currentQuestionIndex: 0,
      selectedAnswer: '',
      userAnswers: [],
      timeRemaining: 0,
      quizStarted: false,
      quizCompleted: false,
      showExplanation: false
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateScore = () => {
    const correct = quizState.userAnswers.filter(a => a.correct).length;
    const total = quizState.userAnswers.length;
    return {
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0
    };
  };

  // Quiz Setup Screen
  if (!quizState.quizStarted) {
    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto`}>
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Vocabulary Quiz
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Test your knowledge and track your progress
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Questions
              </label>
              <select
                value={quizSettings.questionCount}
                onChange={(e) => setQuizSettings(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                className={commonClasses.input}
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Limit
              </label>
              <select
                value={quizSettings.timeLimit}
                onChange={(e) => setQuizSettings(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                className={commonClasses.input}
              >
                <option value={180}>3 Minutes</option>
                <option value={300}>5 Minutes</option>
                <option value={600}>10 Minutes</option>
                <option value={0}>No Limit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Question Type
              </label>
              <select
                value={quizSettings.quizType}
                onChange={(e) => setQuizSettings(prev => ({ ...prev, quizType: e.target.value as any }))}
                className={commonClasses.input}
              >
                <option value="mixed">Mixed</option>
                <option value="multiple_choice">Multiple Choice Only</option>
                <option value="fill_blank">Fill in the Blank Only</option>
              </select>
            </div>

            <button
              onClick={generateQuiz}
              disabled={loading}
              className={`w-full ${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center justify-center gap-2 py-4 text-lg`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Results Screen
  if (quizState.quizCompleted) {
    const score = calculateScore();

    return (
      <div className="p-6">
        <div className={`${commonClasses.card} p-8 max-w-2xl mx-auto`}>
          <div className="text-center mb-8">
            <Trophy className={`w-20 h-20 mx-auto mb-4 ${
              score.percentage >= 80 ? 'text-yellow-500' :
              score.percentage >= 60 ? 'text-gray-400' :
              'text-orange-500'
            }`} />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Quiz Complete!
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Your Score: {score.correct} / {score.total} ({score.percentage}%)
            </p>
          </div>

          <div className="mb-8">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {score.correct}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Correct</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {score.total - score.correct}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Incorrect</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatTime(quizSettings.timeLimit - quizState.timeRemaining)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Time Used</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <List className="w-5 h-5" />
              Review Answers
            </h3>
            {quizState.questions.map((question, index) => {
              const userAnswer = quizState.userAnswers.find(a => a.questionId === question.id);
              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border-2 ${
                    userAnswer?.correct
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {userAnswer?.correct ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-2">
                        {index + 1}. {question.question}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your answer: <span className="font-medium">{userAnswer?.answer}</span>
                      </p>
                      {!userAnswer?.correct && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Correct answer: <span className="font-medium">{question.correctAnswer}</span>
                        </p>
                      )}
                      {question.explanation && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                          {question.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4">
            <button
              onClick={resetQuiz}
              className={`flex-1 ${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center justify-center gap-2`}
            >
              <RotateCcw className="w-4 h-4" />
              New Quiz
            </button>
            <button
              onClick={generateQuiz}
              className={`flex-1 ${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center justify-center gap-2`}
            >
              <Play className="w-4 h-4" />
              Retry Same Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Question Screen
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const currentAnswer = quizState.userAnswers.find(a => a.questionId === currentQuestion?.id);

  return (
    <div className="p-6">
      {/* Quiz Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Question {quizState.currentQuestionIndex + 1} of {quizState.questions.length}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            {quizState.userAnswers.filter(a => a.correct).length} correct
          </div>
        </div>
        {quizSettings.timeLimit > 0 && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            quizState.timeRemaining < 60
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          }`}>
            <Clock className="w-5 h-5" />
            <span className="font-semibold">{formatTime(quizState.timeRemaining)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${((quizState.currentQuestionIndex) / quizState.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className={`${commonClasses.card} p-8 max-w-3xl mx-auto`}>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {currentQuestion?.question}
        </h2>

        {currentQuestion?.type === 'multiple_choice' && currentQuestion.options && (
          <div className="space-y-3 mb-6">
            {currentQuestion.options.map((option, index) => {
              const isSelected = quizState.selectedAnswer === option;
              const isCorrect = option === currentQuestion.correctAnswer;
              const showResult = quizState.showExplanation;

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={showResult}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    showResult
                      ? isCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : isSelected
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      : isSelected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option}</span>
                    {showResult && isCorrect && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion?.type === 'fill_blank' && (
          <div className="mb-6">
            <input
              type="text"
              value={quizState.selectedAnswer}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              disabled={quizState.showExplanation}
              placeholder="Type your answer..."
              className={`${commonClasses.input} text-lg`}
              autoFocus
            />
          </div>
        )}

        {/* Explanation */}
        {quizState.showExplanation && currentQuestion?.explanation && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Explanation
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!quizState.showExplanation ? (
          <button
            onClick={submitAnswer}
            disabled={!quizState.selectedAnswer.trim()}
            className={`w-full ${commonClasses.button} ${commonClasses.buttonPrimary} py-3`}
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            className={`w-full ${commonClasses.button} ${commonClasses.buttonPrimary} py-3`}
          >
            {quizState.currentQuestionIndex >= quizState.questions.length - 1
              ? 'Finish Quiz'
              : 'Next Question'}
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizPanel;
