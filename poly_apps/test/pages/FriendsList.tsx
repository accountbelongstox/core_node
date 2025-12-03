import React from 'react';
import { MobileLayout, Header, GlassCard, Input } from '../components/Shared';
import { useStore } from '../store';
import { Search, MapPin, Clock, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const FriendsList: React.FC = () => {
  const { friends, toggleMonitor, t } = useStore();

  return (
    <MobileLayout>
      <Header 
        title={t('tab.friends')} 
        action={
          <Link to="/friends/add" className="text-blue-600">
            <Plus size={24} />
          </Link>
        } 
      />
      
      <div className="px-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <Input placeholder={t('friend.search')} className="pl-10" />
          <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
        </div>

        {/* List */}
        <div className="space-y-3">
          {friends.map(friend => (
            <GlassCard key={friend.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                 <Link to={`/friends/${friend.id}`} className="flex-1 flex items-center gap-4">
                    <img src={friend.avatar} className="w-12 h-12 rounded-full bg-slate-200" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{friend.name}</h3>
                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full font-bold">
                          {friend.relation}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={10} /> {friend.lastActive}
                      </div>
                    </div>
                 </Link>
                 
                 <div className="flex flex-col items-end gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">{t('friend.monitor')}</label>
                    <div 
                      onClick={() => toggleMonitor(friend.id)}
                      className={`
                        w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300
                        ${friend.isMonitored ? 'bg-blue-500' : 'bg-slate-300'}
                      `}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${friend.isMonitored ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                 </div>
              </div>
              
              <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1 max-w-[200px] truncate">
                   <MapPin size={12} /> {friend.location.address}
                </div>
                <Link to={`/friends/${friend.id}`} className="text-blue-500 flex items-center font-medium">
                  Details <ChevronRight size={12} />
                </Link>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
};

export default FriendsList;