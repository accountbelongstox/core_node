import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';

interface Library {
  id: number;
  name: string;
  description?: string;
  word_count: number;
  language?: string;
  level?: string;
  category?: string;
  is_system?: boolean;
}

export default function LearnLibrary() {
  const { navigate, t } = useContext(AppContext);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');

  useEffect(() => {
    loadLibraries();
  }, [activeTab, selectedLanguage]);

  const loadLibraries = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.vocabulary.getLibraries({
        language: selectedLanguage || undefined,
      });

      if (result.success && result.data) {
        const allLibs = result.data;
        if (activeTab === 'mine') {
          setLibraries(allLibs.filter(lib => !lib.is_system));
        } else {
          setLibraries(allLibs);
        }
      }
    } catch (error) {
      console.error('Failed to load libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLibraryClick = (library: Library) => {
    navigate(`learn/practice?library=${library.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('nav.library')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('library.explore')} {t('library.collections')}
          </p>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('library.all')}
            </button>
            <button
              onClick={() => setActiveTab('mine')}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-colors ${
                activeTab === 'mine'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('library.myBooks')}
            </button>
          </div>

          {/* Language Filter */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.language')}
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="zh">Chinese</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-4">
        {/* Import Document Button */}
        <button
          onClick={() => navigate('tools/article-processor')}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>{t('library.importDocument')}</span>
        </button>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">{t('common.loading')}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && libraries.length === 0 && (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-12">
            <Icons.Library />
            <p className="mt-4 text-slate-600 dark:text-slate-400">{t('library.noBooksFound')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
              Try adjusting your filters or importing new content
            </p>
          </Card>
        )}

        {/* Libraries Grid */}
        {!loading && libraries.length > 0 && (
          <div className="space-y-4">
            {libraries.map((library) => (
              <Card
                key={library.id}
                onClick={() => handleLibraryClick(library)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                    <Icons.Book />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 truncate">
                      {library.name}
                    </h3>
                    {library.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                        {library.description}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {library.language && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded font-medium">
                          {library.language.toUpperCase()}
                        </span>
                      )}
                      {library.level && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded font-medium">
                          {library.level}
                        </span>
                      )}
                      {library.category && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 text-xs rounded font-medium">
                          {library.category}
                        </span>
                      )}
                      {library.is_system && (
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded font-medium">
                          System
                        </span>
                      )}
                    </div>

                    {/* Word Count */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>{library.word_count} {t('library.words')}</span>
                    </div>
                  </div>

                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
