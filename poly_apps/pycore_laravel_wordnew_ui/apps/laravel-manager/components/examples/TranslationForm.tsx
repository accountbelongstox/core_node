import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ArrowRightLeft, Copy, Check, Eraser } from 'lucide-react';
import { useToolModel } from '@/apps/laravel-manager/hooks';
import { AI_TOOLS } from '@/apps/laravel-manager/config/tools.config';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import HistoryList from '../universal/HistoryList';
import { commonClasses } from '@/shared/styles/theme';
import { AI_BODY, AI_GRID_2, AiBentoCard, AiToolActions, AiToolAlert } from '@/shared/ui/AiToolUi';

const TranslationForm: React.FC = () => {
  const { t } = useTranslation();
  const config = AI_TOOLS.translation;
  const { execute, loading, error, history, isFavorite, toggleFavorite, clearError } = useToolModel(config);

  const [input, setInput] = useState({
    text: '',
    sourceLang: 'auto',
    targetLang: 'en'
  });

  const [showHistory, setShowHistory] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [copied, setCopied] = useState(false);

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
      console.error('Translation failed:', err);
    }
  };

  const handleSwap = () => {
    if (input.sourceLang === 'auto') return;
    setInput((prev) => ({
      ...prev,
      sourceLang: prev.targetLang,
      targetLang: prev.sourceLang,
      text: translatedText || prev.text
    }));
    setTranslatedText('');
  };

  const handleClear = () => {
    setInput((prev) => ({ ...prev, text: '' }));
    setTranslatedText('');
    clearError();
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languageOptions = [
    { value: 'auto', label: t('uiTools.languages.auto') },
    { value: 'en', label: t('uiTools.languages.en') },
    { value: 'zh', label: t('uiTools.languages.zh') },
    { value: 'es', label: t('uiTools.languages.es') },
    { value: 'fr', label: t('uiTools.languages.fr') },
    { value: 'de', label: t('uiTools.languages.de') },
    { value: 'ja', label: t('uiTools.languages.ja') },
    { value: 'ko', label: t('uiTools.languages.ko') }
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
      <div className={AI_BODY}>
        <AiBentoCard>
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={input.sourceLang}
              onChange={(e) => setInput({ ...input, sourceLang: e.target.value })}
              className={`${commonClasses.input} w-full flex-1`}
              aria-label={t('uiTools.translation.source_language')}
            >
              {languageOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button
              onClick={handleSwap}
              disabled={input.sourceLang === 'auto'}
              title={input.sourceLang === 'auto' ? t('uiTools.translation.swap_pick_source') : t('uiTools.translation.swap_languages')}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} shrink-0 p-2.5 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <select
              value={input.targetLang}
              onChange={(e) => setInput({ ...input, targetLang: e.target.value })}
              className={`${commonClasses.input} w-full flex-1`}
              aria-label={t('uiTools.translation.target_language')}
            >
              {languageOptions.filter(opt => opt.value !== 'auto').map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </AiBentoCard>

        <div className={AI_GRID_2}>
          <AiBentoCard title={t('uiTools.translation.source_text')}>
            <div className="flex flex-col">
              <textarea
                value={input.text}
                onChange={(e) => setInput({ ...input, text: e.target.value })}
                placeholder={t('uiTools.translation.source_placeholder')}
                className={`${commonClasses.input} w-full resize-none min-h-[220px]`}
                rows={9}
              />
              <div className="mt-2 text-right text-xs text-slate-400 dark:text-slate-500">
                {t('uiTools.translation.characters_count', { count: input.text.length })}
              </div>
            </div>
          </AiBentoCard>

          <AiBentoCard title={t('uiTools.translation.translation')}>
            <div className="flex flex-col">
              <div
                className={`${commonClasses.input} w-full min-h-[220px] whitespace-pre-wrap overflow-auto ${
                  loading ? 'animate-pulse' : ''
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-slate-400">
                    {t('uiTools.translation.translating')}
                  </div>
                ) : translatedText ? (
                  translatedText
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-slate-400">
                    {t('uiTools.translation.output_placeholder')}
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-slate-500">
                  {t('uiTools.translation.characters_count', { count: translatedText.length })}
                </span>
                {translatedText && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('uiTools.common.copied') : t('uiTools.common.copy')}
                  </button>
                )}
              </div>
            </div>
          </AiBentoCard>
        </div>

        {error && <AiToolAlert>{error}</AiToolAlert>}

        <AiToolActions>
          <button
            onClick={handleClear}
            disabled={!input.text && !translatedText}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Eraser className="w-4 h-4" />
            {t('uiTools.common.clear')}
          </button>
          <button
            onClick={handleTranslate}
            disabled={loading || !input.text.trim()}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 px-8 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Languages className="w-4 h-4" />
            {loading ? t('uiTools.translation.translating') : t('uiTools.translation.translate')}
          </button>
        </AiToolActions>
      </div>
    </ToolWrapper>
  );
};

export default TranslationForm;
