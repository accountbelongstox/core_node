/* [v4.1-Iris] Add to Group — ported from
 * qy_capacitor/pages/Library/AddToGroup.tsx. Self-contained: lists the user's
 * word groups via wordflowApi.getWordGroups(), adds the library passed through
 * the query string (libraryId / libraryName) to a chosen group via
 * addLibraryToGroup(), and creates new groups through a Sheet (createGroup) —
 * the created group AUTO-attaches the pending library (no lost selection;
 * same flow as the shared WfAddToLibrarySheet).
 * react-router useNavigate + wfPath() for nav. Faithful Iris look. */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layers, Lock } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { BackButton, Button, EmptyState, Icons, LoadingState, Sheet } from '../WfUI';

const WfLibraryAddToGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, t, learningLanguage } = useWfApp();
  const [searchParams] = useSearchParams();
  const libraryId = searchParams.get('libraryId') || '';
  const libraryName = searchParams.get('libraryName') || (t('nav.library') || 'Library');

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await wordflowApi.getWordGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[WfAddToGroup] Failed to load groups:', error);
      setFeedback(t('home.noGroupsYet') || 'Failed to load groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadGroups();
  }, [isAuthenticated, loadGroups]);

  const createNewGroup = async () => {
    const gname = newGroupName.trim();
    if (!gname) {
      setFeedback(t('library.groupNameRequired') || 'Please enter a group name');
      return;
    }
    try {
      const result: any = await wordflowApi.createGroup({
        name: gname,
        description: `Created for ${libraryName}`,
        // createGroup validates language as a 2-char code when present.
        language: learningLanguage && learningLanguage.length === 2 ? learningLanguage : 'en',
      });
      setNewGroupName('');
      setShowCreateSheet(false);
      setFeedback(null);
      // AUTO-attach the pending library to the new group — previously the
      // selection was lost here (the user had to find and tap the group again).
      const gid: string | undefined = result?.gid ?? result?.data?.gid;
      if (gid && libraryId) {
        await addLibraryToGroup(gid, gname);
        return;
      }
      await wordflowApi.refreshWordGroups();
      loadGroups();
    } catch (error: any) {
      console.error('[WfAddToGroup] Failed to create group:', error);
      setFeedback(error?.message || (t('library.createFailed') || 'Failed to create group'));
    }
  };

  const addLibraryToGroup = async (gid: string, gname: string) => {
    setAddingToGroup(gid);
    try {
      const response: any = await wordflowApi.addLibraryToGroup(gid, libraryId);
      const wordsAdded = response?.words_added ?? response?.data?.words_added ?? 0;
      setFeedback(
        (t('home.wordsAddedSuccess', { count: wordsAdded }) || `Successfully added ${wordsAdded} words`) +
          ` — ${gname}`
      );
      navigate(wfPath(`group_detail?gid=${encodeURIComponent(gid)}`));
    } catch (error: any) {
      console.error('[WfAddToGroup] Failed to add library to group:', error);
      setFeedback(error?.message || (t('common.error') || 'Failed to add library to group'));
    } finally {
      setAddingToGroup(null);
    }
  };

  const getDefaultGroup = () =>
    groups.find(
      (g) => g.name === 'default_group' || g.name.toLowerCase().includes('default')
    );

  const defaultGroup = getDefaultGroup();
  const otherGroups = groups.filter((g) => g.id !== defaultGroup?.id);

  const renderGroupCard = (group: WordGroup) => {
    const isAdding = addingToGroup === group.id;
    return (
      <button
        key={group.id}
        type="button"
        onClick={() => addLibraryToGroup(group.id, group.name)}
        disabled={addingToGroup !== null}
        className="w-full ds-card rounded-[var(--radius-card)] p-4 text-left hover:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[var(--color-text-primary)] truncate flex-1">
            {group.name}
          </p>
          <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
            {group.count} {t('library.words') || 'words'}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 capitalize">
          {group.language} &bull; {group.type}
        </p>
        {isAdding && (
          <p className="text-xs font-semibold mt-2 text-[var(--klein-blue)]">
            {t('learning.adding') || 'Adding…'}
          </p>
        )}
      </button>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="ds-page route-fade flex flex-col pt-12 pb-32">
        <EmptyState
          icon={<Lock strokeWidth={1.5} />}
          title={t('settings.loginRequired') || 'Login Required'}
          description={t('home.syncProgressDescription') || 'Login to manage your study groups.'}
          action={
            <Button variant="grad" className="!w-auto px-8" onClick={() => navigate(wfPath('auth/login'))}>
              {t('auth.login') || 'Login'}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="ds-page route-fade flex flex-col pt-12 pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <BackButton onClick={() => navigate(wfPath('courses'))} />
        <div className="flex-1 min-w-0">
          <h1 className="ds-section-title !text-2xl truncate">
            {t('home.addToGroup') || 'Add to Group'}
          </h1>
        </div>
        <Button
          variant="grad"
          className="!w-auto px-5 !py-2 text-sm shrink-0"
          onClick={() => setShowCreateSheet(true)}
        >
          + {t('home.new') || 'New'}
        </Button>
      </div>

      {/* Library info */}
      <div className="ds-card rounded-[var(--radius-card)] p-4 mb-4">
        <p className="font-semibold text-[var(--color-text-primary)] truncate">{libraryName}</p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          {t('home.selectStudyGroup') || 'Select a group to add this library'}
        </p>
        {feedback && (
          <p className="text-xs font-semibold mt-2 text-[var(--klein-blue)]">{feedback}</p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : (
          <>
            {defaultGroup && (
              <div className="space-y-3">
                <span className="ds-section-label">
                  {t('learning.defaultGroup') || 'Default Group'}
                </span>
                {renderGroupCard(defaultGroup)}
              </div>
            )}

            {otherGroups.length > 0 && (
              <div className="space-y-3">
                <span className="ds-section-label">
                  {t('learning.myGroups') || 'My Groups'}
                </span>
                {otherGroups.map(renderGroupCard)}
              </div>
            )}

            {groups.length === 0 && (
              <EmptyState
                icon={<Layers strokeWidth={1.5} />}
                title={t('home.noGroupsYet') || 'No groups yet'}
                description={t('library.noGroupsHint') || 'Create your first group to get started'}
                action={
                  <Button
                    variant="grad"
                    className="!w-auto px-6"
                    onClick={() => setShowCreateSheet(true)}
                  >
                    {t('library.createGroup') || 'Create Group'}
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>

      {/* Create Group sheet */}
      <Sheet
        open={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        position="bottom"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {t('home.createNewGroup') || 'Create New Group'}
          </h2>
          <button
            type="button"
            onClick={() => setShowCreateSheet(false)}
            className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
            aria-label={t('common.close') || 'Close'}
          >
            <Icons.Close />
          </button>
        </div>

        <input
          type="text"
          autoFocus
          className="w-full ds-card !rounded-[var(--radius-button)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] bg-transparent focus:outline-none focus:ring-2 mb-5"
          style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
          placeholder={t('library.groupNamePlaceholder') || 'Group name...'}
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setNewGroupName('');
              setShowCreateSheet(false);
            }}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="grad" className="flex-1" onClick={createNewGroup}>
            {t('common.create') || 'Create'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

export default WfLibraryAddToGroupPage;
