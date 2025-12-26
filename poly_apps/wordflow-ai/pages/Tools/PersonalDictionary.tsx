import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';

interface PersonalDictionaryEntry {
  id: string;
  word: string;
  definition?: string;
  example?: string;
  notes?: string;
  language?: string;
  created_at?: string;
}

export default function PersonalDictionary() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<PersonalDictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchWord, setSearchWord] = useState('');

  // Form state for creating new entry
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    word: '',
    definition: '',
    example: '',
    notes: '',
    language: 'en'
  });

  // Load personal dictionary entries
  const loadEntries = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.personalDictionary.query({
        limit: 50
      });

      if (result.success && result.data) {
        setEntries(result.data);
      }
    } catch (error) {
      console.error('Failed to load personal dictionary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search entries by word
  const handleSearch = async () => {
    if (!searchWord.trim()) {
      loadEntries();
      return;
    }

    setLoading(true);
    try {
      const result = await ApiCenter.personalDictionary.query({
        word: searchWord,
        limit: 50
      });

      if (result.success && result.data) {
        setEntries(result.data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new entry
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEntry.word.trim()) {
      alert('Word is required');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiCenter.personalDictionary.create(newEntry);

      if (result.success) {
        alert('Entry created successfully!');
        setShowCreateForm(false);
        setNewEntry({
          word: '',
          definition: '',
          example: '',
          notes: '',
          language: 'en'
        });
        loadEntries();
      } else {
        alert(result.error?.message || 'Failed to create entry');
      }
    } catch (error) {
      console.error('Create failed:', error);
      alert('Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  // Delete entry
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await ApiCenter.personalDictionary.deleteById(id);

      if (result.success) {
        alert('Entry deleted successfully!');
        loadEntries();
      } else {
        alert(result.error?.message || 'Failed to delete entry');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  // Delete all entries
  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL entries? This cannot be undone!')) {
      return;
    }

    setLoading(true);
    try {
      const result = await ApiCenter.personalDictionary.deleteAll();

      if (result.success) {
        alert('All entries deleted successfully!');
        loadEntries();
      } else {
        alert(result.error?.message || 'Failed to delete entries');
      }
    } catch (error) {
      console.error('Delete all failed:', error);
      alert('Failed to delete entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
                <h1 className="text-xl font-bold text-gray-900">Personal Dictionary</h1>
                <p className="text-sm text-gray-500">{entries.length} entries</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Entry
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by word..."
            className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete All
            </button>
          )}
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border">
            <h2 className="text-lg font-bold mb-4">Add New Entry</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Word *
                </label>
                <input
                  type="text"
                  value={newEntry.word}
                  onChange={(e) => setNewEntry({ ...newEntry, word: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={newEntry.language}
                  onChange={(e) => setNewEntry({ ...newEntry, language: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="zh">Chinese</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Definition
                </label>
                <textarea
                  value={newEntry.definition}
                  onChange={(e) => setNewEntry({ ...newEntry, definition: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Example
                </label>
                <textarea
                  value={newEntry.example}
                  onChange={(e) => setNewEntry({ ...newEntry, example: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading State */}
        {loading && !showCreateForm && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading entries...</p>
          </div>
        )}

        {/* Entries List */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-gray-600">No entries found</p>
            <p className="text-sm text-gray-500 mt-2">Add your first entry to get started</p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl shadow-lg p-6 border hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{entry.word}</h3>
                    {entry.language && (
                      <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {entry.language.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {entry.definition && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Definition:</p>
                    <p className="text-gray-800">{entry.definition}</p>
                  </div>
                )}

                {entry.example && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Example:</p>
                    <p className="text-gray-700 italic">{entry.example}</p>
                  </div>
                )}

                {entry.notes && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Notes:</p>
                    <p className="text-gray-600 text-sm">{entry.notes}</p>
                  </div>
                )}

                {entry.created_at && (
                  <div className="text-xs text-gray-400 mt-3">
                    Created: {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
