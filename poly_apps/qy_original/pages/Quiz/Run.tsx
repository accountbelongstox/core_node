import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';
import { api } from '../../services/api';
import { QuizQuestion } from '../../types';

const QuizRunPage = () => {
  const { navigate } = useContext(AppContext);
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

  if (questions.length === 0) return <div className="h-full flex items-center justify-center text-blue-400 font-bold animate-pulse">Initializing Arena...</div>;

  if (gameOver) return (
    <div className="quiz-wrapper items-center justify-center text-center animate-fade-in">
       <div className="text-8xl mb-6 filter drop-shadow-[0_0_30px_rgba(255,215,0,0.6)]">🏆</div>
       <h2 className="text-4xl font-black text-white mb-2">VICTORY</h2>
       <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 mb-8">{score}</div>
       <Button onClick={() => navigate('home')} className="w-48">Return Base</Button>
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
    <div className="quiz-wrapper pt-safe pb-safe animate-slide-up">
       {/* Top Bar */}
       <div className="flex justify-between items-center">
          <button onClick={() => navigate('home')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"><Icons.Close /></button>
          <div className="quiz-timer-ring !m-0 !w-12 !h-12 !text-lg !border-2">
             {timeLeft}
          </div>
          <div className="px-4 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold">
             {score} XP
          </div>
       </div>

       {/* Question */}
       <div className="quiz-question-card">
           <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Question {currentIndex + 1}</div>
               <h2 className="quiz-question-text">
                  {currentQ.question}
               </h2>
           </div>
       </div>

       {/* Options */}
       <div className="quiz-options-grid">
          {currentQ.options.map((opt, idx) => {
             let statusClass = "";
             if (selectedOption) {
                if (opt.isCorrect) statusClass = "selected-correct";
                else if (selectedOption === opt.id) statusClass = "selected-wrong";
                else statusClass = "opacity-40 grayscale";
             }

             return (
               <button 
                 key={opt.id}
                 onClick={() => handleSelect(opt.id, opt.isCorrect)}
                 className={`holo-option !mb-0 !py-4 ${statusClass}`}
                 style={{ animationDelay: `${idx * 100}ms` }}
               >
                 <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-xs font-bold text-white/60">
                        {['A','B','C','D'][idx]}
                    </div>
                    <span className="text-lg font-medium">{opt.text}</span>
                 </div>
               </button>
             );
          })}
       </div>
    </div>
  );
};

export default QuizRunPage;
