import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, Plus, 
  Image as ImageIcon, FileClock, Clipboard, Sliders, 
  Radio, Check, RefreshCw, AlertCircle, HelpCircle, FileText
} from 'lucide-react';
import { QueueItem, PlayerState, AppSettings } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface VoicePlayerProps {
  queue: QueueItem[];
  setQueue: (items: QueueItem[]) => void;
  playerState: PlayerState;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  settings: AppSettings;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function VoicePlayer({
  queue,
  setQueue,
  playerState,
  setPlayerState,
  settings,
  toast
}: VoicePlayerProps) {
  const t = TRANSLATIONS[settings.lang];
  const [inputText, setInputText] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Kore' | 'Puck' | 'Zephyr' | 'Fenrir'>('Kore');
  const [simulatedClipboardEnabled, setSimulatedClipboardEnabled] = useState(false);
  const [simClipboardText, setSimClipboardText] = useState('Critical system update complete. Reboot advised.');
  const [screenshotCountdown, setScreenshotCountdown] = useState(settings.screenshotInterval);
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);
  const [notebooklmResult, setNotebooklmResult] = useState<{ subtitles: string[]; summary: string } | null>(null);
  const [isConvertingNotebook, setIsConvertingNotebook] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Active audio URL is tracked locally for HTMLAudioElement
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  // Countdown timer for Scheduled Screen Capture
  useEffect(() => {
    if (!settings.scheduledScreenshot) return;
    
    const interval = setInterval(() => {
      setScreenshotCountdown((prev) => {
        if (prev <= 1) {
          triggerScheduledScreenshot();
          return settings.screenshotInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [settings.scheduledScreenshot, settings.screenshotInterval]);

  const triggerScheduledScreenshot = async () => {
    toast("Periodic screenshot analysis triggered", "info");
    await handleAnalyzeScreenshot(true); // automatically mock image details
  };

  // Synchronize HTML5 audio parameters when playing or speed/volume values change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playerState.speed;
      audioRef.current.volume = playerState.volume;
      if (playerState.isPlaying) {
        audioRef.current.play().catch(() => {
          // Normal safety check if browser prevents autoplay
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [playerState.isPlaying, playerState.speed, playerState.volume, audioBlobUrl]);

  // Translate / Synthesize the current active item's text to premium Speech
  const playActiveIndex = async (index: number) => {
    const item = queue.find(q => q.index === index);
    if (!item) return;

    // Set playing item active in player statistics
    setPlayerState({
      ...playerState,
      currentIndex: index,
      currentAudioFile: item.metadata?.fileName || `TTS_Record_${item.index}.wav`
    });

    toast(`${t.convertTTS}`, "info");
    setIsSynthesizing(true);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, voice: selectedVoice })
      });

      const data = await response.json();
      if (data.success && data.audio) {
        // Build base64 blob so index can actually trigger standard playing sound
        const base64Str = data.audio;
        const raw = window.atob(base64Str);
        const rawLength = raw.length;
        const array = new Uint8Array(new ArrayBuffer(rawLength));
        for (let i = 0; i < rawLength; i++) {
          array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([array], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        setAudioBlobUrl(url);

        // Increments play count
        const updatedQueue = queue.map(q => {
          if (q.index === index) {
            return { 
              ...q, 
              playCount: q.playCount + 1, 
              status: 'completed' as const,
              audioUrl: url
            };
          }
          return q;
        });
        setQueue(updatedQueue);
        
        // Sync statistics database
        await syncQueueWithServer(updatedQueue);

        setPlayerState({
          ...playerState,
          currentIndex: index,
          isPlaying: true,
          playCount: playerState.playCount + 1,
          currentAudioFile: item.metadata?.fileName || `TTS_${selectedVoice}_${item.index}.wav`
        });

        toast(t.convertSuccess, "success");
      } else {
        throw new Error(data.error || "No audio returned");
      }
    } catch (err) {
      console.warn("Server tts failed. Initiating client-side multi-language browser SpeechSynthesis fallback...", err);
      
      // Secondary layout safeguard: Client Native SpeechSynthesis speaks translated sentence!
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(item.text);
        if (settings.lang === 'zh') utterance.lang = 'zh-CN';
        else if (settings.lang === 'ja') utterance.lang = 'ja-JP';
        else utterance.lang = 'en-US';
        
        utterance.rate = playerState.speed;
        utterance.volume = playerState.volume;
        
        utterance.onend = () => {
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
        };
        
        window.speechSynthesis.speak(utterance);
        
        // Update local status representation
        const updatedQueue = queue.map(q => {
          if (q.index === index) {
            return { ...q, playCount: q.playCount + 1, status: 'completed' as const };
          }
          return q;
        });
        setQueue(updatedQueue);

        setPlayerState({
          ...playerState,
          currentIndex: index,
          isPlaying: true,
          playCount: playerState.playCount + 1,
          currentAudioFile: `SpeechSynthesis_Native_${item.index}`
        });
        toast("Fallback Speech completed inside browser successfully", "success");
      } else {
        toast("Failed to synthesize or speak audio", "error");
      }
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleTogglePlay = () => {
    if (queue.length === 0) {
      toast(t.noItemToPlay, "error");
      return;
    }
    
    // Find current index, default to first item if not set
    let idx = playerState.currentIndex;
    if (idx < 0 || !queue.some(q => q.index === idx)) {
      idx = queue[0].index;
    }

    if (playerState.isPlaying) {
      if ('speechSynthesis' in window) window.speechSynthesis.pause();
      setPlayerState({ ...playerState, isPlaying: false });
    } else {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlayerState({ ...playerState, isPlaying: true });
      } else {
        playActiveIndex(idx);
      }
    }
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    const sorted = [...queue].sort((a,b) => a.index - b.index);
    const currArrIndex = sorted.findIndex(q => q.index === playerState.currentIndex);
    
    if (currArrIndex >= 0 && currArrIndex < sorted.length - 1) {
      playActiveIndex(sorted[currArrIndex + 1].index);
    } else {
      playActiveIndex(sorted[0].index); // Loop back
    }
  };

  const handlePrev = () => {
    if (queue.length === 0) return;
    const sorted = [...queue].sort((a,b) => a.index - b.index);
    const currArrIndex = sorted.findIndex(q => q.index === playerState.currentIndex);
    
    if (currArrIndex > 0) {
      playActiveIndex(sorted[currArrIndex - 1].index);
    } else {
      playActiveIndex(sorted[sorted.length - 1].index); // Last
    }
  };

  const syncQueueWithServer = async (newQueue: QueueItem[]) => {
    try {
      await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newQueue })
      });
    } catch (e) {
      console.warn("Could not sync with local memory db:", e);
    }
  };

  // Text voice addition
  const handleAddText = () => {
    if (!inputText.trim()) return;

    const nextIndex = queue.length > 0 ? Math.max(...queue.map(q => q.index)) + 1 : 1;
    const newItem: QueueItem = {
      id: `item_${Date.now()}`,
      index: nextIndex,
      text: inputText.trim(),
      category: 'Voice',
      playCount: 0,
      created: new Date().toISOString(),
      status: 'pending'
    };

    const updated = [...queue, newItem];
    setQueue(updated);
    syncQueueWithServer(updated);
    setInputText('');
    toast(`Added voice item: #${nextIndex}`, "success");
  };

  // Mock Screenshot upload parsed via server-side Gemini
  const handleAnalyzeScreenshot = async (isAuto = false) => {
    setIsAnalyzingScreenshot(true);
    toast("Uploading frames to Gemini AI core parsing...", "info");

    try {
      // High fidelity canvas drawing to simulate actual container screenshot:
      // We will draw a stylish canvas screenshot frame representation to send to Gemini!
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0,0,640,360);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 20px monospace";
        ctx.fillText("DESKTOP MANAGER SYSTEM SCREEN", 40, 80);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px monospace";
        ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 40, 110);
        ctx.fillText("Active alerts in background. Check task schedule.", 40, 145);
        ctx.strokeStyle = "#334155";
        ctx.strokeRect(20,20,600,320);
      }
      
      const base64Img = canvas.toDataURL("image/png");

      const response = await fetch("/api/analyze-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Img })
      });

      const data = await response.json();
      if (data.success && data.tasks) {
        // Insert tasks into user queue
        let currentMax = queue.length > 0 ? Math.max(...queue.map(q => q.index)) : 0;
        const newItems: QueueItem[] = data.tasks.map((t: any, i: number) => ({
          id: `scr_${Date.now()}_${i}`,
          index: currentMax + i + 1,
          text: t.text || `Extracted screenshot task #${i+1}`,
          category: t.category || "Task",
          playCount: 0,
          created: new Date().toISOString(),
          status: 'pending'
        }));

        const updated = [...queue, ...newItems];
        setQueue(updated);
        syncQueueWithServer(updated);
        toast(`${t.ocrSuccess} (${newItems.length})`, "success");
      }
    } catch (e: any) {
      toast(`Screenshot extract failed: ${e.message}`, "error");
    } finally {
      setIsAnalyzingScreenshot(false);
    }
  };

  // Clipboard Simulator trigger
  const triggerSimulatedClipboard = () => {
    if (!simClipboardText.trim()) return;

    let currentMax = queue.length > 0 ? Math.max(...queue.map(q => q.index)) : 0;
    const item: QueueItem = {
      id: `clip_${Date.now()}`,
      index: currentMax + 1,
      text: simClipboardText,
      category: 'Task',
      playCount: 0,
      created: new Date().toISOString(),
      status: 'pending'
    };

    const updated = [...queue, item];
    setQueue(updated);
    syncQueueWithServer(updated);
    toast(t.clipboardTriggered, "success");
  };

  // NotebookLM converting audio flow
  const convertNotebookLM = async () => {
    setIsConvertingNotebook(true);
    toast("Connecting to NotebookLM cached database index...", "info");

    try {
      const response = await fetch("/api/convert-audio-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: "www/notebooklm/class_notes.wav" })
      });

      const data = await response.json();
      if (data.success) {
        setNotebooklmResult({
          subtitles: data.subtitles,
          summary: data.summary
        });

        // Add the subtitle lines to the Queue Manager
        let currentMax = queue.length > 0 ? Math.max(...queue.map(q => q.index)) : 0;
        const freshSubtitles: QueueItem[] = data.subtitles.map((sub: string, index: number) => ({
          id: `sub_${Date.now()}_${index}`,
          index: currentMax + index + 1,
          text: sub,
          category: 'Video',
          playCount: 0,
          created: new Date().toISOString(),
          status: 'pending',
          metadata: { fileName: "class_notes.wav", summary: data.summary }
        }));

        const updated = [...queue, ...freshSubtitles];
        setQueue(updated);
        syncQueueWithServer(updated);

        toast("NotebookLM audio successfully parsed and added to Queue!", "success");
      }
    } catch (err: any) {
      toast("Parsing failed", "error");
    } finally {
      setIsConvertingNotebook(false);
    }
  };

  // Fast visual categories mapping
  const activePlayItem = queue.find(q => q.index === playerState.currentIndex);

  return (
    <div id="voice_player" className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* LEFT COLUMN: THE CONTROLLER */}
      <div className="rounded-2xl p-6 bg-white/40 dark:bg-slate-900/40 border border-white/25 dark:border-slate-800/50 backdrop-blur-md flex flex-col justify-between glass-glow">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-semibold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                <Radio className="w-5 h-5 animate-pulse" />
              </span>
              {t.voicePlayer}
            </h3>
            <span className="text-xs font-mono px-2 py-1 rounded bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
              Live Core Sync
            </span>
          </div>

          {/* PLAYER MAIN PANEL */}
          <div className="rounded-xl p-5 bg-gradient-to-br from-slate-100/60 to-slate-200/60 dark:from-slate-800/60 dark:to-slate-900/60 border border-white/20 dark:border-slate-700/30 mb-5 relative overflow-hidden">
            <div className="relative z-10">
              {/* Media Status */}
              <div className="text-xs font-mono text-sky-600 dark:text-sky-400 tracking-wider mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {playerState.isPlaying ? 'SYSTEM_PLAYBACK_ON' : 'SYSTEM_PLAYBACK_IDLE'}
              </div>

              {/* Subtitle Display */}
              <div className="min-h-[70px] flex flex-col justify-center mb-4">
                <p className="text-sm font-sans font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                  {activePlayItem ? activePlayItem.text : `[${t.noSubtitle}]`}
                </p>
                {activePlayItem?.metadata?.summary && (
                  <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-2 italic">
                    Summary: {activePlayItem.metadata.summary}
                  </p>
                )}
              </div>

              {/* Timeline Indicator */}
              <div className="w-full bg-slate-300 dark:bg-slate-700 h-1 rounded-full overflow-hidden mb-5">
                <div 
                  className="bg-sky-500 h-full rounded-full transition-all duration-300"
                  style={{ width: playerState.isPlaying ? '100%' : '0%' }}
                />
              </div>

              {/* Controller Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handlePrev} 
                    className="p-2.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 transition"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleTogglePlay}
                    className="p-4 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 transition-all hover:scale-105 active:scale-95"
                    disabled={isSynthesizing}
                  >
                    {isSynthesizing ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : playerState.isPlaying ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current translate-x-0.5" />
                    )}
                  </button>
                  <button 
                    onClick={handleNext}
                    className="p-2.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 transition"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {/* Voice Selection */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Voice:</span>
                  <select 
                    value={selectedVoice} 
                    onChange={(e: any) => setSelectedVoice(e.target.value)}
                    className="text-xs font-medium rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="Kore">Kore (Neutral)</option>
                    <option value="Puck">Puck (Bold)</option>
                    <option value="Zephyr">Zephyr (Cheer)</option>
                    <option value="Fenrir">Fenrir (Deep)</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Ambient Background Wave effect */}
            {playerState.isPlaying && (
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-sky-500/10 dark:bg-sky-500/5 rounded-full filter blur-xl animate-float pointer-events-none" />
            )}
          </div>

          {/* AUDIO STATS */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl p-3 bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30">
              <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 block">
                {t.queueSize}
              </span>
              <span className="text-lg font-bold font-mono text-slate-800 dark:text-white block">
                {queue.length}
              </span>
            </div>
            <div className="rounded-xl p-3 bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30">
              <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 block">
                {t.playCount}
              </span>
              <span className="text-lg font-bold font-mono text-slate-800 dark:text-white block">
                {playerState.playCount}
              </span>
            </div>
            <div className="col-span-2 rounded-xl p-3 bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30">
              <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 block">
                {t.audioFile}
              </span>
              <span className="text-xs font-semibold font-mono text-sky-600 dark:text-slate-300 block truncate">
                {playerState.currentAudioFile || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* SLIDERS FOR SPEED / VOLUME */}
        <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
          {/* SPEED SLIDER */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1 text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-sans font-medium">
                <Sliders className="w-3.5 h-3.5" />
                {t.speed}
              </span>
              <span className="font-mono text-sky-500">{playerState.speed.toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1" 
              value={playerState.speed}
              onChange={(e) => setPlayerState({ ...playerState, speed: parseFloat(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>1.5x</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* VOLUME SLIDER */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1 text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-sans font-medium">
                <Volume2 className="w-3.5 h-3.5" />
                {t.volume}
              </span>
              <span className="font-mono text-sky-500">{Math.round(playerState.volume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.0" 
              max="1.0" 
              step="0.05" 
              value={playerState.volume}
              onChange={(e) => setPlayerState({ ...playerState, volume: parseFloat(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: SOURCES & AUTOMATION INTERFACES */}
      <div className="space-y-6">
        
        {/* ADD CONTENT CARD */}
        <div className="rounded-2xl p-6 bg-white/40 dark:bg-slate-900/40 border border-white/25 dark:border-slate-800/50 backdrop-blur-md glass-glow">
          <h4 className="font-sans font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-500" />
            {t.addText}
          </h4>

          {/* Enter voice text form */}
          <div className="space-y-3">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t.enterText}
              rows={3}
              className="w-full rounded-xl p-3 text-sm focus:outline-none bg-slate-100/50 dark:bg-slate-950/40 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500/50"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddText}
                disabled={!inputText.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition shadow-md shadow-sky-500/10 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addTextBtn}
              </button>
            </div>
          </div>

          {/* GALAXY FLOW DIALOG TRIGGERS */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
            {/* Screenshot upload trigger */}
            <button
              onClick={() => handleAnalyzeScreenshot(false)}
              disabled={isAnalyzingScreenshot}
              className="p-3.5 rounded-xl border border-slate-300/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-950/50 transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                {isAnalyzingScreenshot ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold block">{t.addImage}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Gemini Vision OCR</span>
              </div>
            </button>

            {/* NotebookLM converting trigger */}
            <button
              onClick={convertNotebookLM}
              disabled={isConvertingNotebook}
              className="p-3.5 rounded-xl border border-slate-300/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-950/50 transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                {isConvertingNotebook ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <FileClock className="w-5 h-5" />
                )}
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold block">NotebookLM Convert</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">File to Subs</span>
              </div>
            </button>
          </div>
        </div>

        {/* SYSTEM SCHEDULER & CLIPBOARD WRAPPERS */}
        <div className="rounded-2xl p-6 bg-white/40 dark:bg-slate-900/40 border border-white/25 dark:border-slate-800/50 backdrop-blur-md space-y-5 glass-glow">
          {/* Clipboard option */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 mt-0.5">
              <Clipboard className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t.monitorClipboard}
                  </h5>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.clipboardDesc}
                  </p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="sim-clipboard-toggle"
                    checked={simulatedClipboardEnabled}
                    onChange={(e) => {
                      setSimulatedClipboardEnabled(e.target.checked);
                      toast(`Clipboard listener ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
                    }}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
                </div>
              </div>

              {/* SIMULATED INPUT TO TEST CLIPBOARD */}
              {simulatedClipboardEnabled && (
                <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-300/40 dark:border-slate-800/40 p-2.5 rounded-xl space-y-2 relative">
                  <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 font-semibold uppercase">
                    Test Simulated System Clipboard change:
                  </span>
                  <input
                    type="text"
                    value={simClipboardText}
                    onChange={(e) => setSimClipboardText(e.target.value)}
                    className="w-full text-xs p-1.5 focus:outline-none rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-slate-800/60"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={triggerSimulatedClipboard}
                      className="text-[10px] font-semibold bg-purple-500 text-white px-2.5 py-1 rounded"
                    >
                      Trigger Change Event
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot option */}
          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 mt-0.5">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t.screenshotSec}
                  </h5>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.screenshotDesc}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-1.5 rounded">
                  {settings.scheduledScreenshot ? `${screenshotCountdown}s` : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {audioBlobUrl && (
        <audio 
          ref={audioRef}
          src={audioBlobUrl}
          onEnded={() => setPlayerState({ ...playerState, isPlaying: false })}
          className="hidden"
        />
      )}
    </div>
  );
}
