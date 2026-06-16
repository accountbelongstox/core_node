/* [v4.1-Iris] Review Dashboard — ported from qy_capacitor/pages/Review/Dashboard.tsx.
 * Self-contained: react-router useNavigate + wfPath() for nav, useWfApp() for the
 * signed-in guard. Loads retention stats via wordflowApi.getRetentionStats() and
 * the due review queue via wordflowApi.request() (the original used
 * ApiCenter.learning.getReviewQueue). Both calls are try/caught and degrade to
 * empty — unimplemented endpoints simply render zero state, never crash. CTA
 * routes to the flashcard runner / setup. Faithful Iris look (memory gauge,
 * distribution grid, gradient review-queue hero). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card, Button, BackButton, Spinner, SectionTitle, EmptyState, Icons } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { RetentionStat } from '../../../core/api-libs/wordflow/wordflowTypes';

const WfReviewDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const { isAuthenticated } = useWfApp();
  const [stats, setStats] = useState<RetentionStat[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(wfPath('auth/login'));
      return;
    }
    let cancelled = false;

    const loadRetentionStats = async () => {
      try {
        const result = await wordflowApi.getRetentionStats();
        if (!cancelled) setStats(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error('[WfReviewDashboard] Failed to load retention stats:', err);
        if (!cancelled) setStats([]);
      }
    };

    const loadReviewQueue = async () => {
      setLoadingQueue(true);
      try {
        const result = await wordflowApi.request<any>('/learning/review-queue');
        const list = Array.isArray(result)
          ? result
          : Array.isArray(result?.queue)
            ? result.queue
            : Array.isArray(result?.words)
              ? result.words
              : [];
        if (!cancelled) setReviewQueue(list);
      } catch (err) {
        console.error('[WfReviewDashboard] Failed to load review queue:', err);
        if (!cancelled) setReviewQueue([]);
      } finally {
        if (!cancelled) setLoadingQueue(false);
      }
    };

    loadRetentionStats();
    loadReviewQueue();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const safeStats = Array.isArray(stats) ? stats : [];
  const safeQueue = Array.isArray(reviewQueue) ? reviewQueue : [];

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 animate-slide-up pb-24">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate(wfPath('learn/home'))} />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('review.brainStats') || 'Brain Stats'}
        </h1>
      </div>

      {/* Main memory gauge */}
      <div className="flex justify-center relative">
        <div className="w-48 h-48 rounded-full border-[12px] border-[var(--border-highlight)] flex items-center justify-center relative">
          <div
            className="absolute inset-0 rounded-full border-[12px] border-r-transparent border-b-transparent rotate-45"
            style={{ borderLeftColor: 'var(--klein-blue)', borderTopColor: 'var(--klein-blue)' }}
          />
          <div className="text-center">
            <div className="text-4xl font-black text-[var(--color-text-primary)]">65%</div>
            <div className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase">
              {t('stats.retentionShort') || 'Retention'}
            </div>
          </div>
        </div>
      </div>

      <SectionTitle title={t('review.memoryDistribution') || 'Memory Distribution'} className="px-1" />
      {safeStats.length > 0 ? (
        <div className="ds-grid-breathing grid grid-cols-2">
          {safeStats.map((s, i) => (
            <Card key={i} className="flex flex-col gap-2 !p-4">
              <div className={`w-3 h-3 rounded-full ${s.color}`} />
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{s.count}</div>
              <div className="text-xs text-[var(--color-text-secondary)] uppercase font-bold">{s.level}</div>
              <div className="w-full bg-[var(--border-highlight)] h-1.5 rounded-full mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.percentage}%` }} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Icons.Chart />}
          title={t('review.noStats') || 'No memory data yet'}
          description={t('review.noStatsHint') || 'Study a few sessions to build your retention profile.'}
        />
      )}

      {/* Review queue section */}
      <div>
        <SectionTitle title={t('review.reviewQueue') || 'Review Queue'} className="mb-4 px-1" />
        <Card className="!p-6 relative overflow-hidden text-[var(--klein-on)]">
          <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }} />
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-8 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            {loadingQueue ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="md" className="border-white" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white/80 font-medium">
                      {t('review.wordsDueToday') || 'Words Due Today'}
                    </p>
                    <p className="text-4xl font-black mt-1">{safeQueue.length}</p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-8 h-8" aria-hidden />
                  </div>
                </div>
                {safeQueue.length > 0 && (
                  <div className="pt-2 border-t border-white/20">
                    <p className="text-xs text-white/80">
                      {t('review.nextReview') || 'Next review'}: {safeQueue.length}{' '}
                      {safeQueue.length > 1 ? t('review.wordsPlural') || 'words' : t('review.wordSingular') || 'word'}{' '}
                      {t('review.waiting') || 'waiting'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="ds-stack ds-stack-tight">
        <Button variant="grad" onClick={() => navigate(wfPath('flashcard_run'))} disabled={safeQueue.length === 0}>
          {t('review.reviewCritical') || 'Review Critical Words'} ({safeQueue.length || 0})
        </Button>
        <Button variant="secondary" onClick={() => navigate(wfPath('flashcard_setup'))}>
          {t('review.generalReview') || 'General Review'}
        </Button>
      </div>
    </div>
  );
};

export default WfReviewDashboardPage;
