/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';
import { Card, Spinner, PageHeader, Button, IconButton } from '../../components/UI';
import { PillNav } from '../../components/PillNav';

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
        target_language: toLanguage,
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
        target_language: toLanguage,
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
        target_languages: [toLanguage],
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

  const modeDescriptions: Record<string, string> = {
    standard: 'High-quality AI translation',
    google: 'Fast and simple translation',
    learning: 'With explanations & notes',
  };

  return (
    <div className="min-h-screen bg-transparent pb-32">
      <PageHeader title="Translation Tools" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">AI-powered translation with multiple modes</p>
        </div>

        {/* Translation Mode — pill nav */}
        <Card>
          <p className="ds-section-title mb-3">Translation Mode</p>
          <PillNav
            items={[
              { id: 'standard', label: 'Standard' },
              { id: 'google', label: 'Quick (Google)' },
              { id: 'learning', label: 'Learning Mode' },
            ]}
            activeId={translationMode}
            onChange={(id) => setTranslationMode(id as 'standard' | 'google' | 'learning')}
            aria-label="Translation mode"
          />
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
            {modeDescriptions[translationMode]}
          </p>
        </Card>

        {/* Language Selection — pill nav */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <label className="ds-section-label block mb-2">From</label>
              <PillNav
                items={languages.map((l) => ({ id: l.code, label: l.name }))}
                activeId={fromLanguage}
                onChange={setFromLanguage}
                aria-label="From language"
              />
            </div>

            <div className="mt-6 flex-shrink-0">
              <IconButton
                label="Swap languages"
                onClick={handleSwapLanguages}
                active
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                }
              />
            </div>

            <div className="flex-1 min-w-0">
              <label className="ds-section-label block mb-2">To</label>
              <PillNav
                items={languages.map((l) => ({ id: l.code, label: l.name }))}
                activeId={toLanguage}
                onChange={setToLanguage}
                aria-label="To language"
              />
            </div>
          </div>
        </Card>

        {/* Translation Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-lg)]">
          {/* Source Text */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Source Text</h3>
              <button
                onClick={() => setSourceText('')}
                className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                Clear
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              className="w-full h-64 px-4 py-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-tertiary)]">
                {sourceText.length} characters
              </span>
              <button
                onClick={() => handleCopy(sourceText)}
                disabled={!sourceText}
                className="text-sm text-[var(--klein-blue)] hover:underline disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </Card>

          {/* Translated Text */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Translation</h3>
              <button
                onClick={() => setTranslatedText('')}
                className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                Clear
              </button>
            </div>
            <div className="w-full h-64 px-4 py-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center flex flex-col items-center gap-3">
                    <Spinner size="md" />
                    <p className="text-[var(--color-text-secondary)]">Translating...</p>
                  </div>
                </div>
              ) : translatedText ? (
                <pre className="whitespace-pre-wrap text-[var(--color-text-primary)] font-sans">
                  {translatedText}
                </pre>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">Translation will appear here...</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-tertiary)]">
                {translatedText.length} characters
              </span>
              <button
                onClick={() => handleCopy(translatedText)}
                disabled={!translatedText}
                className="text-sm text-[var(--klein-blue)] hover:underline disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </Card>
        </div>

        {/* Translate Button — thumb zone, gradient hero CTA */}
        <Button
          variant="grad"
          onClick={executeTranslation}
          disabled={loading || !sourceText.trim()}
          className="text-lg"
        >
          {loading ? 'Translating...' : 'Translate'}
        </Button>

        {/* Info Box */}
        <Card>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[var(--klein-blue)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-[var(--color-text-secondary)]">
              <p className="font-semibold mb-1 text-[var(--color-text-primary)]">Translation Modes:</p>
              <ul className="space-y-1">
                <li>• <strong>Standard:</strong> High-quality AI translation with context awareness</li>
                <li>• <strong>Quick (Google):</strong> Fast translation using Google Translate</li>
                <li>• <strong>Learning Mode:</strong> Includes grammar notes, vocabulary explanations, and learning tips</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
