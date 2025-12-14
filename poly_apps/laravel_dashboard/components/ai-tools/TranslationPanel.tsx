import React, { useState, useEffect } from 'react';
import {
  Languages,
  ArrowRightLeft,
  Copy,
  Check,
  RefreshCw,
  Volume2,
  History,
  Trash2,
  Globe
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';

interface TranslationPanelProps {
  onTranslationComplete?: (result: any) => void;
}

interface TranslationHistory {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

const LANGUAGES = [
  { code: 'auto', name: 'Auto Detect', flag: '🌐' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' }
];

const TranslationPanel: React.FC<TranslationPanelProps> = ({ onTranslationComplete }) => {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [history, setHistory] = useState<TranslationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const saved = localStorage.getItem('translation_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }
  };

  const saveToHistory = (item: Omit<TranslationHistory, 'id' | 'timestamp'>) => {
    const newItem: TranslationHistory = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now()
    };
    const newHistory = [newItem, ...history.slice(0, 19)]; // Keep last 20
    setHistory(newHistory);
    localStorage.setItem('translation_history', JSON.stringify(newHistory));
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    setLoading(true);
    setTranslatedText('');
    setDetectedLang(null);

    try {
      let response;
      if (sourceLang === 'auto') {
        response = await apiService.detectAndTranslate(sourceText, targetLang);
        if (response.success && response.data) {
          setDetectedLang(response.data.detected_language);
        }
      } else {
        response = await apiService.translate({
          text: sourceText,
          source_language: sourceLang,
          target_language: targetLang
        });
      }

      if (response.success && response.data) {
        const translated = response.data.translated_text || response.data.translation;
        setTranslatedText(translated);

        saveToHistory({
          sourceText,
          translatedText: translated,
          sourceLang: detectedLang || sourceLang,
          targetLang
        });

        onTranslationComplete?.(response.data);
      }
    } catch (error) {
      console.error('Translation failed:', error);
      setTranslatedText('Translation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    setSourceText(translatedText);
    setTranslatedText('');
  };

  const handleCopy = async () => {
    if (translatedText) {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('translation_history');
  };

  const loadFromHistory = (item: TranslationHistory) => {
    setSourceText(item.sourceText);
    setTranslatedText(item.translatedText);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setShowHistory(false);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Translation</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Translate text between multiple languages
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <BentoCard title="Translation History" className="mb-4">
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No history yet</p>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span>{LANGUAGES.find(l => l.code === item.sourceLang)?.flag || '🌐'}</span>
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>{LANGUAGES.find(l => l.code === item.targetLang)?.flag || '🌐'}</span>
                      <span className="ml-auto">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm truncate">{item.sourceText}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{item.translatedText}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </BentoCard>
      )}

      {/* Translation Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source Language */}
        <BentoCard
          title="Source Language"
          headerControls={
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className={`${commonClasses.select} text-sm`}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          }
        >
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            className={`${commonClasses.textarea} h-48 resize-none`}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">
              {sourceText.length} characters
            </span>
            {detectedLang && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Detected: {LANGUAGES.find(l => l.code === detectedLang)?.name || detectedLang}
              </span>
            )}
          </div>
        </BentoCard>

        {/* Target Language */}
        <BentoCard
          title="Translation"
          headerControls={
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className={`${commonClasses.select} text-sm`}
            >
              {LANGUAGES.filter(l => l.code !== 'auto').map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          }
        >
          <div className={`${commonClasses.textarea} h-48 overflow-auto bg-slate-50 dark:bg-slate-800`}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : translatedText ? (
              <p className="whitespace-pre-wrap">{translatedText}</p>
            ) : (
              <p className="text-slate-400 text-center mt-16">Translation will appear here</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">
              {translatedText.length} characters
            </span>
            {translatedText && (
              <button
                onClick={handleCopy}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            )}
          </div>
        </BentoCard>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleSwapLanguages}
          disabled={sourceLang === 'auto'}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          title="Swap languages"
        >
          <ArrowRightLeft className="w-4 h-4" />
          Swap
        </button>
        <button
          onClick={handleTranslate}
          disabled={!sourceText.trim() || loading}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 flex items-center gap-2`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Languages className="w-4 h-4" />
              Translate
            </>
          )}
        </button>
        <button
          onClick={() => {
            setSourceText('');
            setTranslatedText('');
            setDetectedLang(null);
          }}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
        >
          Clear
        </button>
      </div>

      {/* Quick Tips */}
      <BentoCard title="Tips" className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <Globe className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>Select "Auto Detect" to automatically identify the source language</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRightLeft className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>Use the Swap button to quickly reverse translation direction</span>
          </li>
          <li className="flex items-start gap-2">
            <History className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <span>Access your recent translations from the History panel</span>
          </li>
        </ul>
      </BentoCard>
    </div>
  );
};

export default TranslationPanel;
