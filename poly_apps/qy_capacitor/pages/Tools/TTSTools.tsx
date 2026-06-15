/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';
import { resolveAudioUrl } from '../../services/TtsUrl';
import { Card, Icons, PageHeader, EmptyState, Spinner, Badge, Button, IconButton } from '../../components/UI';
import { PillNav } from '../../components/PillNav';

interface GeneratedAudio {
  id: string;
  text: string;
  audio_url: string;
  filename: string;
  language: string;
  voice?: string;
  timestamp: number;
}

export default function TTSTools() {
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

  // Generate audio
  const handleGenerate = async () => {
    if (!text.trim()) {
      alert('Please enter text to generate audio');
      return;
    }

    setLoading(true);

    try {
      const result = await ApiCenter.tts.generate({
        text: text.trim(),
        language,
        voice: voice || undefined,
        speed,
        pitch,
      });

      if (result.success && result.data) {
        const newAudio: GeneratedAudio = {
          id: Date.now().toString(),
          text: text.trim(),
          audio_url: result.data.audio_url,
          filename: result.data.filename,
          language,
          voice: voice || undefined,
          timestamp: Date.now(),
        };

        setGeneratedAudios([newAudio, ...generatedAudios]);
        alert('Audio generated successfully!');
      } else {
        alert(result.error?.message || 'Failed to generate audio');
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate audio');
    } finally {
      setLoading(false);
    }
  };

  // Play audio
  const handlePlay = (audioUrl: string, id: string) => {
    const audio = new Audio(resolveAudioUrl(audioUrl));
    audio.play();
    setCurrentlyPlaying(id);

    audio.onended = () => {
      setCurrentlyPlaying(null);
    };

    audio.onerror = () => {
      alert('Failed to play audio');
      setCurrentlyPlaying(null);
    };
  };

  // Download audio
  const handleDownload = (audioUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = resolveAudioUrl(audioUrl);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Delete audio
  const handleDelete = (id: string) => {
    setGeneratedAudios(generatedAudios.filter(audio => audio.id !== id));
  };

  return (
    <div className="min-h-screen bg-transparent pb-32">
      <PageHeader title="Text-to-Speech Tools" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">Convert text to natural-sounding speech</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-lg)]">
          {/* Generator Panel */}
          <Card>
            <h2 className="ds-section-title mb-4">Generate Speech</h2>

            {/* Text Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Text to Convert
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                className="w-full h-32 px-4 py-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none"
              />
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {text.length} characters
              </div>
            </div>

            {/* Language Selection — pill nav */}
            <div className="mb-4">
              <label className="ds-section-label block mb-2">Language</label>
              <PillNav
                items={languages.map((l) => ({ id: l.code, label: l.name }))}
                activeId={language}
                onChange={setLanguage}
                aria-label="Language"
              />
            </div>

            {/* Voice Selection (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Voice (Optional)
              </label>
              <input
                type="text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="e.g., en-US-Standard-A"
                className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
              />
            </div>

            {/* Speed Control */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Speed: {speed}x
              </label>
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

            {/* Pitch Control */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Pitch: {pitch}x
              </label>
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

            {/* Generate Button */}
            <Button
              variant="grad"
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
            >
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

          {/* History Panel */}
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
                  <div
                    key={audio.id}
                    className="ds-row p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 mr-3">
                        <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">{audio.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge tone="klein">{audio.language.toUpperCase()}</Badge>
                          {audio.voice && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">{audio.voice}</span>
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
                        onClick={() => handlePlay(audio.audio_url, audio.id)}
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
                        onClick={() => handleDownload(audio.audio_url, audio.filename)}
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

        {/* Info Box */}
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
                <li>• Download generated audio files</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
