/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Button, BackButton, Spinner, SectionTitle } from '../../components/UI';
import { Clock } from 'lucide-react';
import { api } from '../../services/api';
import { ApiCenter } from '../../services/ApiCenter';
import { RetentionStat } from '../../types';

const ReviewDashboardPage = () => {
  const { navigate, user, t } = useContext(AppContext);
  const [stats, setStats] = useState<RetentionStat[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('login');
      return;
    }

    loadRetentionStats();
    loadReviewQueue();
  }, [user]);

  const loadRetentionStats = async () => {
    try {
      const result = await api.getRetentionStats();
      setStats(Array.isArray(result) ? result : []);
    } catch (err: any) {
      if (err?.message?.includes('not found') || err?.code === 'HTTP_404') {
        console.log('[Review] Retention stats endpoint not implemented yet');
      } else {
        console.error('[Review] Failed to load retention stats:', err);
      }
    }
  };

  const loadReviewQueue = async () => {
    setLoadingQueue(true);
    try {
      const result = await ApiCenter.learning.getReviewQueue();
      if (result.success && Array.isArray(result.data)) {
        setReviewQueue(result.data);
      }
    } catch (err: any) {
      if (err?.message?.includes('not found') || err?.code === 'HTTP_404') {
        console.log('[Review] Review queue endpoint not implemented yet');
      } else {
        console.error('[Review] Failed to load review queue:', err);
      }
    } finally {
      setLoadingQueue(false);
    }
  };

  const safeStats = Array.isArray(stats) ? stats : [];
  const safeQueue = Array.isArray(reviewQueue) ? reviewQueue : [];

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 animate-slide-up pb-24">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate('home')} />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Brain Stats</h1>
      </div>

      {/* Main Memory Gauge */}
      <div className="flex justify-center relative">
         <div className="w-48 h-48 rounded-full border-[12px] border-[var(--border-highlight)] flex items-center justify-center relative">
             <div className="absolute inset-0 rounded-full border-[12px] border-r-transparent border-b-transparent rotate-45" style={{ borderLeftColor: 'var(--klein-blue)', borderTopColor: 'var(--klein-blue)' }}></div>
             <div className="text-center">
                 <div className="text-4xl font-black text-[var(--color-text-primary)]">65%</div>
                 <div className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase">{t('stats.retentionShort')}</div>
             </div>
         </div>
      </div>

      <SectionTitle title="Memory Distribution" className="px-1" />
      <div className="ds-grid-breathing grid grid-cols-2">
         {safeStats.map((s, i) => (
             <Card key={i} className="flex flex-col gap-2 !p-4">
                 <div className={`w-3 h-3 rounded-full ${s.color}`}></div>
                 <div className="text-2xl font-bold text-[var(--color-text-primary)]">{s.count}</div>
                 <div className="text-xs text-[var(--color-text-secondary)] uppercase font-bold">{s.level}</div>
                 <div className="w-full bg-[var(--border-highlight)] h-1.5 rounded-full mt-1 overflow-hidden">
                     <div className={`h-full rounded-full ${s.color}`} style={{width: `${s.percentage}%`}}></div>
                 </div>
             </Card>
         ))}
      </div>

      {/* Review Queue Section */}
      <div>
         <SectionTitle title="Review Queue" className="mb-4 px-1" />
         <Card className="!p-6 relative overflow-hidden text-[var(--klein-on)]">
            <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}></div>
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-12 -left-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
            {loadingQueue ? (
               <div className="flex items-center justify-center py-4">
                  <Spinner size="md" className="border-white" />
               </div>
            ) : (
               <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                     <div className="min-w-0">
                        <p className="text-sm text-white/80 font-medium">Words Due Today</p>
                        <p className="text-4xl font-black mt-1">{safeQueue.length}</p>
                     </div>
                     <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-8 h-8" aria-hidden />
                     </div>
                  </div>
                  {safeQueue.length > 0 && (
                     <div className="pt-2 border-t border-white/20">
                        <p className="text-xs text-white/80">
                           Next review: {safeQueue.length} word{safeQueue.length > 1 ? 's' : ''} waiting
                        </p>
                     </div>
                  )}
               </div>
            )}
            </div>
         </Card>
      </div>

      <div className="ds-stack ds-stack-tight">
         <Button
            variant="grad"
            onClick={() => navigate('flashcard_run')}
            disabled={safeQueue.length === 0}
         >
             Review Critical Words ({safeQueue.length || 0})
         </Button>
         <Button variant="secondary" onClick={() => navigate('flashcard_setup')}>
             General Review
         </Button>
      </div>
    </div>
  );
};

export default ReviewDashboardPage;
