/* [v4.1-Iris] Translation Tools — ported from
 * poly_apps/qy_capacitor/pages/Tools/TranslationTools.tsx. Self-contained:
 * standard / Google-quick / learning-mode translation via wordflowApi.request
 * (/ai_tools/translation/{translate,simple/google,learning}), language pill
 * navs + swap, copy-to-clipboard. react-router useNavigate for the back action.
 * Every API call try/caught; degrades to an inline error string. Faithful Iris. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spinner, PageHeader, Button, IconButton } from '../WfUI';
import { wordflowApi, extractReply } from '../../../core/api-libs/wordflow/WordflowApi';

const WfToolsTranslationToolsPage: React.FC = () => {
  const navigate = useNavigate();

  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [fromLanguage, setFromLanguage] = useState('en');
  const [toLanguage, setToLanguage] = useState('zh');
  const [loading, setLoading] = useState(false);
  const [translationMode, setTranslationMode] = useState<'standard' | 'google' | 'learning'>('standard');

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

  const executeTranslation = async () => {
    if (!sourceText.trim()) {
      alert('Please enter text to translate');
      return;
    }
    setLoading(true);
    setTranslatedText('');

    try {
      if (translationMode === 'google') {
        const res = await wordflowApi.request<any>('/ai_tools/translation/simple/google', {
          method: 'POST',
          body: JSON.stringify({ text: sourceText, target_language: toLanguage }),
        });
        setTranslatedText(extractReply(res) || 'Translation completed');
      } else if (translationMode === 'learning') {
        const res = await wordflowApi.request<any>('/ai_tools/translation/learning', {
          method: 'POST',
          body: JSON.stringify({ text: sourceText, target_languages: [toLanguage] }),
        });
        // Learning mode can carry grammar notes/explanations — show the raw shape
        // when it is not a plain string.
        setTranslatedText(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
      } else {
        const res = await wordflowApi.request<any>('/ai_tools/translation/translate', {
          method: 'POST',
          body: JSON.stringify({ text: sourceText, target_language: toLanguage }),
        });
        setTranslatedText(extractReply(res) || 'Translation completed');
      }
    } catch (error) {
      console.error('[WfTranslation] Translation failed:', error);
      setTranslatedText('Translation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    setFromLanguage(toLanguage);
    setToLanguage(fromLanguage);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const modeDescriptions: Record<string, string> = {
    standard: 'High-quality AI translation',
    google: 'Fast and simple translation',
    learning: 'With explanations & notes',
  };

  const renderPillNav = (
    items: { id: string; label: string }[],
    activeId: string,
    onChange: (id: string) => void,
    label: string
  ) => (
    <div className="ds-pill-nav" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          onClick={() => onChange(item.id)}
          className={`ds-pill-chip ${activeId === item.id ? 'is-active' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const languageItems = languages.map((l) => ({ id: l.code, label: l.name }));

  return (
    <div className="route-fade min-h-screen bg-transparent pb-32">
      <PageHeader title="Translation Tools" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">AI-powered translation with multiple modes</p>
        </div>

        {/* Translation mode */}
        <Card>
          <p className="ds-section-title mb-3">Translation Mode</p>
          {renderPillNav(
            [
              { id: 'standard', label: 'Standard' },
              { id: 'google', label: 'Quick (Google)' },
              { id: 'learning', label: 'Learning Mode' },
            ],
            translationMode,
            (id) => setTranslationMode(id as 'standard' | 'google' | 'learning'),
            'Translation mode'
          )}
          <p className="text-xs text-[var(--color-text-tertiary)] mt-3">{modeDescriptions[translationMode]}</p>
        </Card>

        {/* Language selection */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <label className="ds-section-label block mb-2">From</label>
              {renderPillNav(languageItems, fromLanguage, setFromLanguage, 'From language')}
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
              {renderPillNav(languageItems, toLanguage, setToLanguage, 'To language')}
            </div>
          </div>
        </Card>

        {/* Translation area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-lg)]">
          {/* Source text */}
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
              <span className="text-sm text-[var(--color-text-tertiary)]">{sourceText.length} characters</span>
              <button
                onClick={() => handleCopy(sourceText)}
                disabled={!sourceText}
                className="text-sm text-[var(--klein-blue)] hover:underline disabled:opacity-50"
              >
                Copy
              </button>
            </div>
          </Card>

          {/* Translated text */}
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
                <pre className="whitespace-pre-wrap text-[var(--color-text-primary)] font-sans">{translatedText}</pre>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">Translation will appear here...</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-tertiary)]">{translatedText.length} characters</span>
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

        {/* Translate button — gradient hero CTA */}
        <Button
          variant="grad"
          onClick={executeTranslation}
          disabled={loading || !sourceText.trim()}
          className="text-lg"
        >
          {loading ? 'Translating...' : 'Translate'}
        </Button>

        {/* Info box */}
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
};

export default WfToolsTranslationToolsPage;
