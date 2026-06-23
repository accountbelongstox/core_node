/* [v4.1-Iris] Search Dictionary — ported from qy_capacitor/pages/Search/Dictionary.tsx
 * + the search history / favorites blocks of qy_capacitor/pages/Tools/Dictionary.tsx.
 * Self-contained: react-router useNavigate + wfPath() for nav, learning language
 * from useWfApp(). Debounced (500ms) word search against the backend via
 * wordflowApi.request(); the original used ApiCenter.words.search. Search /
 * History / Favorites pill tabs; history (last 10 queries) and starred words
 * persist locally via StorageKey.DICTIONARY_HISTORY / DICTIONARY_FAVORITES.
 * Every call is try/caught and degrades to an empty/EmptyState — never crashes.
 * Faithful Iris look (glass search pill, result cards, lucide icons). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, SearchX, Clock, Star } from 'lucide-react';
import { Card, Icons, Spinner, EmptyState, BackButton, Badge, ProgressBar, SectionLabel } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';

type DictionaryTab = 'search' | 'history' | 'favorites';

const WfSearchDictionaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const { learningLanguage } = useWfApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<DictionaryTab>('search');

  // Load persisted search history + favorites (original Tools/Dictionary block).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      StorageCenter.get<string[]>(StorageKey.DICTIONARY_HISTORY, []),
      StorageCenter.get<Word[]>(StorageKey.DICTIONARY_FAVORITES, []),
    ])
      .then(([history, favs]) => {
        if (cancelled) return;
        setSearchHistory(Array.isArray(history) ? history : []);
        setFavorites(Array.isArray(favs) ? favs : []);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchHistory([]);
        setFavorites([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const language = learningLanguage || 'en';
      const response = await wordflowApi.request<any>(
        `/words/search?q=${encodeURIComponent(searchQuery)}&language=${encodeURIComponent(language)}`
      );
      const list: Word[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response?.words)
            ? response.words
            : [];
      setResults(list);
      // Record the query in the persisted history (most recent first, max 10).
      setSearchHistory((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const newHistory = [searchQuery, ...base.filter((h) => h !== searchQuery)].slice(0, 10);
        StorageCenter.set(StorageKey.DICTIONARY_HISTORY, newHistory);
        return newHistory;
      });
    } catch (err) {
      console.error('[WfSearchDictionary] Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (word: Word) => {
    const base = Array.isArray(favorites) ? favorites : [];
    const alreadyFavorited = base.some((f) => f.id === word.id);
    const newFavorites = alreadyFavorited ? base.filter((f) => f.id !== word.id) : [word, ...base];
    setFavorites(newFavorites);
    StorageCenter.set(StorageKey.DICTIONARY_FAVORITES, newFavorites);
  };

  const isFavorited = (wordId: string) =>
    Array.isArray(favorites) && favorites.some((f) => f.id === wordId);

  const clearHistory = () => {
    setSearchHistory([]);
    StorageCenter.remove(StorageKey.DICTIONARY_HISTORY);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setActiveTab('search');
  };

  // Debounced search (500ms) — re-runs on query or learning-language change.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => performSearch(query), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, learningLanguage]);

  const handleWordClick = (wordId: string) => {
    navigate(`${wfPath('word_detail')}?wordId=${encodeURIComponent(wordId)}`);
  };

  return (
    <div className="ds-page h-full flex flex-col p-5 pt-12 animate-slide-up">
      {/* Minimal asymmetric top bar */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate(wfPath('courses'))} />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('dictionary.title') || 'Dictionary'}
        </h1>
      </div>

      <div className="relative mb-7">
        <input
          type="text"
          placeholder={t('dictionary.searchPlaceholder') || 'Type a word to search...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-14 pl-12 pr-14 rounded-full ds-glass ds-glass-edge outline-none focus:ring-2 focus:ring-[var(--klein-ring)] text-[var(--color-text-primary)] transition-all"
          autoFocus
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
          {loading ? <Spinner size="sm" /> : <Icons.Search />}
        </div>
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--klein-blue-soft)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search / History / Favorites pill tabs (original Tools/Dictionary block) */}
      <div className="ds-pill-nav mb-5" role="tablist" aria-label="Dictionary view">
        {(
          [
            // Hardcoded English like the original Tools/Dictionary tabs.
            { id: 'search', label: 'Search' },
            { id: 'history', label: 'History' },
            { id: 'favorites', label: 'Favorites' },
          ] as { id: DictionaryTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`ds-pill-chip ${activeTab === tab.id ? 'is-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-24">
        {/* Search tab */}
        {activeTab === 'search' && !searched && (
          <EmptyState
            icon={<BookOpen className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
            title={t('dictionary.emptyState') || 'Search for words to see definitions'}
            description={t('dictionary.emptyStateHint') || 'Type at least 2 characters to start searching'}
            className="mt-16"
          />
        )}

        {activeTab === 'search' && loading && searched && <Spinner size="md" className="mx-auto my-10" />}

        {activeTab === 'search' && !loading && searched && results.length > 0 && (
          <>
            <div className="text-sm text-[var(--color-text-secondary)] px-1 mb-2">
              {t('dictionary.resultsCount') || 'Found'} {results.length}{' '}
              {results.length === 1
                ? t('dictionary.result') || 'result'
                : t('dictionary.results') || 'results'}
            </div>
            {results.map((word) => (
              <Card
                key={word.id}
                className="animate-fade-in cursor-pointer hover:border-[var(--klein-ring)] transition-all"
                onClick={() => handleWordClick(word.id)}
              >
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] min-w-0 truncate">
                    {word.text}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {word.tags && word.tags.length > 0 && <Badge tone="klein">{word.tags[0]}</Badge>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(word);
                      }}
                      className="ds-touch-target flex items-center justify-center rounded-lg hover:bg-[var(--klein-blue-soft)] transition-colors"
                      title={isFavorited(word.id) ? 'Remove from favorites' : 'Add to favorites'}
                      aria-label={isFavorited(word.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        className={`w-5 h-5 ${isFavorited(word.id) ? 'text-yellow-500' : 'text-[var(--color-text-tertiary)]'}`}
                        fill={isFavorited(word.id) ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>
                </div>
                {word.phonetic && (
                  <div className="text-[var(--klein-blue)] font-mono text-sm mb-2">{word.phonetic}</div>
                )}
                <p className="text-[var(--color-text-primary)] font-medium mb-2">{word.translation}</p>
                {word.example && (
                  <p className="text-[var(--color-text-secondary)] text-sm italic">
                    &quot;{word.example}&quot;
                    {word.exampleTranslation && (
                      <span className="block text-[var(--color-text-tertiary)] text-xs mt-1">
                        {word.exampleTranslation}
                      </span>
                    )}
                  </p>
                )}
                {word.masteryLevel !== undefined && (
                  <div className="mt-3 flex items-center gap-2">
                    <ProgressBar value={word.masteryLevel} className="flex-1" />
                    <span className="text-xs text-[var(--color-text-secondary)] font-bold">
                      {word.masteryLevel}%
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}

        {activeTab === 'search' && !loading && searched && query.trim().length >= 2 && results.length === 0 && (
          <EmptyState
            icon={<SearchX className="w-10 h-10 text-[var(--color-text-tertiary)]" aria-hidden />}
            title={t('dictionary.noResults') || 'No results found'}
            description={t('dictionary.noResultsHint') || 'Try searching with a different word or check spelling'}
          />
        )}

        {/* History tab */}
        {activeTab === 'history' &&
          (searchHistory.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-10 h-10 text-[var(--color-text-tertiary)]" aria-hidden />}
              title="No search history"
              description="Your recent searches will appear here"
              className="mt-16"
            />
          ) : (
            <div className="space-y-3">
              <SectionLabel
                className="px-1"
                action={
                  <button
                    onClick={clearHistory}
                    className="text-sm font-semibold text-red-500 hover:underline flex-shrink-0"
                  >
                    Clear All
                  </button>
                }
              >
                Recent Searches
              </SectionLabel>
              {searchHistory.map((item, index) => (
                <Card
                  key={index}
                  onClick={() => handleHistoryClick(item)}
                  className="cursor-pointer hover:border-[var(--klein-ring)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--klein-blue)]">
                      <Icons.Search />
                    </span>
                    <span className="flex-1 text-[var(--color-text-primary)]">{item}</span>
                    <Icons.ChevronRight />
                  </div>
                </Card>
              ))}
            </div>
          ))}

        {/* Favorites tab */}
        {activeTab === 'favorites' &&
          (favorites.length === 0 ? (
            <EmptyState
              icon={<Star className="w-10 h-10 text-[var(--color-text-tertiary)]" aria-hidden />}
              title="No favorites yet"
              description="Star words to save them here for quick access"
              className="mt-16"
            />
          ) : (
            favorites.map((word) => (
              <Card
                key={word.id}
                className="cursor-pointer hover:border-[var(--klein-ring)] transition-all"
                onClick={() => handleWordClick(word.id)}
              >
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] min-w-0 truncate">
                    {word.text}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(word);
                    }}
                    className="ds-touch-target flex items-center justify-center rounded-lg hover:bg-[var(--klein-blue-soft)] transition-colors shrink-0"
                    title="Remove from favorites"
                    aria-label="Remove from favorites"
                  >
                    <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
                  </button>
                </div>
                {word.phonetic && (
                  <div className="text-[var(--klein-blue)] font-mono text-sm mb-2">{word.phonetic}</div>
                )}
                {word.translation && (
                  <p className="text-[var(--color-text-primary)] font-medium mb-1">{word.translation}</p>
                )}
                {word.definition && (
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{word.definition}</p>
                )}
              </Card>
            ))
          ))}
      </div>
    </div>
  );
};

export default WfSearchDictionaryPage;
