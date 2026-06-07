/* [v4.1-Iris] Reference-parity verified; full-screen overlay → ds-z-modal (centralized stacking, above chrome/popovers). Propagate the Iris layer to un-beautified siblings. */
/* [v4.1-Iris] Search overlay: single scrollable panel + input scrollIntoView on
   focus + dvh height so the soft keyboard no longer covers the input/results.
   Close (X / backdrop) wired to onClose. */
import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Card, Icons, IconButton, EmptyState, LoadingState } from './UI';
import { LanguageCenter } from '../i18n/LanguageCenter';
import { PillNav } from './PillNav';

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
  const inputRef = useRef<HTMLInputElement>(null);

  const rawLanguages = LanguageCenter.getSupportedLanguages();
  const supportedLanguages = Array.isArray(rawLanguages) ? rawLanguages : [];

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

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch (err) {
      console.warn('[SearchOverlay] speechSynthesis unavailable:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 ds-z-modal flex flex-col animate-fade-in" role="dialog" aria-modal="true" aria-label={t('header.smartSearch')}>
      <div
        className="absolute inset-0 ds-modal-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full ds-modal-panel rounded-b-[calc(var(--radius-card)+10px)] overflow-hidden flex flex-col max-h-[88dvh] flex-1 min-h-0">
        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
        <div className="p-6 pt-safe space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="ds-section-title">{t('header.smartSearch')}</h2>
            <IconButton
              icon={<Icons.Close />}
              onClick={onClose}
              label={t('common.close')}
            />
          </div>

          <div>
            <label className="ds-section-label block mb-3">{t('header.targetLanguages')}</label>
            <div className="ds-pill-nav" role="group" aria-label={t('header.targetLanguages')}>
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  aria-pressed={selectedLangs.includes(lang.code)}
                  onClick={() => toggleLang(lang.code)}
                  className={`ds-pill-chip ${selectedLangs.includes(lang.code) ? 'is-active' : ''}`}
                >
                  <span className="flex-shrink-0">{lang.flag}</span> {lang.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('header.searchInputPlaceholder')}
              autoFocus
              className="w-full p-5 pr-16 rounded-[var(--radius-card)] ds-glass ds-glass-edge border border-[var(--border-highlight)] outline-none text-lg text-[var(--color-text-primary)] transition-all"
              style={{ boxShadow: '0 0 0 0 transparent' }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--klein-ring)';
                // Keep the input visible above the soft keyboard.
                setTimeout(() => inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
              }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = '0 0 0 0 transparent'; }}
            />
            <button
              type="button"
              onClick={handleSearch}
              aria-label={t('header.smartSearch')}
              className="ds-btn-klein absolute right-3 top-1/2 -translate-y-1/2 ds-touch-target !w-auto !py-0 px-3 flex items-center justify-center"
            >
              <Icons.Search />
            </button>
          </div>

          <div className="flex items-center justify-between ds-glass p-3 rounded-xl border border-[var(--border-highlight)]">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg transition-colors"
                style={isOnlineTranslate
                  ? { background: 'var(--klein-blue-soft)', color: 'var(--klein-blue)' }
                  : { background: 'var(--color-surface)', color: 'var(--color-text-tertiary)' }}
              >
                <Icons.Cloud />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{t('header.onlineTranslate')}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">{t('header.useCloudAI')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOnlineTranslate(!isOnlineTranslate)}
              aria-pressed={isOnlineTranslate}
              className="w-12 h-7 rounded-full p-1 transition-colors cursor-pointer"
              style={{ background: isOnlineTranslate ? 'var(--klein-blue)' : 'var(--border-highlight)' }}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isOnlineTranslate ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="p-6 pt-0 min-h-[200px]">
          {isSearching ? (
            <LoadingState label={t('header.searchingCloud')} />
          ) : searchResult ? (
            <div className="animate-slide-up">
              <Card>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-4xl font-bold text-[var(--color-text-primary)]">{searchResult.text}</h3>
                    <div className="font-mono text-sm mt-1" style={{ color: 'var(--klein-blue)' }}>{searchResult.phonetic}</div>
                  </div>
                  <IconButton
                    icon={<Icons.Sound />}
                    onClick={() => speak(searchResult.text)}
                    label={t('words.playAudio')}
                  />
                </div>
                <div className="mb-4">
                  <div className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest mb-1">{t('header.meaning')}</div>
                  <p className="text-xl font-bold text-[var(--color-text-primary)]">{searchResult.translation}</p>
                </div>
                <div
                  className="mb-4 p-4 rounded-[var(--radius-button)] ds-glass border-l-4"
                  style={{ borderLeftColor: 'var(--klein-blue)' }}
                >
                  <p className="text-lg text-[var(--color-text-secondary)] italic leading-relaxed">&quot;{searchResult.definition}&quot;</p>
                </div>
                <div className="ds-pill-nav mt-4">
                  {(Array.isArray(searchResult.tags) ? searchResult.tags : []).map((tag: string) => (
                    <span key={tag} className="ds-pill-chip is-active uppercase">
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <EmptyState description={t('header.enterWordPrompt')} />
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
