/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Emoji ✕/📖/🔍 → lucide X/BookOpen/SearchX; dropped unused LanguageCenter import. Propagate the Iris layer to un-beautified siblings. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Spinner, EmptyState, BackButton, Badge, ProgressBar } from '../../components/UI';
import { X, BookOpen, SearchX } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';
import { Word } from '../../types';

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

      if (response.success && Array.isArray(response.data)) {
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
    <div className="ds-page h-full flex flex-col p-5 pt-12 animate-slide-up">
      {/* Minimal asymmetric top bar */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate('courses')} />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('dictionary.title') || 'Dictionary'}</h1>
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

      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-24">
        {!searched && (
          <EmptyState
            icon={<BookOpen className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
            title={t('dictionary.emptyState') || 'Search for words to see definitions'}
            description={t('dictionary.emptyStateHint') || 'Type at least 2 characters to start searching'}
            className="mt-16"
          />
        )}

        {loading && searched && (
          <Spinner size="md" className="mx-auto my-10" />
        )}

        {!loading && searched && results.length > 0 && (
          <>
            <div className="text-sm text-[var(--color-text-secondary)] px-1 mb-2">
              {t('dictionary.resultsCount') || 'Found'} {results.length} {results.length === 1 ? (t('dictionary.result') || 'result') : (t('dictionary.results') || 'results')}
            </div>
            {results.map((word) => (
              <Card
                key={word.id}
                className="animate-fade-in cursor-pointer hover:border-[var(--klein-ring)] transition-all"
                onClick={() => handleWordClick(word.id)}
              >
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] min-w-0 truncate">{word.text}</h3>
                  {word.tags && word.tags.length > 0 && (
                    <Badge tone="klein">{word.tags[0]}</Badge>
                  )}
                </div>
                {word.phonetic && (
                  <div className="text-[var(--klein-blue)] font-mono text-sm mb-2">{word.phonetic}</div>
                )}
                <p className="text-[var(--color-text-primary)] font-medium mb-2">{word.translation}</p>
                {word.example && (
                  <p className="text-[var(--color-text-secondary)] text-sm italic">
                    "{word.example}"
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
                    <span className="text-xs text-[var(--color-text-secondary)] font-bold">{word.masteryLevel}%</span>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}

        {!loading && searched && query.trim().length >= 2 && results.length === 0 && (
          <EmptyState
            icon={<SearchX className="w-10 h-10 text-[var(--color-text-tertiary)]" aria-hidden />}
            title={t('dictionary.noResults') || 'No results found'}
            description={t('dictionary.noResultsHint') || 'Try searching with a different word or check spelling'}
          />
        )}
      </div>
    </div>
  );
};

export default DictionaryPage;
