/* [v4.1-Iris] TTS Tools — ported from
 * poly_apps/qy_capacitor/pages/Tools/TTSTools.tsx. Self-contained: generates
 * speech via wordflowApi.ttsGenerate, with language pill nav, voice/speed/pitch
 * controls, and a generated-audio history (play / download / delete). Audio
 * URLs are repaired to the canonical /ai_tools/tts/audio route (original
 * TtsUrl.ts semantics). When the backend returns no audio URL it falls back to
 * the browser Web Speech API. react-router useNavigate for the back action; every
 * API call try/caught. Faithful Iris look. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Icons, PageHeader, EmptyState, Spinner, Badge, Button, IconButton } from '../WfUI';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { apiManager } from '../../../core/api-libs/wordflow/WordflowApiManager';

interface GeneratedAudio {
  id: string;
  text: string;
  audio_url: string; // empty string => Web Speech API fallback
  filename: string;
  language: string;
  voice?: string;
  speed: number;
  pitch: number;
  timestamp: number;
}

/**
 * Resolve a TTS audio URL to the canonical serving route (ported from the
 * original poly_apps/qy_capacitor/services/TtsUrl.ts). The backend may return
 * (or have persisted) legacy `audio_url` forms missing the `ai_tools` segment
 * or the route prefix entirely; the single correct serving route is
 *   {origin}/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}[/{speed}]/{filename}
 * Absolute URLs are trusted as-is. Every legacy form is collapsed to the
 * `{language}/{type}/.../{filename}` tail and recomposed with the canonical
 * prefix exactly once.
 */
const TTS_AUDIO_CANONICAL_PREFIX = '/api/app_qy_v1/ai_tools/tts/audio/';
const TTS_AUDIO_MARKER = 'tts/audio/';

function resolveAudioUrl(audioUrl: string): string {
  if (!audioUrl) return '';
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    return audioUrl;
  }
  const markerIndex = audioUrl.indexOf(TTS_AUDIO_MARKER);
  const rest = markerIndex >= 0
    ? audioUrl.slice(markerIndex + TTS_AUDIO_MARKER.length)
    : audioUrl.replace(/^\/+/, '');
  const serverRelativePath = `${TTS_AUDIO_CANONICAL_PREFIX}${rest}`;
  try {
    return `${apiManager.getCurrentBaseUrl()}${serverRelativePath}`;
  } catch {
    return serverRelativePath;
  }
}

