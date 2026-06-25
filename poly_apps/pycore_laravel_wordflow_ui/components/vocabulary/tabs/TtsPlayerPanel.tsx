import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2
} from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { EmptyState } from '../../common';
import {
  TTSGenerateResponse,
  AsyncState
} from '../../../types';

interface TtsPlayerPanelProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  tts: AsyncState<TTSGenerateResponse>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  handlePlayPause: () => void;
  handleTimeUpdate: () => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatTime: (seconds: number) => string;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
}

/** Center panel of the Translate tab: the TTS audio player. */
const TtsPlayerPanel: React.FC<TtsPlayerPanelProps> = ({
  audioRef,
  tts,
  isPlaying,
  currentTime,
  duration,
  handlePlayPause,
  handleTimeUpdate,
  handleSeek,
  formatTime,
  setIsPlaying,
  setDuration,
}) => {
  return (
    <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
      <h3 className="font-semibold mb-4">Audio Player</h3>

      {tts.data ? (
        <>
          {/* Audio Element */}
          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration);
              }
            }}
            className="hidden"
          />

          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              disabled
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              disabled
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Audio Info */}
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <p>Duration: {tts.data.duration}s</p>
            <p>Format: {tts.data.format.toUpperCase()}</p>
            {tts.data.cache_hit && (
              <p className="text-emerald-600 dark:text-emerald-400">✓ Cached</p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Volume2}
          title="No audio generated"
          message="Translate text and click TTS button"
          className="flex-1"
        />
      )}
    </div>
  );
};

export default TtsPlayerPanel;
