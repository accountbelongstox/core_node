/* [v4.1-Iris] Course Detail — ported from
 * qy_capacitor/pages/Library/CourseDetail.tsx. Self-contained for the shell:
 * reads the groupId from the route query (?groupId=), loads the group +
 * analysis from wordflowApi in parallel, and degrades to an inline state on
 * failure. Uses react-router useNavigate/useSearchParams + wfPath() for nav,
 * useWfApp() for user / active group / t, and the shared Iris primitives in
 * WfUI. Gradient hero overlap card. Faithful to design-reference-{light,dark}.webp. */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup, CourseAnalysis } from '../../../core/api-libs/wordflow/wordflowTypes';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { Button, Card, BackButton, Badge, Stat, LoadingState, EmptyState } from '../WfUI';

const WfLibraryCourseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, activeGroupId, setActiveGroupId, t } = useWfApp();

  // No placeholder 'g1' fallback — an empty id means "no resolvable group" and
  // we must NOT call analyzeCourse('g1') (backend has no such group → error).
  const groupId = searchParams.get('groupId') || activeGroupId || '';

  const [group, setGroup] = useState<WordGroup | null>(null);
  const [analysis, setAnalysis] = useState<CourseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // No resolvable group → friendly not-found state, don't hit the API.
      if (!groupId) {
        setGroup(null);
        setAnalysis(null);
        setError(t('courseDetail.notFound') || 'Course not found.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [groups, courseAnalysis] = await Promise.all([
          wordflowApi.getWordGroups().catch(() => [] as WordGroup[]),
          wordflowApi.analyzeCourse(groupId).catch(() => null),
        ]);
        if (cancelled) return;
        const g = (Array.isArray(groups) ? groups : []).find((x) => x.id === groupId) || null;
        setGroup(g);
        setAnalysis(courseAnalysis || null);
        if (!g) setError(t('courseDetail.notFound') || 'Course not found.');
      } catch (err: any) {
        if (!cancelled) {
          console.error('[WfCourseDetail] Failed to load course:', err);
          setError(err?.message || 'Failed to load course.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

  const handleStartLearning = () => {
    // Original behavior: prompt (no redirect) when not logged in — the course
    // can only be synced to the cloud library for an authenticated user.
    if (!user) {
      // Hardcoded English like the original (no i18n key existed for it).
      alert('Please login to sync this course to your cloud library.');
      return;
    }
    if (group) setActiveGroupId(group.id);
    navigate(wfPath('learn/home'));
  };

  if (loading) {
    return (
      <div className="ds-page route-fade flex items-center justify-center pt-12">
        <LoadingState label={t('courseDetail.analyzing') || 'Analyzing content…'} />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="ds-page route-fade flex flex-col pt-12">
        <div className="flex items-center gap-3 mb-7">
          <BackButton onClick={() => navigate(wfPath('courses'))} />
          <span className="ds-section-label">{t('courseDetail.title') || 'Course Analysis'}</span>
        </div>
        <EmptyState title={error || (t('courseDetail.notFound') || 'Course not found.')} />
      </div>
    );
  }

  const newWords = analysis?.newWords ?? 0;
  const dailyGoal = user?.dailyGoal || 20;

  return (
    <div className="ds-page route-fade flex flex-col pt-12 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate(wfPath('courses'))} />
        <span className="ds-section-label">{t('courseDetail.title') || 'Course Analysis'}</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 ds-stack">
        {/* Cover */}
        <div className="flex items-center gap-6 px-1">
          <div className="ds-media-frame w-24 h-32 shrink-0 flex items-center justify-center">
            <span className="text-5xl">{group.coverImage || '📚'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-[var(--color-text-primary)] leading-tight mb-2 line-clamp-2">
              {group.name}
            </h1>
            <Badge tone="klein">{group.type}</Badge>
          </div>
        </div>

        {/* Analysis cards */}
        <div className="ds-grid-breathing grid grid-cols-2">
          {/* Gradient hero overlap card */}
          <div
            className="col-span-2 rounded-[var(--radius-card)] p-7 flex flex-col items-center text-center text-[color:var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-4xl font-black mb-1">{analysis?.similarity ?? 0}%</div>
              <div className="text-xs font-bold uppercase tracking-widest text-white/85">
                {t('courseDetail.overlap') || 'Overlap with Memory'}
              </div>
              <p className="text-xs text-white/75 mt-2">
                {t('courseDetail.knownWords') || 'You already know'} {analysis?.knownWords ?? 0}{' '}
                {t('courseDetail.wordsInBook') || 'words in this book.'}
              </p>
            </div>
          </div>

          <Card className="flex flex-col items-center justify-center py-7">
            <Stat value={newWords} label={t('courseDetail.newWords') || 'New Words'} accent className="items-center" />
          </Card>

          <Card className="flex flex-col items-center justify-center py-7">
            <Stat
              value={`~${Math.max(1, Math.ceil(newWords / dailyGoal))}`}
              label={t('courseDetail.daysToFinish') || 'Days to Finish'}
              accent
              className="items-center"
            />
          </Card>
        </div>

        <div className="px-1">
          <h3 className="ds-section-title mb-3">{t('courseDetail.description') || 'Course Description'}</h3>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            {group.description ||
              (t('courseDetail.descriptionFallback') ||
                'This comprehensive course covers essential vocabulary tailored for your learning goals. Optimized for memory retention with spaced repetition compatibility.')}
          </p>
        </div>

        {/* Sample preview */}
        <div className="px-1">
          <h3 className="ds-section-title mb-3">{t('courseDetail.sampleContent') || 'Sample Content'}</h3>
          <div className="ds-stack-tight flex flex-col">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ds-row flex items-center gap-3 p-4">
                <span className="w-8 h-8 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-xs font-bold text-[var(--klein-blue)]">
                  {i}
                </span>
                <div className="h-2 w-24 bg-black/10 dark:bg-white/10 rounded-full" />
                <div className="h-2 w-16 bg-black/10 dark:bg-white/10 rounded-full opacity-50" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating gradient CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/90 to-transparent z-20">
        <Button variant="grad" onClick={handleStartLearning}>
          {t('courseDetail.startLearning') || 'Start Learning Now'}
        </Button>
      </div>
    </div>
  );
};

export default WfLibraryCourseDetailPage;
