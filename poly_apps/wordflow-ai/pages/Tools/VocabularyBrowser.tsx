import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';

interface VocabularyLibrary {
  id: number;
  name: string;
  description?: string;
  word_count: number;
  language?: string;
  level?: string;
  category?: string;
}

interface VocabularyStatistics {
  total_libraries: number;
  total_words: number;
  languages: string[];
}

export default function VocabularyBrowser() {
  const navigate = useNavigate();

  const [statistics, setStatistics] = useState<VocabularyStatistics | null>(null);
  const [libraries, setLibraries] = useState<VocabularyLibrary[]>([]);
  const [recommendedLibraries, setRecommendedLibraries] = useState<VocabularyLibrary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recommended'>('recommended');

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  // Load statistics
  const loadStatistics = async () => {
    try {
      const result = await ApiCenter.vocabulary.getStatistics();
      if (result.success && result.data) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  // Load all libraries
  const loadLibraries = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.vocabulary.getLibraries({
        language: selectedLanguage || undefined,
      });

      if (result.success && result.data) {
        setLibraries(result.data);
      }
    } catch (error) {
      console.error('Failed to load libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load recommended libraries
  const loadRecommended = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.vocabulary.getRecommendedLibraries({
        language: selectedLanguage || undefined,
        level: selectedLevel || undefined,
      });

      if (result.success && result.data) {
        setRecommendedLibraries(result.data);
      }
    } catch (error) {
      console.error('Failed to load recommended libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data based on active tab
  const loadData = () => {
    if (activeTab === 'all') {
      loadLibraries();
    } else {
      loadRecommended();
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedLanguage, selectedLevel]);

  const displayLibraries = activeTab === 'all' ? libraries : recommendedLibraries;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Vocabulary Library</h1>
                <p className="text-sm text-gray-500">Browse and explore vocabulary collections</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Libraries</p>
                  <p className="text-3xl font-bold mt-1">{statistics.total_libraries}</p>
                </div>
                <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Total Words</p>
                  <p className="text-3xl font-bold mt-1">{statistics.total_words.toLocaleString()}</p>
                </div>
                <svg className="w-12 h-12 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Languages</p>
                  <p className="text-3xl font-bold mt-1">{statistics.languages.length}</p>
                </div>
                <svg className="w-12 h-12 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'recommended'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Libraries
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {activeTab === 'recommended' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Level
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading libraries...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && displayLibraries.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            <p className="text-gray-600">No libraries found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
          </div>
        )}

        {/* Libraries Grid */}
        {!loading && displayLibraries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayLibraries.map((library) => (
              <div
                key={library.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 border cursor-pointer"
                onClick={() => {
                  // Navigate to library details or start learning
                  console.log('Selected library:', library);
                }}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{library.name}</h3>
                  {library.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{library.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {library.language && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {library.language.toUpperCase()}
                    </span>
                  )}
                  {library.level && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      {library.level}
                    </span>
                  )}
                  {library.category && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                      {library.category}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>{library.word_count} words</span>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700 font-medium">
                    View →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
