import React from 'react';
import {
  Languages,
  ArrowLeftRight,
  Volume2,
  Copy,
  RefreshCw,
  X,
  Sliders
} from 'lucide-react';
import { commonClasses } from '@/shared/styles/theme';
import { AlertBox } from '../../common';
import { CollapsibleSection } from '../CollapsibleSection';
import {
  TranslationResponse,
  LanguageInfo,
  AsyncState
} from '@/apps/laravel-manager/uiTypes';

interface TranslateInputPanelProps {
  translation: AsyncState<TranslationResponse>;
  tts: { loading: boolean };
  languages: LanguageInfo[];
  sourceLanguage: string;
  setSourceLanguage: (v: string) => void;
  targetLanguage: string;
  setTargetLanguage: (v: string) => void;
  inputText: string;
  setInputText: (v: string) => void;
  translateSettingsOpen: boolean;
  setTranslateSettingsOpen: (updater: (v: boolean) => boolean) => void;
  swapLanguages: () => void;
  handleTranslate: () => void;
  handleDetectAndTranslate: () => void;
  handleGenerateTTS: () => void;
  copy: (text: string) => void;
  setTranslation: React.Dispatch<React.SetStateAction<AsyncState<TranslationResponse>>>;
  t: {
    input_placeholder: string;
    translate: string;
    auto_detect: string;
    clear: string;
  };
}

/** Translate tab LEFT panel: swap-languages header, collapsible language selectors, input textarea, action buttons, error alert, and the translation-result block. */
const TranslateInputPanel: React.FC<TranslateInputPanelProps> = ({
  translation,
  tts,
  languages,
  sourceLanguage,
  setSourceLanguage,
  targetLanguage,
  setTargetLanguage,
  inputText,
  setInputText,
  translateSettingsOpen,
  setTranslateSettingsOpen,
  swapLanguages,
  handleTranslate,
  handleDetectAndTranslate,
  handleGenerateTTS,
  copy,
  setTranslation,
  t,
}) => {
  return (
        <div className={`${commonClasses.card} p-4 flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Translation</h3>
            <button
              onClick={swapLanguages}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Swap languages"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Language Selectors — collapsible secondary settings */}
          <CollapsibleSection
            title={
              <span className="text-xs">
                Languages: <span className="font-semibold uppercase">{sourceLanguage}</span> → <span className="font-semibold uppercase">{targetLanguage}</span>
              </span>
            }
            icon={<Sliders className="w-3.5 h-3.5 text-indigo-500" />}
            open={translateSettingsOpen}
            onToggle={() => setTranslateSettingsOpen((v) => !v)}
            className="mb-4 flex-shrink-0"
          >
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className={`${commonClasses.input} text-sm`}
              >
                {Array.isArray(languages) && languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.native_name} ({lang.name})
                  </option>
                ))}
              </select>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className={`${commonClasses.input} text-sm`}
              >
                {Array.isArray(languages) && languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.native_name} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </CollapsibleSection>

          {/* Input Text Area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.input_placeholder}
            rows={6}
            className={`${commonClasses.input} flex-1 mb-4 resize-none`}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleTranslate}
              disabled={translation.loading || !inputText.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {translation.loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Languages className="w-4 h-4" />
              )}
              {t.translate}
            </button>
            <button
              onClick={handleDetectAndTranslate}
              disabled={translation.loading || !inputText.trim()}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              {t.auto_detect}
            </button>
            <button
              onClick={() => {
                setInputText('');
                setTranslation({ data: null, loading: false, error: null, status: 'idle' });
              }}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
            >
              <X className="w-4 h-4" />
              {t.clear}
            </button>
          </div>

          {/* Translation Result */}
          {translation.error && (
            <AlertBox variant="error" className="mb-4">{translation.error}</AlertBox>
          )}

          {translation.data && (
            <div className="flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Translation</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(translation.data!.translated_text)}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGenerateTTS}
                    disabled={tts.loading}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Generate TTS"
                  >
                    {tts.loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
                <p className="text-slate-900 dark:text-slate-100">{translation.data.translated_text}</p>
              </div>
              {translation.data.phonetic && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  /{translation.data.phonetic}/
                </p>
              )}
              {translation.data.alternatives && translation.data.alternatives.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Alternatives:</p>
                  <div className="flex flex-wrap gap-1">
                    {translation.data.alternatives.map((alt, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          setTranslation(prev => ({
                            ...prev,
                            data: { ...prev.data!, translated_text: alt }
                          }));
                        }}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {translation.data.confidence && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confidence: {(translation.data.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </div>
  );
};

export default TranslateInputPanel;
