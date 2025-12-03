import React, { useState } from 'react';
import { MobileLayout, Header, GlassCard, Input } from '../components/Shared';
import { useStore } from '../store';
import { Search, MapPin, Clock, Plus, ChevronRight, Filter, MessageSquare, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

const FriendsList: React.FC = () => {
  const { friends, toggleMonitor, t } = useStore();
  const [showFilter, setShowFilter] = useState(false);
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <Header 
        title={`${t('tab.friends')} (${friends.length})`} 
        action={
          <div className="flex-row gap-3">
             <button onClick={() => setShowFilter(!showFilter)} style={{ color: 'var(--primary-color)' }}>
               <Filter size={20} />
             </button>
             <Link to="/friends/add" style={{ color: 'var(--primary-color)' }}>
                <Plus size={24} />
             </Link>
          </div>
        } 
      />
      
      {/* Filter Dropdown */}
      <div className={clsx("filter-dropdown", showFilter ? "open" : "closed")} style={{ padding: showFilter ? '0 20px 16px 20px' : '0 20px' }}>
         <GlassCard style={{ padding: 12 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>FILTER BY STATUS</div>
            <div className="flex-row gap-2 flex-wrap">
               {['All', 'Online', 'Monitored', 'Alerts'].map(f => (
                 <button key={f} style={{ padding: '6px 12px', background: f === 'All' ? 'var(--primary-color)' : '#f1f5f9', color: f === 'All' ? 'white' : '#64748b', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                    {f}
                 </button>
               ))}
            </div>
         </GlassCard>
      </div>

      <div className="px-5" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Input placeholder={t('friend.search')} style={{ paddingLeft: 40 }} />
          <Search size={18} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {friends.map(friend => (
            <GlassCard key={friend.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="flex-row items-start gap-3">
                 {/* Avatar Left */}
                 <Link to={`/friends/${friend.id}`}>
                   <img src={friend.avatar} className="friend-avatar" alt={friend.name} />
                 </Link>
                 
                 {/* Middle Content */}
                 <div className="friend-item-content">
                    <div className="flex-row justify-between items-center">
                        <Link to={`/friends/${friend.id}`} style={{ textDecoration: 'none' }}>
                            <div className="flex-row items-center gap-2">
                                <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{friend.name}</h3>
                                <span style={{ fontSize: '10px', padding: '2px 8px', background: '#f3e8ff', color: '#9333ea', borderRadius: 99, fontWeight: 700 }}>
                                {friend.relation}
                                </span>
                            </div>
                        </Link>
                         {/* Monitor Toggle Right */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <label style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8' }}>{t('friend.monitor')}</label>
                            <div 
                                onClick={() => toggleMonitor(friend.id)}
                                className={clsx("monitor-toggle", friend.isMonitored ? "active" : "inactive")}
                            >
                                <div className="toggle-thumb" />
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {friend.lastActive}
                    </div>

                    {/* Chat Preview Area */}
                    <div className="chat-preview-container" onClick={() => navigate(`/chat/${friend.id}`)}>
                        <div className="flex-row items-center gap-2">
                           <MessageSquare size={12} color="#94a3b8" />
                           <span className="chat-preview-text">
                              {friend.chat?.lastMessage || 'No recent messages'}
                           </span>
                        </div>
                        {friend.chat?.unreadCount ? (
                            <span className="unread-badge">{friend.chat.unreadCount}</span>
                        ) : (
                            <ChevronRight size={14} color="#cbd5e1" />
                        )}
                    </div>
                 </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
};

export default FriendsList;