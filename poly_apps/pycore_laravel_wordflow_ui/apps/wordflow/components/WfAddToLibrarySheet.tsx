/* [v4.1-Iris] WfAddToLibrarySheet — shared "add content to a study group"
 * bottom sheet. Reusable for vocabulary libraries AND the public media content
 * types (books / subtitles, 2026-06-12 backend contract). Built on the
 * portal/z-scale-compliant Sheet from WfUI (never raw fixed inset-0).
 *
 * Behavior:
 *   - lists the user's groups, default group pinned first (same partition
 *     logic as WfLibraryAddToGroupPage);
 *   - tap a group → addLibraryToGroup (kind 'library') or
 *     wfLibraryCenter.addMediaSource (kind 'book' | 'subtitle'). Bulk attaches
 *     legitimately take ~10s for a 54k-word library: the tapped row shows a
 *     spinner + "this can take a moment" hint, other rows are disabled and the
 *     sheet is NOT closable mid-flight;
 *   - outcome split: words_added>0 → success toast "+N words";
 *     already_linked / words_added===0 → info toast "already in this group";
 *   - after a real attach the word-groups cache is refreshed
 *     (wordflowApi.refreshWordGroups) BEFORE 'group-sources-changed' is
 *     broadcast, so subscribers re-render from fresh totals;
 *   - inline "create new group" (name + language) AUTO-attaches the content
 *     to the newly created group — no lost selection;
 *   - callers must gate opening behind useWfProtectedAction (this sheet
 *     assumes an authenticated session).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Captions, Layers, Plus } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { isQueuedError } from '../../../core/api-libs/base';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { notify } from '../../../core/notify/notify';
import { Badge, Button, EmptyState, IconButton, Icons, LoadingState, Sheet, Spinner } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { getSupportedLanguages } from '../WfLanguageCenter';
import { wfLibraryCenter } from '../services/WfLibraryCenter';
import { wfEventBus } from '../services/WfEventBus';

/** What is being attached: a vocabulary library or a public book/subtitle. */
export type WfAddToLibraryContent =
  | { kind: 'library'; id: number | string; name: string }
  | { kind: 'book' | 'subtitle'; sourceKey: string; title: string };

export interface WfAddToLibrarySheetProps {
  /** Controls visibility (Sheet renders nothing when false). */
  open: boolean;
  /** The content to attach; the sheet is inert when null. */
  content: WfAddToLibraryContent | null;
  /** Close request (backdrop tap / close button / after success). */
  onClose: () => void;
  /** Fired after a successful attach (after the success toast). */
  onDone?: (result: { gid: string; gname: string; wordsAdded: number }) => void;
}

const contentTitle = (c: WfAddToLibraryContent): string =>
  c.kind === 'library' ? c.name : c.title;

/** Small type glyph for the header content row. */
const ContentTypeIcon: React.FC<{ kind: WfAddToLibraryContent['kind'] }> = ({ kind }) => {
  const cls = 'w-4 h-4';
  if (kind === 'book') return <BookOpen className={cls} aria-hidden />;
  if (kind === 'subtitle') return <Captions className={cls} aria-hidden />;
  return <Layers className={cls} aria-hidden />;
};

/**
 * Did the backend report "this content was already linked to the group"?
 * Primary signal: the explicit additive `already_linked: true` field (2026-06
 * backend contract); fallback heuristic: a successful response that added 0
 * words (the link existed, nothing new was inserted).
 */
const isAlreadyLinked = (response: any, wordsAdded: number): boolean => {
  if (response?.already_linked === true || response?.data?.already_linked === true) return true;
  return wordsAdded === 0;
};

