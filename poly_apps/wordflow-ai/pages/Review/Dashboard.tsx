
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { api } from '../../services/api';
import { ApiCenter } from '../../services/ApiCenter';
import { RetentionStat } from '../../types';

const ReviewDashboardPage = () => {
  const { navigate, user } = useContext(AppContext);
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
      setStats(result);
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
      if (result.success && result.data) {
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

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('home')} className="p-1"><Icons.Back /></button>
        <h1 className="text-2xl font-bold dark:text-white">Brain Stats</h1>
      </div>

      {/* Main Memory Gauge */}
      <div className="flex justify-center mb-8 relative">
         <div className="w-48 h-48 rounded-full border-[12px] border-slate-100 dark:border-slate-800 flex items-center justify-center relative">
             <div className="absolute inset-0 rounded-full border-[12px] border-l-blue-500 border-t-purple-500 border-r-transparent border-b-transparent rotate-45"></div>
             <div className="text-center">
                 <div className="text-4xl font-black text-slate-800 dark:text-white">65%</div>
                 <div className="text-xs font-bold text-slate-400 uppercase">Retention</div>
             </div>
         </div>
      </div>

      <h3 className="font-bold text-slate-700 dark:text-white mb-4 pl-1">Memory Distribution</h3>
      <div className="grid grid-cols-2 gap-4 mb-8">
         {stats.map((s, i) => (
             <Card key={i} className="flex flex-col gap-2 !p-4">
                 <div className={`w-3 h-3 rounded-full ${s.color}`}></div>
                 <div className="text-2xl font-bold dark:text-white">{s.count}</div>
                 <div className="text-xs text-slate-500 uppercase font-bold">{s.level}</div>
                 <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-1">
                     <div className={`h-full rounded-full ${s.color}`} style={{width: `${s.percentage}%`}}></div>
                 </div>
             </Card>
         ))}
      </div>

      {/* Review Queue Section */}
      <div className="mb-6">
         <h3 className="font-bold text-slate-700 dark:text-white mb-4 pl-1">Review Queue</h3>
         <Card className="!p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800">
            {loadingQueue ? (
               <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
               </div>
            ) : (
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Words Due Today</p>
                        <p className="text-4xl font-black text-orange-600 dark:text-orange-400 mt-1">{reviewQueue.length}</p>
                     </div>
                     <div className="w-16 h-16 rounded-full bg-orange-600/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                     </div>
                  </div>
                  {reviewQueue.length > 0 && (
                     <div className="pt-2 border-t border-orange-200 dark:border-orange-800/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                           Next review: {reviewQueue.length} word{reviewQueue.length > 1 ? 's' : ''} waiting
                        </p>
                     </div>
                  )}
               </div>
            )}
         </Card>
      </div>

      <div className="space-y-4">
         <Button
            onClick={() => navigate('flashcard_run')}
            className="shadow-red-500/20 bg-gradient-to-r from-red-500 to-pink-600 border-none"
            disabled={reviewQueue.length === 0}
         >
             Review Critical Words ({reviewQueue.length || 0})
         </Button>
         <Button variant="secondary" onClick={() => navigate('flashcard_setup')}>
             General Review
         </Button>
      </div>
    </div>
  );
};

export default ReviewDashboardPage;
