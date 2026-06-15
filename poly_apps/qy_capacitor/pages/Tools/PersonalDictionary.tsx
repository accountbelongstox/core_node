/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';
import { Card, Icons, LoadingState, EmptyState, PageHeader, Badge, Button, IconButton } from '../../components/UI';

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
        setEntries(Array.isArray(result.data) ? result.data : []);
      } else {
        setEntries([]);
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
        setEntries(Array.isArray(result.data) ? result.data : []);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new entry
  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();

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

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
  ];

  return (
    <div className="min-h-screen bg-transparent pb-32">
      <PageHeader
        title="Personal Dictionary"
        onBack={() => navigate(-1)}
        right={
          <Button
            variant="grad"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="!w-auto !py-2 px-4 text-sm"
          >
            + Add Entry
          </Button>
        }
      />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">{Array.isArray(entries) ? entries.length : 0} entries</p>
        </div>

        {/* Search Bar */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by word..."
            className="ds-glass ds-glass-edge flex-1 min-w-[180px] px-4 py-3 rounded-full text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] transition-all"
          />
          <Button
            variant="klein"
            onClick={handleSearch}
            className="!w-auto !py-3 px-6"
          >
            Search
          </Button>
          {Array.isArray(entries) && entries.length > 0 && (
            <Button
              variant="danger"
              onClick={handleDeleteAll}
              className="!w-auto !py-3 px-4"
            >
              Delete All
            </Button>
          )}
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <h2 className="ds-section-title mb-4">Add New Entry</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Word *
                </label>
                <input
                  type="text"
                  value={newEntry.word}
                  onChange={(e) => setNewEntry({ ...newEntry, word: e.target.value })}
                  className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Language
                </label>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setNewEntry({ ...newEntry, language: lang.code })}
                      className={`ds-pill-chip ${newEntry.language === lang.code ? 'is-active' : ''}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Definition
                </label>
                <textarea
                  value={newEntry.definition}
                  onChange={(e) => setNewEntry({ ...newEntry, definition: e.target.value })}
                  className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Example
                </label>
                <textarea
                  value={newEntry.example}
                  onChange={(e) => setNewEntry({ ...newEntry, example: e.target.value })}
                  className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Notes
                </label>
                <textarea
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="grad"
                  onClick={() => handleCreate()}
                  disabled={loading}
                  className="flex-1 !py-3"
                >
                  {loading ? 'Creating...' : 'Create Entry'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                  className="!w-auto !py-3 px-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Loading State */}
        {loading && !showCreateForm && <LoadingState label="Loading entries..." />}

        {/* Empty State */}
        {!loading && (!Array.isArray(entries) || entries.length === 0) && (
          <EmptyState
            icon={<Icons.Book />}
            title="No entries found"
            description="Add your first entry to get started"
          />
        )}

        {/* Entries List — card stack (no table) */}
        {!loading && Array.isArray(entries) && entries.length > 0 && (
          <div className="ds-stack-tight">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{entry.word}</h3>
                    {entry.language && (
                      <Badge tone="klein" className="mt-1">{entry.language.toUpperCase()}</Badge>
                    )}
                  </div>
                  <IconButton
                    label="Delete entry"
                    onClick={() => handleDelete(entry.id)}
                    className="!text-red-500 hover:!bg-red-500/10"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    }
                  />
                </div>

                {entry.definition && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Definition:</p>
                    <p className="text-[var(--color-text-primary)]">{entry.definition}</p>
                  </div>
                )}

                {entry.example && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Example:</p>
                    <p className="text-[var(--color-text-secondary)] italic">{entry.example}</p>
                  </div>
                )}

                {entry.notes && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Notes:</p>
                    <p className="text-[var(--color-text-tertiary)] text-sm">{entry.notes}</p>
                  </div>
                )}

                {entry.created_at && (
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-3">
                    Created: {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
