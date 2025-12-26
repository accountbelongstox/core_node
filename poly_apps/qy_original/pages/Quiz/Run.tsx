<<<<<<< HEAD

=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
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

<<<<<<< HEAD
  if (questions.length === 0) return <div className="p-10 text-center">Loading Quiz...</div>;

  if (gameOver) return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in text-center">
       <div className="text-6xl mb-6">🏆</div>
       <h2 className="text-3xl font-bold dark:text-white mb-2">Quiz Complete!</h2>
       <p className="text-slate-500 mb-8 text-xl">Score: <span className="text-blue-500 font-bold">{score}</span></p>
       <Button onClick={() => navigate('home')}>Back Home</Button>
=======
  if (questions.length === 0) return <div className="h-full flex items-center justify-center text-blue-400 font-bold animate-pulse">Initializing Arena...</div>;

  if (gameOver) return (
    <div className="quiz-wrapper items-center justify-center text-center animate-fade-in">
       <div className="text-8xl mb-6 filter drop-shadow-[0_0_30px_rgba(255,215,0,0.6)]">🏆</div>
       <h2 className="text-4xl font-black text-white mb-2">VICTORY</h2>
       <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-600 mb-8">{score}</div>
       <Button onClick={() => navigate('home')} className="w-48">Return Base</Button>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
<<<<<<< HEAD
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
               <h3 className="text-slate-500 uppercase text-xs font-bold mb-4 tracking-widest">{currentQ.type} Question</h3>
               <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-relaxed">{currentQ.question}</h2>
=======
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
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
           </div>
       </div>

       {/* Options */}
<<<<<<< HEAD
       <div className="grid gap-3 z-10">
          {currentQ.options.map(opt => {
             let stateClass = "bg-white/60 dark:bg-slate-800/60 border-white/40";
             if (selectedOption) {
                if (opt.isCorrect) stateClass = "bg-green-500 text-white border-green-600 shadow-green-500/30";
                else if (selectedOption === opt.id) stateClass = "bg-red-500 text-white border-red-600 shadow-red-500/30";
                else stateClass = "opacity-50";
=======
       <div className="quiz-options-grid">
          {currentQ.options.map((opt, idx) => {
             let statusClass = "";
             if (selectedOption) {
                if (opt.isCorrect) statusClass = "selected-correct";
                else if (selectedOption === opt.id) statusClass = "selected-wrong";
                else statusClass = "opacity-40 grayscale";
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
             }

             return (
               <button 
                 key={opt.id}
                 onClick={() => handleSelect(opt.id, opt.isCorrect)}
<<<<<<< HEAD
                 className={`p-5 rounded-2xl font-bold text-lg transition-all duration-300 transform active:scale-98 shadow-sm border ${stateClass}`}
               >
                 {opt.text}
=======
                 className={`holo-option !mb-0 !py-4 ${statusClass}`}
                 style={{ animationDelay: `${idx * 100}ms` }}
               >
                 <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-xs font-bold text-white/60">
                        {['A','B','C','D'][idx]}
                    </div>
                    <span className="text-lg font-medium">{opt.text}</span>
                 </div>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
               </button>
             );
          })}
       </div>
    </div>
  );
};

<<<<<<< HEAD
export default QuizRunPage;
=======
export default QuizRunPage;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
