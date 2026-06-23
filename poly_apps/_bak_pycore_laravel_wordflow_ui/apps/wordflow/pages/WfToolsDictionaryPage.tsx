/* [v4.1-Iris] Smart Dictionary — ported from
 * poly_apps/qy_capacitor/pages/Tools/Dictionary.tsx. Self-contained: debounced
 * word search via wfTranslationCenter.lookup() (wraps the public GET /lookup
 * surface with a ~30-min word+language cache), search history + favorites
 * persisted in localStorage, react-router useNavigate + wfPath() for nav,
 * useWfApp() for the learning language. Every API call try/caught; degrades to
 * empty states instead of crashing. Faithful Iris look. */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, SearchX, Clock, Star } from 'lucide-react';
import { Card, Icons, Spinner, LoadingState, SectionTitle } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wfTranslationCenter } from '../services/WfTranslationCenter';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

const HISTORY_KEY = 'wf_dictionary_history';
const FAVORITES_KEY = 'wf_dictionary_favorites';

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

const WfToolsDictionaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { learningLanguage } = useWfApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'favorites'>('search');

  // Load search history + favorites from localStorage.
  useEffect(() => {
    setSearchHistory(readStore<string[]>(HISTORY_KEY, []));
    setFavorites(readStore<Word[]>(FAVORITES_KEY, []));
  }, []);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const language = learningLanguage || 'en';
      // Live-verified: /qurey_word is unusable from the web client (it sits
      // behind the Client-Token middleware and its route binding is broken —
      // ArgumentCountError even with a valid client token). The public
      // GET /lookup?word=&language= is the supported dictionary surface —
      // wrapped (incl. response normalization + the ~30-min word+language
      // cache) by wfTranslationCenter. A miss is HTTP 404 (caught below).
      const list: Word[] = await wfTranslationCenter.lookup(searchQuery, language);
      setResults(list);

      if (list.length > 0) {
        setSearchHistory((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const next = [searchQuery, ...base.filter((h) => h !== searchQuery)].slice(0, 10);
          writeStore(HISTORY_KEY, next);
          return next;
        });
      }
    } catch (err) {
      console.error('[WfDictionary] Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => performSearch(query.trim()), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, learningLanguage, isOnline]);

  const toggleFavorite = (word: Word) => {
    const base = Array.isArray(favorites) ? favorites : [];
    const alreadyFavorited = base.some((f) => f.id === word.id);
    const next = alreadyFavorited ? base.filter((f) => f.id !== word.id) : [word, ...base];
    setFavorites(next);
    writeStore(FAVORITES_KEY, next);
  };

  const isFavorited = (wordId: string) =>
    Array.isArray(favorites) && favorites.some((f) => f.id === wordId);

  const clearHistory = () => {
    setSearchHistory([]);
    writeStore(HISTORY_KEY, []);
  };

  const handleWordClick = (word: Word) => {
    navigate(wfPath(`word_detail?wordId=${encodeURIComponent(word.id)}`));
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setActiveTab('search');
  };

  const tabs = [
    { id: 'search', label: 'Search' },
    { id: 'history', label: 'History' },
    { id: 'favorites', label: 'Favorites' },
  ];

  const renderWordCard = (word: Word, forceStar = false) => (
    <Card key={word.id} className="cursor-pointer hover:scale-[1.01] transition-transform">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1" onClick={() => handleWordClick(word)}>
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">{word.text}</h3>
          {word.phonetic && <p className="text-sm text-[var(--klein-blue)] mb-2">{word.phonetic}</p>}
          {(word.definition || word.translation) && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
              {word.definition || word.translation}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(word);
          }}
          className="ds-touch-target flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
        >
          {forceStar || isFavorited(word.id) ? (
            <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
        </button>
      </div>
    </Card>
  );

  return (
    <div className="ds-page ds-section-gap route-fade pt-20 pb-32">
      {/* Header */}
      <div className="px-1">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Search words and phrases in multiple languages
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
          Smart Dictionary
        </h1>
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Type a word to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ds-glass ds-glass-edge w-full p-4 pl-12 pr-12 rounded-full outline-none focus:ring-2 focus:ring-[var(--klein-ring)] text-[var(--color-text-primary)] transition-all"
          autoFocus
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--klein-blue)]">
          {loading ? <Spinner size="sm" /> : <Icons.Search />}
        </div>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <Icons.Close />
          </button>
        )}
      </div>

      {/* Online/Offline toggle */}
      <div className="ds-row flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOnline ? 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}>
            <Icons.Cloud />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isOnline ? 'Online Dictionary' : 'Offline Dictionary'}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {isOnline ? 'AI-powered translations' : 'Local database'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`w-12 h-7 rounded-full p-1 transition-colors ${isOnline ? 'bg-[var(--klein-blue)]' : 'bg-[var(--color-surface)] border border-[var(--border-highlight)]'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isOnline ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Tabs — pill nav */}
      <div className="ds-pill-nav" role="tablist" aria-label="Dictionary view">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as 'search' | 'history' | 'favorites')}
            className={`ds-pill-chip ${activeTab === tab.id ? 'is-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ds-stack">
        {/* Search tab */}
        {activeTab === 'search' && (
          <>
            {!searched && (
              <Card className="text-center py-12">
                <BookOpen className="w-14 h-14 mx-auto mb-4 text-[var(--klein-blue)]" strokeWidth={1.5} />
                <p className="font-semibold text-[var(--color-text-primary)] mb-2">Search for words</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Type at least 2 characters to start searching
                </p>
              </Card>
            )}

            {loading && searched && (
              <Card>
                <LoadingState label="Searching..." />
              </Card>
            )}

            {!loading && searched && (!Array.isArray(results) || results.length === 0) && (
              <Card className="text-center py-12">
                <SearchX className="w-14 h-14 mx-auto mb-4 text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
                <p className="font-semibold text-[var(--color-text-primary)] mb-2">No results found</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Try different keywords or check your spelling
                </p>
              </Card>
            )}

            {!loading && searched && Array.isArray(results) && results.length > 0 && (
              <div className="ds-stack-tight">{results.map((word) => renderWordCard(word))}</div>
            )}
          </>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <>
            {!Array.isArray(searchHistory) || searchHistory.length === 0 ? (
              <Card className="text-center py-12">
                <Clock className="w-14 h-14 mx-auto mb-4 text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
                <p className="font-semibold text-[var(--color-text-primary)] mb-2">No search history</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Your recent searches will appear here
                </p>
              </Card>
            ) : (
              <div className="ds-stack-tight">
                <SectionTitle
                  title="Recent Searches"
                  className="px-1"
                  action={
                    <button
                      onClick={clearHistory}
                      className="text-sm font-semibold text-red-500 hover:underline flex-shrink-0"
                    >
                      Clear All
                    </button>
                  }
                />
                {searchHistory.map((item, index) => (
                  <Card
                    key={index}
                    onClick={() => handleHistoryClick(item)}
                    className="cursor-pointer hover:scale-[1.01] transition-transform"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--klein-blue)]"><Icons.Search /></span>
                      <span className="flex-1 text-[var(--color-text-primary)]">{item}</span>
                      <Icons.ChevronRight />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          <>
            {!Array.isArray(favorites) || favorites.length === 0 ? (
              <Card className="text-center py-12">
                <Star className="w-14 h-14 mx-auto mb-4 text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
                <p className="font-semibold text-[var(--color-text-primary)] mb-2">No favorites yet</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Star words to save them here for quick access
                </p>
              </Card>
            ) : (
              <div className="ds-stack-tight">
                {favorites.map((word) => renderWordCard(word, true))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WfToolsDictionaryPage;
