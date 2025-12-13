import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Download,
  RefreshCw,
  Trash2,
  Plus,
  Check,
  Mic,
  Settings,
  List as ListIcon
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';

interface TTSPanelProps {
  onGenerateComplete?: (result: any) => void;
}

interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  accent?: string;
}

interface QueueItem {
  id: string;
  text: string;
  voice: string;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  audioUrl?: string;
  timestamp: number;
}

const TTSPanel: React.FC<TTSPanelProps> = ({ onGenerateComplete }) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadVoices();
    loadQueue();
  }, []);

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const response = await apiService.getVoices();
      if (response.success && response.data) {
        setVoices(response.data);
        if (response.data.length > 0) {
          setSelectedVoice(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      // Fallback voices if API fails
      const fallbackVoices: Voice[] = [
        { id: 'en-US-standard', name: 'US English (Standard)', language: 'en', gender: 'neutral' },
        { id: 'en-GB-standard', name: 'British English', language: 'en', gender: 'neutral' },
        { id: 'zh-CN-standard', name: 'Chinese (Mandarin)', language: 'zh', gender: 'neutral' },
        { id: 'ja-JP-standard', name: 'Japanese', language: 'ja', gender: 'neutral' },
        { id: 'es-ES-standard', name: 'Spanish', language: 'es', gender: 'neutral' }
      ];
      setVoices(fallbackVoices);
      setSelectedVoice(fallbackVoices[0].id);
    } finally {
      setLoadingVoices(false);
    }
  };

  const loadQueue = () => {
    const saved = localStorage.getItem('tts_queue');
    if (saved) {
      try {
        setQueue(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load queue:', error);
      }
    }
  };

  const saveQueue = (newQueue: QueueItem[]) => {
    localStorage.setItem('tts_queue', JSON.stringify(newQueue));
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    const newItem: QueueItem = {
      id: Date.now().toString(),
      text: text.trim(),
      voice: selectedVoice,
      language: selectedLanguage,
      status: 'processing',
      timestamp: Date.now()
    };

    const newQueue = [newItem, ...queue];
    setQueue(newQueue);
    saveQueue(newQueue);

    setLoading(true);

    try {
      const response = await apiService.generateTTS({
        text: text.trim(),
        language: selectedLanguage,
        voice_type: selectedVoice,
        speed,
        pitch
      });

      if (response.success && response.data) {
        const audioUrl = response.data.audio_url || response.data.url;

        const updatedQueue = newQueue.map(item =>
          item.id === newItem.id
            ? { ...item, status: 'completed' as const, audioUrl }
            : item
        );
        setQueue(updatedQueue);
        saveQueue(updatedQueue);

        onGenerateComplete?.(response.data);
        setText('');
      } else {
        throw new Error('Generation failed');
      }
    } catch (error) {
      console.error('TTS generation failed:', error);
      const updatedQueue = newQueue.map(item =>
        item.id === newItem.id
          ? { ...item, status: 'failed' as const }
          : item
      );
      setQueue(updatedQueue);
      saveQueue(updatedQueue);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (item: QueueItem) => {
    if (!item.audioUrl) return;

    if (currentlyPlaying === item.id) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = item.audioUrl;
        audioRef.current.play();
        setCurrentlyPlaying(item.id);
      }
    }
  };

  const handleDownload = async (item: QueueItem) => {
    if (!item.audioUrl) return;

    const link = document.createElement('a');
    link.href = item.audioUrl;
    link.download = `tts_${item.id}.mp3`;
    link.click();
  };

  const handleDeleteFromQueue = (id: string) => {
    const newQueue = queue.filter(item => item.id !== id);
    setQueue(newQueue);
    saveQueue(newQueue);
    if (currentlyPlaying === id) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    }
  };

  const handleClearQueue = () => {
    setQueue([]);
    localStorage.removeItem('tts_queue');
    audioRef.current?.pause();
    setCurrentlyPlaying(null);
  };

  const filteredVoices = voices.filter(v => v.language === selectedLanguage);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
            <Volume2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Text-to-Speech (TTS)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Convert text to natural-sounding speech
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowQueue(!showQueue)}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
        >
          <ListIcon className="w-4 h-4" />
          Queue ({queue.length})
        </button>
      </div>

      {/* Queue Panel */}
      {showQueue && (
        <BentoCard title="Generation Queue">
          <div className="space-y-2">
            {queue.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No items in queue</p>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleClearQueue}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.text}</p>
                      <p className="text-xs text-slate-500">
                        {voices.find(v => v.id === item.voice)?.name || item.voice} • {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'processing' && (
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                      {item.status === 'completed' && item.audioUrl && (
                        <>
                          <button
                            onClick={() => handlePlay(item)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                          >
                            {currentlyPlaying === item.id ? (
                              <Pause className="w-4 h-4 text-green-600" />
                            ) : (
                              <Play className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDownload(item)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                          >
                            <Download className="w-4 h-4 text-blue-600" />
                          </button>
                        </>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-xs text-red-600">Failed</span>
                      )}
                      <button
                        onClick={() => handleDeleteFromQueue(item.id)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </BentoCard>
      )}

      {/* Text Input */}
      <BentoCard title="Text Input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          className={`${commonClasses.textarea} h-32 resize-none`}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">
            {text.length} characters
          </span>
          <span className="text-xs text-slate-500">
            ~{Math.ceil(text.length / 100)} seconds
          </span>
        </div>
      </BentoCard>

      {/* Voice Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BentoCard title="Voice Settings">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  const voicesForLang = voices.filter(v => v.language === e.target.value);
                  if (voicesForLang.length > 0) {
                    setSelectedVoice(voicesForLang[0].id);
                  }
                }}
                className={commonClasses.select}
              >
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Voice ({filteredVoices.length} available)
              </label>
              {loadingVoices ? (
                <div className="flex items-center justify-center p-4">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : (
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className={commonClasses.select}
                >
                  {filteredVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.gender ? `(${voice.gender})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </BentoCard>

        <BentoCard title="Advanced Settings">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Speed: {speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Slower</span>
                <span>Faster</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Pitch: {pitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Lower</span>
                <span>Higher</span>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={!text.trim() || loading || loadingVoices}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 flex items-center gap-2`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              Generate Speech
            </>
          )}
        </button>
      </div>

      {/* Tips */}
      <BentoCard title="Tips" className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20">
        <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <Mic className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
            <span>Different voices have different characteristics - try them out!</span>
          </li>
          <li className="flex items-start gap-2">
            <Settings className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
            <span>Adjust speed and pitch to customize the voice output</span>
          </li>
          <li className="flex items-start gap-2">
            <Download className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
            <span>Download generated audio files for offline use</span>
          </li>
        </ul>
      </BentoCard>

      {/* Hidden Audio Player */}
      <audio
        ref={audioRef}
        onEnded={() => setCurrentlyPlaying(null)}
        className="hidden"
      />
    </div>
  );
};

export default TTSPanel;
