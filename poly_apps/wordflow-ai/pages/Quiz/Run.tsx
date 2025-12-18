
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';
import { api } from '../../services/api';
import { QuizQuestion } from '../../types';

const QuizRunPage = () => {
  // [i18n] Added `t` function for multi-language support
  const { navigate, t } = useContext(AppContext);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    api.getQuizSession().then(setQuestions);
  }, []);

  useEffect(() => {
    if (selectedOption || gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
           handleTimeOut();
           return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedOption, currentIndex, gameOver]);

  const handleTimeOut = () => {
    setIsCorrect(false);
    setSelectedOption('timeout');
    setTimeout(nextQuestion, 1500);
  };

  const handleSelect = (optionId: string, correct: boolean) => {
    if (selectedOption) return;
    setSelectedOption(optionId);
    setIsCorrect(correct);
    if (correct) setScore(s => s + 10);
    setTimeout(nextQuestion, 1200);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(p => p + 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setTimeLeft(15);
    } else {
      setGameOver(true);
    }
  };

  // [i18n] Replaced hardcoded "Loading Quiz..." with t()
  if (questions.length === 0) return <div className="p-10 text-center">{t('quiz.loadingQuiz')}</div>;

  if (gameOver) return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
       <div className="text-6xl mb-6">🏆</div>
       {/* [i18n] Replaced hardcoded "Quiz Complete!" with t() */}
       <h2 className="text-3xl font-bold dark:text-white mb-2">{t('quiz.quizComplete')}</h2>
       {/* [i18n] Replaced hardcoded "Score:" with t() */}
       <p className="text-slate-500 mb-8 text-xl">{t('quiz.score')} <span className="text-blue-500 font-bold">{score}</span></p>
       {/* [i18n] Replaced hardcoded "Back Home" with t() */}
       <Button onClick={() => navigate('home')}>{t('quiz.backHome')}</Button>
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
    <div className="h-full flex flex-col p-6 pt-safe pb-safe relative overflow-hidden">
       {/* Top Bar */}
       <div className="flex items-center justify-between mb-8 z-10">
          <button onClick={() => navigate('home')} className="p-2 bg-white/40 rounded-full"><Icons.Back /></button>
          <div className="flex-1 mx-4 bg-slate-200 h-2 rounded-full overflow-hidden">
             <div className="bg-blue-500 h-full transition-all duration-1000" style={{width: `${(currentIndex / questions.length) * 100}%`}}></div>
          </div>
          <div className="font-mono font-bold text-blue-600">{score}</div>
       </div>

       {/* Timer */}
       <div className="flex justify-center mb-8">
           <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-xl ${timeLeft < 5 ? 'border-red-500 text-red-500 animate-pulse' : 'border-blue-400 text-blue-600'}`}>
              {timeLeft}
           </div>
       </div>

       {/* Question */}
       <div className="flex-1 flex flex-col items-center justify-center z-10 mb-8">
           <div className="holo-card p-8 rounded-3xl w-full text-center shadow-xl backdrop-blur-md">
               {/* [i18n] Replaced hardcoded "Question" with t() */}
               <h3 className="text-slate-500 uppercase text-xs font-bold mb-4 tracking-widest">{currentQ.type} {t('quiz.question')}</h3>
               <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-relaxed">{currentQ.question}</h2>
           </div>
       </div>

       {/* Options */}
       <div className="grid gap-3 z-10">
          {currentQ.options.map(opt => {
             let stateClass = "bg-white/60 dark:bg-slate-800/60 border-white/40";
             if (selectedOption) {
                if (opt.isCorrect) stateClass = "bg-green-500 text-white border-green-600 shadow-green-500/30";
                else if (selectedOption === opt.id) stateClass = "bg-red-500 text-white border-red-600 shadow-red-500/30";
                else stateClass = "opacity-50";
             }

             return (
               <button 
                 key={opt.id}
                 onClick={() => handleSelect(opt.id, opt.isCorrect)}
                 className={`p-5 rounded-2xl font-bold text-lg transition-all duration-300 transform active:scale-98 shadow-sm border ${stateClass}`}
               >
                 {opt.text}
               </button>
             );
          })}
       </div>
    </div>
  );
};

export default QuizRunPage;
