
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';
import { LanguageCenter } from '../../i18n/LanguageCenter';

const DictionaryPage = () => {
  const { navigate, t, settings } = useContext(AppContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [query, settings.language.learningLanguages]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const language = settings.language.learningLanguages?.[0] || 'en';
      const response = await ApiCenter.words.search(searchQuery, language);

      if (response.success && response.data) {
        setResults(response.data);
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

  const handleWordClick = (wordId: string) => {
    navigate('word_detail', { wordId });
  };

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('courses')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <Icons.Back />
        </button>
        <h1 className="text-2xl font-bold dark:text-white">{t('dictionary.title') || 'Dictionary'}</h1>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          placeholder={t('dictionary.searchPlaceholder') || 'Type a word to search...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-4 pl-12 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 shadow-sm outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all"
          autoFocus
        />
        <div className="absolute left-4 top-4 text-slate-400">
          {loading ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> : '🔍'}
        </div>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-24">
        {!searched && (
          <div className="text-center mt-20 text-slate-400">
            <div className="text-4xl mb-4">📖</div>
            <p className="font-medium">{t('dictionary.emptyState') || 'Search for words to see definitions'}</p>
            <p className="text-sm mt-2">{t('dictionary.emptyStateHint') || 'Type at least 2 characters to start searching'}</p>
          </div>
        )}

        {loading && searched && (
          <div className="flex items-center justify-center p-10">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">{t('common.searching') || 'Searching...'}</span>
            </div>
          </div>
        )}

        {!loading && searched && results.length > 0 && (
          <>
            <div className="text-sm text-slate-500 px-1 mb-2">
              {t('dictionary.resultsCount') || 'Found'} {results.length} {results.length === 1 ? (t('dictionary.result') || 'result') : (t('dictionary.results') || 'results')}
            </div>
            {results.map((word) => (
              <Card
                key={word.id}
                className="animate-fade-in cursor-pointer hover:scale-[1.01] transition-all"
                onClick={() => handleWordClick(word.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold dark:text-white">{word.text}</h3>
                  {word.tags && word.tags.length > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 font-medium">
                      {word.tags[0]}
                    </span>
                  )}
                </div>
                {word.phonetic && (
                  <div className="text-blue-500 font-mono text-sm mb-2">{word.phonetic}</div>
                )}
                <p className="text-slate-700 dark:text-slate-300 font-medium mb-2">{word.translation}</p>
                {word.example && (
                  <p className="text-slate-500 text-sm italic">
                    "{word.example}"
                    {word.exampleTranslation && (
                      <span className="block text-slate-400 text-xs mt-1">
                        {word.exampleTranslation}
                      </span>
                    )}
                  </p>
                )}
                {word.masteryLevel !== undefined && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                        style={{ width: `${word.masteryLevel}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500 font-bold">{word.masteryLevel}%</span>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}

        {!loading && searched && query.trim().length >= 2 && results.length === 0 && (
          <div className="text-center mt-10 text-slate-500">
            <div className="text-4xl mb-4">🔍</div>
            <p className="font-medium mb-2">{t('dictionary.noResults') || 'No results found'}</p>
            <p className="text-sm text-slate-400">
              {t('dictionary.noResultsHint') || 'Try searching with a different word or check spelling'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DictionaryPage;
