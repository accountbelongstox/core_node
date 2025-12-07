import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

const StatsPage = () => {
  const { user, navigate } = useContext(AppContext);
  const mockWeeklyData = [40, 70, 30, 85, 50, 90, 60];

  return (
    <div className="page-container animate-slide-up">
      <div className="flex items-center gap-3 px-6 mb-4">
        <button onClick={() => navigate('home')} className="p-2 rounded-full bg-white/10 text-white"><Icons.Back /></button>
        <h1 className="text-2xl font-bold text-white">Neural Stats</h1>
      </div>

      <div className="page-content-scroll">
        <div className="stats-hero-section">
           <div className="text-xs font-bold text-blue-300 uppercase tracking-[0.2em] mb-2">Total Knowledge</div>
           <div className="stats-big-number">
             {user?.totalLearned}
           </div>
           <div className="text-sm text-slate-400">Words encoded in long-term memory</div>
        </div>

        <div className="space-y-4">
            {/* Weekly Chart */}
            <div className="holo-card p-6 bg-white/5 border border-white/10">
               <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-sm">
                  Activity Stream
               </h3>
               <div className="flex items-end justify-between h-32 gap-2">
                  {mockWeeklyData.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                       <div className="w-full bg-white/5 rounded-t-lg relative overflow-hidden" style={{height: '100%'}}>
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                            style={{height: `${h}%`, borderRadius: '4px 4px 0 0'}}
                          ></div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-4">
               <div className="holo-card p-5 bg-white/5 border border-white/10 flex flex-col items-center text-center">
                  <div className="text-3xl mb-2">🧠</div>
                  <div className="text-2xl font-bold text-white">85%</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Retention</div>
               </div>
               
               <div className="holo-card p-5 bg-white/5 border border-white/10 flex flex-col items-center text-center">
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="text-2xl font-bold text-white">{user?.streak} Day</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Streak</div>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;