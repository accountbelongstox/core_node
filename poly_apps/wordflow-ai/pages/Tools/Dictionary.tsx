import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';

export default function ToolsDictionary() {
  const { navigate, t, settings } = useContext(AppContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'favorites'>('search');

  // Load search history and favorites
  useEffect(() => {
    const history = localStorage.getItem('dictionaryHistory');
    const favs = localStorage.getItem('dictionaryFavorites');
    if (history) setSearchHistory(JSON.parse(history));
    if (favs) setFavorites(JSON.parse(favs));
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, settings.language.learningLanguages, isOnline]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const language = settings.language.learningLanguages?.[0] || 'en';
      const response = await ApiCenter.words.search(searchQuery, language);

      if (response.success && response.data) {
        setResults(response.data);
        // Add to history
        const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem('dictionaryHistory', JSON.stringify(newHistory));
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('[Dictionary] Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (word: Word) => {
    const isFavorited = favorites.some(f => f.id === word.id);
    let newFavorites;

    if (isFavorited) {
      newFavorites = favorites.filter(f => f.id !== word.id);
    } else {
      newFavorites = [word, ...favorites];
    }

    setFavorites(newFavorites);
    localStorage.setItem('dictionaryFavorites', JSON.stringify(newFavorites));
  };

  const isFavorited = (wordId: string) => {
    return favorites.some(f => f.id === wordId);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('dictionaryHistory');
  };

  const handleWordClick = (word: Word) => {
    navigate(`word_detail?wordId=${word.id}`);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setActiveTab('search');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-4 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Smart Dictionary
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Search words and phrases in multiple languages
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Type a word to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full p-4 pl-12 pr-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 ring-blue-500 text-slate-900 dark:text-white transition-all"
              autoFocus
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              {loading ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Icons.Search />
              )}
            </div>
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icons.Close />
              </button>
            )}
          </div>

          {/* Online/Offline Toggle */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOnline ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <Icons.Cloud />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isOnline ? 'Online Dictionary' : 'Offline Dictionary'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isOnline ? 'AI-powered translations' : 'Local database'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`w-12 h-7 rounded-full p-1 transition-colors ${isOnline ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isOnline ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                activeTab === 'search'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                activeTab === 'favorites'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Favorites
            </button>
          </div>
        </div>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-4">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <>
            {!searched && (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
                <div className="text-6xl mb-4">📖</div>
                <p className="font-semibold text-slate-900 dark:text-white mb-2">Search for words</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Type at least 2 characters to start searching
                </p>
              </Card>
            )}

            {loading && searched && (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Searching...</p>
              </Card>
            )}

            {!loading && searched && results.length === 0 && (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <p className="font-semibold text-slate-900 dark:text-white mb-2">No results found</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Try different keywords or check your spelling
                </p>
              </Card>
            )}

            {!loading && searched && results.length > 0 && (
              <div className="space-y-3">
                {results.map((word) => (
                  <Card
                    key={word.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1" onClick={() => handleWordClick(word)}>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                          {word.text}
                        </h3>
                        {word.phonetic && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                            {word.phonetic}
                          </p>
                        )}
                        {word.definition && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {word.definition}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(word);
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {isFavorited(word.id) ? (
                          <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <>
            {searchHistory.length === 0 ? (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
                <div className="text-6xl mb-4">🕐</div>
                <p className="font-semibold text-slate-900 dark:text-white mb-2">No search history</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your recent searches will appear here
                </p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Recent Searches
                  </h2>
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {searchHistory.map((item, index) => (
                    <Card
                      key={index}
                      onClick={() => handleHistoryClick(item)}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Icons.Search />
                        <span className="flex-1 text-slate-900 dark:text-white">{item}</span>
                        <Icons.ChevronRight />
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <>
            {favorites.length === 0 ? (
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
                <div className="text-6xl mb-4">⭐</div>
                <p className="font-semibold text-slate-900 dark:text-white mb-2">No favorites yet</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Star words to save them here for quick access
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {favorites.map((word) => (
                  <Card
                    key={word.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1" onClick={() => handleWordClick(word)}>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                          {word.text}
                        </h3>
                        {word.phonetic && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                            {word.phonetic}
                          </p>
                        )}
                        {word.definition && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {word.definition}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(word);
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
