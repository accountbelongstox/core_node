import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, Star, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../core/api';
import { useLoadingError } from '../../hooks';
import { commonClasses } from '../../styles/theme';

interface LibraryBrowserProps {
  onLibrarySelected: (library: any) => void;
}

const LibraryBrowser: React.FC<LibraryBrowserProps> = ({ onLibrarySelected }) => {
  const [libraries, setLibraries] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const { loading, error, setLoading, setError } = useLoadingError();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [languages, setLanguages] = useState<any[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedLanguage, selectedDifficulty]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [libRes, recRes] = await Promise.all([
        api.appQyV1.getLibraries({
          language: selectedLanguage !== 'all' ? selectedLanguage : undefined,
          difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
          search: searchQuery || undefined,
          page: 1,
          per_page: 50
        }),
        api.appQyV1.getRecommendedLibraries({ limit: 6 })
      ]);

      if (libRes.success && libRes.data) {
        const libData = libRes.data as any;
        setLibraries(libData.libraries || libData.data?.libraries || libData);
      }

      if (recRes.success && recRes.data) {
        setRecommended(recRes.data as any);
      }

      // 设置默认语言列表
      setLanguages([
        { code: 'all', name: 'All Languages' },
        { code: 'english', name: 'English' },
        { code: 'lao', name: 'Lao' },
        { code: 'japanese', name: 'Japanese' },
        { code: 'vietnamese', name: 'Vietnamese' }
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load libraries');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLibrary = async (library: any) => {
    setSelecting(library.id);
    setError(null);

    try {
      // Note: 需要在 AppQyV1API 中添加 selectLibrary 方法
      // 暂时使用现有的实现
      onLibrarySelected(library);
    } catch (err: any) {
      setError(err.message || 'Selection error');
    } finally {
      setSelecting(null);
    }
  };

  const filteredLibraries = libraries.filter(lib =>
    searchQuery === '' ||
    lib.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lib.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search libraries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${commonClasses.input} pl-10`}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className={`${commonClasses.input} flex-1`}
          >
            <option value="all">All Languages</option>
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className={`${commonClasses.input} flex-1`}
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {recommended.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Recommended Libraries
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map(lib => (
              <div key={lib.id} className={`${commonClasses.card} p-4 hover:border-indigo-500 transition-colors cursor-pointer`} onClick={() => handleSelectLibrary(lib)}>
                <div className="flex items-start justify-between mb-2">
                  <BookOpen className="w-8 h-8 text-indigo-600" />
                  {lib.is_popular && (
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded">
                      Popular
                    </span>
                  )}
                </div>
                <h4 className="font-semibold mb-1">{lib.name}</h4>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{lib.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{lib.word_count || 0} words</span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    {lib.difficulty || 'N/A'}
                  </span>
                </div>
                {selecting === lib.id && (
                  <div className="mt-2 flex items-center justify-center text-indigo-600">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Selecting...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">All Libraries</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredLibraries.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No libraries found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLibraries.map(lib => (
              <div
                key={lib.id}
                className={`${commonClasses.card} p-4 hover:border-indigo-500 transition-colors cursor-pointer`}
                onClick={() => handleSelectLibrary(lib)}
              >
                <div className="flex items-start justify-between mb-2">
                  <BookOpen className="w-8 h-8 text-slate-600" />
                  {lib.category && (
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded">
                      {lib.category}
                    </span>
                  )}
                </div>
                <h4 className="font-semibold mb-1">{lib.name}</h4>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{lib.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{lib.word_count || 0} words</span>
                  <span>{lib.language}</span>
                </div>
                {selecting === lib.id && (
                  <div className="mt-2 flex items-center justify-center text-indigo-600">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Selecting...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryBrowser;
