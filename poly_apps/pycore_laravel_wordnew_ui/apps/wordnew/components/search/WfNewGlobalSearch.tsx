/**
 * WfNewGlobalSearch — the app-wide search palette opened from the header (or
 * Ctrl/Cmd+K, "/"). One query searches pages, loaded content groups and the
 * dictionary; ">" narrows to page commands; the mic dictates the query.
 *
 * Portaled to <body> and sized to the VISUAL viewport below the safe-area
 * inset, so the panel never slides above the screen top or under the soft
 * keyboard (mobile web, Capacitor app); a centered palette on desktop.
 */
import { OVERLAY_Z } from '@/shared/styles/overlay';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Mic, MicOff, History, Loader2, Wand2, Star, CornerDownLeft } from 'lucide-react';
import type { Word, WfNewContentGroup, WfNewHomeContent } from '../../api';
import type { WordNewTab } from '../../routing/WordNewHashRoutes';
import { wfNewSettings } from '../../WfNewSettingsStore';
import { useWfNewSettings } from '../../useWfNewSettings';
import { capSTT } from '../../platform/capabilities/CapSpeechRecognition';
import { useBackButton } from '../../platform/capabilities/CapAppStateCore';
import { useWfNewVisualViewport } from '../../hooks/useWfNewVisualViewport';
import {
  isCommandQuery, searchContent, searchLocalWords, searchPages, searchWords, stripCommandPrefix,
  wordNewSearchPage, WORDNEW_SEARCH_COMMAND_PREFIX, WORDNEW_SEARCH_QUICK_TABS,
  type WordNewSearchHit, type WordNewSearchScope, type WordNewWordHit,
} from '../../services/WordNewGlobalSearch';
import { WfNewSearchRow } from './WfNewSearchRows';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

interface WfNewGlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  trans: Trans;
  lang: string;
  homeContent: WfNewHomeContent;
  wordPool: Word[];
  favorites: Word[];
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
  onOpenPage: (tab: WordNewTab) => void;
  onOpenContent: (group: WfNewContentGroup) => void;
  onSelectWord: (word: Word) => void;
  onPlayAudio: (word: Word) => void;
  onToggleFavorite: (word: Word) => void;
  /** Hand an unknown term to the AI Lab custom-word forge. */
  onForgeWord: (text: string) => void;
}

