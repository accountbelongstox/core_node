import React, { useState, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Card, Icons } from './UI';
import { LanguageCenter } from '../i18n/LanguageCenter';

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ open, onClose }) => {
  const { t } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['en']);
  const [isOnlineTranslate, setIsOnlineTranslate] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const supportedLanguages = LanguageCenter.getSupportedLanguages();

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    setTimeout(() => {
      setSearchResult({
        text: searchQuery,
        translation: isOnlineTranslate ? 'Online Translation Result' : 'Local Dictionary Result',
        phonetic: '/.../',
        definition: 'A detailed definition retrieved from the selected source.',
        tags: selectedLangs,
      });
      setIsSearching(false);
    }, 800);
  };

  const toggleLang = (code: string) => {
    if (selectedLangs.includes(code)) {
      setSelectedLangs((prev) => prev.filter((c) => c !== code));
    } else {
      setSelectedLangs((prev) => [...prev, code]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-fade-in" role="dialog" aria-label={t('header.smartSearch')}>
      <div
        className="absolute inset-0 bg-slate-900/30 dark:bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full ds-modal-panel rounded-b-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] flex-1 min-h-0">
        <div className="p-6 pt-safe space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('header.smartSearch')}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="ds-touch-target flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Icons.Close />
            </button>
          </div>

          <div>
            <label className="ds-section-label block mb-2">{t('header.targetLanguages')}</label>
            <div className="flex gap-2 flex-wrap">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLang(lang.code)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-bold border transition-all
                    ${selectedLangs.includes(lang.code)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}
                  `}
                >
                  {lang.flag} {lang.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('header.searchInputPlaceholder')}
              autoFocus
              className="w-full p-5 pr-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none text-lg dark:text-white transition-all"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform ds-touch-target"
            >
              <Icons.Search />
            </button>
          </div>

          <div className="flex items-center justify-between ds-glass p-3 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isOnlineTranslate ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-slate-200 text-slate-400 dark:bg-slate-700'}`}>
                <Icons.Cloud />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 dark:text-white">{t('header.onlineTranslate')}</span>
                <span className="text-[10px] text-slate-400">{t('header.useCloudAI')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOnlineTranslate(!isOnlineTranslate)}
              className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${isOnlineTranslate ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={isOnlineTranslate}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isOnlineTranslate ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto min-h-[200px]">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-pulse">
              <Icons.Cloud />
              <span className="mt-2 text-sm font-bold">{t('header.searchingCloud')}</span>
            </div>
          ) : searchResult ? (
            <div className="animate-slide-up">
              <Card className="!bg-white dark:!bg-slate-800 !border-none shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-4xl font-bold text-slate-800 dark:text-white">{searchResult.text}</h3>
                    <div className="text-blue-500 font-mono text-sm mt-1">{searchResult.phonetic}</div>
                  </div>
                  <button type="button" className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:scale-105 transition-transform ds-touch-target">
                    <Icons.Sound />
                  </button>
                </div>
                <div className="mb-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('header.meaning')}</div>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{searchResult.translation}</p>
                </div>
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 border-l-4 border-l-blue-400">
                  <p className="text-lg text-slate-600 dark:text-slate-400 italic leading-relaxed">&quot;{searchResult.definition}&quot;</p>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {searchResult.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-bold text-slate-500 uppercase">
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <div className="text-center text-slate-400 mt-8">
              <p>{t('header.enterWordPrompt')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
