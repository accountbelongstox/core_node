/* [v4.1-Iris] Personal Dictionary — ported from
 * poly_apps/qy_capacitor/pages/Tools/PersonalDictionary.tsx, wired to the real
 * AppQyV1PersonDict backend through the typed wordflowApi personal-dictionary
 * methods (query with limit/offset pagination, create, delete-by-id,
 * delete-all). Conventions: useWfApp() t() i18n, notify toasts, Sheet confirm
 * dialogs (never window.confirm), cancellation-safe loads via a sequence ref,
 * optimistic deletes with rollback. Faithful Iris look (gradient add CTA,
 * language pill chips, card stack). */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Trash2 } from 'lucide-react';
import {
  Card,
  Icons,
  LoadingState,
  EmptyState,
  PageHeader,
  Badge,
  Button,
  IconButton,
  Sheet,
} from '../WfUI';
import {
  wordflowApi,
  type PersonalDictionaryEntry,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { notify } from '../../../core/notify/notify';
import { getSupportedLanguages } from '../WfLanguageCenter';

const PAGE_SIZE = 50;

type ConfirmTarget = { type: 'one'; entry: PersonalDictionaryEntry } | { type: 'all' } | null;

const EMPTY_FORM = { word: '', definition: '', example: '', notes: '', language: 'en' };

const WfToolsPersonalDictionaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: appLoading, t } = useWfApp();

  const [entries, setEntries] = useState<PersonalDictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchWord, setSearchWord] = useState('');
  // The word filter actually applied server-side (set by the Search button).
  const [activeSearch, setActiveSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEntry, setNewEntry] = useState({ ...EMPTY_FORM });
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  // Monotonic sequence: stale responses (superseded search / unmount) are
  // dropped instead of clobbering newer state.
  const seqRef = useRef(0);
  useEffect(() => () => { seqRef.current += 1; }, []);

  const loadEntries = useCallback(
    async (word: string, offset: number, append: boolean) => {
      const seq = ++seqRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const batch = await wordflowApi.queryPersonalDictionary({
          limit: PAGE_SIZE,
          offset,
          ...(word ? { word } : {}),
        });
        if (seq !== seqRef.current) return;
        setEntries((prev) => (append ? [...prev, ...batch] : batch));
        setHasMore(batch.length === PAGE_SIZE);
      } catch (error) {
        if (seq !== seqRef.current) return;
        console.error('[WfPersonalDictionary] Failed to load entries:', error);
        notify.error(t('tools.personalDict.loadFailed'));
        if (!append) {
          setEntries([]);
          setHasMore(false);
        }
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    if (appLoading || !isAuthenticated) return;
    loadEntries('', 0, false);
  }, [appLoading, isAuthenticated, loadEntries]);

  const handleSearch = () => {
    const word = searchWord.trim();
    setActiveSearch(word);
    loadEntries(word, 0, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || loading) return;
    loadEntries(activeSearch, entries.length, true);
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const word = newEntry.word.trim();
    if (!word) {
      notify.error(t('tools.personalDict.wordRequired'));
      return;
    }
    setCreating(true);
    try {
      const res = await wordflowApi.createPersonalDictionaryEntry({
        word,
        definition: newEntry.definition.trim() || undefined,
        example: newEntry.example.trim() || undefined,
        notes: newEntry.notes.trim() || undefined,
        language: newEntry.language,
      });
      // Verified create response: { id, message } — prepend the known shape
      // locally instead of refetching the whole first page.
      const created: PersonalDictionaryEntry = {
        id: res?.id ?? String(Date.now()),
        word,
        definition: newEntry.definition.trim() || null,
        example: newEntry.example.trim() || null,
        notes: newEntry.notes.trim() || null,
        language: newEntry.language,
        created_at: new Date().toISOString(),
      };
      setEntries((prev) => [created, ...prev]);
      setNewEntry({ ...EMPTY_FORM, language: newEntry.language });
      setShowCreateForm(false);
      notify.success(t('tools.personalDict.createSuccess'));
    } catch (error: any) {
      console.error('[WfPersonalDictionary] Create failed:', error);
      notify.error(error?.message || t('tools.personalDict.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  // Optimistic delete (single / all) with rollback on failure.
  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    const prev = entries;
    const prevHasMore = hasMore;
    setConfirmTarget(null);
    if (target.type === 'one') {
      setEntries(prev.filter((it) => it.id !== target.entry.id));
      try {
        await wordflowApi.deletePersonalDictionaryEntry(target.entry.id);
        notify.success(t('tools.personalDict.deleteSuccess'));
      } catch (error: any) {
        console.error('[WfPersonalDictionary] Delete failed:', error);
        setEntries(prev);
        notify.error(error?.message || t('tools.personalDict.deleteFailed'));
      }
    } else {
      setEntries([]);
      setHasMore(false);
      try {
        await wordflowApi.deleteAllPersonalDictionaryEntries();
        notify.success(t('tools.personalDict.deleteAllSuccess'));
      } catch (error: any) {
        console.error('[WfPersonalDictionary] Delete all failed:', error);
        setEntries(prev);
        setHasMore(prevHasMore);
        notify.error(error?.message || t('tools.personalDict.deleteAllFailed'));
      }
    }
  };

  const languages = getSupportedLanguages();

  // Local instant filter on the already-loaded list (word / definition /
  // notes); the Search button still runs the server-side `word` query.
  const filterQuery = searchWord.trim().toLowerCase();
  const visibleEntries = entries.filter((entry) => {
    if (!filterQuery) return true;
    return (
      (entry.word || '').toLowerCase().includes(filterQuery) ||
      (entry.definition || '').toLowerCase().includes(filterQuery) ||
      (entry.notes || '').toLowerCase().includes(filterQuery)
    );
  });

  if (!appLoading && !isAuthenticated) {
    return (
      <div className="route-fade min-h-screen bg-transparent pb-32">
        <PageHeader title={t('tools.personalDict.title')} onBack={() => navigate(-1)} />
        <div className="ds-page pt-[var(--space-breath)]">
          <EmptyState
            icon={<Lock strokeWidth={1.5} />}
            title={t('settings.loginRequired')}
            description={t('tools.personalDict.loginDescription')}
            action={
              <Button
                variant="grad"
                className="!w-auto px-8"
                onClick={() => navigate(wfPath('auth/login'))}
              >
                {t('auth.login')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="route-fade min-h-screen bg-transparent pb-32">
      <PageHeader
        title={t('tools.personalDict.title')}
        onBack={() => navigate(-1)}
        right={
          <Button
            variant="grad"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="!w-auto !py-2 px-4 text-sm"
          >
            + {t('tools.personalDict.addEntry')}
          </Button>
        }
      />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {filterQuery
              ? t('tools.personalDict.filteredCount', {
                  shown: visibleEntries.length,
                  total: entries.length,
                })
              : t('tools.personalDict.entriesCount', { count: entries.length })}
          </p>
        </div>

        {/* Search bar */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('tools.personalDict.searchPlaceholder')}
            className="ds-glass ds-glass-edge flex-1 min-w-[180px] px-4 py-3 rounded-full text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] transition-all"
          />
          <Button variant="klein" onClick={handleSearch} className="!w-auto !py-3 px-6">
            {t('common.search')}
          </Button>
          {entries.length > 0 && (
            <Button
              variant="danger"
              onClick={() => setConfirmTarget({ type: 'all' })}
              className="!w-auto !py-3 px-4"
            >
              {t('tools.personalDict.deleteAll')}
            </Button>
          )}
        </div>

        {/* Create form */}
        {showCreateForm && (
          <Card>
            <h2 className="ds-section-title mb-4">{t('tools.personalDict.addNewEntry')}</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t('tools.personalDict.word')} *
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
                  {t('tools.personalDict.language')}
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
                  {t('tools.personalDict.definition')}
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
                  {t('tools.personalDict.example')}
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
                  {t('tools.personalDict.notes')}
                </label>
                <textarea
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="grad" onClick={() => handleCreate()} disabled={creating} className="flex-1 !py-3">
                  {creating ? t('common.creating') : t('tools.personalDict.createEntry')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                  className="!w-auto !py-3 px-6"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Loading state */}
        {loading && <LoadingState label={t('tools.personalDict.loadingEntries')} />}

        {/* Empty state */}
        {!loading && visibleEntries.length === 0 && (
          <EmptyState
            icon={<Icons.Book />}
            title={t('tools.personalDict.empty')}
            description={
              filterQuery
                ? t('tools.personalDict.emptyFiltered')
                : t('tools.personalDict.emptyHint')
            }
          />
        )}

        {/* Entries list — card stack (locally filtered by the search box) */}
        {!loading && visibleEntries.length > 0 && (
          <div className="ds-stack-tight">
            {visibleEntries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{entry.word}</h3>
                    {entry.language && (
                      <Badge tone="klein" className="mt-1">{entry.language.toUpperCase()}</Badge>
                    )}
                  </div>
                  <IconButton
                    label={t('tools.personalDict.deleteEntry')}
                    onClick={() => setConfirmTarget({ type: 'one', entry })}
                    className="!text-red-500 hover:!bg-red-500/10"
                    icon={<Trash2 className="w-5 h-5" />}
                  />
                </div>

                {entry.definition && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
                      {t('tools.personalDict.definition')}:
                    </p>
                    <p className="text-[var(--color-text-primary)]">{entry.definition}</p>
                  </div>
                )}

                {entry.example && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
                      {t('tools.personalDict.example')}:
                    </p>
                    <p className="text-[var(--color-text-secondary)] italic">{entry.example}</p>
                  </div>
                )}

                {entry.notes && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">
                      {t('tools.personalDict.notes')}:
                    </p>
                    <p className="text-[var(--color-text-tertiary)] text-sm">{entry.notes}</p>
                  </div>
                )}

                {entry.created_at && (
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-3">
                    {t('tools.personalDict.createdAt')}: {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                )}
              </Card>
            ))}

            {/* Offset pagination: a full page implies there may be more rows. */}
            {hasMore && !filterQuery && (
              <Button
                variant="secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="!py-3"
              >
                {loadingMore ? t('common.loading') : t('tools.personalDict.loadMore')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation — Sheet, never window.confirm */}
      <Sheet open={confirmTarget !== null} onClose={() => setConfirmTarget(null)}>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
          {confirmTarget?.type === 'all'
            ? t('tools.personalDict.deleteAllConfirmTitle')
            : t('tools.personalDict.deleteConfirmTitle')}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {confirmTarget?.type === 'all'
            ? t('tools.personalDict.deleteAllConfirmMessage', { count: entries.length })
            : t('tools.personalDict.deleteConfirmMessage', {
                word: confirmTarget?.type === 'one' ? confirmTarget.entry.word : '',
              })}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteConfirmed}>
            {t('common.delete')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

export default WfToolsPersonalDictionaryPage;
