
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { Header } from '../../components/Header';
import { api } from '../../services/api';
import { WordGroup } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';

const DashboardPage = () => {
  const { user, navigate, t, activeGroupId } = useContext(AppContext);
  const [activeGroup, setActiveGroup] = useState<WordGroup | null>(null);

  useEffect(() => {
    if (user) {
      api.getWordGroups().then(groups => {
        const found = groups.find(g => g.id === activeGroupId) || groups[0];
        setActiveGroup(found);
      });
    }
  }, [user, activeGroupId]);
  
  const handleProtectedAction = (action: () => void) => {
    if (user) {
      action();
    } else {
      if (window.confirm("Account required for this feature. Login now?")) {
        navigate('login');
      }
    }
  };

  const startMode = (route: string) => {
    handleProtectedAction(() => {
      navigate(route, { groupId: activeGroupId });
    });
  };

  const currentLangCode = user?.learningLanguages?.[0] || 'en';
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-safe pb-32 px-5 animate-slide-up">
      {/* Header with Avatar */}
      <div className="flex justify-between items-center mb-6 pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t('start_learning')}</span>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
            {user?.name.split(' ')[0]}
          </h1>
        </div>
        <div 
          onClick={() => navigate('profile')}
          className="relative group cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 to-purple-500 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>
          <img src={user?.avatar} className="relative w-12 h-12 rounded-full border-[3px] border-white dark:border-slate-800 shadow-lg object-cover" alt="Avatar" />
        </div>
      </div>

      {/* Active Material Indicator (Click to Change) */}
      <div onClick={() => navigate('courses')} className="mb-6 flex items-center justify-between p-4 rounded-[2rem] bg-white/40 dark:bg-slate-800/40 border border-white/40 backdrop-blur-md cursor-pointer hover:bg-white/60 transition-colors shadow-sm">
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-white dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-2xl shadow-inner border border-white/20">
                  {activeGroup?.coverImage || '📚'}
              </div>
              <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Current Book</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">{activeGroup?.name || 'Loading...'}</span>
              </div>
          </div>
          <div className="text-blue-500 text-xs font-bold px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:scale-105 transition-transform">Change</div>
      </div>

      {/* --- BENTO STUDY CENTER --- */}
      <div className="grid grid-cols-2 gap-4 auto-rows-min mb-8">
        <div className="col-span-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">Study Center</h2>
        </div>

        {/* 1. Sequential Playback (Featured) */}
        <Card onClick={() => startMode('playlist')} className="col-span-2 !p-5 bg-gradient-to-r from-blue-500 to-indigo-600 !border-none text-white shadow-xl shadow-blue-500/20 group relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
           <div className="relative z-10 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-bold backdrop-blur-sm">RECOMMENDED</span>
                 </div>
                 <h3 className="font-bold text-2xl">Smart Playlist</h3>
                 <p className="text-blue-100 text-sm font-medium">Auto-play & Instant Review</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white text-blue-600 flex items-center justify-center text-2xl shadow-lg group-active:scale-90 transition-transform">
                 ▶
              </div>
           </div>
        </Card>

        {/* 2. Flashcards */}
        <Card onClick={() => startMode('flashcard_run')} className="aspect-[4/3] flex flex-col justify-between group hover:border-blue-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-sm">
            Aa
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-white text-lg">Flashcards</div>
            <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Spaced Repetition</div>
          </div>
        </Card>

        {/* 3. Reading Flow */}
        <Card onClick={() => startMode('reading_run')} className="aspect-[4/3] flex flex-col justify-between group hover:border-purple-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl shadow-sm">
             <Icons.Book />
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-white text-lg">Reading</div>
            <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Flow Context</div>
          </div>
        </Card>
        
        {/* 4. Quiz Mode */}
        <Card onClick={() => startMode('quiz_run')} className="aspect-[4/3] flex flex-col justify-between group hover:border-orange-300 transition-colors">
           <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center text-xl shadow-sm">
              ?
           </div>
           <div>
              <div className="font-bold text-slate-800 dark:text-white text-lg">Quiz</div>
              <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Gamified Test</div>
           </div>
        </Card>

        {/* 5. Passive Listening */}
        <Card onClick={() => startMode('listening_player')} className="aspect-[4/3] flex flex-col justify-between group hover:border-pink-300 transition-colors">
           <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-500 flex items-center justify-center text-xl shadow-sm">
              🎧
           </div>
           <div>
              <div className="font-bold text-slate-800 dark:text-white text-lg">Passive</div>
              <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Audio Loop</div>
           </div>
        </Card>
      </div>

      {/* Progress & Goals */}
      <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">My Progress</h2>
          </div>
           <Card onClick={() => navigate('stats')} className="flex flex-col gap-2">
              <div className="text-3xl mb-1">🔥</div>
              <div className="font-bold dark:text-white text-xl">{user?.streak} Days</div>
              <div className="text-xs text-slate-500">Current Streak</div>
           </Card>
           <Card onClick={() => navigate('review_dashboard')} className="flex flex-col gap-2">
              <div className="text-3xl mb-1">🧠</div>
              <div className="font-bold dark:text-white text-xl">85%</div>
              <div className="text-xs text-slate-500">Retention Rate</div>
           </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
