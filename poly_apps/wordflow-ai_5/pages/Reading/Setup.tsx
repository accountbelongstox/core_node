import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Button, Icons } from '../../components/UI';
import { api } from '../../services/api';
import { WordGroup } from '../../types';

const ReadingSetupPage = () => {
  const { navigate } = useContext(AppContext);
  const [groups, setGroups] = useState<WordGroup[]>([]);

  useEffect(() => {
    api.getWordGroups().then(setGroups);
  }, []);

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up-fade relative">
       {/* Floating Island Header */}
       <div className="fixed top-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl dark:shadow-blue-900/20 pointer-events-auto transition-colors duration-500">
              <button 
                onClick={() => navigate('home')} 
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center text-slate-600 dark:text-white/80 transition-colors"
              >
                <Icons.Back />
              </button>
              <h2 className="text-lg font-serif font-bold text-slate-800 dark:text-white tracking-wide">Library</h2>
              <div className="w-10"></div> {/* Spacer for balance */}
          </div>
       </div>
       
       {/* Hero / Decorative Top */}
       <div className="px-6 pt-32 pb-8 text-center">
          <h1 className="text-5xl font-serif text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-white dark:to-white/40 mb-3 tracking-tight">
             Select Material
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-base font-light font-sans max-w-xs mx-auto leading-relaxed">
             Choose a portal to begin your journey into the world of words.
          </p>
       </div>

       {/* Grid Layout */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-6 pb-32 overflow-y-auto no-scrollbar">
         {groups.map((g, i) => (
           <div 
             key={g.id} 
             onClick={() => navigate('reading_run', { groupId: g.id })}
             className="group relative cursor-pointer transform hover:-translate-y-1 transition-transform duration-300"
             style={{ animationDelay: `${i * 100}ms` }}
           >
             <Card className="h-full flex flex-col items-start !p-6 border border-white/40 dark:border-white/5 hover:border-blue-400/50 dark:hover:border-blue-400/30 transition-colors bg-white/60 dark:bg-slate-800/40">
               <div className="flex justify-between w-full items-start mb-6">
                 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-white/10 dark:to-transparent border border-white/40 dark:border-white/10 flex items-center justify-center text-4xl shadow-sm group-hover:scale-110 transition-transform duration-500">
                    {g.coverImage || '📘'}
                 </div>
                 <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-blue-300 uppercase tracking-widest">
                    {g.progress}% Complete
                 </div>
               </div>
               
               <div className="mt-auto w-full">
                 <h3 className="font-serif text-2xl font-bold text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors leading-tight">
                    {g.name}
                 </h3>
                 <div className="flex items-center justify-between text-xs text-slate-500 font-medium border-t border-slate-200 dark:border-white/5 pt-4 mt-2">
                   <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                       <span className="uppercase tracking-wider">{g.type}</span>
                   </div>
                   <span className="font-mono opacity-70">{g.count} words</span>
                 </div>
               </div>

               {/* Progress Bar Background */}
               <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-white/5">
                  <div className="h-full bg-blue-500/80 dark:bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${g.progress}%` }}></div>
               </div>
             </Card>
           </div>
         ))}
       </div>
    </div>
  );
};

export default ReadingSetupPage;