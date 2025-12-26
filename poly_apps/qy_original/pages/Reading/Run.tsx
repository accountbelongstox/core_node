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

  if (!currentWord) return <div className="immersive-container justify-center items-center text-tertiary">LOADING ENGINE...</div>;

  return (
    <div className="immersive-container p-6 pt-safe pb-safe">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-10 z-20">
        <div className="island-header" style={{ padding: '0.25rem 1rem', borderRadius: '1rem' }}>
           <span className="text-xs font-bold text-secondary">
             {currentIndex + 1} <span className="text-tertiary">/</span> {words.length}
           </span>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setShowDetail(!showDetail)} className="w-12 h-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-primary backdrop-blur-md">
             👁️
           </button>
           <button onClick={() => navigate('home')} className="w-12 h-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-primary backdrop-blur-md">
             ✕
           </button>
        </div>
      </div>

      {/* Word Card */}
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-slide-up z-10">
         <div>
            <h1 className="text-6xl holo-text mb-4">
               {currentWord.text}
            </h1>
            {settings.display.showPhonetic && (
               <div className="inline-block px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-accent font-mono text-lg">
                  {currentWord.phonetic}
               </div>
            )}
         </div>
         
         <div className={`transition-all duration-700 ease-out transform ${showDetail ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            {settings.display.showTranslation && (
               <div className="text-3xl font-bold text-secondary mb-8 hero-title">
                  {currentWord.translation}
               </div>
            )}
            
            <div className="app-card max-w-xs mx-auto p-6" style={{ background: 'rgba(255,255,255,0.05)' }}>
               <p className="text-primary text-lg leading-relaxed font-serif italic">
                  "{currentWord.example}"
               </p>
            </div>
         </div>
      </div>

      {/* Glass Controls */}
      <div className="h-32 flex items-center justify-center gap-8 pb-4 z-20">
         <button onClick={handleInstantReview} className="flex flex-col items-center gap-2 group">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-tertiary group-active:scale-95 transition-all group-hover:bg-white/10">
               <Icons.Rewind />
            </div>
            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Review</span>
         </button>

         <button onClick={() => setIsPlaying(!isPlaying)} className="transform transition-transform active:scale-95 group">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/10 backdrop-blur-xl transition-all duration-300 ${isPlaying ? 'bg-white text-secondary' : 'app-btn-primary text-white'}`}>
               {isPlaying ? <Icons.Pause /> : <Icons.Play />}
            </div>
         </button>

         <button onClick={handleNext} className="flex flex-col items-center gap-2 group">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary group-active:scale-95 transition-all group-hover:bg-white/10">
               <Icons.ChevronRight />
            </div>
            <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest">Next</span>
         </button>
      </div>
    </div>
  );
};

export default ReadingRunPage;
