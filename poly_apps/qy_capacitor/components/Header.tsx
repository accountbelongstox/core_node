/* [v4.1-Iris] Reference-parity verified; lang dropdown → <Popover> (centralized stacking), search overlay → ds-z-modal. Propagate the Iris layer to un-beautified siblings. */
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useWindowScroll } from 'react-use';
import { Icons, Card, IconButton, Badge, LoadingState, EmptyState, FabGrad, Popover } from './UI';
import { Avatar } from './Avatar';
import { AppContext } from '../contexts/AppContext';
import { MOCK_ANNOUNCEMENTS, SUPPORTED_LANGUAGES } from '../services/mockData';
import { LanguageCenter, SupportedLanguage } from '../i18n/LanguageCenter';
import { StateManager, GlobalState } from '../services/StateManager';
import { api } from '../services/api';

export const Header = ({ title }: { title?: string }) => {
  const { user, navigate, t, settings, updateSettings } = useContext(AppContext);
  const { y: scrollY } = useWindowScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['en']);
  const [isOnlineTranslate, setIsOnlineTranslate] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Track scroll position using react-use
  useEffect(() => {
    setIsScrolled(scrollY > 20);
  }, [scrollY]);

  // outside-click / Escape handled by <Popover>

  // Theme toggle
  const toggleTheme = () => {
    const currentTheme = settings.display.theme;
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    updateSettings({ display: { ...settings.display, theme: nextTheme } });
    StateManager.set(GlobalState.THEME, nextTheme);
    
    // Apply theme to document
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Language change
  const handleLanguageChange = (lang: SupportedLanguage) => {
    // Update settings first
    updateSettings({ language: { ...settings.language, appInterface: lang } });
    
    // Update LanguageCenter
    LanguageCenter.setLanguage(lang);
    
    // Update StateManager
    StateManager.set(GlobalState.LANGUAGE, lang);
    
    // Update API
    api.setLanguage(lang);
    
    setIsLangDropdownOpen(false);
    
    // Reload page to apply language changes
    window.location.reload();
  };

  const currentLanguage = LanguageCenter.getCurrentLanguage();
  const currentLangConfig = LanguageCenter.getLanguageConfig();
  const rawLanguages = LanguageCenter.getSupportedLanguages();
  const supportedLanguages = Array.isArray(rawLanguages) ? rawLanguages : [];

  const handleSearch = () => {
     if(!searchQuery.trim()) return;
     setIsSearching(true);
     setSearchResult(null);
     
     // Simulate API Call
     setTimeout(() => {
         setSearchResult({
             text: searchQuery,
             translation: isOnlineTranslate ? "Online Translation Result" : "Local Dictionary Result",
             phonetic: "/.../",
             definition: "A detailed definition retrieved from the selected source.",
             tags: selectedLangs
         });
         setIsSearching(false);
     }, 800);
  };

  const toggleLang = (code: string) => {
      if (selectedLangs.includes(code)) {
          setSelectedLangs(prev => prev.filter(c => c !== code));
      } else {
          setSelectedLangs(prev => [...prev, code]);
      }
  };

  const speak = (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
      try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      } catch (err) {
          console.warn('[Header] speechSynthesis unavailable:', err);
      }
  };

  return (
    <>
        {/* Floating Header Island — adaptive (no max-width) */}
        <div
          className="fixed top-0 left-0 right-0 z-40 px-[max(var(--page-padding-h),env(safe-area-inset-left,0px))] pr-[max(var(--page-padding-h),env(safe-area-inset-right,0px))] pt-[env(safe-area-inset-top,0px)] pb-2"
        >
            <div className={`
                w-full rounded-full px-2 py-2 flex items-center gap-2.5 transition-all duration-500
                ${isScrolled
                   ? 'ds-glass ds-glass-edge'
                   : 'bg-transparent border border-transparent'}
            `}>
                {/* User Avatar — reference: avatar anchors the left */}
                <div onClick={() => navigate(user ? 'profile' : 'login')} className="cursor-pointer shrink-0 group relative ml-1">
                    {user ? (
                        <Avatar
                            src={user.avatar_url}
                            fallbackSrc={user.avatar}
                            name={user.name || user.nickname || user.username}
                            alt="Profile"
                            className="w-10 h-10 rounded-full border-2 border-[var(--color-surface)] shadow-sm group-hover:scale-105 transition-transform"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full ds-glass ds-glass-edge flex items-center justify-center border border-[var(--border-highlight)] text-[var(--color-text-secondary)]">
                            <Icons.User />
                        </div>
                    )}
                    {/* Status Dot */}
                     <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--color-surface)]"></div>
                </div>

                {/* Search Capsule with trailing gradient filter orb (reference) */}
                <div
                    className={`
                      flex-1 min-w-0 h-12 rounded-full flex items-center pl-4 pr-1.5 gap-2 transition-all duration-300 group
                      ${isScrolled ? 'bg-[var(--color-surface)]/60' : 'ds-glass ds-glass-edge border border-[var(--border-highlight)] shadow-sm'}
                    `}
                >
                    <button
                        type="button"
                        onClick={() => setIsSearchOpen(true)}
                        className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer text-left"
                        aria-label={t('header.smartSearch')}
                    >
                        <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0"><Icons.Search /></span>
                        <span className="text-sm text-[var(--color-text-secondary)] font-medium truncate">
                            {title || t('header.searchPlaceholder')}
                        </span>
                    </button>
                    <FabGrad
                        icon={<Icons.Filter />}
                        onClick={() => setIsSearchOpen(true)}
                        label={t('header.smartSearch')}
                        size={38}
                    />
                </div>

                {/* Right cluster — icon-only, quiet (reference asymmetry) */}
                <div className="flex items-center shrink-0">
                    <IconButton
                        icon={settings.display.theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
                        onClick={toggleTheme}
                        label={settings.display.theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
                    />

                    <div className="relative" ref={langDropdownRef}>
                        <IconButton
                            icon={<Icons.Globe />}
                            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                            label={t('header.changeLanguage')}
                            active={isLangDropdownOpen}
                        />

                        <Popover open={isLangDropdownOpen} onClose={() => setIsLangDropdownOpen(false)} anchorRef={langDropdownRef} align="end" className="w-[min(13rem,calc(100vw-2rem))]">
                            <div className="p-2 flex flex-col gap-1" role="listbox">
                                {supportedLanguages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        type="button"
                                        role="option"
                                        aria-selected={currentLanguage === lang.code}
                                        onClick={() => handleLanguageChange(lang.code)}
                                        className={`ds-pill-chip ds-touch-target !justify-start !rounded-[var(--radius-button)] w-full text-left ${currentLanguage === lang.code ? 'is-active' : ''}`}
                                    >
                                        <span className="text-xl flex-shrink-0">{lang.flag}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{lang.nativeName}</div>
                                            <div className={`text-xs truncate ${currentLanguage === lang.code ? 'opacity-80' : 'text-[var(--color-text-tertiary)]'}`}>{lang.name}</div>
                                        </div>
                                        {currentLanguage === lang.code && <Icons.Check className="w-4 h-4 flex-shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </Popover>
                    </div>

                    <IconButton
                        icon={<Icons.Settings />}
                        onClick={() => navigate('settings')}
                        label="Settings"
                    />
                </div>
            </div>
        </div>

        {/* Announcement Ticker — adaptive */}
        <div className="pt-20 px-[max(var(--page-padding-h),env(safe-area-inset-left,0px))] pr-[max(var(--page-padding-h),env(safe-area-inset-right,0px))] pb-2">
             <div className="flex items-center gap-2 overflow-hidden py-1 opacity-80 hover:opacity-100 transition-opacity">
                 <Badge tone="klein">NEW</Badge>
                 <div className="flex-1 text-xs font-medium text-[var(--color-text-secondary)] truncate animate-slide-up">
                     {MOCK_ANNOUNCEMENTS[0].message}
                 </div>
             </div>
        </div>

        {/* Full Screen Search Overlay */}
        {isSearchOpen && (
            <div className="fixed inset-0 ds-z-modal flex flex-col animate-fade-in">
                {/* Backdrop */}
                <div className="absolute inset-0 ds-modal-backdrop" onClick={() => setIsSearchOpen(false)} aria-hidden />

                {/* Search Panel */}
                <div className="relative ds-modal-panel w-full rounded-b-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] border-b border-[var(--border-highlight)]">
                    <div className="p-6 pt-safe space-y-6">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('header.smartSearch')}</h2>
                            <IconButton
                                icon={<Icons.Close />}
                                onClick={() => setIsSearchOpen(false)}
                                label={t('common.close')}
                            />
                        </div>

                        {/* Language Multi-Select */}
                        <div>
                            <label className="ds-section-label block mb-3">{t('header.targetLanguages')}</label>
                            <div className="ds-pill-nav" role="group">
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => toggleLang(lang.code)}
                                        className={`ds-pill-chip ${selectedLangs.includes(lang.code) ? 'is-active' : ''}`}
                                    >
                                        <span className="flex-shrink-0">{lang.flag}</span> {lang.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Input Area */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={t('header.searchInputPlaceholder')}
                                autoFocus
                                className="w-full p-5 pr-16 rounded-[var(--radius-card)] ds-glass ds-glass-edge border border-[var(--border-highlight)] outline-none text-lg text-[var(--color-text-primary)] transition-all"
                                style={{ boxShadow: '0 0 0 0 transparent' }}
                                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px var(--klein-ring)'; }}
                                onBlur={(e) => { e.currentTarget.style.boxShadow = '0 0 0 0 transparent'; }}
                            />
                            <button
                                onClick={handleSearch}
                                aria-label={t('header.smartSearch')}
                                className="ds-btn-klein absolute right-3 top-1/2 -translate-y-1/2 ds-touch-target !w-auto !py-0 px-3 flex items-center justify-center"
                            >
                                <Icons.Search />
                            </button>
                        </div>

                        {/* Options Toggle */}
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
                                <span
                                    className={`block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isOnlineTranslate ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 bg-[var(--color-surface)]/40 p-6 overflow-y-auto min-h-[200px]">
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
                                            <span key={tag} className="ds-pill-chip is-active uppercase">{tag}</span>
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
        )}
    </>
  );
};