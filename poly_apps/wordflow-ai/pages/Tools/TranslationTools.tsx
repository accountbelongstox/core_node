import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';

export default function TranslationTools() {
  const navigate = useNavigate();

  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [fromLanguage, setFromLanguage] = useState('en');
  const [toLanguage, setToLanguage] = useState('zh');
  const [loading, setLoading] = useState(false);
  const [translationMode, setTranslationMode] = useState<'standard' | 'google' | 'learning'>('standard');

  // Available languages (these would come from API in real app)
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
  ];

  // Standard translation
  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      alert('Please enter text to translate');
      return;
    }

    setLoading(true);
    setTranslatedText('');

    try {
      const result = await ApiCenter.translation.translate({
        text: sourceText,
        from_language: fromLanguage,
        to_language: toLanguage,
      });

      if (result.success && result.data) {
        setTranslatedText(result.data.translation || 'Translation completed');
      } else {
        alert(result.error?.message || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation failed:', error);
      alert('Translation failed');
    } finally {
      setLoading(false);
    }
  };

  // Google translation (simple and fast)
  const handleGoogleTranslate = async () => {
    if (!sourceText.trim()) {
      alert('Please enter text to translate');
      return;
    }

    setLoading(true);
    setTranslatedText('');

    try {
      const result = await ApiCenter.translation.simpleTranslateWithGoogle({
        text: sourceText,
        from_language: fromLanguage,
        to_language: toLanguage,
      });

      if (result.success && result.data) {
        setTranslatedText(result.data.translation || 'Translation completed');
      } else {
        alert(result.error?.message || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation failed:', error);
      alert('Translation failed');
    } finally {
      setLoading(false);
    }
  };

  // Learning mode translation (with explanations)
  const handleLearningTranslate = async () => {
    if (!sourceText.trim()) {
      alert('Please enter text to translate');
      return;
    }

    setLoading(true);
    setTranslatedText('');

    try {
      const result = await ApiCenter.translation.learningMode({
        text: sourceText,
        from_language: fromLanguage,
        to_language: toLanguage,
        difficulty_level: 'intermediate',
      });

      if (result.success && result.data) {
        // Format learning mode response (might include explanations, grammar notes, etc.)
        const formatted = JSON.stringify(result.data, null, 2);
        setTranslatedText(formatted);
      } else {
        alert(result.error?.message || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation failed:', error);
      alert('Translation failed');
    } finally {
      setLoading(false);
    }
  };

  // Execute translation based on selected mode
  const executeTranslation = () => {
    switch (translationMode) {
      case 'google':
        handleGoogleTranslate();
        break;
      case 'learning':
        handleLearningTranslate();
        break;
      default:
        handleTranslate();
    }
  };

  // Swap languages
  const handleSwapLanguages = () => {
    setFromLanguage(toLanguage);
    setToLanguage(fromLanguage);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="w-full sm:max-w-2xl sm:mx-auto md:max-w-4xl lg:max-w-6xl px-4 py-4">
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
              <h1 className="text-xl font-bold text-gray-900">Translation Tools</h1>
              <p className="text-sm text-gray-500">AI-powered translation with multiple modes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full sm:max-w-2xl sm:mx-auto md:max-w-4xl lg:max-w-6xl px-4 py-6">
        {/* Translation Mode Selection */}
        <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Translation Mode:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setTranslationMode('standard')}
              className={`p-4 rounded-lg border-2 transition-all ${
                translationMode === 'standard'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900 mb-1">Standard</div>
              <div className="text-xs text-gray-600">High-quality AI translation</div>
            </button>

            <button
              onClick={() => setTranslationMode('google')}
              className={`p-4 rounded-lg border-2 transition-all ${
                translationMode === 'google'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900 mb-1">Quick (Google)</div>
              <div className="text-xs text-gray-600">Fast and simple translation</div>
            </button>

            <button
              onClick={() => setTranslationMode('learning')}
              className={`p-4 rounded-lg border-2 transition-all ${
                translationMode === 'learning'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900 mb-1">Learning Mode</div>
              <div className="text-xs text-gray-600">With explanations & notes</div>
            </button>
          </div>
        </div>

        {/* Language Selection */}
        <div className="mb-6 bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <select
                value={fromLanguage}
                onChange={(e) => setFromLanguage(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSwapLanguages}
              className="mt-7 p-3 hover:bg-gray-100 rounded-lg transition-colors"
              title="Swap languages"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <select
                value={toLanguage}
                onChange={(e) => setToLanguage(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Translation Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Text */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Source Text</h3>
              <button
                onClick={() => setSourceText('')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              className="w-full h-64 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {sourceText.length} characters
              </span>
              <button
                onClick={() => handleCopy(sourceText)}
                disabled={!sourceText}
                className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Translated Text */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Translation</h3>
              <button
                onClick={() => setTranslatedText('')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="w-full h-64 px-4 py-3 border rounded-lg bg-gray-50 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-600">Translating...</p>
                  </div>
                </div>
              ) : translatedText ? (
                <pre className="whitespace-pre-wrap text-gray-900 font-sans">
                  {translatedText}
                </pre>
              ) : (
                <p className="text-gray-400">Translation will appear here...</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {translatedText.length} characters
              </span>
              <button
                onClick={() => handleCopy(translatedText)}
                disabled={!translatedText}
                className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Translate Button */}
        <div className="mt-6 text-center">
          <button
            onClick={executeTranslation}
            disabled={loading || !sourceText.trim()}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-semibold shadow-lg"
          >
            {loading ? 'Translating...' : 'Translate'}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Translation Modes:</p>
              <ul className="space-y-1 text-blue-800">
                <li>• <strong>Standard:</strong> High-quality AI translation with context awareness</li>
                <li>• <strong>Quick (Google):</strong> Fast translation using Google Translate</li>
                <li>• <strong>Learning Mode:</strong> Includes grammar notes, vocabulary explanations, and learning tips</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
