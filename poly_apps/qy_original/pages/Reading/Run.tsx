import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';
import { api } from '../../services/api';
import { Word } from '../../types';

const ReadingRunPage = () => {
  const { navigate, currentParams, settings } = useContext(AppContext);
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if(!currentParams.groupId) return;
    api.getWordsForGroup(currentParams.groupId).then(data => {
      setWords(data);
      if(settings.audio.autoPlay) setIsPlaying(true);
    });
  }, [currentParams.groupId]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && words.length > 0) {
      interval = setInterval(() => {
        handleNext();
      }, settings.audio.speed * 3000); 
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, words]);

  const handleNext = () => {
    historyRef.current.push(currentIndex);
    if (historyRef.current.length > 10) historyRef.current.shift();
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      navigate('home');
    }
  };

  const handleInstantReview = () => {
    setIsPlaying(false);
    const prev = historyRef.current.pop();
    if (prev !== undefined) {
      setCurrentIndex(prev);
    } else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentWord = words[currentIndex];

  if (!currentWord) return <div className="flex h-full items-center justify-center dark:text-white animate-pulse font-bold tracking-widest text-slate-400">LOADING ENGINE...</div>;

  return (
    <div className="h-full flex flex-col p-6 pt-safe pb-safe relative overflow-hidden">
      {/* Immersive Background Overlay - Lighter for Holographic feel */}
      <div className="absolute inset-0 bg-white/10 dark:bg-black/40 backdrop-blur-[2px] z-0"></div>

      {/* Top Bar */}
      <div className="relative z-10 flex justify-between items-center mb-10">
        <div className="px-4 py-1.5 rounded-full bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/40 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
           {currentIndex + 1} <span className="text-slate-400 mx-1">/</span> {words.length}
        </div>
        <div className="flex gap-4">
           <button onClick={() => setShowDetail(!showDetail)} className="w-11 h-11 flex items-center justify-center bg-white/40 dark:bg-white/10 rounded-full backdrop-blur-md border border-white/40 text-slate-700 dark:text-white hover:bg-white/60 transition-all shadow-sm active:scale-90">
             <span className="text-lg">👁️</span>
           </button>
           <button onClick={() => navigate('home')} className="w-11 h-11 flex items-center justify-center bg-white/40 dark:bg-white/10 rounded-full backdrop-blur-md border border-white/40 text-slate-700 dark:text-white hover:bg-white/60 transition-all shadow-sm active:scale-90">
             <span className="text-lg font-bold">✕</span>
           </button>
        </div>
      </div>

      {/* Word Card */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-float">
         <div className="relative">
            <h1 className="text-6xl font-black text-slate-800 dark:text-white tracking-tighter drop-shadow-sm mb-5 transition-all duration-300">
               {currentWord.text}
            </h1>
            {settings.display.showPhonetic && (
               <div className="inline-block px-5 py-2 rounded-2xl bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/30 text-blue-600 dark:text-blue-300 font-mono text-lg shadow-sm">
                  {currentWord.phonetic}
               </div>
            )}
         </div>
         
         <div className={`transition-all duration-700 ease-out transform ${showDetail ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            {settings.display.showTranslation && (
               <div className="text-3xl font-bold text-slate-600 dark:text-slate-300 mb-10 tracking-tight">
                  {currentWord.translation}
               </div>
            )}
            
            <div className="holo-card p-8 rounded-3xl max-w-xs mx-auto border border-white/60 shadow-xl backdrop-blur-xl">
               <p className="text-slate-700 dark:text-slate-200 text-lg leading-relaxed font-serif italic text-opacity-90">
                  "{currentWord.example}"
               </p>
            </div>
         </div>
      </div>

      {/* Glass Controls */}
      <div className="relative z-10 h-32 flex items-center justify-center gap-8 pb-4">
         <button onClick={handleInstantReview} className="flex flex-col items-center gap-3 group">
            <div className="w-16 h-16 rounded-full bg-yellow-400/20 dark:bg-yellow-400/10 backdrop-blur-md border border-yellow-400/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 shadow-lg group-active:scale-90 transition-all hover:bg-yellow-400/30">
               <Icons.Rewind />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-yellow-600 transition-colors">Review</span>
         </button>

         <button onClick={() => setIsPlaying(!isPlaying)} className="transform transition-transform active:scale-95 group">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 backdrop-blur-xl transition-all duration-300 ${isPlaying ? 'bg-slate-200/50 text-slate-600 hover:bg-slate-200/70' : 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white hover:scale-105 hover:shadow-blue-500/40'}`}>
               {isPlaying ? <Icons.Pause /> : <Icons.Play />}
            </div>
         </button>

         <button onClick={handleNext} className="flex flex-col items-center gap-3 group">
            <div className="w-16 h-16 rounded-full bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/40 flex items-center justify-center text-slate-700 dark:text-white shadow-lg group-active:scale-90 transition-all hover:bg-white/60">
               <Icons.ChevronRight />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">Next</span>
         </button>
      </div>
    </div>
  );
};

export default ReadingRunPage;