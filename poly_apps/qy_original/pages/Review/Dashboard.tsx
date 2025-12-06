
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { api } from '../../services/api';
import { RetentionStat } from '../../types';

const ReviewDashboardPage = () => {
  const { navigate } = useContext(AppContext);
  const [stats, setStats] = useState<RetentionStat[]>([]);

  useEffect(() => {
    api.getRetentionStats().then(setStats);
  }, []);

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

      <div className="space-y-4">
         <Button onClick={() => navigate('flashcard_run')} className="shadow-red-500/20 bg-gradient-to-r from-red-500 to-pink-600 border-none">
             Review Critical Words (12)
         </Button>
         <Button variant="secondary" onClick={() => navigate('flashcard_setup')}>
             General Review
         </Button>
      </div>
    </div>
  );
};

export default ReviewDashboardPage;
