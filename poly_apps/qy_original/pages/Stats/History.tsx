<<<<<<< HEAD

import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
=======
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798

const HistoryPage = () => {
  const { navigate } = useContext(AppContext);

<<<<<<< HEAD
  // Mock Calendar Data (last 30 days)
  const days = Array.from({length: 30}, (_, i) => ({
=======
  // Mock Calendar Data (last 28 days for 4 weeks)
  const days = Array.from({length: 28}, (_, i) => ({
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    date: i,
    intensity: Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0
  }));

  const getIntensityColor = (i: number) => {
    switch(i) {
<<<<<<< HEAD
      case 0: return 'bg-slate-200 dark:bg-slate-700';
      case 1: return 'bg-blue-200 dark:bg-blue-900';
      case 2: return 'bg-blue-400 dark:bg-blue-700';
      case 3: return 'bg-blue-500 dark:bg-blue-600';
      case 4: return 'bg-blue-700 dark:bg-blue-500';
      default: return 'bg-slate-200';
=======
      case 0: return 'bg-slate-200/20';
      case 1: return 'bg-blue-500/30';
      case 2: return 'bg-blue-500/50';
      case 3: return 'bg-blue-500/70';
      case 4: return 'bg-blue-500';
      default: return 'bg-slate-200/20';
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    }
  };

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up pb-24">
<<<<<<< HEAD
       <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('stats')} className="p-1"><Icons.Back /></button>
          <h1 className="text-2xl font-bold dark:text-white">Study History</h1>
       </div>

       <Card className="mb-6 !p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Consistency Heatmap</h3>
          <div className="grid grid-cols-7 gap-2">
             {days.map((d, i) => (
                <div key={i} className={`aspect-square rounded-md ${getIntensityColor(d.intensity)}`}></div>
             ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-3 font-medium">
             <span>Less</span>
             <span>More</span>
          </div>
       </Card>

       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Recent Sessions</h3>
       <div className="space-y-3 overflow-y-auto no-scrollbar">
          {[1,2,3,4,5].map(i => (
             <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/40">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center font-bold text-xs">
                      {['RD','FC','QZ','LS','RD'][i-1]}
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-700 dark:text-white">
                         {['Reading Mode', 'Flashcards', 'Quiz', 'Listening', 'Reading Mode'][i-1]}
                      </h4>
                      <p className="text-xs text-slate-500">Today, 10:{30 + i} AM</p>
                   </div>
                </div>
                <div className="text-right">
                   <div className="font-bold text-green-500">+{10 * i} words</div>
                   <div className="text-xs text-slate-400">15 mins</div>
=======
       <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('stats')} className="p-2 rounded-full bg-white/10 hover:bg-white/20"><Icons.Back /></button>
          <h1 className="text-2xl font-bold dark:text-white">Study History</h1>
       </div>

       <div className="app-card mb-8">
          <h3 className="text-xs font-bold text-tertiary uppercase mb-4 tracking-widest">Consistency Heatmap</h3>
          <div className="heatmap-grid">
             {days.map((d, i) => (
                <div key={i} className={`heatmap-cell ${getIntensityColor(d.intensity)}`}></div>
             ))}
          </div>
          <div className="flex justify-between text-[10px] text-tertiary mt-2 font-bold uppercase">
             <span>Less</span>
             <span>More</span>
          </div>
       </div>

       <h3 className="settings-section-title">Recent Sessions</h3>
       <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
          {[1,2,3,4,5].map(i => (
             <div key={i} className="history-session-card">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
                      {['RD','FC','QZ','LS','RD'][i-1]}
                   </div>
                   <div>
                      <h4 className="font-bold text-primary">
                         {['Reading Mode', 'Flashcards', 'Quiz', 'Listening', 'Reading Mode'][i-1]}
                      </h4>
                      <p className="text-xs text-tertiary font-mono">Today, 10:{30 + i} AM</p>
                   </div>
                </div>
                <div className="text-right">
                   <div className="font-bold text-green-500">+{10 * i}</div>
                   <div className="text-[10px] font-bold text-tertiary uppercase">Words</div>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

<<<<<<< HEAD
export default HistoryPage;
=======
export default HistoryPage;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
