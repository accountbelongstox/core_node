import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import { useToolModel } from '../../hooks';
import { AI_TOOLS } from '../../config/tools.config';
import ToolWrapper from '../universal/ToolWrapper';
import HistoryList from '../universal/HistoryList';
import BentoCard from '../BentoCard';
import { commonClasses } from '../../styles/theme';

/**
 * TranslationForm - Simplified translation tool using centralized architecture
 *
 * Before: 370 lines with manual API calls, history, favorites
 * After: ~100 lines with automatic management
 */
const TranslationForm: React.FC = () => {
  const config = AI_TOOLS.translation;
  const { execute, loading, error, result, history, isFavorite, toggleFavorite, clearError } = useToolModel(config);

  const [input, setInput] = useState({
    text: '',
    sourceLang: 'auto',
    targetLang: 'en'
  });

  const [showHistory, setShowHistory] = useState(false);
  const [translatedText, setTranslatedText] = useState('');

  const handleTranslate = async () => {
    if (!input.text.trim()) return;

    clearError();
    setTranslatedText('');

    try {
      const result = await execute(input);
      if (result && result.translated_text) {
        setTranslatedText(result.translated_text);
      }
    } catch (err) {
      // Error is automatically handled by useToolModel
      console.error('Translation failed:', err);
    }
  };

  const languageOptions = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' }
  ];

  return (
    <ToolWrapper
      title={config.name}
      icon={Languages}
      gradient="blue-purple"
      description={config.description}
      favorites={config.favorites}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      showHistory={showHistory}
      onToggleHistory={() => setShowHistory(!showHistory)}
      history={<HistoryList items={history} />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Text */}
        <BentoCard title="Source Text">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Source Language
              </label>
              <select
                value={input.sourceLang}
                onChange={(e) => setInput({ ...input, sourceLang: e.target.value })}
                className={commonClasses.input}
              >
                {languageOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Text to Translate
              </label>
              <textarea
                value={input.text}
                onChange={(e) => setInput({ ...input, text: e.target.value })}
                placeholder="Enter text to translate..."
                className={`${commonClasses.input} resize-none`}
                rows={8}
              />
            </div>

            <button
              onClick={handleTranslate}
              disabled={loading || !input.text.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} w-full`}
            >
              {loading ? 'Translating...' : 'Translate'}
            </button>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </BentoCard>

        {/* Translated Text */}
        <BentoCard title="Translation">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Target Language
              </label>
              <select
                value={input.targetLang}
                onChange={(e) => setInput({ ...input, targetLang: e.target.value })}
                className={commonClasses.input}
              >
                {languageOptions.filter(opt => opt.value !== 'auto').map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Translated Text
              </label>
              <div
                className={`${commonClasses.input} min-h-[200px] whitespace-pre-wrap ${
                  loading ? 'animate-pulse' : ''
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    Translating...
                  </div>
                ) : translatedText ? (
                  translatedText
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    Translation will appear here
                  </div>
                )}
              </div>
            </div>

            {translatedText && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(translatedText);
                }}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} w-full`}
              >
                Copy Translation
              </button>
            )}
          </div>
        </BentoCard>
      </div>
    </ToolWrapper>
  );
};

export default TranslationForm;
