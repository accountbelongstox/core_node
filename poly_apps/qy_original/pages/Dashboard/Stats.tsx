
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';

const StatsPage = () => {
  const { user, navigate } = useContext(AppContext);

  const mockWeeklyData = [40, 70, 30, 85, 50, 90, 60];

  return (
    <div className="h-full flex flex-col p-4 pt-12 animate-slide-up pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('home')} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><Icons.Back /></button>
        <h1 className="text-2xl font-bold dark:text-white">Statistics</h1>
      </div>

      <div className="space-y-6">
        <Card className="bg-slate-800 text-white border-none">
           <div className="text-slate-400 text-sm mb-1">Total Words Learned</div>
           <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
             {user?.totalLearned}
           </div>
        </Card>

        <div className="glass-panel p-5 rounded-2xl">
           <h3 className="font-bold mb-4 dark:text-white">Weekly Activity</h3>
           <div className="flex items-end justify-between h-32 gap-2">
              {mockWeeklyData.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                   <div className="w-full bg-blue-500/20 rounded-t-md relative overflow-hidden" style={{height: '100%'}}>
                      <div className="absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all duration-1000" style={{height: `${h}%`}}></div>
                   </div>
                   <span className="text-xs text-slate-400">{['M','T','W','T','F','S','S'][i]}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <Card>
              <div className="text-3xl mb-2">🧠</div>
              <div className="font-bold dark:text-white">85%</div>
              <div className="text-xs text-slate-500">Retention Rate</div>
           </Card>
           <Card>
              <div className="text-3xl mb-2">⏱️</div>
              <div className="font-bold dark:text-white">12.5h</div>
              <div className="text-xs text-slate-500">Study Time</div>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
