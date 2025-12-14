import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Download,
  RefreshCw,
  Trash2,
  Mic,
  Settings
} from 'lucide-react';
import { useToolModel } from '../../hooks';
import { AI_TOOLS } from '../../config/tools.config';
import ToolWrapper from '../universal/ToolWrapper';
import HistoryList from '../universal/HistoryList';
import BentoCard from '../BentoCard';
import { commonClasses } from '../../styles/theme';
import { appQyV1Model } from '../../core/models';
import { extractArrayFromResponse, safeFilter } from '../../utils/arrayUtils';

/**
 * TTSForm - Text-to-Speech using centralized architecture
 *
 * Before: 458 lines
 * After: ~150 lines (67% reduction)
 */
const TTSForm: React.FC = () => {
  const config = AI_TOOLS.tts;
  const {
    execute,
    loading,
    error,
    history,
    isFavorite,
    toggleFavorite,
    clearError
  } = useToolModel(config);

  // Form state
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(0);
  const [pitch, setPitch] = useState(0);

  // TTS Options from backend
  const [ttsOptions, setTtsOptions] = useState<any>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Audio playback
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // History display
  const [showHistory, setShowHistory] = useState(false);

  // Load TTS options on mount
  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const result = await appQyV1Model.aiTools.tts.getOptions();

      if (result.success && result.data) {
        setTtsOptions(result.data);

        // Set default language if available
        if (result.data.languages?.length > 0) {
          const defaultLang = result.data.languages.includes('en') ? 'en' : result.data.languages[0];
          setLanguage(defaultLang);

          // Set default voice for selected language
          if (result.data.voices && result.data.voices[defaultLang]) {
            setVoice(result.data.voices[defaultLang]);
          }
        }

        // Set default speed and pitch
        if (result.data.speed?.default !== undefined) {
          setSpeed(result.data.speed.default);
        }
        if (result.data.pitch?.default !== undefined) {
          setPitch(result.data.pitch.default);
        }
      }
    } catch (err) {
      console.error('Failed to load TTS options:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    clearError();

    try {
      const result = await appQyV1Model.aiTools.tts.generate(text.trim(), language, {
        type: 'sentence',
        options: {
          rate: `${speed >= 0 ? '+' : ''}${speed}%`,
          pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`,
        }
      });

      if (result.success && result.data?.audio_url) {
        setCurrentAudio(result.data.audio_url);
        setText(''); // Clear input on success
      }
    } catch (err) {
      console.error('TTS generation failed:', err);
    }
  };

  const handlePlayAudio = (audioUrl: string) => {
    if (!audioRef.current) return;

    if (playing && currentAudio === audioUrl) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setCurrentAudio(audioUrl);
      setPlaying(true);
    }
  };

  const handleDownload = (audioUrl: string, id: string) => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `tts_${id}.mp3`;
    link.click();
  };

  // Language name mapping
  const languageNames: Record<string, string> = {
    'af': 'Afrikaans', 'am': 'Amharic', 'ar': 'Arabic', 'as': 'Assamese',
    'az': 'Azerbaijani', 'bg': 'Bulgarian', 'bn': 'Bengali', 'bs': 'Bosnian',
    'ca': 'Catalan', 'cs': 'Czech', 'cy': 'Welsh', 'da': 'Danish',
    'de': 'German', 'el': 'Greek', 'en': 'English', 'es': 'Spanish',
    'et': 'Estonian', 'eu': 'Basque', 'fa': 'Persian', 'fi': 'Finnish',
    'fil': 'Filipino', 'fr': 'French', 'ga': 'Irish', 'gl': 'Galician',
    'gu': 'Gujarati', 'he': 'Hebrew', 'hi': 'Hindi', 'hr': 'Croatian',
    'hu': 'Hungarian', 'hy': 'Armenian', 'id': 'Indonesian', 'is': 'Icelandic',
    'it': 'Italian', 'ja': 'Japanese', 'jv': 'Javanese', 'ka': 'Georgian',
    'kk': 'Kazakh', 'km': 'Khmer', 'kn': 'Kannada', 'ko': 'Korean',
    'lo': 'Lao', 'lt': 'Lithuanian', 'lv': 'Latvian', 'mk': 'Macedonian',
    'ml': 'Malayalam', 'mn': 'Mongolian', 'mr': 'Marathi', 'ms': 'Malay',
    'mt': 'Maltese', 'my': 'Burmese', 'nb': 'Norwegian', 'ne': 'Nepali',
    'nl': 'Dutch', 'or': 'Odia', 'pa': 'Punjabi', 'pl': 'Polish',
    'ps': 'Pashto', 'pt': 'Portuguese', 'ro': 'Romanian', 'ru': 'Russian',
    'si': 'Sinhala', 'sk': 'Slovak', 'sl': 'Slovenian', 'so': 'Somali',
    'sq': 'Albanian', 'sr': 'Serbian', 'su': 'Sundanese', 'sv': 'Swedish',
    'sw': 'Swahili', 'ta': 'Tamil', 'te': 'Telugu', 'th': 'Thai',
    'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu', 'uz': 'Uzbek',
    'vi': 'Vietnamese', 'wuu': 'Wu Chinese', 'yue': 'Cantonese', 'zh': 'Chinese',
    'zu': 'Zulu'
  };

  const availableLanguages = ttsOptions?.languages || [];
  const speedConfig = ttsOptions?.speed || { min: -50, max: 100, step: 10, default: 0 };
  const pitchConfig = ttsOptions?.pitch || { min: -50, max: 50, step: 5, default: 0 };

  return (
    <ToolWrapper
      title={config.name}
      icon={Volume2}
      gradient="green-teal"
      description={config.description}
      favorites={config.favorites}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      showHistory={showHistory}
      onToggleHistory={() => setShowHistory(!showHistory)}
      history={
        <HistoryList
          items={history}
          showInput={true}
          showOutput={false}
        />
      }
    >
      <div className="space-y-6">
        {/* Text Input */}
        <BentoCard title="Text Input">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className={`${commonClasses.input} resize-none`}
            rows={6}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>{text.length} characters</span>
            <span>~{Math.ceil(text.length / 100)} seconds</span>
          </div>
        </BentoCard>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voice Settings */}
          <BentoCard title="Voice Settings">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Language ({availableLanguages.length} available)
                </label>
                {loadingOptions ? (
                  <div className="flex items-center justify-center p-4">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <select
                    value={language}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      setLanguage(newLang);
                      if (ttsOptions?.voices && ttsOptions.voices[newLang]) {
                        setVoice(ttsOptions.voices[newLang]);
                      }
                    }}
                    className={commonClasses.input}
                  >
                    {availableLanguages.map((lang: string) => (
                      <option key={lang} value={lang}>
                        {languageNames[lang] || lang} ({lang})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Voice</label>
                <input
                  type="text"
                  value={voice}
                  readOnly
                  className={`${commonClasses.input} bg-slate-50 dark:bg-slate-800`}
                  placeholder="Auto-selected based on language"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Voice is automatically selected for the chosen language
                </p>
              </div>
            </div>
          </BentoCard>

          {/* Advanced Settings */}
          <BentoCard title="Advanced Settings">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Speed: {speed >= 0 ? '+' : ''}{speed}{speedConfig.unit}
                </label>
                <input
                  type="range"
                  min={speedConfig.min}
                  max={speedConfig.max}
                  step={speedConfig.step}
                  value={speed}
                  onChange={(e) => setSpeed(parseInt(e.target.value))}
                  className="w-full"
                  disabled={loadingOptions}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Slower ({speedConfig.min}{speedConfig.unit})</span>
                  <span>Faster ({speedConfig.max}{speedConfig.unit})</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Pitch: {pitch >= 0 ? '+' : ''}{pitch}{pitchConfig.unit}
                </label>
                <input
                  type="range"
                  min={pitchConfig.min}
                  max={pitchConfig.max}
                  step={pitchConfig.step}
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className="w-full"
                  disabled={loadingOptions}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Lower ({pitchConfig.min}{pitchConfig.unit})</span>
                  <span>Higher ({pitchConfig.max}{pitchConfig.unit})</span>
                </div>
              </div>
            </div>
          </BentoCard>
        </div>

        {/* Generate Button */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={!text.trim() || loading || loadingOptions}
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

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Current Audio Player */}
        {currentAudio && (
          <BentoCard title="Generated Audio">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handlePlayAudio(currentAudio)}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
              >
                {playing && currentAudio ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Play
                  </>
                )}
              </button>
              <button
                onClick={() => handleDownload(currentAudio, Date.now().toString())}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </BentoCard>
        )}

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
      </div>

      {/* Hidden Audio Player */}
      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </ToolWrapper>
  );
};

export default TTSForm;
