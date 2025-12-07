import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { MOCK_LEADERBOARD, MOCK_ACHIEVEMENTS } from '../../services/mockData';

const LeaderboardPage = () => {
  const { navigate } = useContext(AppContext);
  const [tab, setTab] = useState<'ranking' | 'badges'>('ranking');

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up pb-24 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 z-10">
         <div className="flex items-center gap-3">
            <button onClick={() => navigate('home')} className="p-2 rounded-full bg-white/10 hover:bg-white/20"><Icons.Back /></button>
            <h1 className="text-2xl font-bold dark:text-white">Community</h1>
         </div>
         <div className="flex bg-white/10 rounded-xl p-1">
            <button onClick={() => setTab('ranking')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'ranking' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400'}`}>Rank</button>
            <button onClick={() => setTab('badges')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'badges' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400'}`}>Badges</button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 px-1">
         {tab === 'ranking' ? (
           <>
             {MOCK_LEADERBOARD.map((u, i) => (
               <div 
                 key={i} 
                 className={`rank-card ${u.rank <= 3 ? 'top-rank' : ''}`}
                 style={{ animationDelay: `${i * 100}ms` }}
               >
                  <div className={`
                    w-8 h-8 flex items-center justify-center font-black rounded-full text-sm
                    ${u.rank === 1 ? 'bg-yellow-400 text-yellow-900 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : u.rank === 2 ? 'bg-slate-300 text-slate-800' : u.rank === 3 ? 'bg-orange-300 text-orange-900' : 'text-slate-500 bg-white/5'}
                  `}>
                    {u.rank}
                  </div>
                  <div className="relative">
                     <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/20" />
                     {u.rank === 1 && <div className="absolute -top-2 -right-1 text-base">👑</div>}
                  </div>
                  
                  <div className="flex-1">
                     <div className="font-bold text-primary">{u.name}</div>
                     {u.isCurrentUser && <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">You</div>}
                  </div>
                  <div className="text-right">
                     <div className="text-blue-500 font-mono font-bold text-lg">{u.xp.toLocaleString()}</div>
                     <div className="text-[10px] text-slate-500 font-bold uppercase">XP</div>
                  </div>
               </div>
             ))}
           </>
         ) : (
           <div className="grid grid-cols-2 gap-4">
              {MOCK_ACHIEVEMENTS.map(a => (
                <div key={a.id} className={`app-card p-5 rounded-2xl flex flex-col items-center text-center ${!a.unlocked ? 'opacity-60 grayscale' : ''}`}>
                   <div className="text-5xl mb-4 drop-shadow-md">{a.icon}</div>
                   <h3 className="font-bold text-sm text-primary mb-2">{a.name}</h3>
                   <p className="text-xs text-secondary mb-4 leading-relaxed">{a.description}</p>
                   {a.unlocked ? (
                     <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Unlocked</span>
                   ) : (
                     <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full mt-auto overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${(a.progress / a.maxProgress) * 100}%` }}></div>
                     </div>
                   )}
                </div>
              ))}
           </div>
         )}
      </div>
    </div>
  );
};

export default LeaderboardPage;