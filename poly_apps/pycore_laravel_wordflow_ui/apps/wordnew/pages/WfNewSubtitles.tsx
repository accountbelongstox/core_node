import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, Volume2, Video, Star, Sparkles, Languages, Check, Info, 
  ArrowLeftRight, Repeat, ArrowRight, RotateCw, ListRestart, HelpCircle, FastForward
} from 'lucide-react';
import { ElementTheme, Word } from '../WfNewTypes';
import { wfNewApi, type SubtitleLine, type SubtitleCourse } from '../api';

// Safe placeholder while courses load (keeps every activeCourse read crash-free).
const EMPTY_COURSE: SubtitleCourse = { id: '', title: 'Loading…', category: '', subtitles: [] };

interface WfNewSubtitlesProps {
  activeTheme: ElementTheme;
  favorites: Word[];
  onToggleFavorite: (word: Word) => void;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
}

export const WfNewSubtitles: React.FC<WfNewSubtitlesProps> = ({
  activeTheme,
  favorites,
  onToggleFavorite,
  addToast
}) => {
  // Course Selector — courses loaded via the API gateway (mock or real).
  const [courses, setCourses] = useState<SubtitleCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  useEffect(() => {
    let alive = true;
    wfNewApi.getSubtitleCourses()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setCourses(list);
        if (list.length > 0) setSelectedCourseId((id) => id || list[0].id);
      })
      .catch(() => { /* leave empty on failure */ });
    return () => { alive = false; };
  }, []);
  const activeCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || courses[0] || EMPTY_COURSE;
  }, [selectedCourseId, courses]);

  // Video / Audio Play states
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLoopingSentence, setIsLoopingSentence] = useState<boolean>(false);
  const [showChineseSub, setShowChineseSub] = useState<boolean>(true);

  // Click-to-lookup word states
  const [selectedLookupWord, setSelectedLookupWord] = useState<{
    text: string;
    translation: string;
    definition: string;
    phonetic: string;
    tags?: string[];
  } | null>(null);

  // References
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subtitleContainerRef = useRef<HTMLDivElement | null>(null);

  // Total course duration in seconds
  const totalDuration = useMemo(() => {
    const lastSub = activeCourse.subtitles[activeCourse.subtitles.length - 1];
    return lastSub ? lastSub.endTime : 60;
  }, [activeCourse]);

  // Find currently active subtitle line based on currentTime
  const activeLineIndex = useMemo(() => {
    return activeCourse.subtitles.findIndex(
      line => currentTime >= line.startTime && currentTime <= line.endTime
    );
  }, [currentTime, activeCourse]);

  const activeLine = activeCourse.subtitles[activeLineIndex !== -1 ? activeLineIndex : 0];

  // Tick simulation loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          let nextTime = prev + 0.1 * playbackSpeed;
          
          // Loop current active sentence boundaries if checked
          if (isLoopingSentence && activeLine) {
            if (nextTime > activeLine.endTime) {
              return activeLine.startTime;
            }
          }

          if (nextTime >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return nextTime;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playbackSpeed, isLoopingSentence, activeLine, totalDuration]);

  // Sync scroll for the highlighted subtitles in track lists
  useEffect(() => {
    if (activeLineIndex !== -1 && subtitleContainerRef.current) {
      const activeElement = document.getElementById(`sub-line-${activeLineIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [activeLineIndex]);

  // Play audio voice lookup helper for English word
  const speakLookupWord = (wordText: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordText);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      addToast("SpeechSynthesis unavailable in sandbox environment", "warning");
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
  };

  // Convert seconds to readable mm:ss representation
  const formatTimeHelper = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Click on a specific subtitle word
  const handleWordLookupClick = (w: any) => {
    setSelectedLookupWord(w);
    speakLookupWord(w.text);
  };

  // Import looked up word directly into favorites
  const handleAddLookupToFavorites = () => {
    if (!selectedLookupWord) return;
    
    // Check if duplicate exists
    const duplicate = favorites.some(f => f.text.toLowerCase() === selectedLookupWord.text.toLowerCase());
    if (duplicate) {
      addToast(`"${selectedLookupWord.text}" already is favorited`, 'info');
      return;
    }

    const constructedWord: Word = {
      id: `fav-sub-${Date.now()}`,
      text: selectedLookupWord.text,
      phonetic: selectedLookupWord.phonetic || '/lookup/',
      translation: selectedLookupWord.translation,
      definition: selectedLookupWord.definition || 'Extracted via subtitles interactive learning.',
      example: 'Context phrase from subtitle class active file.',
      tags: selectedLookupWord.tags || ['Subtitle']
    };

    onToggleFavorite(constructedWord);
  };

  return (
    <div id="subtitles-panel-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-2">
      
      {/* LEFT PORTION: Simulated Video Player & Subtitle display */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Course video header option list */}
        <div className="flex justify-between items-center bg-slate-900/40 p-3.5 rounded-2xl border border-white/5 font-mono text-xs">
          <span className="text-zinc-400 font-bold">Select Subtitle Package:</span>
          <select 
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setCurrentTime(0);
              setIsPlaying(false);
              setSelectedLookupWord(null);
            }}
            className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-zinc-300 font-bold focus:outline-none"
          >
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        {/* CSS/Canvas Simulated High-end Futuristic Video Viewport */}
        <div className="aspect-video w-full rounded-3xl bg-zinc-950 border border-white/10 shadow-3xl relative overflow-hidden flex flex-col justify-between group">
          
          {/* Top Video overlay tag info */}
          <div className="p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-400 animate-pulse" />
              <div className="font-mono text-xs">
                <p className="text-slate-100 font-bold truncate max-w-sm">{activeCourse.title}</p>
                <p className="text-zinc-400 text-[10px] mt-0.5">{activeCourse.category}</p>
              </div>
            </div>
            <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              1080p FHD
            </span>
          </div>

          {/* Central Pulsing Particle waveform acting as beautiful simulator visualization */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex gap-1.5 items-end h-24">
              {Array.from({ length: 16 }).map((_, idx) => (
                <motion.div 
                  key={idx}
                  animate={{
                    height: isPlaying ? [12, 60, 20, 96, 12] : 20,
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5 + (idx % 4) * 0.2,
                    ease: "easeInOut"
                  }}
                  className={`w-1 rounded-full bg-gradient-to-t from-indigo-500 to-fuchsia-500 opacity-[0.25]`}
                />
              ))}
            </div>
            {/* Play pause central indicator when hovered */}
            <div className="absolute w-16 h-16 rounded-full bg-slate-900/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
            </div>
          </div>

          {/* Bottom Interactive subtitle layer inside video itself */}
          <div className="z-10 w-full space-y-4">
            
            {/* Interactive Sentence Text Overlay (En with split clickable words + Zh) */}
            <div className="px-6 py-4 bg-gradient-to-t from-black via-black/85 to-transparent text-center space-y-2">
              {activeLine ? (
                <>
                  {/* English clickable words line */}
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-xl mx-auto">
                    {activeLine.text.split(" ").map((rawWordText, wIdx) => {
                      // Filter symbols: keep text but clean punctuation for dictionary key
                      const stripped = rawWordText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
                      // Find if this specific word has mock translations loaded
                      const findWordDetail = activeLine.words.find(w => w.text.toLowerCase() === stripped.toLowerCase());
                      const isHighlighedLookup = selectedLookupWord?.text.toLowerCase() === stripped.toLowerCase();

                      return (
                        <button
                          key={wIdx}
                          onClick={() => {
                            if (findWordDetail) {
                              handleWordLookupClick(findWordDetail);
                            } else {
                              // basic lookup
                              const w = {
                                text: stripped,
                                translation: "Fuzzy dictionary tracking online...",
                                definition: "Standard dictionary definition map database query pending.",
                                phonetic: "/word/"
                              };
                              handleWordLookupClick(w);
                            }
                          }}
                          className={`px-1 rounded text-sm sm:text-base font-extrabold transition-all border outline-none ${
                            isHighlighedLookup
                              ? 'bg-fuchsia-500 text-white border-fuchsia-400 font-black shadow-lg scale-105'
                              : 'text-slate-100 hover:text-indigo-400 bg-black/10 border-transparent hover:border-indigo-500/20 hover:scale-105'
                          }`}
                        >
                          {rawWordText}
                        </button>
                      );
                    })}
                  </div>

                  {/* Chinese support translation line */}
                  {showChineseSub && (
                    <p className="text-xs sm:text-sm font-semibold text-indigo-300 select-none tracking-wide animate-pulse">
                      {activeLine.translation}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-500 font-mono">No subtitle track loaded for this millisecond</p>
              )}
            </div>

            {/* Video Controls bar (Always showing inside group hover or playing) */}
            <div className="px-5 py-3.5 bg-slate-950/90 border-t border-white/5 flex flex-col gap-2 pointer-events-auto">
              
              {/* Timeline seek slider bar */}
              <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
                <span>{formatTimeHelper(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={totalDuration}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg outline-none"
                />
                <span>{formatTimeHelper(totalDuration)}</span>
              </div>

              {/* Controls buttons row */}
              <div className="flex justify-between items-center pt-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white active:scale-95"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      setIsLoopingSentence(!isLoopingSentence);
                      addToast(isLoopingSentence ? "Sentence loop disabled" : "Looping current sentence bounds active", "info");
                    }}
                    className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 font-mono ${
                      isLoopingSentence
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                        : 'border-white/5 text-zinc-500'
                    }`}
                    title="Loop current sentence bounds"
                  >
                    <Repeat className="w-3.5 h-3.5 text-zinc-400" />
                    <span>L-Loop</span>
                  </button>

                  <button
                    onClick={() => setShowChineseSub(!showChineseSub)}
                    className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 font-mono ${
                      showChineseSub
                        ? 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10'
                        : 'border-white/5 text-zinc-500'
                    }`}
                    title="Toggle translation lines"
                  >
                    <Languages className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Tr-Zh</span>
                  </button>
                </div>

                <div className="flex items-center gap-3.5 font-mono text-[10px]">
                  {/* Speed Controls */}
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600">Speed:</span>
                    <div className="flex gap-1.5">
                      {[0.8, 1.0, 1.25].map(sp => (
                        <button
                          key={sp}
                          onClick={() => setPlaybackSpeed(sp)}
                          className={`px-1.5 py-0.5 rounded border text-[9px] ${
                            playbackSpeed === sp
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 font-bold'
                              : 'border-white/5 text-zinc-500 hover:text-white'
                          }`}
                        >
                          {sp}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* RIGHT PORTION: Dynamic Interactive dictionary translation lookups */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Lookup Card Widget details */}
        <div className="p-5 rounded-3xl bg-slate-900/40 border border-white/5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              Interactive Word Synapse Lookup
            </h3>
          </div>

          <AnimatePresence mode="wait">
            {selectedLookupWord ? (
              <motion.div
                key={selectedLookupWord.text}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                {/* Word name pronunciation line */}
                <div className="space-y-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-2xl font-black text-indigo-300 tracking-tight">{selectedLookupWord.text}</h4>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">{selectedLookupWord.phonetic}</p>
                    </div>
                    <button
                      onClick={() => speakLookupWord(selectedLookupWord.text)}
                      className="p-2 bg-indigo-500/10 rounded-full hover:bg-indigo-500/20 text-indigo-400"
                      title="Pronounce Word"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Translation translation */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-zinc-500 block">Translation</span>
                  <p className="text-sm font-bold text-slate-100">{selectedLookupWord.translation}</p>
                </div>

                {/* Definition details */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-zinc-500 block">En Definition</span>
                  <p className="text-xs text-zinc-400 leading-normal font-sans">{selectedLookupWord.definition}</p>
                </div>

                {/* Import tool Button */}
                <button
                  onClick={handleAddLookupToFavorites}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  <Star className="w-3.5 h-3.5 fill-white" /> Add to Sandbox Favorites
                </button>
              </motion.div>
            ) : (
              <div className="text-center py-20 px-4 space-y-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mx-auto text-zinc-500">
                  <Info className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-200">Awaiting Active Lookup</h4>
                  <p className="text-[11px] text-zinc-500 max-w-[200px] mx-auto leading-normal">
                    Click any highlighted word in the running subtitle track to query dictionary details.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtitle track sequence item scrolling navigator */}
        <div className="p-5 rounded-3xl bg-slate-900/40 border border-white/5 space-y-3 flex flex-col h-[280px]">
          <h4 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400">
            Subtitle Track Index List
          </h4>

          <div 
            ref={subtitleContainerRef}
            className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-2"
          >
            {activeCourse.subtitles.map((line, idx) => {
              const isCurrent = idx === activeLineIndex;
              return (
                <div
                  key={line.id}
                  id={`sub-line-${idx}`}
                  onClick={() => {
                    handleSeek(line.startTime);
                    setIsPlaying(true);
                  }}
                  className={`p-3 rounded-2xl text-left border cursor-pointer transition-all ${
                    isCurrent
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 font-bold scale-[1.01]'
                      : 'border-white/5 hover:border-white/10 hover:bg-white/5 bg-slate-950/10 text-zinc-400'
                  }`}
                >
                  <div className="flex justify-between items-center font-mono text-[9px] text-zinc-500 mb-1">
                    <span>INDEX {idx + 1}</span>
                    <span>{formatTimeHelper(line.startTime)}</span>
                  </div>
                  <p className={`text-xs truncate ${isCurrent ? 'text-indigo-200 font-extrabold' : 'text-slate-300'}`}>{line.text}</p>
                  {showChineseSub && (
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{line.translation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
