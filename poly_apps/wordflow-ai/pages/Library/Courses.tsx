
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { api } from '../../services/api';
import { WordGroup } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';

const CoursesPage = () => {
  const { navigate, t, user, activeGroupId } = useContext(AppContext);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    api.getWordGroups().then(setGroups);
    if (user?.learningLanguages && user.learningLanguages.length > 0) {
        setActiveTab(user.learningLanguages[0]);
    }
  }, [user]);

  const filteredGroups = groups.filter(g => {
    if (activeTab === 'all') return true;
    // Show 'user' or 'document' types in all tabs or specific logic? 
    // Assuming documents might have a language tag, or default to show in all.
    // Here we strictly filter by language code matching the tab.
    if (g.type === 'document') return activeTab === 'en'; // Hack for demo documents defaulting to EN
    return g.language === activeTab;
  });

  // Get tab objects from user preferences
  const tabs = user?.learningLanguages?.map(code => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
      return { code, name: lang?.name || code, flag: lang?.flag };
  }) || [];

  // [i18n] Replaced hardcoded 'All' with t()
  // Add 'All' tab if user has multiple languages
  if (tabs.length > 1) tabs.unshift({ code: 'all', name: t('library.all'), flag: '🌍' });

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">{t('library')}</h1>
        <button onClick={() => navigate('dictionary')} className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl backdrop-blur-md shadow-sm border border-white/40">
           <span className="text-lg">🔍</span>
        </button>
      </div>

      {/* Language Tabs */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 pb-2">
         {tabs.map((tab) => (
           <button 
             key={tab.code}
             onClick={() => setActiveTab(tab.code)}
             className={`
               flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 shrink-0 border
               ${activeTab === tab.code 
                 ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30' 
                 : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 border-white/40 hover:bg-white/80'}
             `}
           >
             <span>{tab.flag}</span>
             <span>{tab.name}</span>
           </button>
         ))}
         
         <button onClick={() => navigate('settings_lang')} className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xl shrink-0 border border-transparent hover:bg-slate-200">
             +
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 space-y-4">
         {/* Upload Card */}
         <div
             onClick={() => navigate('upload')}
             className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-[2rem] p-6 flex flex-col items-center justify-center text-blue-500 bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer hover:bg-blue-50 transition-colors"
           >
              <div className="mb-2"><Icons.Book /></div>
              {/* [i18n] Replaced hardcoded "Import Document / PDF" with t() */}
              <span className="font-bold">{t('library.importDocument')}</span>
         </div>

         {filteredGroups.length === 0 && (
             <div className="text-center text-slate-400 py-10">
                 {/* [i18n] Replaced hardcoded "No books found..." with t() */}
                 {t('library.noBooksFound')}
             </div>
         )}

         {filteredGroups.map(g => {
           const isActive = g.id === activeGroupId;
           return (
             <Card key={g.id} className={`flex gap-4 group transition-all cursor-pointer ${isActive ? 'ring-2 ring-blue-500/30' : 'hover:scale-[1.02]'}`} onClick={() => navigate('course_detail', { groupId: g.id })}>
               <div className="w-24 h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center text-5xl shadow-inner shrink-0 relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/20"></div>
                 <span className="relative z-10">{g.coverImage}</span>
               </div>

               <div className="flex flex-col py-1 flex-1">
                 <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg dark:text-white leading-tight line-clamp-2">{g.name}</h3>
                    {isActive && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs shadow-md">✓</div>}
                 </div>

                 {/* [i18n] Replaced hardcoded "No description available." with t() */}
                 <p className="text-xs text-slate-500 mt-2 line-clamp-2">{g.description || t('library.noDescription')}</p>

                 <div className="mt-auto">
                     <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                         {/* [i18n] Replaced hardcoded "words" with t() */}
                         <span>{g.count} {t('library.words')}</span>
                         <span>{g.progress}%</span>
                     </div>
                     <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${g.progress}%` }}></div>
                     </div>
                 </div>
               </div>
             </Card>
           );
         })}
      </div>
    </div>
  );
};

export default CoursesPage;
