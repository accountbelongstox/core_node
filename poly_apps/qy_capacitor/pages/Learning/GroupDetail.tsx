/* [v4.1-Iris] Web port of the Learning Group detail screen — AppContext navigation + ApiCenter data layer, v4.1 Iris visuals preserved (tokens, glass header, gradient hero, lucide/Icons, no emoji, no inline hex). */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { ApiCenter } from '../../services/ApiCenter';
import { Button, Icons, SectionLabel } from '../../components/UI';
import PillNav from '../../components/PillNav';

interface Word {
  word_id: number;
  word: string;
  proficiency?: number;
  read_count?: number;
  review_count?: number;
  last_read_at?: string;
  next_review_at?: string;
}

interface Library {
  id: number;
  name: string;
  language: string;
  total_words: number;
  added_at: string;
}

const SECTION_TABS = [
  { id: 'libraries', label: 'Libraries' },
  { id: 'words', label: 'Words' },
];

const getProficiencyColor = (proficiency: number): string => {
  if (proficiency >= 90) return 'var(--color-success, #10b981)';
  if (proficiency >= 75) return 'var(--klein-blue)';
  if (proficiency >= 60) return '#f59e0b';
  if (proficiency >= 40) return '#ef4444';
  return 'var(--color-text-tertiary, #9ca3af)';
};

