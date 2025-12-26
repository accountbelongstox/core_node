<<<<<<< HEAD

import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
=======
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
import { api } from '../../services/api';
import { RetentionStat } from '../../types';

const ReviewDashboardPage = () => {
  const { navigate } = useContext(AppContext);
  const [stats, setStats] = useState<RetentionStat[]>([]);

  useEffect(() => {
    api.getRetentionStats().then(setStats);
  }, []);

  return (
<<<<<<< HEAD
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
=======
    <div className="page-container animate-slide-up">
      <div className="flex items-center gap-3 px-6 mb-4">
        <button onClick={() => navigate('home')} className="p-2 rounded-full bg-white/10 text-white"><Icons.Back /></button>
        <h1 className="text-2xl font-bold text-white">Brain Health</h1>
      </div>

      <div className="page-content-scroll">
         {/* Gauge */}
         <div className="flex justify-center mb-8 relative py-8">
             <div className="relative w-64 h-32 overflow-hidden">
                 <div className="absolute top-0 left-0 w-64 h-64 rounded-full border-[2rem] border-white/5 border-b-transparent border-r-transparent transform rotate-45"></div>
                 <div className="absolute top-0 left-0 w-64 h-64 rounded-full border-[2rem] border-blue-500 border-b-transparent border-r-transparent transform rotate-45 shadow-[0_0_40px_rgba(59,130,246,0.3)]" style={{clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'}}></div>
             </div>
             <div className="absolute bottom-6 text-center w-full">
                 <div className="text-6xl font-black text-white drop-shadow-lg">65%</div>
                 <div className="text-xs font-bold text-blue-300 uppercase tracking-[0.2em] mt-1">Efficiency</div>
             </div>
         </div>

         <div className="space-y-4 mb-8">
             <h3 className="settings-section-title">Memory Matrix</h3>
             {stats.map((s, i) => (
                 <div key={i} className="holo-card p-4 bg-white/5 border border-white/10 flex items-center gap-4">
                     <div className={`w-3 h-3 rounded-full ${s.color} shadow-[0_0_10px_currentColor]`}></div>
                     <div className="flex-1">
                         <div className="flex justify-between items-end mb-2">
                             <span className="text-sm font-bold text-white">{s.level}</span>
                             <span className="text-xs font-mono text-slate-400">{s.count} words</span>
                         </div>
                         <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                             <div className={`h-full rounded-full ${s.color}`} style={{width: `${s.percentage}%`}}></div>
                         </div>
                     </div>
                 </div>
             ))}
         </div>

         <div className="space-y-3 pb-8">
             <Button onClick={() => navigate('flashcard_run')} className="bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/20">
                 ⚡ Critical Review (12)
             </Button>
             <Button variant="primary" onClick={() => navigate('flashcard_setup')}>
                 Start General Review
             </Button>
         </div>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
      </div>
    </div>
  );
};

<<<<<<< HEAD
export default ReviewDashboardPage;
=======
export default ReviewDashboardPage;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
