
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';

const HistoryPage = () => {
  const { navigate } = useContext(AppContext);

  // Mock Calendar Data (last 30 days)
  const days = Array.from({length: 30}, (_, i) => ({
    date: i,
    intensity: Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0
  }));

  const getIntensityColor = (i: number) => {
    switch(i) {
      case 0: return 'bg-slate-200 dark:bg-slate-700';
      case 1: return 'bg-blue-200 dark:bg-blue-900';
      case 2: return 'bg-blue-400 dark:bg-blue-700';
      case 3: return 'bg-blue-500 dark:bg-blue-600';
      case 4: return 'bg-blue-700 dark:bg-blue-500';
      default: return 'bg-slate-200';
    }
  };

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up pb-24">
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
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

export default HistoryPage;
