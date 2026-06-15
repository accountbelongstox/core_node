/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, BackButton, Badge, SectionTitle, EmptyState, Icons } from '../../components/UI';
import { BookOpen } from 'lucide-react';
import { WordGroup } from '../../types';
import { WordGroupsCenter } from '../../services/WordGroupsCenter';

const ReadingSetupPage = () => {
  const { navigate, user, t } = useContext(AppContext);
  const [groups, setGroups] = useState<WordGroup[]>([]);

  // Subscribe to WordGroupsCenter for automatic updates
  useEffect(() => {
    const unsubscribe = WordGroupsCenter.subscribe((g) =>
      setGroups(Array.isArray(g) ? g : [])
    );
    WordGroupsCenter.fetchAll();
    return unsubscribe;
  }, []);

  const safeGroups = Array.isArray(groups) ? groups : [];

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 animate-slide-up pb-32">
       {/* Minimal asymmetric top bar */}
       <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate('home')} />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">{t('reading.library')}</h1>
       </div>

       {/* Hero */}
       <SectionTitle
          title="Select Material"
          subtitle="Choose a portal to begin your journey into the world of words."
          className="px-1"
       />

       {/* Grid Layout */}
       {safeGroups.length > 0 ? (
         <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-2 overflow-y-auto no-scrollbar">
           {safeGroups.map((g) => (
             <div
               key={g.id}
               onClick={() => navigate('reading_run', { groupId: g.id })}
               className="group relative cursor-pointer min-w-0"
             >
               <Card className="h-full flex flex-col items-start !p-6 transition-colors hover:border-[var(--klein-ring)]">
                 <div className="flex justify-between w-full items-start mb-6 gap-3">
                   <div className="w-14 h-14 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] shadow-inner border border-white/40 group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                      {g.coverImage && /^https?:\/\//.test(g.coverImage) ? (
                        <img src={g.coverImage} alt="" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <BookOpen className="w-7 h-7" />
                      )}
                   </div>
                   <Badge tone="klein">{g.progress}%</Badge>
                 </div>

                 <div className="mt-auto w-full min-w-0">
                   <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--klein-blue)] transition-colors leading-tight truncate">
                      {g.name}
                   </h3>
                   <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium border-t border-[var(--border-highlight)] pt-4 mt-2 gap-2">
                     <div className="flex items-center gap-2 min-w-0">
                         <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--klein-blue)' }}></span>
                         <span className="uppercase tracking-wider truncate">{g.type}</span>
                     </div>
                     <span className="font-mono opacity-70 flex-shrink-0">{g.count} words</span>
                   </div>
                 </div>

                 {/* Progress Bar Background */}
                 <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-highlight)] rounded-b-[var(--radius-card)] overflow-hidden">
                    <div className="h-full" style={{ width: `${g.progress}%`, background: 'var(--klein-blue)', boxShadow: 'var(--klein-glow)' }}></div>
                 </div>
               </Card>
             </div>
           ))}
         </div>
       ) : (
         <EmptyState
            icon={<Icons.Book />}
            title={t('reading.library')}
            description="Choose a portal to begin your journey into the world of words."
         />
       )}
    </div>
  );
};

export default ReadingSetupPage;