const WfToolsTtsToolsPage: React.FC = () => {
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
  ];

  const handleGenerate = async () => {
    if (!text.trim()) {
      alert('Please enter text to generate audio');
      return;
    }
    setLoading(true);
    try {
      let audioUrl = '';
      let filename = `tts-${Date.now()}.mp3`;
      try {
        const data = await wordflowApi.ttsGenerate({
          text: text.trim(),
          language,
          voice: voice || undefined,
          speed,
          pitch,
        });
        // Live-verified: /ai_tools/tts/generate is queue-based now — it answers
        // { queued: true, task_id, status: 'pending', ... } with NO audio URL
        // (the audio materializes later via the TTS worker). Read every known
        // URL key defensively; when none is present we fall back to Web Speech.
        audioUrl = data?.audio_url || data?.url || data?.audio?.url || '';
        if (data?.filename) filename = data.filename;
      } catch (error) {
        // Backend unavailable — fall back to the browser Web Speech API below.
        console.error('[WfTts] Generation failed, using Web Speech fallback:', error);
      }

      const newAudio: GeneratedAudio = {
        id: Date.now().toString(),
        text: text.trim(),
        audio_url: audioUrl,
        filename,
        language,
        voice: voice || undefined,
        speed,
        pitch,
        timestamp: Date.now(),
      };
      setGeneratedAudios((prev) => [newAudio, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  /** Play via the browser speech synthesizer (fallback when no audio URL). */
  const speakViaWebSpeech = (audio: GeneratedAudio) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Speech synthesis is not supported in this browser');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(audio.text);
    utterance.lang = audio.language;
    utterance.rate = audio.speed;
    utterance.pitch = audio.pitch;
    setCurrentlyPlaying(audio.id);
    utterance.onend = () => setCurrentlyPlaying(null);
    utterance.onerror = () => setCurrentlyPlaying(null);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handlePlay = (audio: GeneratedAudio) => {
    if (!audio.audio_url) {
      speakViaWebSpeech(audio);
      return;
    }
    try {
      const el = new Audio(resolveAudioUrl(audio.audio_url));
      setCurrentlyPlaying(audio.id);
      el.onended = () => setCurrentlyPlaying(null);
      el.onerror = () => {
        // Server audio failed — try the Web Speech fallback before giving up.
        speakViaWebSpeech(audio);
      };
      el.play().catch(() => speakViaWebSpeech(audio));
    } catch {
      speakViaWebSpeech(audio);
    }
  };

  const handleDownload = (audio: GeneratedAudio) => {
    if (!audio.audio_url) {
      alert('This clip was generated locally and has no downloadable file');
      return;
    }
    const a = document.createElement('a');
    a.href = resolveAudioUrl(audio.audio_url);
    a.download = audio.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = (id: string) => {
    setGeneratedAudios((prev) => prev.filter((audio) => audio.id !== id));
  };

  return (
    <div className="route-fade min-h-screen bg-transparent pb-32">
      <PageHeader title="Text-to-Speech Tools" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">Convert text to natural-sounding speech</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-lg)]">
          {/* Generator panel */}
          <Card>
            <h2 className="ds-section-title mb-4">Generate Speech</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Text to Convert</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                className="w-full h-32 px-4 py-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none"
              />
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">{text.length} characters</div>
            </div>

            {/* Language pill nav */}
            <div className="mb-4">
              <label className="ds-section-label block mb-2">Language</label>
              <div className="ds-pill-nav" role="tablist" aria-label="Language">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    role="tab"
                    aria-selected={language === l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`ds-pill-chip ${language === l.code ? 'is-active' : ''}`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Voice (Optional)</label>
              <input
                type="text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="e.g., en-US-Standard-A"
                className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Speed: {speed}x</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-[var(--klein-blue)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1">
                <span>0.5x (Slower)</span>
                <span>2.0x (Faster)</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Pitch: {pitch}x</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-[var(--klein-blue)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1">
                <span>0.5x (Lower)</span>
                <span>2.0x (Higher)</span>
              </div>
            </div>

            <Button variant="grad" onClick={handleGenerate} disabled={loading || !text.trim()}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Generate Audio
                </span>
              )}
            </Button>
          </Card>

          {/* History panel */}
          <Card>
            <h2 className="ds-section-title mb-4">Generated Audio</h2>

            {generatedAudios.length === 0 ? (
              <EmptyState
                icon={<Icons.Sound />}
                title="No audio generated yet"
                description="Generate your first audio to see it here"
              />
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {generatedAudios.map((audio) => (
                  <div key={audio.id} className="ds-row p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 mr-3">
                        <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">{audio.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge tone="klein">{audio.language.toUpperCase()}</Badge>
                          {audio.voice && <span className="text-xs text-[var(--color-text-tertiary)]">{audio.voice}</span>}
                          {!audio.audio_url && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">Browser voice</span>
                          )}
                        </div>
                      </div>
                      <IconButton
                        label="Delete audio"
                        onClick={() => handleDelete(audio.id)}
                        className="!text-red-500 hover:!bg-red-500/10"
                        icon={
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        }
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="klein"
                        onClick={() => handlePlay(audio)}
                        disabled={currentlyPlaying === audio.id}
                        className="flex-1 !py-2 px-3 text-sm"
                      >
                        {currentlyPlaying === audio.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <Spinner size="sm" />
                            Playing
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Play
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleDownload(audio)}
                        className="!w-auto !py-2 px-3 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </Button>
                    </div>

                    <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                      {new Date(audio.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Info box */}
        <Card>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[var(--klein-blue)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-[var(--color-text-secondary)]">
              <p className="font-semibold mb-1 text-[var(--color-text-primary)]">TTS Features:</p>
              <ul className="space-y-1">
                <li>• Support for multiple languages and voices</li>
                <li>• Adjustable speech speed and pitch</li>
                <li>• High-quality natural-sounding audio</li>
                <li>• Falls back to the browser voice when offline</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WfToolsTtsToolsPage;
