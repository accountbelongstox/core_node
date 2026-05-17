import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

const HistoryPage = () => {
  const { navigate } = useContext(AppContext);

  // Mock Calendar Data (last 28 days for 4 weeks)
  const days = Array.from({length: 28}, (_, i) => ({
    date: i,
    intensity: Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0
  }));

  const getIntensityColor = (i: number) => {
    switch(i) {
      case 0: return 'bg-slate-200/20';
      case 1: return 'bg-blue-500/30';
      case 2: return 'bg-blue-500/50';
      case 3: return 'bg-blue-500/70';
      case 4: return 'bg-blue-500';
      default: return 'bg-slate-200/20';
    }
  };

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up pb-24">
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
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

export default HistoryPage;
