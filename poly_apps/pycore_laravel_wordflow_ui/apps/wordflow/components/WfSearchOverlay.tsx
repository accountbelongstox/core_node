import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, SearchX, Clock, Star, Globe, Sparkles, Volume2, RotateCw, Cloud, CornerDownLeft } from 'lucide-react';
import { Card, Icons, Spinner, EmptyState, Badge, ProgressBar, Portal } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wfAudioCenter } from '../services/WfAudioCenter';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

type DictionaryTab = 'search' | 'history' | 'favorites';
type SearchStyle = 1 | 2 | 3;

const STYLE_KEY = 'wf.search.style';
const ONLINE_KEY = 'wf.search.online';
const STYLE_CLASS: Record<SearchStyle, string> = { 1: 'is-spotlight', 2: 'is-sheet', 3: 'is-island' };
const STYLE_LABEL: Record<SearchStyle, string> = { 1: 'Spotlight', 2: 'Glass Sheet', 3: 'Floating Island' };

const loadStyle = (): SearchStyle => {
  if (typeof window === 'undefined') return 1;
  const raw = Number(window.localStorage.getItem(STYLE_KEY));
  return raw === 2 || raw === 3 ? raw : 1;
};
const loadOnline = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(ONLINE_KEY) !== '0';
};

/* ---- shared search engine (debounced lookup + persisted history/favourites) ---- */
function useDictionarySearch(active: boolean) {
  const { learningLanguage } = useWfApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  const [online, setOnline] = useState<boolean>(loadOnline);
  const [history, setHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Word[]>([]);
  const [tab, setTab] = useState<DictionaryTab>('search');
  const lastQuery = useRef('');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.all([
      StorageCenter.get<string[]>(StorageKey.DICTIONARY_HISTORY, []),
      StorageCenter.get<Word[]>(StorageKey.DICTIONARY_FAVORITES, []),
    ])
      .then(([h, f]) => {
        if (cancelled) return;
        setHistory(Array.isArray(h) ? h : []);
        setFavorites(Array.isArray(f) ? f : []);
      })
      .catch(() => { if (!cancelled) { setHistory([]); setFavorites([]); } });
    return () => { cancelled = true; };
  }, [active]);

  const performSearch = useCallback(async (q: string) => {
    setLoading(true);
    setSearched(true);
    setError(false);
    lastQuery.current = q;
    try {
      const language = learningLanguage || 'en';
      const res = await wordflowApi.request<any>(
        `/words/search?q=${encodeURIComponent(q)}&language=${encodeURIComponent(language)}&online=${online ? 1 : 0}`
      );
      const list: Word[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.results) ? res.results
        : Array.isArray(res?.words) ? res.words : [];
      setResults(list);
      setHistory((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const next = [q, ...base.filter((h) => h !== q)].slice(0, 10);
        StorageCenter.set(StorageKey.DICTIONARY_HISTORY, next);
        return next;
      });
    } catch (err) {
      console.error('[WfSearchOverlay] Search failed:', err);
      setResults([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [learningLanguage, online]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearched(false); setError(false); return; }
    const timer = setTimeout(() => performSearch(query), 500);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const retry = useCallback(() => {
    if (lastQuery.current.trim().length >= 2) performSearch(lastQuery.current);
  }, [performSearch]);

  const setOnlinePersist = (v: boolean) => {
    setOnline(v);
    try { window.localStorage.setItem(ONLINE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const toggleFavorite = (word: Word) => {
    const base = Array.isArray(favorites) ? favorites : [];
    const has = base.some((f) => f.id === word.id);
    const next = has ? base.filter((f) => f.id !== word.id) : [word, ...base];
    setFavorites(next);
    StorageCenter.set(StorageKey.DICTIONARY_FAVORITES, next);
  };
  const isFavorited = (id: string) => Array.isArray(favorites) && favorites.some((f) => f.id === id);
  const clearHistory = () => { setHistory([]); StorageCenter.remove(StorageKey.DICTIONARY_HISTORY); };

  return {
    query, setQuery, results, loading, searched, error, online, setOnline: setOnlinePersist,
    history, favorites, tab, setTab, toggleFavorite, isFavorited, clearHistory, retry,
    learningLanguage,
  };
}

const WordResultCard: React.FC<{
  word: Word; favorited: boolean; active?: boolean; lang?: string;
  onOpen: () => void; onFav: () => void; innerRef?: (el: HTMLDivElement | null) => void;
}> = ({ word, favorited, active, lang, onOpen, onFav, innerRef }) => {
  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    wfAudioCenter.playWord({ audioUrl: word.audioUrl, text: word.text, lang });
  };
  return (
    <motion.div
      layoutId={`card-${word.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`wf-search-ov__card ds-card ds-card-spot p-4 rounded-[var(--radius-card)] cursor-pointer border border-white/10 dark:border-white/5 bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md shadow-sm transition-[border-color,background-color] hover:bg-white/70 dark:hover:bg-zinc-900/60 ${active ? 'is-active ring-2 ring-[var(--klein-ring)]' : ''}`}
      onClick={onOpen}
    >
      <div ref={innerRef} aria-current={active ? 'true' : undefined} />
      <div className="flex justify-between items-start gap-3">
        <h3 className="text-lg font-extrabold text-[var(--color-text-primary)] min-w-0 truncate">{word.text}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {word.tags && word.tags.length > 0 && <Badge tone="klein">{word.tags[0]}</Badge>}
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={speak}
            className="ds-touch-target w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--klein-blue)] hover:bg-[var(--klein-blue-soft)] transition-colors"
            aria-label="Play pronunciation"
            title="Play pronunciation"
          >
            <Volume2 className="w-4.5 h-4.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={(e) => { e.stopPropagation(); onFav(); }}
            className="ds-touch-target w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--klein-blue-soft)] transition-colors"
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4.5 h-4.5 ${favorited ? 'text-amber-500' : 'text-[var(--color-text-tertiary)]'}`}
              fill={favorited ? 'currentColor' : 'none'} />
          </motion.button>
        </div>
      </div>
      {word.phonetic && <div className="text-[var(--klein-blue)] font-mono text-xs mt-1 font-semibold">{word.phonetic}</div>}
      {word.translation && <p className="text-[var(--color-text-primary)] font-bold mt-1 text-sm">{word.translation}</p>}
      {word.example && (
        <p className="text-[var(--color-text-secondary)] text-xs italic mt-1 pb-1">&quot;{word.example}&quot;</p>
      )}
      {word.masteryLevel !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar value={word.masteryLevel} className="flex-1" />
          <span className="text-xs text-[var(--color-text-secondary)] font-bold">{word.masteryLevel}%</span>
        </div>
      )}
    </motion.div>
  );
};

export const WfSearchOverlay: React.FC<{ open: boolean; onClose: () => void; topOffset?: number }> = ({
  open, onClose, topOffset = 80,
}) => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const eng = useDictionarySearch(open);
  const [style, setStyle] = useState<SearchStyle>(loadStyle);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLElement | null>(null);
  const activeIndexRef = useRef(-1);

  // Mount + enter/exit transition driven by `data-shown`.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(id);
  }, [open]);

  // Focus the input + lock background scroll + Escape-to-close while open.
  useEffect(() => {
    if (!open) return;
    const focus = setTimeout(() => inputRef.current?.focus(), 90);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(focus);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const pickStyle = (s: SearchStyle) => {
    setStyle(s);
    try { window.localStorage.setItem(STYLE_KEY, String(s)); } catch { /* ignore */ }
  };

  const openWord = useCallback((id: string) => {
    onClose();
    navigate(`${wfPath('word_detail')}?wordId=${encodeURIComponent(id)}`);
  }, [onClose, navigate]);

  // Reset the keyboard highlight whenever the visible list changes.
  useEffect(() => { setActiveIndex(-1); }, [eng.tab, eng.query, eng.results, eng.online]);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);
  useEffect(() => { activeItemRef.current?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);

  // Arrow Up/Down moves the highlight; Enter opens (or re-runs a history query).
  useEffect(() => {
    if (!open) return;
    const onNav = (e: KeyboardEvent) => {
      const list: (Word | string)[] =
        eng.tab === 'search' ? eng.results : eng.tab === 'favorites' ? eng.favorites : eng.history;
      if (!list.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % list.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? list.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        const idx = activeIndexRef.current;
        if (idx < 0 || idx >= list.length) return;
        e.preventDefault();
        const item = list[idx];
        if (eng.tab === 'history') { eng.setQuery(item as string); eng.setTab('search'); }
        else { openWord((item as Word).id); }
      }
    };
    document.addEventListener('keydown', onNav);
    return () => document.removeEventListener('keydown', onNav);
  }, [open, eng.tab, eng.results, eng.favorites, eng.history, eng.setQuery, eng.setTab, openWord]);

  if (!mounted) return null;

  const ph = t('dictionary.searchPlaceholder') || 'Type a word to search...';
  const caps = [
    { icon: <BookOpen className="w-3.5 h-3.5" />, label: t('dictionary.capSmart') || 'Smart Dictionary' },
    { icon: <Globe className="w-3.5 h-3.5" />, label: t('dictionary.capOnline') || 'Online Dictionary' },
    { icon: <Sparkles className="w-3.5 h-3.5" />, label: t('dictionary.capAi') || 'AI translations' },
  ];
  const tabs: { id: DictionaryTab; label: string }[] = [
    { id: 'search', label: t('dictionary.tabSearch') || 'Search' },
    { id: 'history', label: t('dictionary.tabHistory') || 'History' },
    { id: 'favorites', label: t('dictionary.tabFavorites') || 'Favorites' },
  ];

  const body = (
    <>
      {/* Search input */}
      <div className="wf-search-ov__inputwrap">
        <span className="wf-search-ov__inputicon">{eng.loading ? <Spinner size="sm" /> : <Icons.Search />}</span>
        <input
          ref={inputRef}
          type="text"
          value={eng.query}
          onChange={(e) => eng.setQuery(e.target.value)}
          placeholder={ph}
          className="wf-search-ov__input"
          aria-label={ph}
        />
        {eng.query && (
          <button type="button" onClick={() => eng.setQuery('')} className="wf-search-ov__clear" aria-label="Clear">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Capability hints */}
      <div className="wf-search-ov__caps">
        {caps.map((c) => (
          <span key={c.label} className="wf-search-ov__cap">{c.icon}{c.label}</span>
        ))}
      </div>

      {/* Online / Offline dictionary source */}
      <div className="wf-search-ov__source">
        <span className={`wf-search-ov__source-icon ${eng.online ? 'is-on' : ''}`} aria-hidden>
          <Cloud className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="wf-search-ov__source-title">
            {eng.online ? (t('dictionary.capOnline') || 'Online Dictionary') : (t('dictionary.capOffline') || 'Offline Dictionary')}
          </p>
          <p className="wf-search-ov__source-sub">
            {eng.online ? (t('dictionary.capAi') || 'AI-powered translations') : (t('dictionary.capLocal') || 'Local database')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={eng.online}
          onClick={() => eng.setOnline(!eng.online)}
          className={`wf-search-ov__switch ${eng.online ? 'is-on' : ''}`}
          aria-label={t('dictionary.capOnline') || 'Online Dictionary'}
        >
          <span className="wf-search-ov__switch-knob" />
        </button>
      </div>

      {/* Search / History / Favorites */}
      <div className="ds-pill-nav wf-search-ov__tabs" role="tablist" aria-label="Search view">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={eng.tab === tb.id}
            onClick={() => eng.setTab(tb.id)}
            className={`ds-pill-chip ${eng.tab === tb.id ? 'is-active' : ''}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="wf-search-ov__results no-scrollbar">
        {eng.tab === 'search' && (
          <>
            {!eng.searched && (
              <>
                <EmptyState
                  icon={<BookOpen className="w-8 h-8" aria-hidden />}
                  title={t('dictionary.emptyState') || 'Search for words'}
                  description={t('dictionary.emptyStateHint') || 'Type at least 2 characters to start searching'}
                />
                {eng.history.length > 0 && (
                  <div className="wf-search-ov__suggest">
                    <span className="wf-search-ov__suggest-label">
                      {t('dictionary.recentSearches') || 'Recent searches'}
                    </span>
                    <div className="wf-search-ov__suggest-chips">
                      {eng.history.slice(0, 6).map((item, i) => (
                        <button
                          key={`${item}-${i}`}
                          type="button"
                          onClick={() => eng.setQuery(item)}
                          className="wf-search-ov__suggest-chip"
                        >
                          <Clock className="w-3.5 h-3.5" />{item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {eng.loading && eng.searched && <Spinner size="md" className="mx-auto my-8" />}
            {!eng.loading && eng.error && (
              <EmptyState
                icon={<SearchX className="w-8 h-8" aria-hidden />}
                title={t('dictionary.searchError') || 'Search failed'}
                description={t('dictionary.searchErrorHint') || 'Check your connection and try again'}
                action={
                  <button type="button" onClick={eng.retry} className="wf-search-ov__retry">
                    <RotateCw className="w-4 h-4" />{t('common.retry') || 'Retry'}
                  </button>
                }
              />
            )}
            {!eng.loading && !eng.error && eng.searched && eng.results.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-[var(--color-text-secondary)] px-1">
                  {(t('dictionary.resultsCount') || 'Found')} {eng.results.length}
                </div>
                {eng.results.map((w, i) => (
                  <WordResultCard
                    key={w.id} word={w} favorited={eng.isFavorited(w.id)}
                    active={i === activeIndex} lang={eng.learningLanguage}
                    innerRef={i === activeIndex ? (el) => { activeItemRef.current = el; } : undefined}
                    onOpen={() => openWord(w.id)} onFav={() => eng.toggleFavorite(w)}
                  />
                ))}
              </div>
            )}
            {!eng.loading && !eng.error && eng.searched && eng.query.trim().length >= 2 && eng.results.length === 0 && (
              <EmptyState
                icon={<SearchX className="w-8 h-8" aria-hidden />}
                title={t('dictionary.noResults') || 'No results found'}
                description={t('dictionary.noResultsHint') || 'Try a different word or check the spelling'}
              />
            )}
          </>
        )}

        {eng.tab === 'history' && (
          eng.history.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8" aria-hidden />}
              title={t('dictionary.noHistory') || 'No search history'}
              description={t('dictionary.noHistoryHint') || 'Your recent searches will appear here'}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  {t('dictionary.recentSearches') || 'Recent searches'}
                </span>
                <button type="button" onClick={eng.clearHistory}
                  className="text-xs font-semibold text-red-500 hover:underline">
                  {t('common.clearAll') || 'Clear all'}
                </button>
              </div>
              {eng.history.map((item, i) => (
                <button
                  key={`${item}-${i}`}
                  type="button"
                  ref={i === activeIndex ? (el) => { activeItemRef.current = el; } : undefined}
                  onClick={() => { eng.setQuery(item); eng.setTab('search'); }}
                  className={`wf-search-ov__row ${i === activeIndex ? 'is-active' : ''}`}
                >
                  <span className="text-[var(--klein-blue)]"><Clock className="w-4 h-4" /></span>
                  <span className="flex-1 text-left truncate text-[var(--color-text-primary)]">{item}</span>
                  <Icons.ChevronRight />
                </button>
              ))}
            </div>
          )
        )}

        {eng.tab === 'favorites' && (
          eng.favorites.length === 0 ? (
            <EmptyState
              icon={<Star className="w-8 h-8" aria-hidden />}
              title={t('dictionary.noFavorites') || 'No favorites yet'}
              description={t('dictionary.noFavoritesHint') || 'Star words to save them here'}
            />
          ) : (
            <div className="space-y-3">
              {eng.favorites.map((w, i) => (
                <WordResultCard
                  key={w.id} word={w} favorited
                  active={i === activeIndex} lang={eng.learningLanguage}
                  innerRef={i === activeIndex ? (el) => { activeItemRef.current = el; } : undefined}
                  onOpen={() => openWord(w.id)} onFav={() => eng.toggleFavorite(w)}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Keyboard hint footer (command-palette affordance) */}
      <div className="wf-search-ov__hints" aria-hidden>
        <span><kbd>↑</kbd><kbd>↓</kbd> {t('dictionary.kbdNavigate') || 'navigate'}</span>
        <span><kbd><CornerDownLeft className="w-3 h-3" /></kbd> {t('dictionary.kbdOpen') || 'open'}</span>
        <span><kbd>esc</kbd> {t('common.close') || 'close'}</span>
      </div>
    </>
  );

  const panelVariants = {
    hidden: style === 1
      ? { opacity: 0, y: -24, scale: 0.98 }
      : style === 2
      ? { opacity: 0, y: -30 }
      : { opacity: 0, y: 24, scale: 0.92 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        damping: style === 3 ? 18 : 24,
        stiffness: style === 3 ? 240 : 320
      }
    },
    exit: style === 1
      ? { opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.15 } }
      : style === 2
      ? { opacity: 0, y: -20, transition: { duration: 0.15 } }
      : { opacity: 0, y: 16, scale: 0.94, transition: { duration: 0.15 } }
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className={`wf-search-ov ${STYLE_CLASS[style]}`} role="dialog" aria-modal="true"
            aria-label={t('header.searchPlaceholder') || 'Search'}>
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="wf-search-ov__backdrop" 
              onClick={onClose} 
              aria-hidden 
            />

            {/* Panel */}
            <motion.div 
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="wf-search-ov__panel" 
              style={{ ['--wf-ov-top' as any]: `${topOffset}px` }}
            >
              {/* gradient orbs (style 3) + frosted header accents */}
              <span className="wf-search-ov__orb wf-search-ov__orb--a" aria-hidden />
              <span className="wf-search-ov__orb wf-search-ov__orb--b" aria-hidden />

              {/* header row: title + style switcher + close */}
              <div className="wf-search-ov__head">
                <div className="wf-search-ov__title">
                  <span className="wf-search-ov__title-orb text-white" aria-hidden>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </span>
                  <span className="font-extrabold tracking-tight bg-gradient-to-r from-[var(--color-text-primary)] to-[var(--color-text-secondary)] bg-clip-text text-transparent">
                    {t('dictionary.title') || 'Smart Search'}
                  </span>
                </div>
                <div className="wf-search-ov__styles" role="group" aria-label="Search style">
                  {([1, 2, 3] as SearchStyle[]).map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => pickStyle(s)}
                      className={`wf-search-ov__style ${style === s ? 'is-active font-black' : ''}`}
                      title={`Style ${s} — ${STYLE_LABEL[s]}`}
                      aria-pressed={style === s}
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  type="button" 
                  onClick={onClose} 
                  className="wf-search-ov__close shadow-sm" 
                  aria-label={t('common.close') || 'Close'}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {body}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
};

export default WfSearchOverlay;
