
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { MOCK_FRIENDS, MOCK_ACTIVITIES } from '../../services/mockData';

const FriendsPage = () => {
  const { navigate, t } = useContext(AppContext);

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
       {/* Header */}
       <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('home')} className="p-1"><Icons.Back /></button>
             {/* [i18n] Replaced hardcoded "Friends" with t() */}
             <h1 className="text-2xl font-bold dark:text-white">{t('social.friends')}</h1>
          </div>
          {/* [i18n] Replaced hardcoded "+ Add" with t() */}
          <button className="bg-blue-100 text-blue-600 p-2 rounded-xl text-sm font-bold">{t('social.add')}</button>
       </div>

       {/* Active Friends Horizontal Scroll */}
       <div className="mb-8">
          {/* [i18n] Replaced hardcoded "Active Now" with t() */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">{t('social.activeNow')}</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
             {MOCK_FRIENDS.map(f => (
                <div key={f.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                   <div className="relative">
                      <img src={f.avatar_url || f.avatar} className="w-16 h-16 rounded-2xl border-2 border-white shadow-sm" />
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${f.status === 'online' ? 'bg-green-500' : f.status === 'studying' ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                   </div>
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center">{f.name.split(' ')[0]}</span>
                </div>
             ))}
          </div>
       </div>

       {/* Activity Feed */}
       <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-24">
          {/* [i18n] Replaced hardcoded "Activity Feed" with t() */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">{t('social.activityFeed')}</h3>
          {MOCK_ACTIVITIES.map(a => (
             <Card key={a.id} className="flex gap-4 !p-4">
                <img src={a.userAvatar} className="w-12 h-12 rounded-full border border-slate-100" />
                <div className="flex-1">
                   <p className="text-sm dark:text-white">
                      <span className="font-bold">{a.userName}</span> {a.action}
                   </p>
                   <p className="text-xs text-slate-400 mt-1">{a.time}</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                   <button className="text-slate-300 hover:text-red-500 transition-colors">♥</button>
                   <span className="text-xs text-slate-400">{a.likes}</span>
                </div>
             </Card>
          ))}

          <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white !border-none mt-4">
             <div className="flex justify-between items-center">
                <div>
                   {/* [i18n] Replaced hardcoded text with t() */}
                   <h3 className="font-bold text-lg">{t('social.inviteFriends')}</h3>
                   <p className="text-white/80 text-sm">{t('social.getProFree')}</p>
                </div>
                <div className="text-3xl">🎁</div>
             </div>
          </Card>
       </div>
    </div>
  );
};

export default FriendsPage;
