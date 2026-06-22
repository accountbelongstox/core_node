/* [v4.1-Iris] Article Processor — ported from
 * poly_apps/qy_capacitor/pages/Tools/ArticleProcessor.tsx, wired to the real
 * AppQyV1ArticleController pipeline through the typed wordflowApi article
 * methods: preview (parse only) → submit (persist + TTS global task) → poll
 * /ai_tools/article/task/{id} via the persistent-task layer until done →
 * "add extracted words to a study group" through addWordsToGroup (the
 * /create_group upsert-append path — /group/add_word only takes integer ids).
 * Conventions: useWfApp() t() i18n, notify toasts, Sheet for the group picker,
 * cancellation-safe effects. The submit→poll session lives in
 * <TaskPersistenceProvider> (key wordflow.article-processor): the persisted
 * payload carries { task_id, words } so both the poll loop AND the extracted
 * word list survive navigation and a full reload. Faithful Iris look. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, Layers, Lock, XCircle } from 'lucide-react';
import { Card, PageHeader, ProgressBar, Button, EmptyState, LoadingState, Sheet, Icons } from '../WfUI';
import {
  wordflowApi,
  type ArticlePreviewResult,
  type ArticleTaskStatus,
} from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { usePersistentTask } from '../../../core/tasks/usePersistentTask';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { notify } from '../../../core/notify/notify';
import { getSupportedLanguages } from '../WfLanguageCenter';

// Live-verified: /ai_tools/article/{preview,submit} validate language
// in:english,chinese,spanish,french,german,japanese,korean — full names,
// not ISO codes.
const ARTICLE_LANGUAGE_NAME: Record<string, string> = {
  en: 'english',
  zh: 'chinese',
  es: 'spanish',
  fr: 'french',
  de: 'german',
  ja: 'japanese',
  ko: 'korean',
};

interface ArticleTaskSaved {
  task_id: string;
  /** Unique words extracted at submit time (kept for the add-to-group flow). */
  words?: string[];
}

const SAMPLE_TITLE = 'The Benefits of Learning Languages';
const SAMPLE_CONTENT = `Learning a new language opens up a world of opportunities. It not only enhances your cognitive abilities but also allows you to connect with people from different cultures.

Research shows that bilingual individuals have better problem-solving skills and improved memory. Language learning also delays cognitive decline in older adults.

Furthermore, knowing multiple languages can boost your career prospects. In today's globalized world, employers value candidates who can communicate across cultures and languages.

Start your language learning journey today and experience these amazing benefits yourself!`;

const WfToolsArticleProcessorPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: appLoading, t } = useWfApp();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('en');
  const [difficultyLevel, setDifficultyLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ArticlePreviewResult | null>(null);

  // Add-extracted-words-to-group flow (Sheet group picker).
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [addingGid, setAddingGid] = useState<string | null>(null);

  // The submit→poll-until-done task is backed by the global task layer
  // (`wordflow.article-processor`): the task_id + extracted words, the polled
  // status snapshot and the poll loop live in <TaskPersistenceProvider> above
  // the router, so they survive navigating away/back AND a full reload —
  // `begin({ task_id, words })` persists the payload, and `reattach` re-polls
  // the backend on a fresh load. No try/catch — `.catch`.
  const fetchTask = (id: string): Promise<ArticleTaskStatus | null> =>
    wordflowApi
      .getArticleTaskStatus(id)
      .then((data) => (data ? { ...data, task_id: id } : null))
      .catch((error: any) => {
        console.error('[WfArticleProcessor] Status check failed:', error);
        return null; // keep last snapshot; transient failure won't clobber
      });

  const task = usePersistentTask<ArticleTaskStatus, ArticleTaskSaved>(
    'wordflow.article-processor',
    {
      intervalMs: 2000,
      poll: () => {
        const id = task.saved?.task_id ?? task.data?.task_id;
        if (!id) return Promise.resolve(null);
        return fetchTask(id).then((snap) => {
          if (!snap) return null;
          // A terminal task should settle: push the final snapshot then return
          // null so the provider stops polling but keeps `data` (survives reload).
          if (snap.status === 'completed' || snap.status === 'failed') {
            task.set(snap);
            return null;
          }
          return snap;
        });
      },
      reattach: (saved) => (saved?.task_id ? fetchTask(saved.task_id) : Promise.resolve(null)),
    },
  );

  const taskStatus = task.data;
  const taskId = task.saved?.task_id ?? task.data?.task_id ?? null;

  // Words available for the add-to-group flow: the submitted set (persisted
  // with the task) wins; before a submit the preview parse is used.
  const extractedWords: string[] =
    (task.saved?.words && task.saved.words.length > 0 ? task.saved.words : null) ??
    (previewData?.words ?? []);

  // Load the user's groups when the picker opens (cancellation-safe).
  useEffect(() => {
    if (!groupSheetOpen) return;
    let cancelled = false;
    setGroupsLoading(true);
    wordflowApi
      .getWordGroups()
      .then((list) => {
        if (!cancelled) setGroups(Array.isArray(list) ? list : []);
      })
      .catch((error) => {
        console.error('[WfArticleProcessor] Failed to load groups:', error);
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => { cancelled = true; };
  }, [groupSheetOpen]);

  const handlePreview = async () => {
    if (!content.trim()) {
      notify.error(t('tools.articleProcessor.contentRequired'));
      return;
    }
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      // Live-verified params: { article_text, language } (the backend rejects
      // `content` with "The article text field is required.").
      const data = await wordflowApi.articlePreview({
        article_text: content.trim(),
        language: ARTICLE_LANGUAGE_NAME[language] || language,
      });
      setPreviewData(data || null);
    } catch (error: any) {
      console.error('[WfArticleProcessor] Preview failed:', error);
      notify.error(error?.message || t('tools.articleProcessor.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      notify.error(t('tools.articleProcessor.titleContentRequired'));
      return;
    }
    setLoading(true);
    if (task.running) task.end(); // clear any prior session before a new submit
    try {
      // Live-verified params (same validator as preview): article_text +
      // full-name language; title / difficulty_level are optional extras.
      const data = await wordflowApi.articleSubmit({
        title: title.trim(),
        article_text: content.trim(),
        language: ARTICLE_LANGUAGE_NAME[language] || language,
        difficulty_level: difficultyLevel,
      });
      const words = Array.isArray(data?.words)
        ? data.words.map((w) => w.word).filter(Boolean)
        : [];
      if (data?.task_id) {
        // Register + persist { task_id, words } and start the provider's poll loop.
        task.begin({ task_id: data.task_id, words });
        notify.success(t('tools.articleProcessor.submitted'));
      } else if (data?.article_id) {
        // Saved without a TTS task (tts_status: not_requested) — still done.
        notify.success(t('tools.articleProcessor.submitted'));
      } else {
        notify.error(t('tools.articleProcessor.submitFailed'));
      }
    } catch (error: any) {
      console.error('[WfArticleProcessor] Submission failed:', error);
      notify.error(error?.message || t('tools.articleProcessor.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToGroup = async (group: WordGroup) => {
    if (extractedWords.length === 0 || addingGid) return;
    setAddingGid(group.id);
    try {
      // Verified /create_group upsert: posting an EXISTING gname appends the
      // gwords to that group. Unwrapped success data carries new_words.
      const res: any = await wordflowApi.addWordsToGroup(group.name, extractedWords, {
        gcontent: content.trim() || undefined,
        language,
      });
      const added = typeof res?.new_words === 'number' ? res.new_words : extractedWords.length;
      notify.success(
        t('tools.articleProcessor.addedToGroup', { count: added, name: group.name })
      );
      setGroupSheetOpen(false);
    } catch (error: any) {
      console.error('[WfArticleProcessor] Add words to group failed:', error);
      notify.error(error?.message || t('tools.articleProcessor.addToGroupFailed'));
    } finally {
      setAddingGid(null);
    }
  };

  const loadSampleArticle = () => {
    setTitle(SAMPLE_TITLE);
    setContent(SAMPLE_CONTENT);
    setLanguage('en');
  };

  const renderPillNav = (
    items: { id: string; label: string }[],
    activeId: string,
    onChange: (id: string) => void,
    label: string
  ) => (
    <div className="ds-pill-nav" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          onClick={() => onChange(item.id)}
          className={`ds-pill-chip ${activeId === item.id ? 'is-active' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const renderAddToGroupButton = () =>
    extractedWords.length > 0 && (
      <Button
        variant="grad"
        className="!py-3 mt-1"
        onClick={() => setGroupSheetOpen(true)}
      >
        {t('tools.articleProcessor.addWordsToGroup', { count: extractedWords.length })}
      </Button>
    );

  // The preview/submit endpoints are auth:sanctum — gate like other tools pages.
  if (!appLoading && !isAuthenticated) {
    return (
      <div className="route-fade min-h-screen bg-transparent pb-32">
        <PageHeader title={t('tools.articleProcessor.title')} onBack={() => navigate(-1)} />
        <div className="ds-page pt-[var(--space-breath)]">
          <EmptyState
            icon={<Lock strokeWidth={1.5} />}
            title={t('settings.loginRequired')}
            description={t('tools.articleProcessor.loginDescription')}
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
      <PageHeader title={t('tools.articleProcessor.title')} onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('tools.articleProcessor.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-lg)]">
          {/* Input panel */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="ds-section-title">{t('tools.articleProcessor.articleContent')}</h2>
              <button onClick={loadSampleArticle} className="ds-link-more">
                {t('tools.articleProcessor.loadSample')}
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t('tools.articleProcessor.articleTitle')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('tools.articleProcessor.titlePlaceholder')}
                className="w-full px-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)]"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t('tools.articleProcessor.articleContent')}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('tools.articleProcessor.contentPlaceholder')}
                className="w-full h-80 px-4 py-3 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none"
              />
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {t('tools.articleProcessor.contentStats', {
                  chars: content.length,
                  words: content.split(/\s+/).filter((w) => w).length,
                })}
              </div>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <label className="ds-section-label block mb-2">
                  {t('tools.articleProcessor.language')}
                </label>
                {renderPillNav(
                  getSupportedLanguages().map((l) => ({ id: l.code, label: l.name })),
                  language,
                  setLanguage,
                  t('tools.articleProcessor.language')
                )}
              </div>

              <div>
                <label className="ds-section-label block mb-2">
                  {t('tools.articleProcessor.difficulty')}
                </label>
                {renderPillNav(
                  [
                    { id: 'beginner', label: t('library.beginner') },
                    { id: 'intermediate', label: t('library.intermediate') },
                    { id: 'advanced', label: t('library.advanced') },
                  ],
                  difficultyLevel,
                  (id) => setDifficultyLevel(id as typeof difficultyLevel),
                  t('tools.articleProcessor.difficulty')
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={previewLoading || !content.trim()}
              >
                {previewLoading
                  ? t('tools.articleProcessor.previewing')
                  : t('tools.articleProcessor.previewParsing')}
              </Button>
              <Button
                variant="grad"
                onClick={handleSubmit}
                disabled={loading || !title.trim() || !content.trim()}
              >
                {loading
                  ? t('tools.articleProcessor.submitting')
                  : t('tools.articleProcessor.processArticle')}
              </Button>
            </div>
          </Card>

          {/* Results panel */}
          <div className="lg:col-span-1 space-y-[var(--space-lg)]">
            {previewData && (
              <Card>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
                  {t('tools.articleProcessor.previewResults')}
                </h3>
                <div className="space-y-3">
                  {/* Live-verified preview shape: { sentences, words, word_frequency,
                      total_sentences, total_words, unique_words } */}
                  <div className="p-3 bg-[var(--klein-blue-soft)] rounded-[var(--radius-button)] space-y-1">
                    <p className="text-sm text-[var(--klein-blue)] font-semibold">
                      {t('tools.articleProcessor.wordsFound', { count: previewData.total_words ?? 0 })}
                    </p>
                    <p className="text-xs text-[var(--klein-blue)]">
                      {t('tools.articleProcessor.sentencesCount', { count: previewData.total_sentences ?? 0 })}
                      {' · '}
                      {t('tools.articleProcessor.uniqueWords', { count: previewData.unique_words ?? 0 })}
                    </p>
                  </div>
                  {Array.isArray(previewData.words) && previewData.words.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        {t('tools.articleProcessor.sampleWords')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {previewData.words.slice(0, 10).map((word, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-secondary)] text-xs rounded-full"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!taskId && renderAddToGroupButton()}
                </div>
              </Card>
            )}

            {taskId && (
              <Card>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
                  {t('tools.articleProcessor.processingStatus')}
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-[var(--color-surface)] border border-[var(--border-highlight)] rounded-[var(--radius-button)]">
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
                      {t('tools.articleProcessor.taskId')}
                    </p>
                    <p className="text-sm font-mono text-[var(--color-text-primary)] break-all">{taskId}</p>
                  </div>

                  {taskStatus && (
                    <>
                      <div className="p-3 bg-[var(--klein-blue-soft)] rounded-[var(--radius-button)]">
                        <p className="text-xs text-[var(--klein-blue)] mb-1">
                          {t('tools.articleProcessor.status')}
                        </p>
                        <p className="text-sm font-semibold text-[var(--klein-blue)] capitalize">
                          {taskStatus.status}
                        </p>
                      </div>

                      {taskStatus.progress !== undefined && taskStatus.progress !== null && (
                        <div className="p-3 bg-[var(--color-surface)] border border-[var(--border-highlight)] rounded-[var(--radius-button)]">
                          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                            {t('tools.articleProcessor.progress')}
                          </p>
                          <ProgressBar value={taskStatus.progress} />
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-right">
                            {Math.round(taskStatus.progress)}%
                          </p>
                        </div>
                      )}

                      {taskStatus.status === 'completed' && (
                        <div className="p-3 bg-[var(--klein-blue-soft)] border border-[var(--klein-blue)]/30 rounded-[var(--radius-button)]">
                          <p className="text-sm text-[var(--klein-blue)] font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            {t('tools.articleProcessor.completedMessage')}
                          </p>
                        </div>
                      )}

                      {taskStatus.status === 'failed' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-[var(--radius-button)]">
                          <p className="text-sm text-red-500 font-semibold flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 flex-shrink-0" />
                            {t('tools.articleProcessor.failedMessage')}
                          </p>
                          {taskStatus.error && (
                            <p className="text-xs text-red-500 mt-1 break-words">{taskStatus.error}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Extracted words (persisted with the task) → group picker */}
                  {extractedWords.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        {t('tools.articleProcessor.extractedWords')}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {extractedWords.slice(0, 10).map((word, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--border-highlight)] text-[var(--color-text-secondary)] text-xs rounded-full"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                      {renderAddToGroupButton()}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {!taskId && !previewData && (
              <Card>
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-[var(--klein-blue)] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    <p className="font-semibold mb-1 text-[var(--color-text-primary)]">
                      {t('tools.articleProcessor.howItWorks')}
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>{t('tools.articleProcessor.how1')}</li>
                      <li>{t('tools.articleProcessor.how2')}</li>
                      <li>{t('tools.articleProcessor.how3')}</li>
                      <li>{t('tools.articleProcessor.how4')}</li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Group picker — Sheet, never a raw overlay */}
      <Sheet open={groupSheetOpen} onClose={() => setGroupSheetOpen(false)} position="bottom">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {t('tools.articleProcessor.addToGroupTitle')}
          </h2>
          <button
            type="button"
            onClick={() => setGroupSheetOpen(false)}
            className="ds-touch-target flex items-center justify-center rounded-full hover:bg-[var(--color-primary-container)] transition-colors text-[var(--color-text-secondary)]"
            aria-label={t('common.close')}
          >
            <Icons.Close />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {t('tools.articleProcessor.selectGroupHint', { count: extractedWords.length })}
        </p>

        {groupsLoading ? (
          <LoadingState label={t('common.loading')} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Layers strokeWidth={1.5} />}
            title={t('tools.articleProcessor.noGroups')}
            description={t('tools.articleProcessor.noGroupsHint')}
          />
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
            {groups.map((group) => {
              const isAdding = addingGid === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleAddToGroup(group)}
                  disabled={addingGid !== null}
                  className="w-full ds-card rounded-[var(--radius-card)] p-4 text-left hover:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--color-text-primary)] truncate flex-1">
                      {group.name}
                    </p>
                    <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                      {group.count} {t('library.words')}
                    </span>
                  </div>
                  {isAdding && (
                    <p className="text-xs font-semibold mt-2 text-[var(--klein-blue)]">
                      {t('tools.articleProcessor.addingWords')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
};

export default WfToolsArticleProcessorPage;
