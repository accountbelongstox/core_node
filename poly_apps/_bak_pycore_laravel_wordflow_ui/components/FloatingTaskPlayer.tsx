
import React, { useState, useEffect, useRef } from 'react';
import { TaskItem, AudioSegment } from '../types';
import { X, Play, Pause, SkipForward, SkipBack, RefreshCw, GripHorizontal } from "lucide-react";
import ReactDOM from 'react-dom';

interface FloatingTaskPlayerProps {
  task: TaskItem;
  onClose: () => void;
  initialPos?: { x: number; y: number };
  zIndex: number;
  onFocus: () => void;
}

const FloatingTaskPlayer: React.FC<FloatingTaskPlayerProps> = ({ task, onClose, initialPos = { x: 100, y: 100 }, zIndex, onFocus }) => {
  const [position, setPosition] = useState(initialPos);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Playback State
  const [currentSegIdx, setCurrentSegIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [progress, setProgress] = useState(0); // 0 to 100

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dragging Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    onFocus();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Audio Simulation Logic
  useEffect(() => {
    if (isPlaying) {
      // Guard Clause: Check if segment exists
      const segment = task.audioSegments[currentSegIdx];
      if (!segment) {
        setIsPlaying(false);
        setProgress(0);
        return;
      }

      const durationMs = (segment.duration || 1) * 1000;
      const intervalMs = 50;
      const step = 100 / (durationMs / intervalMs);

      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
             // Finished Segment
             if (currentSegIdx < task.audioSegments.length - 1 && autoPlay) {
               setCurrentSegIdx(c => c + 1);
               return 0;
             } else {
               setIsPlaying(false);
               return 100;
             }
          }
          return prev + step;
        });
      }, intervalMs);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, currentSegIdx, task.audioSegments, autoPlay]);

  // Reset progress when segment changes manually
  const changeSegment = (idx: number) => {
    if (idx >= 0 && idx < task.audioSegments.length) {
        setCurrentSegIdx(idx);
        setProgress(0);
        setIsPlaying(true);
    }
  };

  const togglePlay = () => {
      if (task.audioSegments.length > 0) {
          setIsPlaying(!isPlaying);
      }
  };

  return ReactDOM.createPortal(
    <div 
      className="fixed flex flex-col w-[800px] h-[500px] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl bg-slate-900/90 border border-white/10 transition-shadow duration-200"
      style={{ 
        left: position.x, 
        top: position.y,
        zIndex: zIndex,
        boxShadow: isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}
      onMouseDown={onFocus}
    >
      {/* Header / Drag Handle */}
      <div 
        className="h-12 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-white/10 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
         <div className="flex items-center gap-2 text-slate-300">
            <GripHorizontal size={18} className="opacity-50" />
            <span className="font-mono text-sm font-bold truncate max-w-[400px]">{task.title}</span>
         </div>
         <div className="flex items-center gap-2">
             <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                 <X size={16} />
             </button>
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
         {/* Left: Prompt Text */}
         <div className="w-1/2 border-r border-white/10 p-6 overflow-y-auto bg-slate-950/30">
            <h3 className="text-xs uppercase text-slate-500 font-bold mb-4 tracking-wider">Prompt Information</h3>
            <p className="text-slate-300 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                {task.promptText || "No prompt text available."}
            </p>
         </div>

         {/* Right: Audio Playlist */}
         <div className="w-1/2 flex flex-col bg-slate-900/50">
             {/* Playlist Items */}
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {task.audioSegments.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                         <p>No Audio Segments</p>
                     </div>
                 ) : (
                     task.audioSegments.map((seg, idx) => {
                       const isActive = idx === currentSegIdx;
                       return (
                         <div 
                            key={seg.id}
                            onClick={() => changeSegment(idx)}
                            className={`
                                p-3 rounded-lg cursor-pointer transition-all border
                                ${isActive 
                                    ? 'bg-indigo-600/20 border-indigo-500/50 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]' 
                                    : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}
                            `}
                         >
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 text-xs font-mono ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
                                    {String(idx + 1).padStart(2, '0')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate mb-1 ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>
                                        {seg.text}
                                    </p>
                                    {isActive && (
                                        <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs text-slate-600 font-mono">{seg.duration}s</span>
                            </div>
                         </div>
                       );
                     })
                 )}
             </div>

             {/* Player Controls */}
             <div className="h-20 bg-black/40 border-t border-white/10 flex items-center justify-between px-6 backdrop-blur-sm">
                 <div className="flex items-center gap-4">
                     <button 
                        className={`p-2 rounded-full hover:bg-white/10 transition-colors ${!autoPlay ? 'text-slate-500' : 'text-emerald-400'}`}
                        onClick={() => setAutoPlay(!autoPlay)}
                        title="Toggle Auto-play"
                     >
                         <RefreshCw size={16} className={autoPlay ? "" : "opacity-50"} />
                     </button>
                 </div>

                 <div className="flex items-center gap-6">
                     <button 
                        className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => changeSegment(Math.max(0, currentSegIdx - 1))}
                        disabled={currentSegIdx === 0 || task.audioSegments.length === 0}
                     >
                         <SkipBack size={20} />
                     </button>
                     
                     <button 
                        className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={togglePlay}
                        disabled={task.audioSegments.length === 0}
                     >
                         {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                     </button>

                     <button 
                        className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => changeSegment(Math.min(task.audioSegments.length - 1, currentSegIdx + 1))}
                        disabled={currentSegIdx >= task.audioSegments.length - 1 || task.audioSegments.length === 0}
                     >
                         <SkipForward size={20} />
                     </button>
                 </div>

                 <div className="w-10"></div> {/* Spacer for symmetry */}
             </div>
         </div>
      </div>
    </div>,
    document.body
  );
};

export default FloatingTaskPlayer;
