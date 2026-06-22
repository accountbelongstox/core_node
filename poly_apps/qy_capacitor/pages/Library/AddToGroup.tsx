/* [v4.1-Iris] Web port of the Library "Add to Group" screen — RN primitives replaced with web JSX + ds-* / UI.tsx primitives, AppContext navigation + ApiCenter data layer. v4.1 Iris visuals (tokens, glass header, gradient hero, Icons, no emoji, no inline hex). */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { ApiCenter } from '../../services/ApiCenter';
import { StorageCenter } from '../../services/StorageCenter';
import { Button, Icons } from '../../components/UI';

interface WordGroup {
  gid: string;
  gname: string;
  total_words: number;
  created_at: string;
  updated_at: string;
}

export default function AddToGroup() {
  const { navigate, currentParams } = useContext(AppContext);
  const libraryId: number = currentParams?.libraryId ?? 0;
  const libraryName: string = currentParams?.libraryName ?? 'Library';

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiCenter.wordGroups.getAll();

      if (response.success && Array.isArray(response.data)) {
        // Normalize ApiCenter group shape into the local view-model.
        const mapped: WordGroup[] = response.data.map((g: any) => ({
          gid: g.id,
          gname: g.name,
          total_words: g.count ?? g.wordCount ?? 0,
          created_at: g.created_at ?? '',
          updated_at: g.updated_at ?? g.created_at ?? '',
        }));
        setGroups(mapped);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      window.alert('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    StorageCenter.auth.getToken().then((token) => {
      if (!active) return;
      if (!token) {
        window.alert('Please login first');
        navigate('login');
        return;
      }
      loadGroups();
    });
    return () => {
      active = false;
    };
  }, [loadGroups, navigate]);

  const createNewGroup = async () => {
    if (!newGroupName.trim()) {
      window.alert('Please enter a group name');
      return;
    }

    try {
      const response = await ApiCenter.wordGroups.create({
        name: newGroupName,
        description: `Created for ${libraryName}`,
        language: 'en',
      });

      if (response.success) {
        window.alert('Group created successfully');
        setNewGroupName('');
        setShowCreateModal(false);
        loadGroups();
      }
    } catch (error: any) {
      console.error('Error creating group:', error);
      window.alert(error?.message || 'Failed to create group');
    }
  };

  const addLibraryToGroup = async (gid: string, gname: string) => {
    setAddingToGroup(gid);

    try {
      const response = await ApiCenter.wordGroups.addLibraryToGroup({
        gid,
        library_id: libraryId,
      });

      if (response.success) {
        const wordsAdded = response.data?.words_added ?? 0;
        window.alert(`Added ${wordsAdded} words from "${libraryName}" to "${gname}"`);
        navigate('group_detail', { gid });
      }
    } catch (error: any) {
      console.error('Error adding library to group:', error);
      window.alert(error?.message || 'Failed to add library to group');
    } finally {
      setAddingToGroup(null);
    }
  };

  const getDefaultGroup = () =>
    groups.find(
      (g) => g.gname === 'default_group' || g.gname.toLowerCase().includes('default')
    );

  const defaultGroup = getDefaultGroup();
  const otherGroups = groups.filter((g) => g.gid !== defaultGroup?.gid);

  const renderGroupCard = (group: WordGroup) => {
    const isAdding = addingToGroup === group.gid;
    return (
      <button
        key={group.gid}
        onClick={() => addLibraryToGroup(group.gid, group.gname)}
        disabled={addingToGroup !== null}
        className="w-full ds-card p-4 text-left hover:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[var(--color-text-primary)] truncate flex-1">
            {group.gname}
          </p>
          <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
            {group.total_words} words
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Updated: {group.updated_at ? new Date(group.updated_at).toLocaleDateString() : '—'}
        </p>
        {isAdding && (
          <p className="text-xs font-semibold mt-2 text-[var(--klein-blue)]">Adding...</p>
        )}
      </button>
    );
  };

  return (
    <div className="ds-page h-full flex flex-col bg-[var(--color-bg)] animate-slide-up overflow-hidden">
      {/* Background aurora layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary-container)] to-transparent opacity-40 -z-10 pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/80 border-b border-[var(--border-highlight)] px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('courses')}
          className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
          aria-label="Back"
        >
          <Icons.Back />
        </button>

        <h1 className="flex-1 text-lg font-bold text-[var(--color-text-primary)] truncate">
          Add to Group
        </h1>

        <Button
          variant="grad"
          className="!w-auto px-5 !py-2 text-sm"
          onClick={() => setShowCreateModal(true)}
        >
          + New
        </Button>
      </div>

      {/* Library info */}
      <div className="px-5 pt-4 pb-2">
        <div className="ds-card p-4">
          <p className="font-semibold text-[var(--color-text-primary)] truncate">{libraryName}</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Select a group to add this library
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-2 pb-8 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--klein-blue)]">
            <Icons.Loader />
          </div>
        ) : (
          <>
            {defaultGroup && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                  Default Group
                </p>
                {renderGroupCard(defaultGroup)}
              </div>
            )}

            {otherGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                  My Groups
                </p>
                {otherGroups.map(renderGroupCard)}
              </div>
            )}

            {groups.length === 0 && (
              <div className="ds-card p-10 text-center space-y-3">
                <p className="font-semibold text-[var(--color-text-primary)]">No groups yet</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Create your first group to get started
                </p>
                <Button
                  variant="grad"
                  className="!w-auto px-6 mx-auto"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Group
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 ds-z-modal flex items-end justify-center ds-modal-backdrop animate-fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="ds-modal-panel w-full max-w-lg rounded-t-[calc(var(--radius-card)+6px)] rounded-b-none p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Create New Group
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
                aria-label="Close"
              >
                <Icons.Close />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              className="w-full ds-card !rounded-[var(--radius-button)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] bg-transparent focus:outline-none focus:ring-2 mb-5"
              style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setNewGroupName('');
                  setShowCreateModal(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="grad" className="flex-1" onClick={createNewGroup}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
