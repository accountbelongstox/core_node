
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
    <div className="p-4 pt-12 h-full flex flex-col animate-slide-up">
       <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('home')} className="p-1"><Icons.Back /></button>
          <h2 className="text-2xl font-bold dark:text-white">Select Material</h2>
       </div>
       
       <div className="grid gap-4 overflow-y-auto flex-1 pb-24 no-scrollbar">
         {groups.map(g => (
           <Card key={g.id} onClick={() => navigate('reading_run', { groupId: g.id })} className="flex items-center gap-4 cursor-pointer hover:bg-white/40 dark:hover:bg-slate-700/40">
             <div className="text-3xl w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl">{g.coverImage || '📘'}</div>
             <div className="flex-1">
               <div className="font-bold text-lg dark:text-white">{g.name}</div>
               <div className="text-sm text-slate-500">{g.count} words • {g.type.toUpperCase()}</div>
               <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500" style={{ width: `${g.progress}%` }}></div>
               </div>
             </div>
             <div className="text-xs font-bold text-blue-500">{g.progress}%</div>
           </Card>
         ))}
       </div>
    </div>
  );
};

export default ReadingSetupPage;