const WORD_DEBOUNCE_MS = 280;
const ALL_SCOPE_LIMITS = { pages: 4, content: 5, words: 12 } as const;
const SCOPED_LIMIT = 60;
const SCOPES: readonly WordNewSearchScope[] = ['all', 'words', 'content', 'pages'];
const STT_LANGUAGE: Record<string, string> = { en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' };

export const WfNewGlobalSearch: React.FC<WfNewGlobalSearchProps> = ({
  isOpen, onClose, trans, lang, homeContent, wordPool, favorites, isLoggedIn, isSuperAdmin,
  onOpenPage, onOpenContent, onSelectWord, onPlayAudio, onToggleFavorite, onForgeWord,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<WordNewSearchScope>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [wordHits, setWordHits] = useState<WordNewWordHit[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchHistory = useWfNewSettings().searchHistory ?? [];
  const viewport = useWfNewVisualViewport(isOpen);

  const command = isCommandQuery(query);
  const term = stripCommandPrefix(query);
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setScope('all');
    setVoiceError('');
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(focus);
      document.body.style.overflow = previous;
      void capSTT.stop().catch(() => undefined);
    };
  }, [isOpen]);

  useBackButton(() => {
    if (!isOpen) return false;
    onClose();
    return true;
  });

  // Dictionary words: local matches paint immediately, the backend merges in after a debounce.
  useEffect(() => {
    const wantsWords = !command && term && (scope === 'all' || scope === 'words');
    if (!wantsWords) {
      setWordHits([]);
      setWordsLoading(false);
      return;
    }
    let cancelled = false;
    setWordHits(searchLocalWords(term, favorites, wordPool));
    setWordsLoading(true);
    const timer = window.setTimeout(() => {
      void searchWords(term, favorites, wordPool).then((hits) => {
        if (cancelled) return;
        setWordHits(hits);
        setWordsLoading(false);
      });
    }, WORD_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, command, scope, favorites, wordPool]);

  const pageHits = useMemo(
    () => (term || command ? searchPages(query, trans, { isLoggedIn, isSuperAdmin }) : []),
    [query, term, command, trans, isLoggedIn, isSuperAdmin],
  );
  const contentHits = useMemo(() => (term && !command ? searchContent(term, homeContent) : []), [term, command, homeContent]);

  const sections = useMemo(() => {
    if (command) return [{ id: 'pages' as const, hits: pageHits as WordNewSearchHit[] }];
    const pick = (id: 'pages' | 'content' | 'words', hits: WordNewSearchHit[]) =>
      scope === 'all' ? hits.slice(0, ALL_SCOPE_LIMITS[id]) : scope === id ? hits.slice(0, SCOPED_LIMIT) : [];
    return [
      { id: 'pages' as const, hits: pick('pages', pageHits) },
      { id: 'content' as const, hits: pick('content', contentHits) },
      { id: 'words' as const, hits: pick('words', wordHits) },
    ].filter((section) => section.hits.length > 0);
  }, [command, scope, pageHits, contentHits, wordHits]);

  const flatHits = useMemo(() => sections.flatMap((section) => section.hits), [sections]);
  const counts: Record<WordNewSearchScope, number> = {
    all: pageHits.length + contentHits.length + wordHits.length,
    pages: pageHits.length,
    content: contentHits.length,
    words: wordHits.length,
  };

  useEffect(() => setActiveIndex(0), [query, scope]);

  useEffect(() => {
    const key = flatHits[activeIndex]?.key;
    if (!key || !listRef.current) return;
    listRef.current.querySelector(`[data-search-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, flatHits]);

  const openHit = useCallback((hit: WordNewSearchHit) => {
    if (term) wfNewSettings.pushSearchHistory(query.trim());
    if (hit.kind === 'word') {
      onSelectWord(hit.word);
      onClose();
      return;
    }
    onClose();
    if (hit.kind === 'page') onOpenPage(hit.tab);
    else onOpenContent(hit.group);
  }, [term, query, onSelectWord, onClose, onOpenPage, onOpenContent]);

  const forge = () => {
    wfNewSettings.pushSearchHistory(term);
    onClose();
    onForgeWord(term);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flatHits.length ? (i + 1) % flatHits.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flatHits.length ? (i - 1 + flatHits.length) % flatHits.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = flatHits[activeIndex];
      if (hit) openHit(hit);
      else if (term && !command) forge();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const toggleVoice = async () => {
    if (listening) {
      void capSTT.stop().catch(() => undefined);
      setListening(false);
      return;
    }
    setVoiceError('');
    setListening(true);
    try {
      const result = await capSTT.listenOnce({ language: STT_LANGUAGE[lang] ?? 'en-US', partialResults: false });
      if (result.transcript) setQuery(result.transcript.trim());
    } catch {
      setVoiceError(trans('search.voiceUnavailable'));
    } finally {
      setListening(false);
      inputRef.current?.focus();
    }
  };

  const sectionTitle = (id: 'pages' | 'content' | 'words') => trans(`search.section.${id}`);
  let rowIndex = -1;

  const panel = (
    <motion.div
      key="wf-global-search"
      className={`fixed inset-x-0 ${OVERLAY_Z.modal} flex flex-col`}
      style={{ top: viewport.offsetTop, height: viewport.height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex-1 min-h-0 flex justify-center px-2 sm:px-6 pb-2 sm:pb-8 pt-[calc(var(--wf-safe-top)+0.5rem)] sm:pt-[calc(var(--wf-safe-top)+8vh)] pointer-events-none">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={trans('tip.search')}
          initial={{ y: -12, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: -12, scale: 0.98 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="pointer-events-auto w-full max-w-2xl h-fit max-h-full min-h-0 flex flex-col rounded-3xl border border-slate-900/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        >
          <div className="shrink-0 p-2.5 sm:p-3 space-y-2.5 border-b border-slate-900/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 h-12 pl-3.5 pr-1.5 rounded-2xl bg-slate-900/5 dark:bg-slate-950/60 border border-slate-900/10 dark:border-white/5 focus-within:border-indigo-500/60">
              <Search className="w-4.5 h-4.5 shrink-0 text-zinc-400" />
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={listening ? trans('search.listening') : trans('search.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label={trans('search.placeholder')}
                className="min-w-0 flex-1 bg-transparent outline-none text-[15px] sm:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="shrink-0 p-2 rounded-full text-zinc-400 hover:bg-slate-900/10 dark:hover:bg-white/10 cursor-pointer" title={trans('search.clear')} aria-label={trans('search.clear')}>
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void toggleVoice()}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${listening ? 'bg-rose-500 text-white animate-pulse' : 'text-indigo-500 dark:text-indigo-300 hover:bg-indigo-500/10'}`}
                title={trans('search.voice')}
                aria-label={trans('search.voice')}
                aria-pressed={listening}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button type="button" onClick={onClose} className="shrink-0 h-9 px-2.5 rounded-full text-xs font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-900/10 dark:hover:bg-white/10 cursor-pointer" aria-label={trans('search.close')}>
                <span className="sm:hidden">{trans('search.cancel')}</span>
                <kbd className="hidden sm:inline font-mono text-[10px]">Esc</kbd>
              </button>
            </div>

            {!command && (
              <ChipGroup<WordNewSearchScope>
                role="tab"
                nowrap
                gapClassName="gap-1.5"
                className="no-scrollbar !pb-0"
                value={scope}
                onChange={setScope}
                chipClassName="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs"
                selectedClassName="bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-200"
                idleClassName="bg-transparent border-slate-900/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:bg-slate-900/5 dark:hover:bg-white/5"
                options={SCOPES.map((id) => ({
                  value: id,
                  label: (
                    <>
                      {trans(`search.scope.${id}`)}
                      {term && <span className="text-[10px] font-mono opacity-70">{counts[id]}</span>}
                    </>
                  ),
                }))}
              />
            )}
            {voiceError && <p className="px-1 text-[11px] text-amber-600 dark:text-amber-400">{voiceError}</p>}
          </div>

          <div ref={listRef} role="listbox" className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-3 space-y-3">
            {!term && !command && (
              <>
                {searchHistory.length > 0 && (
                  <section className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500"><History className="w-3.5 h-3.5" />{trans('search.recentTitle')}</h4>
                      <button type="button" onClick={() => wfNewSettings.setField('searchHistory', [])} className="text-[11px] font-bold text-zinc-500 hover:text-rose-500 cursor-pointer">{trans('search.clearHistory')}</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map((item) => (
                        <button key={item} type="button" onClick={() => { setQuery(item); inputRef.current?.focus(); }} className="max-w-full truncate h-8 px-3 rounded-full text-xs bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5 hover:border-indigo-500/40 cursor-pointer">
                          {item}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-1.5">
                  <h4 className="px-1 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">{trans('search.quickJump')}</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {WORDNEW_SEARCH_QUICK_TABS.map((tab) => {
                      const page = wordNewSearchPage(tab, trans);
                      const Icon = page.icon;
                      return (
                        <button key={tab} type="button" onClick={() => { onClose(); onOpenPage(tab); }} title={page.title} className="min-w-0 flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl bg-slate-900/5 dark:bg-white/5 hover:bg-indigo-500/10 cursor-pointer">
                          <Icon className="w-5 h-5 text-indigo-500 dark:text-indigo-300" />
                          <span className="w-full truncate text-center text-[10px] font-bold text-slate-600 dark:text-zinc-300">{page.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="px-1 text-[10px] text-zinc-500">{trans('search.commandHint', { prefix: WORDNEW_SEARCH_COMMAND_PREFIX })}</p>
                </section>

                <section className="space-y-1">
                  <h4 className="flex items-center gap-1.5 px-1 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500"><Star className="w-3.5 h-3.5 text-amber-400" />{trans('search.favorites')}</h4>
                  {favorites.length === 0 && <p className="px-1 py-4 text-center text-xs text-zinc-500">{trans('search.favoritesEmpty')}</p>}
                  {favorites.map((word) => {
                    const hit: WordNewWordHit = { kind: 'word', key: `fav:${word.id}`, word, score: 1 };
                    return (
                      <WfNewSearchRow key={hit.key} hit={hit} query="" active={false} favorite trans={trans}
                        onOpen={() => openHit(hit)} onHover={() => undefined}
                        onPlay={() => onPlayAudio(word)} onToggleFavorite={() => onToggleFavorite(word)} />
                    );
                  })}
                </section>
              </>
            )}

            {sections.map((section) => (
              <section key={section.id} className="space-y-0.5">
                <div className="flex items-center justify-between px-1 pb-0.5">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">{sectionTitle(section.id)}</h4>
                  {scope === 'all' && !command && counts[section.id] > section.hits.length && (
                    <button type="button" onClick={() => setScope(section.id)} className="text-[11px] font-bold text-indigo-500 dark:text-indigo-300 cursor-pointer">
                      {trans('search.showAll', { n: counts[section.id] })}
                    </button>
                  )}
                </div>
                {section.hits.map((hit) => {
                  rowIndex += 1;
                  const index = rowIndex;
                  return (
                    <WfNewSearchRow
                      key={hit.key}
                      hit={hit}
                      query={term}
                      active={index === activeIndex}
                      favorite={hit.kind === 'word' && favoriteIds.has(hit.word.id)}
                      trans={trans}
                      onOpen={() => openHit(hit)}
                      onHover={() => setActiveIndex(index)}
                      onPlay={() => hit.kind === 'word' && onPlayAudio(hit.word)}
                      onToggleFavorite={() => hit.kind === 'word' && onToggleFavorite(hit.word)}
                    />
                  );
                })}
              </section>
            ))}

            {term && wordsLoading && (scope === 'all' || scope === 'words') && !command && (
              <p className="flex items-center justify-center gap-2 py-3 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" />{trans('search.searching')}</p>
            )}

            {term && !wordsLoading && flatHits.length === 0 && (
              <p className="py-8 text-center text-xs text-zinc-500">{trans('search.empty', { q: term })}</p>
            )}

            {term && !command && !wordsLoading && (scope === 'all' || scope === 'words') && !wordHits.some((hit) => hit.word.text.toLowerCase() === term.toLowerCase()) && (
              <button type="button" onClick={forge} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-dashed border-fuchsia-500/40 text-left hover:bg-fuchsia-500/10 cursor-pointer">
                <span className="shrink-0 w-9 h-9 rounded-xl bg-fuchsia-500/10 text-fuchsia-500 flex items-center justify-center"><Wand2 className="w-4 h-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{trans('search.forge', { q: term })}</span>
              </button>
            )}
          </div>

          <div className="hidden sm:flex shrink-0 items-center gap-3 px-4 py-2 border-t border-slate-900/5 dark:border-white/5 text-[10px] font-mono text-zinc-500">
            <span><kbd>↑</kbd> <kbd>↓</kbd> {trans('search.hintMove')}</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" />{trans('search.hintOpen')}</span>
            <span className="ml-auto"><kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd></span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{isOpen && panel}</AnimatePresence>, document.body);
};
