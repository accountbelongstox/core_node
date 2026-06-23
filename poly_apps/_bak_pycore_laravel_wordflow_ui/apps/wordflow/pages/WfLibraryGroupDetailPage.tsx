/* [v4.1-Iris] Group Detail — ported from
 * qy_capacitor/pages/Learning/GroupDetail.tsx. Self-contained: loads a group's
 * name (getGroupById), every linked content source (/group/get_sources:
 * vocabulary libraries AND book/subtitle media sources, Wave-2 2026-06-12
 * contract), the word list (/group/get_words, text/pagination only) and ONE
 * per-group progress blob (/group/get_progress_blob via wfProgressCenter,
 * per-group JSON progress storage 2026-06-12) that feeds BOTH the stats strip
 * (computed client-side — wfProgressCenter.computeStats) and the Words tab's
 * per-word proficiency join. /group/get_progress_stats stays as the documented
 * fallback when the blob endpoint fails (that path re-fetches the words with
 * the server-side with_progress join, so nothing double-fetches on the happy
 * path). The Sources / Words pill sections render the unified source list with
 * type icons + words_added badges; adds/removes go through the real backend
 * group management endpoints (add_library / remove_library / add_media_source
 * / remove_media_source / remove_word) with a WfUI Sheet confirm, and the view
 * re-fetches on the 'group-sources-changed' broadcast
 * (wfLibraryCenter.subscribeGroupSources). react-router useNavigate + wfPath()
 * for nav (gid via search params). Faithful Iris look. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Captions, Layers, Library as LibraryIcon, Lock, Plus, X } from 'lucide-react';
import {
  wordflowApi,
  GroupProgressStats,
  type WfBookSummary,
  type WfGroupMediaSource,
  type WfGroupProgressBlob,
  type WfSubtitleSummary,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { notify } from '../../../core/notify/notify';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wfLibraryCenter } from '../services/WfLibraryCenter';
import { wfProgressCenter } from '../services/WfProgressCenter';
import {
  BackButton,
  Button,
  EmptyState,
  Icons,
  LoadingState,
  SectionLabel,
  Sheet,
  Stat,
} from '../WfUI';

interface GroupWord {
  word_id: number | string;
  word: string;
  proficiency?: number;
  read_count?: number;
  review_count?: number;
  last_read_at?: string;
  next_review_at?: string;
}

interface GroupLibrary {
  id: number | string;
  name: string;
  language: string;
  total_words: number;
}

/** Tab ids inside the add-source sheet (libraries + the two media types). */
type AddSheetTab = 'libraries' | 'books' | 'subtitles';

/** Normalize a /group/get_words response page into GroupWord rows. */
const mapGroupWords = (result: any): GroupWord[] => {
  const rawWords: any[] = Array.isArray(result?.words)
    ? result.words
    : Array.isArray(result)
      ? result
      : [];
  return rawWords.map((w: any) => ({
    word_id: w.word_id ?? w.id,
    word: w.word ?? w.text ?? '',
    proficiency: w.proficiency ?? w.masteryLevel,
    read_count: w.read_count,
    review_count: w.review_count,
    last_read_at: w.last_read_at,
    next_review_at: w.next_review_at,
  }));
};

const getProficiencyColor = (proficiency: number): string => {
  if (proficiency >= 90) return 'var(--color-success, #10b981)';
  if (proficiency >= 75) return 'var(--klein-blue)';
  if (proficiency >= 60) return '#f59e0b';
  if (proficiency >= 40) return '#ef4444';
  return 'var(--color-text-tertiary, #9ca3af)';
};

const WfLibraryGroupDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, t } = useWfApp();
  const [searchParams] = useSearchParams();
  const gid = searchParams.get('gid') || '';

  const [groupName, setGroupName] = useState('');
  const [words, setWords] = useState<GroupWord[]>([]);
  const [libraries, setLibraries] = useState<GroupLibrary[]>([]);
  const [mediaSources, setMediaSources] = useState<WfGroupMediaSource[]>([]);
  const [stats, setStats] = useState<GroupProgressStats | null>(null);
  // The per-group progress blob (ONE /group/get_progress_blob call) — feeds
  // both the stats strip (computeStats) and the Words tab's per-word join.
  const [progressBlob, setProgressBlob] = useState<WfGroupProgressBlob | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLibrarySheet, setShowLibrarySheet] = useState(false);
  const [availableLibraries, setAvailableLibraries] = useState<GroupLibrary[]>([]);
  const [availableBooks, setAvailableBooks] = useState<WfBookSummary[]>([]);
  const [availableSubtitles, setAvailableSubtitles] = useState<WfSubtitleSummary[]>([]);
  const [addTab, setAddTab] = useState<AddSheetTab>('libraries');
  const [addingSourceKey, setAddingSourceKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'sources' | 'words'>('sources');

  // Remove (word / library / media source) confirm flow — confirmed in a WfUI
  // Sheet, executed against the real backend endpoints (/group/remove_word,
  // /group/remove_library, /group/remove_media_source).
  const [pendingRemoval, setPendingRemoval] = useState<
    | { type: 'library' | 'word'; id: number | string; label: string }
    | { type: 'media'; sourceType: 'book' | 'subtitle'; sourceKey: string; label: string }
    | null
  >(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const sectionTabs = [
    { id: 'sources' as const, label: t('media.sources') || 'Sources' },
    { id: 'words' as const, label: t('learning.words') || 'Words' },
  ];

  // Unified source list — /group/get_sources (libraries + media_sources).
  const loadSources = useCallback(async () => {
    if (!gid) return;
    try {
      const res = await wordflowApi.getGroupSources(gid);
      setLibraries(
        (res.libraries || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          language: l.language ?? '',
          total_words: l.total_words ?? 0,
        }))
      );
      setMediaSources(Array.isArray(res.media_sources) ? res.media_sources : []);
    } catch (error) {
      console.error('[WfGroupDetail] Failed to load group sources:', error);
    }
  }, [gid]);

  const loadGroupData = useCallback(async () => {
    if (!gid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      try {
        const group: any = await wordflowApi.getGroupById(gid);
        if (group && typeof group === 'object') {
          setGroupName(group.gname ?? group.name ?? '');
        }
      } catch (error) {
        console.error('[WfGroupDetail] Failed to load group:', error);
      }

      // Word list — /group/get_words returns word_id (the vocabulary-item
      // integer id the remove_word endpoint expects). withProgress: false —
      // the per-word progress fields are joined CLIENT-SIDE from the progress
      // blob loadStats() fetches anyway (one progress fetch, never two; the
      // blob-failure fallback in loadStats restores the server-side join).
      const result: any = await wordflowApi.getGroupWords(gid, { withProgress: false });
      setWords(mapGroupWords(result));

      // Every linked content source (libraries + media) — /group/get_sources.
      await loadSources();

      loadStats();
    } catch (error) {
      console.error('[WfGroupDetail] Failed to load group data:', error);
      setWords([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, loadSources]);

  // Progress-stats strip + Words-tab proficiency source — ONE
  // /group/get_progress_blob call (wfProgressCenter), aggregated CLIENT-SIDE
  // (computeStats mirrors the backend bucket semantics exactly). Non-blocking,
  // degrades to hidden when unavailable. Documented FALLBACK: when the blob
  // endpoint fails, the strip falls back to the server-side
  // /group/get_progress_stats aggregation and the word list re-fetches with
  // the server-side with_progress join (failure path only — the happy path
  // fetches progress exactly once).
  const loadStats = useCallback(async () => {
    if (!gid) return;
    try {
      const blob = await wfProgressCenter.getBlob(gid);
      setProgressBlob(blob);
      setStats(wfProgressCenter.computeStats(blob));
    } catch (blobError) {
      console.error(
        '[WfGroupDetail] Progress blob failed, falling back to /group/get_progress_stats:',
        blobError
      );
      setProgressBlob(null);
      try {
        const result = await wordflowApi.getGroupProgressStats(gid);
        setStats(result?.stats ?? null);
      } catch (error) {
        console.error('[WfGroupDetail] Failed to load progress stats:', error);
        setStats(null);
      }
      try {
        const result: any = await wordflowApi.getGroupWords(gid, { withProgress: true });
        setWords(mapGroupWords(result));
      } catch (error) {
        console.error('[WfGroupDetail] Fallback word-progress fetch failed:', error);
      }
    }
  }, [gid]);

  // Addable content for the add sheet: vocabulary libraries + the public
  // books/subtitles lists (cached centers; all degrade to empty on failure).
  const loadAvailableContent = useCallback(async () => {
    try {
      const [list, bookPage, subtitlePage] = await Promise.all([
        wordflowApi.getRecommendedLibraries(),
        wfLibraryCenter.getBooks({ perPage: 50 }),
        wfLibraryCenter.getSubtitles({ perPage: 50 }),
      ]);
      if (Array.isArray(list)) {
        const mapped: GroupLibrary[] = list.map((l: any) => ({
          id: l.id,
          name: l.name,
          language: l.lang_code ?? l.language ?? '',
          total_words: l.total_words ?? l.word_count ?? 0,
        }));
        setAvailableLibraries(mapped);
      }
      setAvailableBooks(Array.isArray(bookPage?.books) ? bookPage.books : []);
      setAvailableSubtitles(Array.isArray(subtitlePage?.subtitles) ? subtitlePage.subtitles : []);
    } catch (error) {
      console.error('[WfGroupDetail] Failed to load available content:', error);
      setAvailableLibraries([]);
      setAvailableBooks([]);
      setAvailableSubtitles([]);
    }
  }, []);

  // Per-word progress joined CLIENT-SIDE from the blob — the same fetch that
  // feeds the stats strip. Without a blob (fallback path) the rows keep the
  // server-joined fields the fallback re-fetch put on them.
  const wordsWithProgress = useMemo<GroupWord[]>(() => {
    if (!progressBlob) return words;
    return words.map((w) => {
      const entry = wfProgressCenter.entryOf(progressBlob, w.word_id);
      if (!entry) return w; // never studied — same as the server omitting the join
      return {
        ...w,
        proficiency: entry.proficiency,
        read_count: entry.read_count,
        review_count: entry.review_count,
        last_read_at: entry.last_read_at ?? undefined,
        next_review_at: entry.next_review_at ?? undefined,
      };
    });
  }, [words, progressBlob]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadGroupData();
  }, [isAuthenticated, loadGroupData]);

  // Re-fetch sources + stats whenever any view mutates this group's sources
  // ('group-sources-changed' broadcast from wfLibraryCenter / the add sheet).
  useEffect(() => {
    if (!isAuthenticated || !gid) return;
    const unsubscribe = wfLibraryCenter.subscribeGroupSources((payload) => {
      if (payload?.gid && payload.gid !== gid) return;
      loadSources();
      loadStats();
    });
    return unsubscribe;
  }, [isAuthenticated, gid, loadSources, loadStats]);

  const addLibraryToGroup = async (libraryId: number | string) => {
    try {
      await wordflowApi.addLibraryToGroup(gid, libraryId);
      setLibraries((prev) => {
        const lib = availableLibraries.find((l) => l.id === libraryId);
        return lib && !prev.some((p) => p.id === lib.id) ? [...prev, lib] : prev;
      });
      await wordflowApi.refreshWordGroups();
      // Direct wordflowApi call (no 'group-sources-changed' broadcast) — drop
      // the held blob so loadGroupData's loadStats sees the new words.
      wfProgressCenter.invalidate(gid);
      loadGroupData();
      setShowLibrarySheet(false);
    } catch (error: any) {
      console.error('[WfGroupDetail] Failed to add library:', error);
      notify.error(error?.message || (t('common.error') || 'Error'));
    }
  };

  // Attach a public book/subtitle (AUTH POST /group/add_media_source via
  // wfLibraryCenter, which broadcasts 'group-sources-changed' → loadSources).
  const addMediaSourceToGroup = async (
    sourceType: 'book' | 'subtitle',
    sourceKey: string
  ) => {
    if (addingSourceKey) return;
    setAddingSourceKey(sourceKey);
    try {
      const result = await wfLibraryCenter.addMediaSource(gid, sourceType, sourceKey);
      notify.success(
        t('home.wordsAddedSuccess', { count: result?.words_added ?? 0 }) ||
          `Successfully added ${result?.words_added ?? 0} words`
      );
      setShowLibrarySheet(false);
    } catch (error: any) {
      console.error('[WfGroupDetail] Failed to add media source:', error);
      notify.error(error?.message || (t('common.error') || 'Error'));
    } finally {
      setAddingSourceKey(null);
    }
  };

  const requestRemoveLibrary = (lib: GroupLibrary) => {
    setRemoveError(null);
    setPendingRemoval({ type: 'library', id: lib.id, label: lib.name });
  };

  const requestRemoveMediaSource = (source: WfGroupMediaSource) => {
    setRemoveError(null);
    setPendingRemoval({
      type: 'media',
      sourceType: source.source_type,
      sourceKey: source.source_key,
      label: source.title,
    });
  };

  const requestRemoveWord = (item: GroupWord) => {
    setRemoveError(null);
    setPendingRemoval({ type: 'word', id: item.word_id, label: item.word });
  };

  // Execute the confirmed removal against the backend (POST
  // /group/remove_library, /group/remove_media_source or /group/remove_word),
  // then drop the entry locally and refresh the stats.
  const confirmRemoval = async () => {
    if (!pendingRemoval || removing) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      if (pendingRemoval.type === 'library') {
        // Server-side this only unlinks the library (words it added stay in
        // the group), so the word list does not need a reload.
        await wordflowApi.removeLibraryFromGroup(gid, pendingRemoval.id);
        setLibraries((prev) => prev.filter((l) => l.id !== pendingRemoval.id));
      } else if (pendingRemoval.type === 'media') {
        // wfLibraryCenter broadcasts 'group-sources-changed' → loadSources();
        // still drop the row locally for an immediate UI response.
        const { sourceType, sourceKey } = pendingRemoval;
        await wfLibraryCenter.removeMediaSource(gid, sourceType, sourceKey);
        setMediaSources((prev) =>
          prev.filter((s) => !(s.source_type === sourceType && s.source_key === sourceKey))
        );
      } else {
        await wordflowApi.removeWordFromGroup({ gid, word_id: pendingRemoval.id });
        setWords((prev) => prev.filter((w) => w.word_id !== pendingRemoval.id));
        // The group's contents changed — drop the held blob so the re-computed
        // stats strip reflects the removal instead of the ≤30s-old copy.
        wfProgressCenter.invalidate(gid);
        loadStats();
      }
      await wordflowApi.refreshWordGroups();
      setPendingRemoval(null);
    } catch (error: any) {
      console.error('[WfGroupDetail] Failed to remove:', error);
      setRemoveError(
        (error && typeof error.message === 'string' && error.message) ||
          (t('learning.removeFailed') || 'Failed to remove')
      );
    } finally {
      setRemoving(false);
    }
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
        <BackButton onClick={() => navigate(wfPath('group_management'))} />
        <div className="flex-1 min-w-0">
          <h1 className="ds-section-title !text-2xl truncate">
            {groupName || (t('learning.groupDetail') || 'Group Detail')}
          </h1>
        </div>
        <Button
          variant="grad"
          className="!w-auto px-5 !py-2 text-sm shrink-0"
          onClick={() => navigate(wfPath(`study_session?gid=${encodeURIComponent(gid)}`))}
        >
          {t('learning.study') || 'Study'}
        </Button>
      </div>

      {/* Progress stats strip — computed client-side from the progress blob
          (server /group/get_progress_stats only as the documented fallback) */}
      {stats && (
        <div className="ds-card rounded-[var(--radius-card)] px-4 py-3 mb-4 grid grid-cols-4 gap-2 text-center">
          <Stat value={stats.total_words} label={t('learning.words') || 'Words'} className="items-center" />
          <Stat value={stats.mastered_words} label={t('flashcards.mastered') || 'Mastered'} accent className="items-center" />
          <Stat value={stats.due_for_review} label={t('flashcards.reviewDue') || 'Review Due'} className="items-center" />
          <Stat
            value={`${Math.round(stats.avg_proficiency)}%`}
            label={t('learning.proficiency') || 'Proficiency'}
            className="items-center"
          />
        </div>
      )}

      {/* Section pill nav */}
      <div className="ds-pill-nav mb-4" role="tablist" aria-label={t('learning.groupSections') || 'Group sections'}>
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSection === tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`ds-pill-chip ${activeSection === tab.id ? 'is-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : !gid ? (
          // No group id in the URL (no active group) — don't query the backend,
          // show a friendly empty state instead.
          <EmptyState
            icon={<Layers strokeWidth={1.5} />}
            title={t('library.noGroups') || 'No groups yet'}
            description={t('library.noGroupsHint') || 'Import or create a word group to get started.'}
            action={
              <Button variant="grad" className="!w-auto px-8" onClick={() => navigate(wfPath('group_management'))}>
                {t('learning.groups') || 'Groups'}
              </Button>
            }
          />
        ) : activeSection === 'sources' ? (
          <>
            <SectionLabel
              className="mb-1"
              action={
                <button
                  type="button"
                  onClick={() => {
                    loadAvailableContent();
                    setAddTab('libraries');
                    setShowLibrarySheet(true);
                  }}
                  className="ds-pill-chip is-active text-sm px-4 py-1.5 inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> {t('media.addSource') || 'Add Source'}
                </button>
              }
            >
              {(t('media.sources') || 'Sources')} ({libraries.length + mediaSources.length})
            </SectionLabel>

            {libraries.length === 0 && mediaSources.length === 0 ? (
              <EmptyState
                icon={<Layers strokeWidth={1.5} />}
                title={t('learning.noLibraries') || 'No sources added yet'}
                description={t('learning.noLibrariesHint') || 'Add a library, book or subtitle to fill this group with words.'}
              />
            ) : (
              <>
                {/* Vocabulary libraries */}
                {libraries.map((lib) => (
                  <div key={`lib-${lib.id}`} className="ds-card rounded-[var(--radius-card)] p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--klein-blue-soft)] flex items-center justify-center flex-shrink-0 text-[var(--klein-blue)]">
                      <LibraryIcon className="w-5 h-5" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--color-text-primary)] truncate">{lib.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {lib.language} &bull; {lib.total_words} {t('library.words') || 'words'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestRemoveLibrary(lib)}
                      className="ds-touch-target flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                      aria-label={t('learning.removeLibrary') || 'Remove library'}
                      title={t('learning.removeLibrary') || 'Remove library'}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                {/* Media sources (books / subtitles) with words_added badge */}
                {mediaSources.map((source) => (
                  <div
                    key={`media-${source.source_type}-${source.source_key}`}
                    className="ds-card rounded-[var(--radius-card)] p-4 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--klein-blue-soft)] flex items-center justify-center flex-shrink-0 text-[var(--klein-blue)]">
                      {source.source_type === 'book'
                        ? <BookOpen className="w-5 h-5" aria-hidden />
                        : <Captions className="w-5 h-5" aria-hidden />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--color-text-primary)] truncate">{source.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-xs font-bold text-[var(--klein-blue)] bg-[var(--klein-blue-soft)] rounded-full px-2 py-0.5">
                          {t('media.wordsAdded', { count: source.words_added }) ||
                            `${source.words_added} words added`}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {source.language}
                          {source.added_at && <> &bull; {new Date(source.added_at).toLocaleDateString()}</>}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestRemoveMediaSource(source)}
                      className="ds-touch-target flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                      aria-label={t('media.removeSource') || 'Remove source'}
                      title={t('media.removeSource') || 'Remove source'}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <SectionLabel className="mb-1">
              {(t('learning.words') || 'Words')} ({words.length})
            </SectionLabel>

            {words.length === 0 ? (
              <EmptyState
                icon={<BookOpen strokeWidth={1.5} />}
                title={t('learning.noWords') || 'No words yet'}
              />
            ) : (
              wordsWithProgress.map((item) => {
                const proficiency = item.proficiency || 0;
                return (
                  <div key={item.word_id} className="ds-card rounded-[var(--radius-card)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--color-text-primary)] flex-1 min-w-0 truncate">{item.word}</p>
                      <span
                        className="text-xs font-bold text-[var(--klein-on)] rounded-full px-2.5 py-1 flex-shrink-0"
                        style={{ background: getProficiencyColor(proficiency) }}
                      >
                        {proficiency.toFixed(0)}%
                      </span>
                      {/* Remove word from group (POST /group/remove_word) */}
                      <button
                        type="button"
                        onClick={() => requestRemoveWord(item)}
                        className="w-8 h-8 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                        aria-label={t('learning.removeWord') || 'Remove word'}
                        title={t('learning.removeWord') || 'Remove word'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {item.read_count !== undefined && (
                      <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                        <span>{t('learning.reads') || 'Reads'}: {item.read_count}</span>
                        <span>{t('learning.reviews') || 'Reviews'}: {item.review_count}</span>
                        {item.next_review_at && (
                          <span style={{ color: 'var(--klein-blue)' }}>
                            {t('common.next') || 'Next'}: {new Date(item.next_review_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Proficiency progress bar */}
                    <div className="mt-3 h-1 rounded-full bg-[var(--border-highlight)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${proficiency}%`, background: getProficiencyColor(proficiency) }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Add Source sheet — libraries + public books/subtitles, via type tabs */}
      <Sheet
        open={showLibrarySheet}
        onClose={() => setShowLibrarySheet(false)}
        position="bottom"
        panelClassName="max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {t('media.addSource') || 'Add Source'}
          </h2>
          <button
            type="button"
            onClick={() => setShowLibrarySheet(false)}
            className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
            aria-label={t('common.close') || 'Close'}
          >
            <Icons.Close />
          </button>
        </div>

        {/* Source type tabs */}
        <div className="ds-pill-nav mb-4" role="tablist" aria-label={t('media.addSource') || 'Add Source'}>
          {([
            { id: 'libraries', label: t('learning.libraries') || 'Libraries' },
            { id: 'books', label: t('media.books') || 'Books' },
            { id: 'subtitles', label: t('media.subtitles') || 'Subtitles' },
          ] as { id: AddSheetTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={addTab === tab.id}
              onClick={() => setAddTab(tab.id)}
              className={`ds-pill-chip ${addTab === tab.id ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
          {addTab === 'libraries' ? (
            availableLibraries.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
                {t('learning.noLibrariesAvailable') || 'No libraries available'}
              </p>
            ) : (
              availableLibraries.map((lib) => (
                <button
                  key={lib.id}
                  type="button"
                  onClick={() => addLibraryToGroup(lib.id)}
                  className="w-full ds-card rounded-[var(--radius-card)] p-4 text-left hover:ring-2 transition-all"
                  style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
                >
                  <p className="font-semibold text-[var(--color-text-primary)]">{lib.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {lib.language} &bull; {lib.total_words} {t('library.words') || 'words'}
                  </p>
                </button>
              ))
            )
          ) : addTab === 'books' ? (
            availableBooks.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
                {t('media.empty') || 'No public content yet'}
              </p>
            ) : (
              availableBooks.map((book) => (
                <button
                  key={book.source_key}
                  type="button"
                  disabled={addingSourceKey !== null}
                  onClick={() => addMediaSourceToGroup('book', book.source_key)}
                  className="w-full ds-card rounded-[var(--radius-card)] p-4 text-left hover:ring-2 transition-all disabled:opacity-60"
                  style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
                >
                  <p className="font-semibold text-[var(--color-text-primary)] truncate">{book.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {book.language} &bull; {book.sentence_count} {t('media.sentences') || 'sentences'}
                  </p>
                  {addingSourceKey === book.source_key && (
                    <p className="text-xs font-semibold mt-1 text-[var(--klein-blue)]">
                      {t('learning.adding') || 'Adding…'}
                    </p>
                  )}
                </button>
              ))
            )
          ) : availableSubtitles.length === 0 ? (
            <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
              {t('media.empty') || 'No public content yet'}
            </p>
          ) : (
            availableSubtitles.map((subtitle) => (
              <button
                key={subtitle.source_key}
                type="button"
                disabled={addingSourceKey !== null}
                onClick={() => addMediaSourceToGroup('subtitle', subtitle.source_key)}
                className="w-full ds-card rounded-[var(--radius-card)] p-4 text-left hover:ring-2 transition-all disabled:opacity-60"
                style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
              >
                <p className="font-semibold text-[var(--color-text-primary)] truncate">{subtitle.title}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {subtitle.language} &bull; {subtitle.segment_count} {t('media.segments') || 'segments'} &bull;{' '}
                  {subtitle.sentence_count} {t('media.sentences') || 'sentences'}
                </p>
                {addingSourceKey === subtitle.source_key && (
                  <p className="text-xs font-semibold mt-1 text-[var(--klein-blue)]">
                    {t('learning.adding') || 'Adding…'}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </Sheet>

      {/* Remove confirm sheet (library / word) — WfUI Sheet, no window.confirm */}
      <Sheet
        open={!!pendingRemoval}
        onClose={() => {
          if (!removing) setPendingRemoval(null);
        }}
        position="center"
      >
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
          {pendingRemoval?.type === 'library'
            ? t('learning.removeLibrary') || 'Remove Library'
            : pendingRemoval?.type === 'media'
              ? t('media.removeSource') || 'Remove Source'
              : t('learning.removeWord') || 'Remove Word'}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-1">
          {pendingRemoval?.type === 'library'
            ? t('learning.removeLibraryConfirm') || 'Remove this library from the group?'
            : pendingRemoval?.type === 'media'
              ? t('media.removeSourceConfirm') || 'Remove this content source from the group?'
              : t('learning.removeWordConfirm') || 'Remove this word from the group?'}
        </p>
        {pendingRemoval && (
          <p className="font-semibold text-[var(--color-text-primary)] mb-4 truncate">
            {pendingRemoval.label}
          </p>
        )}
        {removeError && (
          <p className="text-sm font-semibold text-red-500 mb-3" role="alert">
            {removeError}
          </p>
        )}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="!py-3"
            disabled={removing}
            onClick={() => setPendingRemoval(null)}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="danger" className="!py-3" disabled={removing} onClick={confirmRemoval}>
            {removing
              ? t('common.processing') || 'Processing…'
              : t('common.delete') || 'Remove'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

export default WfLibraryGroupDetailPage;
