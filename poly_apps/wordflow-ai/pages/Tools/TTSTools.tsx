import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';

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
    const audio = new Audio(audioUrl);
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
    a.href = audioUrl;
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Text-to-Speech Tools</h1>
              <p className="text-sm text-gray-500">Convert text to natural-sounding speech</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generator Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Generate Speech</h2>

            {/* Text Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text to Convert
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                className="w-full h-32 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <div className="mt-1 text-xs text-gray-500">
                {text.length} characters
              </div>
            </div>

            {/* Language Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Selection (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice (Optional)
              </label>
              <input
                type="text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="e.g., en-US-Standard-A"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Speed Control */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speed: {speed}x
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.5x (Slower)</span>
                <span>2.0x (Faster)</span>
              </div>
            </div>

            {/* Pitch Control */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pitch: {pitch}x
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.5x (Lower)</span>
                <span>2.0x (Higher)</span>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
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
            </button>
          </div>

          {/* History Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Generated Audio</h2>

            {generatedAudios.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-gray-600">No audio generated yet</p>
                <p className="text-sm text-gray-500 mt-2">Generate your first audio to see it here</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {generatedAudios.map((audio) => (
                  <div
                    key={audio.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 mr-3">
                        <p className="text-sm text-gray-900 line-clamp-2">{audio.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                            {audio.language.toUpperCase()}
                          </span>
                          {audio.voice && (
                            <span className="text-xs text-gray-500">{audio.voice}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(audio.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePlay(audio.audio_url, audio.id)}
                        disabled={currentlyPlaying === audio.id}
                        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                      >
                        {currentlyPlaying === audio.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
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
                      </button>
                      <button
                        onClick={() => handleDownload(audio.audio_url, audio.filename)}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(audio.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-green-900">
              <p className="font-semibold mb-1">TTS Features:</p>
              <ul className="space-y-1 text-green-800">
                <li>• Support for multiple languages and voices</li>
                <li>• Adjustable speech speed and pitch</li>
                <li>• High-quality natural-sounding audio</li>
                <li>• Download generated audio files</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