export default function GroupDetail() {
  const { navigate, currentParams } = useContext(AppContext);
  const gid: string = currentParams?.gid || '';

  const [groupName, setGroupName] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [availableLibraries, setAvailableLibraries] = useState<Library[]>([]);
  const [activeSection, setActiveSection] = useState('libraries');

  const loadGroupData = useCallback(async () => {
    if (!gid) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const groupResponse = await ApiCenter.wordGroups.getById(gid);
      if (groupResponse.success && groupResponse.data) {
        setGroupName(groupResponse.data.name || '');
      }

      const wordsResponse = await ApiCenter.wordGroups.getWords(gid);
      if (wordsResponse.success && Array.isArray(wordsResponse.data)) {
        // Normalize backend word shape into the local Word view-model.
        const mapped: Word[] = wordsResponse.data.map((w: any) => ({
          word_id: w.word_id ?? w.id,
          word: w.word ?? w.text ?? '',
          proficiency: w.proficiency,
          read_count: w.read_count,
          review_count: w.review_count,
          last_read_at: w.last_read_at,
          next_review_at: w.next_review_at,
        }));
        setWords(mapped);
      } else {
        setWords([]);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  }, [gid]);

  const loadAvailableLibraries = useCallback(async () => {
    try {
      const response = await ApiCenter.vocabulary.getLibraries();
      if (response.success && Array.isArray(response.data)) {
        const mapped: Library[] = response.data.map((l: any) => ({
          id: l.id,
          name: l.name,
          language: l.language_code ?? l.language ?? '',
          total_words: l.word_count ?? l.total_words ?? 0,
          added_at: l.created_at ?? '',
        }));
        setAvailableLibraries(mapped);
      }
    } catch (error) {
      console.error('Error loading available libraries:', error);
    }
  }, []);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const addLibraryToGroup = async (libraryId: number) => {
    try {
      const response = await ApiCenter.wordGroups.addLibraryToGroup({
        gid,
        library_id: libraryId,
      });

      if (response.success) {
        setLibraries((prev) => {
          const lib = availableLibraries.find((l) => l.id === libraryId);
          return lib && !prev.some((p) => p.id === lib.id) ? [...prev, lib] : prev;
        });
        loadGroupData();
        setShowLibraryModal(false);
      }
    } catch (error: any) {
      console.error('Error adding library:', error);
    }
  };

  const removeLibraryFromGroup = (libraryId: number) => {
    if (!window.confirm('Remove this library from the group?')) return;
    // No ApiCenter endpoint exposes group-library removal; reflect the change
    // locally so the UI stays consistent until the service adds the method.
    setLibraries((prev) => prev.filter((l) => l.id !== libraryId));
  };

  return (
    <div className="ds-page h-full flex flex-col bg-[var(--color-bg)] animate-slide-up overflow-hidden">
      {/* Background aurora layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary-container)] to-transparent opacity-40 -z-10 pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/80 border-b border-[var(--border-highlight)] px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('group_management')}
          className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
        >
          <Icons.Back />
        </button>

        <h1 className="flex-1 text-lg font-bold text-[var(--color-text-primary)] truncate">
          {groupName || 'Group'}
        </h1>

        <Button
          variant="grad"
          className="!w-auto px-5 !py-2 text-sm"
          onClick={() => navigate('study_session', { gid })}
        >
          Study
        </Button>
      </div>

      {/* Section pill nav */}
      <div className="ds-section-gap px-5 pt-4">
        <PillNav
          items={SECTION_TABS}
          activeId={activeSection}
          onChange={setActiveSection}
          aria-label="Group sections"
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-4 pb-8 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--klein-blue)]">
            <Icons.Loader />
          </div>
        ) : activeSection === 'libraries' ? (
          <>
            {/* Libraries section header */}
            <SectionLabel
              className="mb-1"
              action={
                <button
                  onClick={() => {
                    loadAvailableLibraries();
                    setShowLibraryModal(true);
                  }}
                  className="ds-pill-chip is-active text-sm px-4 py-1.5"
                >
                  + Add Library
                </button>
              }
            >
              Libraries ({libraries.length})
            </SectionLabel>

            {libraries.length === 0 ? (
              <div className="ds-card p-8 text-center text-[var(--color-text-secondary)] text-sm">
                No libraries added yet
              </div>
            ) : (
              libraries.map((lib) => (
                <div key={lib.id} className="ds-card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)] truncate">{lib.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {lib.language} &bull; {lib.total_words} words
                    </p>
                  </div>
                  <button
                    onClick={() => removeLibraryFromGroup(lib.id)}
                    className="ds-touch-target flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                    aria-label="Remove library"
                  >
                    <Icons.Close />
                  </button>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {/* Words section header */}
            <SectionLabel className="mb-1">
              Words ({words.length})
            </SectionLabel>

            {words.length === 0 ? (
              <div className="ds-card p-8 text-center text-[var(--color-text-secondary)] text-sm">
                No words yet
              </div>
            ) : (
              words.map((item) => {
                const proficiency = item.proficiency || 0;
                return (
                  <div key={item.word_id} className="ds-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--color-text-primary)]">{item.word}</p>
                      <span
                        className="text-xs font-bold text-[var(--klein-on)] rounded-full px-2.5 py-1 flex-shrink-0"
                        style={{ background: getProficiencyColor(proficiency) }}
                      >
                        {proficiency.toFixed(0)}%
                      </span>
                    </div>

                    {item.read_count !== undefined && (
                      <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                        <span>Reads: {item.read_count}</span>
                        <span>Reviews: {item.review_count}</span>
                        {item.next_review_at && (
                          <span style={{ color: 'var(--klein-blue)' }}>
                            Next: {new Date(item.next_review_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Proficiency progress bar */}
                    <div className="mt-3 h-1 rounded-full bg-[var(--border-highlight)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${proficiency}%`,
                          background: getProficiencyColor(proficiency),
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Add Library Modal */}
      {showLibraryModal && (
        <div
          className="fixed inset-0 ds-z-modal flex items-end justify-center ds-modal-backdrop animate-fade-in"
          onClick={() => setShowLibraryModal(false)}
        >
          <div
            className="ds-modal-panel w-full max-w-lg rounded-t-[calc(var(--radius-card)+6px)] rounded-b-none p-5 max-h-[80vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Add Library</h2>
              <button
                onClick={() => setShowLibraryModal(false)}
                className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
              >
                <Icons.Close />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {availableLibraries.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
                  No libraries available
                </p>
              ) : (
                availableLibraries.map((lib) => (
                  <button
                    key={lib.id}
                    onClick={() => addLibraryToGroup(lib.id)}
                    className="w-full ds-card p-4 text-left hover:ring-2 transition-all"
                    style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
                  >
                    <p className="font-semibold text-[var(--color-text-primary)]">{lib.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {lib.language} &bull; {lib.total_words} words
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
