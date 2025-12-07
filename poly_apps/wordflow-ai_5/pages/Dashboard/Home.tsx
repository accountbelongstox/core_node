
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
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
  
  // Unified Auth Guard
  const handleProtectedAction = (action: () => void) => {
      if (user) {
          action();
      } else {
          if (window.confirm("Account required for this feature. Login now?")) {
              navigate('login');
          }
      }
  };

  const currentLangCode = user?.learningLanguages?.[0] || 'en';
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-slate-950">
      <Header />
      
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-24 pb-32 animate-slide-up">
        {/* Welcome Section */}
        <div className="mb-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                 {user ? t('start_learning') : 'Guest Mode'}
            </span>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                {user ? `Hi, ${user.name.split(' ')[0]}` : 'Welcome Guest'}
            </h1>
        </div>

        {/* Language Selection Bar */}
        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-white/40 backdrop-blur-sm mb-8 shadow-sm">
             <div className="flex items-center gap-3">
                 <span className="text-2xl">{currentLang.flag}</span>
                 <div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Target Language</div>
                     <div className="text-sm font-bold text-slate-800 dark:text-white leading-none">{currentLang.name}</div>
                 </div>
             </div>
             
             <button 
                onClick={() => navigate('settings_lang')}
                className="p-2 rounded-xl bg-white/60 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border border-white/20 shadow-sm"
             >
                 <Icons.Settings />
             </button>
        </div>

        {/* Library / Active Course Section */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-2 px-1">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {user ? 'My Course' : 'Library'}
                </h2>
                <button 
                    onClick={() => handleProtectedAction(() => navigate('courses'))} 
                    className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg"
                >
                    + Add
                </button>
            </div>

            {user ? (
                <div 
                    onClick={() => navigate('course_detail', { groupId: activeGroupId })}
                    className="flex items-center justify-between p-5 rounded-[2rem] bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-800/60 dark:to-slate-900/40 border border-white/40 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-lg shadow-blue-500/5 group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-3xl shadow-inner border border-white/40">
                            {activeGroup?.coverImage || '📚'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {activeGroup?.name || 'Loading...'}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                   <div className="h-full bg-blue-500" style={{width: `${activeGroup?.progress || 0}%`}}></div>
                               </div>
                               <span className="text-xs font-bold text-slate-400">{activeGroup?.progress}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        <Icons.ChevronRight />
                    </div>
                </div>
            ) : (
                <div 
                    onClick={() => handleProtectedAction(() => {})}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/30 transition-colors group"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                        <Icons.Book />
                    </div>
                    <span className="font-bold text-slate-500 group-hover:text-blue-500">Select a Word Bank to Start</span>
                    <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-center">Login Required</span>
                </div>
            )}
        </div>

        {/* Study Modes Grid */}
        <div className="grid grid-cols-2 gap-4 auto-rows-min mb-8">
            <div className="col-span-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">Study Center</h2>
            </div>

            {/* Playlist Mode */}
            <Card 
                onClick={() => handleProtectedAction(() => navigate('playlist', { groupId: activeGroupId }))} 
                className="col-span-2 !p-5 bg-gradient-to-r from-blue-500 to-indigo-600 !border-none text-white shadow-xl shadow-blue-500/20 group relative overflow-hidden cursor-pointer"
            >
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
                     {user ? '▶' : <div className="text-slate-400"><Icons.Lock /></div>}
                  </div>
               </div>
            </Card>

            {/* Flashcards */}
            <Card 
                onClick={() => handleProtectedAction(() => navigate('flashcard_run', { groupId: activeGroupId }))} 
                className="aspect-[4/3] flex flex-col justify-between group hover:border-blue-300 transition-colors cursor-pointer relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-sm">
                Aa
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-white text-lg">Flashcards</div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Spaced Repetition</div>
              </div>
              {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>

            {/* Reading Flow */}
            <Card 
                onClick={() => handleProtectedAction(() => navigate('reading_run', { groupId: activeGroupId }))} 
                className="aspect-[4/3] flex flex-col justify-between group hover:border-purple-300 transition-colors cursor-pointer relative"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl shadow-sm">
                 <Icons.Book />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-white text-lg">Reading</div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Flow Context</div>
              </div>
              {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>
            
            {/* Quiz Mode */}
            <Card 
                onClick={() => handleProtectedAction(() => navigate('quiz_run', { groupId: activeGroupId }))} 
                className="aspect-[4/3] flex flex-col justify-between group hover:border-orange-300 transition-colors cursor-pointer relative"
            >
               <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center text-xl shadow-sm">
                  ?
               </div>
               <div>
                  <div className="font-bold text-slate-800 dark:text-white text-lg">Quiz</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Gamified Test</div>
               </div>
               {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>

            {/* Passive Listening */}
            <Card 
                onClick={() => handleProtectedAction(() => navigate('listening_player', { groupId: activeGroupId }))} 
                className="aspect-[4/3] flex flex-col justify-between group hover:border-pink-300 transition-colors cursor-pointer relative"
            >
               <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-500 flex items-center justify-center text-xl shadow-sm">
                  🎧
               </div>
               <div>
                  <div className="font-bold text-slate-800 dark:text-white text-lg">Passive</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Audio Loop</div>
               </div>
               {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>
        </div>

        {/* Progress Section */}
        <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">My Progress</h2>
            
            {user ? (
                <div className="grid grid-cols-2 gap-4">
                   <Card onClick={() => navigate('stats')} className="flex flex-col gap-2 cursor-pointer">
                      <div className="text-3xl mb-1">🔥</div>
                      <div className="font-bold dark:text-white text-xl">{user.streak || 0} Days</div>
                      <div className="text-xs text-slate-500">Current Streak</div>
                   </Card>
                   <Card onClick={() => navigate('review_dashboard')} className="flex flex-col gap-2 cursor-pointer">
                      <div className="text-3xl mb-1">🧠</div>
                      <div className="font-bold dark:text-white text-xl">85%</div>
                      <div className="text-xs text-slate-500">Retention Rate</div>
                   </Card>
                </div>
            ) : (
                <div className="bg-slate-900 rounded-[2rem] p-6 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <h3 className="text-xl font-bold mb-2 relative z-10">Sync Your Progress</h3>
                    <p className="text-slate-400 text-sm mb-6 relative z-10">Login to save your streaks, vocabulary lists, and mastery levels across devices.</p>
                    <Button onClick={() => navigate('login')} className="bg-white text-slate-900 shadow-none border-none hover:bg-slate-100 relative z-10">
                        Login Now
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
