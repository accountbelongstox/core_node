
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { MOCK_LEADERBOARD, MOCK_ACHIEVEMENTS } from '../../services/mockData';

const LeaderboardPage = () => {
  // [i18n] Added `t` function for multi-language support
  const { navigate, t } = useContext(AppContext);
  const [tab, setTab] = useState<'ranking' | 'badges'>('ranking');

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up pb-24">
      <div className="flex justify-between items-center mb-6">
         <div className="flex items-center gap-3">
            <button onClick={() => navigate('home')} className="p-1"><Icons.Back /></button>
            {/* [i18n] Replaced hardcoded "Community" with t() */}
            <h1 className="text-2xl font-bold dark:text-white">{t('social.community')}</h1>
         </div>
         <div className="flex gap-2">
            {/* [i18n] Replaced hardcoded tab labels with t() */}
            <button onClick={() => setTab('ranking')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'ranking' ? 'bg-blue-500 text-white' : 'bg-white/40 text-slate-600'}`}>{t('social.rank')}</button>
            <button onClick={() => setTab('badges')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'badges' ? 'bg-blue-500 text-white' : 'bg-white/40 text-slate-600'}`}>{t('social.badges')}</button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
         {tab === 'ranking' ? (
           <>
             {MOCK_LEADERBOARD.map((u, i) => (
               <div 
                 key={i} 
                 className={`
                   flex items-center gap-4 p-4 rounded-2xl holo-card border-white/40
                   ${u.isCurrentUser ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : ''}
                   ${u.rank === 1 ? 'shadow-yellow-200/50 border-yellow-200' : ''}
                 `}
               >
                  <div className={`
                    w-8 h-8 flex items-center justify-center font-bold rounded-full
                    ${u.rank === 1 ? 'bg-yellow-400 text-white' : u.rank === 2 ? 'bg-slate-300 text-white' : u.rank === 3 ? 'bg-orange-300 text-white' : 'bg-transparent text-slate-400'}
                  `}>
                    {u.rank}
                  </div>
                  <img src={u.avatar_url || u.avatar} className="w-10 h-10 rounded-full border border-white" />
                  <div className="flex-1 font-bold text-slate-700 dark:text-white">{u.name}</div>
                  <div className="text-blue-500 font-mono font-bold">{u.xp} XP</div>
               </div>
             ))}
           </>
         ) : (
           <div className="grid grid-cols-2 gap-4">
              {MOCK_ACHIEVEMENTS.map(a => (
                <div key={a.id} className={`holo-card p-4 rounded-2xl flex flex-col items-center text-center ${!a.unlocked ? 'opacity-60 grayscale' : ''}`}>
                   <div className="text-4xl mb-3">{a.icon}</div>
                   <h3 className="font-bold text-sm dark:text-white mb-1">{a.name}</h3>
                   <p className="text-xs text-slate-500 mb-3 leading-tight">{a.description}</p>
                   {a.unlocked ? (
                     {/* [i18n] Replaced hardcoded "Unlocked" with t() */}
                     <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-bold rounded-full">{t('social.unlocked')}</span>
                   ) : (
                     <div className="w-full bg-slate-200 h-1.5 rounded-full mt-auto">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(a.progress / a.maxProgress) * 100}%` }}></div>
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
