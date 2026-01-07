
import React from 'react';
import { useAppContext } from '../App';
import { Icons } from '../constants';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'info' | 'warning' | 'success';
}

const AnnouncementCenter: React.FC = () => {
  const { t } = useAppContext();
  
  // Example announcement data
  const announcements: Announcement[] = [
    {
      id: '1',
      title: t.announcementV3Title,
      content: t.announcementV3Content,
      date: '2024-12-20',
      type: 'success'
    },
    {
      id: '2',
      title: t.announcementDeepSeekTitle,
      content: t.announcementDeepSeekContent,
      date: '2024-12-18',
      type: 'info'
    }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20 text-green-500';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500';
      default: return 'bg-blue-500/10 border-blue-500/20 text-blue-500';
    }
  };

  return (
    <div className="glass p-8 rounded-[3rem] border-white/5 shadow-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500">
          <Icons.Activity />
        </div>
        <h3 className="text-2xl font-black italic tracking-tight">{t.announcementCenter}</h3>
      </div>
      
      {announcements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t.noAnnouncements}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {announcements.map(announcement => (
            <div 
              key={announcement.id} 
              className={`p-6 rounded-[2rem] border ${getTypeColor(announcement.type)} transition-all hover:scale-[1.02] cursor-pointer`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <h4 className="text-lg font-black italic tracking-tight flex-1">{announcement.title}</h4>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                  {announcement.date}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {announcement.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementCenter;