export const WfAddToLibrarySheet: React.FC<WfAddToLibrarySheetProps> = ({
  open,
  content,
  onClose,
  onDone,
}) => {
  const { t, learningLanguage } = useWfApp();

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupLanguage, setNewGroupLanguage] = useState(learningLanguage || 'en');
  const [creating, setCreating] = useState(false);
  // Cancellation-safe loads: only the latest sequence may commit state.
  const seqRef = useRef(0);

  // A bulk attach (or create+attach) is in flight: everything else is frozen.
  const busy = addingToGroup !== null || creating;

  // The sheet must NOT be closable mid-flight — an abandoned-looking request
  // still completes server-side and the user would re-tap into "already added".
  const guardedClose = useCallback(() => {
    if (addingToGroup !== null) return;
    onClose();
  }, [addingToGroup, onClose]);

  const loadGroups = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const data = await wordflowApi.getWordGroups();
      if (seq !== seqRef.current) return;
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      if (seq !== seqRef.current) return;
      console.error('[WfAddToLibrarySheet] Failed to load groups:', error);
      setGroups([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  // (Re)load groups + reset transient state every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setShowCreateForm(false);
    setNewGroupName('');
    setNewGroupLanguage(learningLanguage || 'en');
    loadGroups();
    return () => {
      seqRef.current++; // cancel in-flight load on close/unmount
    };
    // learningLanguage intentionally only seeds the default on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadGroups]);

  /** Attach `content` to group `gid`; returns true on success. */
  const attachToGroup = useCallback(
    async (gid: string, gname: string): Promise<boolean> => {
      if (!content) return false;
      setAddingToGroup(gid);
      try {
        let wordsAdded = 0;
        let already = false;
        if (content.kind === 'library') {
          const response: any = await wordflowApi.addLibraryToGroup(gid, content.id);
          wordsAdded = response?.words_added ?? response?.data?.words_added ?? 0;
          already = isAlreadyLinked(response, wordsAdded);
          // Refresh BEFORE broadcasting so subscribers re-read warm, fresh
          // group totals (backend merges JSON+pivot counts server-side).
          await wordflowApi.refreshWordGroups().catch(() => null);
          // Media adds broadcast inside wfLibraryCenter; mirror it for libraries
          // so group views relying on 'group-sources-changed' stay in sync.
          wfEventBus.emit('group-sources-changed', {
            gid,
            sourceType: 'library',
            sourceKey: String(content.id),
            action: 'add',
          });
        } else {
          const result: any = await wfLibraryCenter.addMediaSource(
            gid,
            content.kind,
            content.sourceKey
          );
          wordsAdded = result?.words_added ?? 0;
          already = isAlreadyLinked(result, wordsAdded);
          // wfLibraryCenter already broadcast 'group-sources-changed'; still
          // refresh the groups cache so list pages render fresh totals.
          await wordflowApi.refreshWordGroups().catch(() => null);
        }
        if (already) {
          notify.info(
            `${t('home.alreadyInGroup') || 'Already in this group'} — ${gname}`
          );
        } else {
          notify.success(
            `${t('home.wordsAddedSuccess', { count: wordsAdded }) || `Successfully added ${wordsAdded} words`} — ${gname}`
          );
        }
        onDone?.({ gid, gname, wordsAdded });
        onClose();
        return true;
      } catch (error: any) {
        if (isQueuedError(error)) {
          // Offline write queue (master client): the add was persisted and
          // will replay when the connection returns — not a failure. The
          // "saved offline" toast is emitted ONCE by the central deduped
          // handler in WordflowApi.request(); only the flow lives here
          // (keep the sheet open, busy reset in finally).
          return false;
        }
        console.error('[WfAddToLibrarySheet] Failed to add content to group:', error);
        notify.error(error?.message || t('common.error') || 'Failed to add to group');
        return false;
      } finally {
        setAddingToGroup(null);
      }
    },
    [content, t, onDone, onClose]
  );

  /** Create a group, then AUTO-attach the pending content to it. */
  const handleCreateAndAttach = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      notify.error(t('library.groupNameRequired') || 'Please enter a group name');
      return;
    }
    if (!content) return;
    setCreating(true);
    try {
      const result: any = await wordflowApi.createGroup({
        name,
        description: `Created for ${contentTitle(content)}`,
        language: newGroupLanguage,
      });
      const gid: string | undefined = result?.gid ?? result?.data?.gid;
      setNewGroupName('');
      setShowCreateForm(false);
      if (gid) {
        await attachToGroup(gid, name);
      } else {
        // Group exists but the response carried no gid — fall back to a list
        // refresh so the user can tap the new group manually.
        console.warn('[WfAddToLibrarySheet] createGroup returned no gid:', result);
        await loadGroups();
      }
    } catch (error: any) {
      if (isQueuedError(error)) {
        // Toast handled by the central queued-offline handler in
        // WordflowApi.request() — keep only the flow (busy reset in finally).
        return;
      }
      console.error('[WfAddToLibrarySheet] Failed to create group:', error);
      notify.error(error?.message || t('library.createFailed') || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }, [newGroupName, newGroupLanguage, content, t, attachToGroup, loadGroups]);

  // Default group pinned first — same partition logic as WfLibraryAddToGroupPage.
  const defaultGroup = groups.find(
    (g) => g.name === 'default_group' || g.name.toLowerCase().includes('default')
  );
  const otherGroups = groups.filter((g) => g.id !== defaultGroup?.id);
  const orderedGroups = defaultGroup ? [defaultGroup, ...otherGroups] : otherGroups;

  const renderGroupRow = (group: WordGroup) => {
    const isAdding = addingToGroup === group.id;
    const isDefault = group.id === defaultGroup?.id;
    return (
      <button
        key={group.id}
        type="button"
        onClick={() => attachToGroup(group.id, group.name)}
        disabled={busy}
        className={`group/row w-full ds-row rounded-[var(--radius-card)] p-3 pr-3.5 min-h-[72px] flex items-center gap-3.5 text-left ${
          busy && !isAdding ? 'opacity-50 cursor-not-allowed' : ''
        } ${isAdding ? 'ring-2 ring-[var(--klein-ring)]' : ''}`}
      >
        {/* Group initial in a round gradient chip — echoes the reference's circular thumbs */}
        <span
          className="ds-bento-chip !rounded-full flex-shrink-0 w-12 h-12 text-lg font-extrabold"
          aria-hidden
        >
          {(group.name || '?').trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text-primary)] truncate leading-tight">
            {group.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {group.language && (
              <Badge tone="klein" className="!px-2 !py-0.5">
                {group.language.toUpperCase()}
              </Badge>
            )}
            {isDefault && (
              <Badge tone="neutral" dot className="!px-2 !py-0.5">
                {t('learning.defaultGroup') || 'Default Group'}
              </Badge>
            )}
            <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
              {group.count} {t('library.words') || 'words'}
            </span>
          </div>
          {isAdding && (
            <p className="text-xs font-semibold mt-2 text-[var(--klein-blue)]">
              {t('home.addInProgressHint') || 'Adding — this can take a moment for large libraries…'}
            </p>
          )}
        </div>
        {/* Add affordance — circular chip that fills + spins up on row hover */}
        <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] transition-all duration-300 group-hover/row:scale-110 group-hover/row:rotate-90 group-hover/row:bg-[var(--klein-blue)] group-hover/row:text-[var(--klein-on)]">
          {isAdding ? <Spinner size="sm" /> : <Plus className="w-4 h-4" aria-hidden />}
        </span>
      </button>
    );
  };

  return (
    <Sheet
      open={open && !!content}
      onClose={guardedClose}
      position="center"
      panelClassName="overflow-hidden"
    >
      {/* Hero header — bleeds to the panel edges with a soft accent glow behind
          the gradient type chip + what is being added. Centered, translucent
          (ds-modal-panel) modal; tokens drive dark/light automatically. */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 mb-4">
        <div
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-44 rounded-full opacity-50 blur-3xl"
          style={{ background: 'var(--klein-gradient)' }}
          aria-hidden
        />
        <div className="relative flex items-start gap-3.5">
          {content && (
            <span className="ds-bento-chip !rounded-2xl flex-shrink-0 w-12 h-12 [&_svg]:w-5 [&_svg]:h-5" aria-hidden>
              <ContentTypeIcon kind={content.kind} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {t('home.addToGroup') || 'Add to Study Group'}
            </h2>
            {content && (
              <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate mt-1">
                {contentTitle(content)}
              </p>
            )}
          </div>
          <IconButton
            icon={<Icons.Close />}
            onClick={guardedClose}
            disabled={addingToGroup !== null}
            label={t('common.close') || 'Close'}
            className="flex-shrink-0 -mr-1.5 -mt-1.5"
          />
        </div>
      </div>

      <div className="max-h-[55vh] overflow-y-auto no-scrollbar ds-stack ds-stack-tight">
        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : (
          <>
            {orderedGroups.length > 0 && (
              <div className="space-y-2">
                <span className="ds-section-label">
                  {t('learning.myGroups') || 'My Groups'}
                </span>
                {orderedGroups.map(renderGroupRow)}
              </div>
            )}

            {groups.length === 0 && !showCreateForm && (
              <EmptyState
                icon={<Layers strokeWidth={1.5} />}
                title={t('home.noGroupsYet') || 'No groups yet'}
                description={t('library.noGroupsHint') || 'Create your first group to get started'}
              />
            )}
          </>
        )}

        {/* Inline create-new-group (auto-attaches the content after creation),
            visually separated from the group list. */}
        <div className={loading ? '' : 'pt-3 mt-1 border-t border-[var(--border-highlight)]'}>
          {showCreateForm ? (
            <div className="ds-card rounded-[var(--radius-card)] p-4 space-y-3">
              <span className="ds-section-label">
                {t('home.createNewGroup') || 'Create New Group'}
              </span>
              <input
                type="text"
                autoFocus
                className="w-full ds-card !rounded-[var(--radius-button)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] bg-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
                placeholder={t('library.groupNamePlaceholder') || 'Group name...'}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <div>
                <label className="ds-section-label block mb-2">
                  {t('library.language') || 'Language'}
                </label>
                <div className="ds-pill-nav" role="tablist" aria-label={t('library.language') || 'Language'}>
                  {getSupportedLanguages().map((cfg) => (
                    <button
                      key={cfg.code}
                      type="button"
                      role="tab"
                      aria-selected={newGroupLanguage === cfg.code}
                      onClick={() => setNewGroupLanguage(cfg.code)}
                      className={`ds-pill-chip ${newGroupLanguage === cfg.code ? 'is-active' : ''}`}
                    >
                      {cfg.flag} {cfg.code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 !py-3"
                  disabled={creating}
                  onClick={() => {
                    setNewGroupName('');
                    setShowCreateForm(false);
                  }}
                >
                  {t('common.cancel') || 'Cancel'}
                </Button>
                <Button
                  variant="grad"
                  className="flex-1 !py-3"
                  disabled={busy}
                  onClick={handleCreateAndAttach}
                >
                  {creating ? t('common.creating') || 'Creating...' : t('common.create') || 'Create'}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              disabled={busy}
              className="group/add w-full ds-empty rounded-[var(--radius-card)] p-3.5 min-h-[64px] flex items-center justify-center gap-2.5 text-sm font-bold text-[var(--klein-blue)] transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="ds-bento-chip !rounded-full w-9 h-9 [&_svg]:w-4 [&_svg]:h-4 transition-transform duration-300 group-hover/add:scale-110 group-hover/add:rotate-90" aria-hidden>
                <Plus />
              </span>
              {t('home.createNewGroup') || 'Create New Group'}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default WfAddToLibrarySheet;
