import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, Settings2, 
  RotateCcw, Sparkles, HelpCircle, VolumeX, ListMusic, Layers, RefreshCw
} from 'lucide-react';
import { ElementTheme, Word } from '../WfNewTypes';
import { MOCK_WALKMAN_WORDS } from '../WfNewMockDb';

interface WfNewWalkmanProps {
  activeTheme: ElementTheme;
  courseWords: Word[];
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  lang: string;
}

export const WfNewWalkman: React.FC<WfNewWalkmanProps> = ({
  activeTheme,
  courseWords,
  addToast,
  lang
}) => {
  // Use either active catalog words or fallback walkman dataset
  const activeWordsPool = courseWords.length > 0 ? courseWords : MOCK_WALKMAN_WORDS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Custom Audio Walkman Modes
  const [playRate, setPlayRate] = useState<number>(0.9); // speed
  const [wordRepeatTimes, setWordRepeatTimes] = useState<number>(1); // repeat count each word
  const [speakChinese, setSpeakChinese] = useState<boolean>(true); // trigger definition read in zh-CN
  const [autoLoopPlaylist, setAutoLoopPlaylist] = useState<boolean>(true);

  // Tracking playback count parameters
  const [currentRepeatIteration, setCurrentRepeatIteration] = useState(0);
  const [isSpeakingDefinition, setIsSpeakingDefinition] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeWord = activeWordsPool[currentIndex];

  // Speech helper supporting dual language queue
  const speakCurrentStep = () => {
    if (!('speechSynthesis' in window)) {
      console.warn("SpeechSynthesis not functional on this platform.");
      return;
    }

    window.speechSynthesis.cancel();
    if (!activeWord) return;

    // Define English utterance
    const enUtterance = new SpeechSynthesisUtterance(activeWord.text);
    enUtterance.lang = 'en-US';
    enUtterance.rate = playRate;

    enUtterance.onstart = () => {
      setIsSpeakingDefinition(false);
    };

    enUtterance.onend = () => {
      if (speakChinese && activeWord.translation) {
        // Wait custom milliseconds then speak Chinese translation
        timerRef.current = setTimeout(() => {
          const zhText = activeWord.translation.replace(/[^\u4e00-\u9fa5]/g, ' '); // Strip non-chinese characters briefly for cleaner read
          const zhUtterance = new SpeechSynthesisUtterance(zhText);
          zhUtterance.lang = 'zh-CN';
          zhUtterance.rate = 1.0;

          zhUtterance.onstart = () => {
            setIsSpeakingDefinition(true);
          };

          zhUtterance.onend = () => {
            handleUtteranceCompletedChain();
          };

          zhUtterance.onerror = () => {
            handleUtteranceCompletedChain();
          };

          window.speechSynthesis.speak(zhUtterance);
        }, 600);
      } else {
        handleUtteranceCompletedChain();
      }
    };

    enUtterance.onerror = () => {
      handleUtteranceCompletedChain();
    };

    window.speechSynthesis.speak(enUtterance);
  };

  const handleUtteranceCompletedChain = () => {
    if (!isPlaying) return;

    // Check repeats
    if (currentRepeatIteration < wordRepeatTimes - 1) {
      setCurrentRepeatIteration(prev => prev + 1);
      // Wait shortly then recite again
      timerRef.current = setTimeout(() => {
        speakCurrentStep();
      }, 1000);
    } else {
      // Move to next word after sequence
      setCurrentRepeatIteration(0);
      timerRef.current = setTimeout(() => {
        handleNextWord();
      }, 1200);
    }
  };

  const handleNextWord = () => {
    setCurrentIndex(prev => {
      const nextIdx = prev + 1;
      if (nextIdx >= activeWordsPool.length) {
        if (autoLoopPlaylist) {
          addToast("Syntopic catalog loop re-started", "info");
          return 0;
        } else {
          setIsPlaying(false);
          addToast("End of walkman playback pool reached", "success");
          return prev;
        }
      }
      return nextIdx;
    });
    setCurrentRepeatIteration(0);
  };

  const handlePrevWord = () => {
    setCurrentIndex(prev => {
      const prevIdx = prev - 1;
      if (prevIdx < 0) {
        return activeWordsPool.length - 1;
      }
      return prevIdx;
    });
    setCurrentRepeatIteration(0);
  };

  // Play/pause toggle effect
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (isPlaying) {
      speakCurrentStep();
    } else {
      window.speechSynthesis.cancel();
      setIsSpeakingDefinition(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, playRate, wordRepeatTimes, speakChinese]);

  // Handle unmount speech cancel
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const selectWordManual = (idx: number) => {
    setCurrentIndex(idx);
    setCurrentRepeatIteration(0);
    if (!isPlaying) {
      // Speak once manually
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const enUtterance = new SpeechSynthesisUtterance(activeWordsPool[idx].text);
        enUtterance.lang = 'en-US';
        enUtterance.rate = playRate;
        window.speechSynthesis.speak(enUtterance);
      }
    }
  };

  return (
    <div id=" walkman-container-module" className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-2">
      
      {/* LEFT: Classic Virtual Walkman Cassette Core Player */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Walkman Graphic Hardware Skin */}
        <div className={`p-6 rounded-[36px] bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 border border-white/10 shadow-2xl relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 filter blur-[40px] rounded-full pointer-events-none" />
          
          {/* Symmetrical Cassette Interface */}
          <div className="rounded-2xl bg-zinc-950/90 p-5 border border-white/5 space-y-6">
            
            {/* Cassette Upper Segment Label */}
            <div className="flex justify-between items-center px-1 font-mono text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5"><ListMusic className="w-3.5 h-3.5 text-zinc-400" /> SIDE A</span>
              <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded animate-pulse font-bold">
                {isPlaying ? "RECITER LIVE" : "PAUSED"}
              </span>
              <span>120m STEREO</span>
            </div>

            {/* Simulated Cassette Rotating Wheels Viewport */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl relative h-28 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-10 border border-white/5 rounded-full bg-zinc-950/80 flex justify-between items-center px-10">
                
                {/* Reel Left */}
                <motion.div 
                  id="reel-left"
                  animate={{ rotate: isPlaying ? [0, 360] : 0 }}
                  transition={{ ease: "linear", duration: 6, repeat: Infinity }}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-indigo-400/40 bg-zinc-900 flex items-center justify-center relative shrink-0"
                >
                  <div className="w-5 h-5 rounded-full bg-zinc-950 border border-indigo-500/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                  <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full" />
                </motion.div>

                {/* Cassette clear window text */}
                <div className="text-center font-mono text-[9px] text-zinc-400 pointer-events-none z-10 space-y-0.5">
                  <div className="font-bold tracking-widest text-indigo-300">WORDFLOW</div>
                  <div>INDEX {currentIndex + 1} / {activeWordsPool.length}</div>
                </div>

                {/* Reel Right */}
                <motion.div 
                  id="reel-right"
                  animate={{ rotate: isPlaying ? [0, 360] : 0 }}
                  transition={{ ease: "linear", duration: 6, repeat: Infinity }}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-indigo-400/40 bg-zinc-900 flex items-center justify-center relative shrink-0"
                >
                  <div className="w-5 h-5 rounded-full bg-zinc-950 border border-indigo-500/30 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                  <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full" />
                </motion.div>

              </div>

              {/* Tape horizontal stripes */}
              <div className="absolute inset-x-2 bottom-3 flex justify-between opacity-30 text-[9px] font-mono text-indigo-300 px-6">
                <span>0 | | | | | 50</span>
                <span>100</span>
              </div>
            </div>

            {/* Lyric/Word center focus screen with sliding animations */}
            <div className="bg-slate-900/60 rounded-xl p-5 border border-white/5 h-32 flex flex-col justify-center items-center text-center relative overflow-hidden">
              {activeWord ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeWord.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-2.5 w-full px-4"
                  >
                    <div className="flex justify-center items-center gap-2.5">
                      <h4 className="text-3xl font-black text-white tracking-tight">{activeWord.text}</h4>
                      <span className="text-[10px] text-indigo-400 font-mono italic">
                        {activeWord.wordType || 'vocab'}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-zinc-400">{activeWord.phonetic}</p>

                    <p className={`text-sm font-bold transition-colors ${
                      isSpeakingDefinition ? "text-fuchsia-400 animate-pulse" : "text-emerald-400"
                    }`}>
                      {activeWord.translation}
                    </p>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <span className="text-xs text-zinc-600 font-mono">No active track selected</span>
              )}

              {/* Progress ribbon */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500"
                  animate={{ 
                    width: `${((currentIndex + 1) / activeWordsPool.length) * 100}%` 
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

          </div>

          {/* Symmetrical hardware physical press button deck layout */}
          <div className="grid grid-cols-5 gap-2 pt-6 pb-2 px-1">
            
            {/* Prev Word Trigger */}
            <button
              id="wm-btn-prev"
              onClick={handlePrevWord}
              className="py-3 bg-zinc-900 hover:bg-zinc-800 active:translate-y-0.5 text-zinc-300 rounded-xl border-b-4 border-zinc-950 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              title="Previous Word"
            >
              <SkipBack className="w-4 h-4 text-zinc-400 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-mono uppercase text-zinc-500">PREV</span>
            </button>

            {/* Play Trigger */}
            <button
              id="wm-btn-play"
              onClick={() => {
                setIsPlaying(true);
                addToast("Walkman active playback streaming", "info");
              }}
              disabled={isPlaying}
              className={`py-3 rounded-xl border-b-4 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group ${
                isPlaying 
                  ? 'bg-indigo-950/40 border-indigo-950 text-indigo-500 opacity-60' 
                  : 'bg-zinc-900 border-zinc-950 text-zinc-300 hover:bg-zinc-800 active:translate-y-0.5'
              }`}
              title="Play"
            >
              <Play className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-mono uppercase text-zinc-500">PLAY</span>
            </button>

            {/* Pause Trigger */}
            <button
              id="wm-btn-pause"
              onClick={() => {
                setIsPlaying(false);
                addToast("Audio recitation paused", "info");
              }}
              disabled={!isPlaying}
              className={`py-3 rounded-xl border-b-4 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group ${
                !isPlaying 
                  ? 'bg-zinc-950/20 border-zinc-950 text-zinc-600 opacity-60' 
                  : 'bg-zinc-900 border-zinc-950 text-zinc-300 hover:bg-zinc-850 active:translate-y-0.5'
              }`}
              title="Pause"
            >
              <Pause className="w-4 h-4 text-zinc-400 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-mono uppercase text-zinc-500">PAUSE</span>
            </button>

            {/* Next Word Trigger */}
            <button
              id="wm-btn-next"
              onClick={handleNextWord}
              className="py-3 bg-zinc-900 hover:bg-zinc-800 active:translate-y-0.5 text-zinc-300 rounded-xl border-b-4 border-zinc-950 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              title="Next Word"
            >
              <SkipForward className="w-4 h-4 text-zinc-400 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-mono uppercase text-zinc-500">NEXT</span>
            </button>

            {/* Stop/Sound Trigger */}
            <button
              id="wm-btn-stop"
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(0);
                setCurrentRepeatIteration(0);
                window.speechSynthesis.cancel();
                addToast("Walkman process stopped & reset", "warning");
              }}
              className="py-3 bg-zinc-900 hover:bg-zinc-800 active:translate-y-0.5 text-zinc-300 rounded-xl border-b-4 border-zinc-950 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              title="Stop and Reset"
            >
              <RotateCcw className="w-4 h-4 text-rose-400 group-hover:rotate-45 transition-transform" />
              <span className="text-[9px] font-mono uppercase text-zinc-500">RESET</span>
            </button>

          </div>

        </div>

        {/* Walkman contextual details cards */}
        {activeWord && (
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-indigo-400 font-bold">
              <Sparkles className="w-4 h-4" /> Contextual Sandbox Guide
            </div>
            <p className="text-zinc-300 leading-relaxed font-sans mt-1">
              &ldquo;{activeWord.example || 'Example sentence showcasing lexical values.'}&rdquo;
            </p>
            {activeWord.definition && (
              <p className="text-[11px] text-zinc-500 leading-normal">
                <span className="text-indigo-300 font-bold">Lexical Note: </span>{activeWord.definition}
              </p>
            )}
            <div className="flex gap-2.5 flex-wrap pt-0.5">
              {(activeWord.tags || ['General']).map((t, idx) => (
                <span key={idx} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* RIGHT: Walkman Playback parameters & Playlist Catalog lists */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Playback Parameters widget panel */}
        <div className="p-5 rounded-3xl bg-slate-900/30 border border-white/5 space-y-4">
          <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 border-b border-white/5 pb-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            Recital Calibration Parameters
          </h3>

          <div className="space-y-4">
            
            {/* Speed speechRate selector */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-zinc-400">Recital Audio Speed Rate</span>
                <span className="text-indigo-400 font-black">{playRate}x</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.5"
                  max="1.6"
                  step="0.1"
                  value={playRate}
                  onChange={(e) => setPlayRate(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg outline-none"
                />
              </div>
            </div>

            {/* Loop Option count */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-mono block">Recitation Repeats per Lexeme</span>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => {
                      setWordRepeatTimes(n);
                      addToast(`Repeats configured to ${n} times`, "info");
                    }}
                    className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                      wordRepeatTimes === n
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 shadow-mesh'
                        : 'border-white/5 hover:border-white/10 bg-white/5 text-zinc-400'
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Chinese voice translation switch */}
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="space-y-0.5">
                <span id="trans-speak-lbl" className="text-xs font-bold text-slate-100 font-mono block">Chinese Translation Voice</span>
                <span className="text-[10px] text-zinc-500 font-mono">Speak translation in zh-CN</span>
              </div>
              <button
                aria-labelledby="trans-speak-lbl"
                onClick={() => {
                  setSpeakChinese(!speakChinese);
                  addToast(`Translation voice ${!speakChinese ? 'enabled' : 'disabled'}`, 'info');
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors relative focus:outline-none ${
                  speakChinese ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${
                  speakChinese ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Loop Playlist automatically */}
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="space-y-0.5">
                <span id="auto-loop-lbl" className="text-xs font-bold text-slate-100 font-mono block">Auto Loop Playlist</span>
                <span className="text-[10px] text-zinc-500 font-mono font-bold">Restart from beginning at end</span>
              </div>
              <button
                aria-labelledby="auto-loop-lbl"
                onClick={() => {
                  setAutoLoopPlaylist(!autoLoopPlaylist);
                }}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors relative focus:outline-none ${
                  autoLoopPlaylist ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${
                  autoLoopPlaylist ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

          </div>
        </div>

        {/* Playlists Active Words tracklists */}
        <div className="p-5 rounded-3xl bg-slate-900/30 border border-white/5 space-y-4">
          <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex justify-between items-center">
            <span>Playlists Track Deck ({activeWordsPool.length})</span>
            <span className="text-[10px] px-2 py-0.5 bg-indigo-500/15 text-indigo-400 rounded-full">EN-US</span>
          </h3>

          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
            {activeWordsPool.map((word, index) => {
              const isSelected = currentIndex === index;
              return (
                <div
                  key={word.id}
                  onClick={() => selectWordManual(index)}
                  className={`p-3 rounded-xl border text-left flex justify-between items-center cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 font-bold'
                      : 'border-white/5 hover:border-indigo-500/10 hover:bg-white/5 bg-slate-950/20 text-zinc-400'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs block truncate font-mono text-slate-200">
                      {index + 1}. <span className={isSelected ? 'text-indigo-300 font-extrabold' : ''}>{word.text}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono block mt-0.5 mt-0.5">{word.translation}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {isSelected && isPlaying && (
                      <div className="flex gap-0.5 items-end h-3">
                        <span className="w-0.5 h-3 bg-indigo-400 rounded animate-bounce shrink-0" style={{ animationDelay: '0.1s' }} />
                        <span className="w-0.5 h-2 bg-indigo-400 rounded animate-bounce shrink-0" style={{ animationDelay: '0.3s' }} />
                        <span className="w-0.5 h-3.5 bg-indigo-400 rounded animate-bounce shrink-0" style={{ animationDelay: '0s' }} />
                      </div>
                    )}
                    <span className="p-1 text-zinc-550 group-hover:text-zinc-300">
                      <Volume2 className="w-3.5 h-3.5 text-zinc-500 hover:text-indigo-400" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
