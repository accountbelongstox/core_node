import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';
import { api } from '../../services/api';
import { WordGroup } from '../../types';

const CoursesPage = () => {
  const { navigate, t, user, activeGroupId } = useContext(AppContext);
  const [groups, setGroups] = useState<WordGroup[]>([]);

  useEffect(() => {
    api.getWordGroups().then(setGroups);
  }, []);

  return (
    <div className="page-container animate-slide-up">
      {/* Header handled by global header wrapper in Header.tsx logic or manually here if needed */}
      <div className="flex justify-between items-center px-6 mb-6">
        <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Library</h1>
        <button onClick={() => navigate('dictionary')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"><Icons.Search /></button>
      </div>

      <div className="page-content-scroll">
         <div 
             onClick={() => navigate('upload')}
             className="border border-dashed border-white/20 rounded-3xl p-4 flex items-center justify-center gap-3 text-blue-400 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 mb-6"
           >
              <Icons.Cloud />
              <span className="font-bold text-sm">Import Document / PDF</span>
         </div>

         <div className="library-grid">
             {groups.map((g, i) => {
               const isActive = g.id === activeGroupId;
               return (
                 <div 
                    key={g.id} 
                    className={`course-card-premium cursor-pointer ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => navigate('course_detail', { groupId: g.id })}
                    style={{ animationDelay: `${i * 100}ms` }}
                 >
                   <div className="course-cover-art">
                        {g.coverImage}
                   </div>
                   <div className="course-info">
                       <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">{g.type}</span>
                       <h3 className="font-bold text-xl text-white leading-tight mb-2">{g.name}</h3>
                       <div className="mt-auto w-full">
                           <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                               <span>{g.count} Words</span>
                               <span>{g.progress}%</span>
                           </div>
                           <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                               <div className="h-full bg-blue-500" style={{ width: `${g.progress}%` }}></div>
                           </div>
                       </div>
                   </div>
                 </div>
               );
             })}
         </div>
      </div>
    </div>
  );
};

export default CoursesPage;