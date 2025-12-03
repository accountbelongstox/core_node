import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { Footprints, Heart, Thermometer, MapPin, Wifi, Smartphone, Clock } from 'lucide-react';

const FriendDetail: React.FC = () => {
  const { id } = useParams();
  const { friends, t } = useStore();
  const friend = friends.find(f => f.id === id);

  if (!friend) return <div>Not Found</div>;

  return (
    <MobileLayout showNav={false}>
      <Header title={friend.name} backTo="/friends" />
      
      <div className="px-5" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
        
        {/* Map Preview */}
        <Link to="/history" style={{ display: 'block' }}>
          <GlassCard style={{ padding: 0, height: 160, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: '2rem', opacity: 0.5 }}>MAP VIEW</span>
            </div>
             <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                   <MapPin size={12} color="#3b82f6" />
                   {friend.location.address}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Updated: 1 min ago</div>
             </div>
          </GlassCard>
        </Link>

        {/* Health Stats */}
        <div className="stats-grid">
          <GlassCard className="stat-card">
            <Footprints color="#fb923c" size={24} />
            <div className="stat-value">{friend.health?.steps}</div>
            <div className="stat-label">Steps</div>
          </GlassCard>
          <GlassCard className="stat-card">
            <Heart color="#f87171" size={24} />
            <div className="stat-value">{friend.health?.heartRate} <span style={{ fontSize: '0.75rem' }}>bpm</span></div>
            <div className="stat-label">Heart</div>
          </GlassCard>
          <GlassCard className="stat-card">
            <Thermometer color="#60a5fa" size={24} />
            <div className="stat-value">{friend.health?.temp}°C</div>
            <div className="stat-label">Temp</div>
          </GlassCard>
        </div>

        {/* Device Report */}
        <GlassCard>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16 }}>{t('stats.device')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div className="flex-row justify-between items-center" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 12 }}>
                <div className="flex-row items-center gap-3">
                   <div style={{ padding: 8, background: '#dbeafe', color: '#2563eb', borderRadius: 8 }}><Wifi size={18} /></div>
                   <span style={{ fontWeight: 500 }}>Network</span>
                </div>
                <span style={{ fontWeight: 700, color: '#475569' }}>{friend.device?.network}</span>
             </div>
             <div className="flex-row justify-between items-center" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 12 }}>
                <div className="flex-row items-center gap-3">
                   <div style={{ padding: 8, background: '#f3e8ff', color: '#9333ea', borderRadius: 8 }}><Smartphone size={18} /></div>
                   <span style={{ fontWeight: 500 }}>Unlocks</span>
                </div>
                <span style={{ fontWeight: 700, color: '#475569' }}>{friend.device?.unlocks} times</span>
             </div>
             <div className="flex-row justify-between items-center">
                <div className="flex-row items-center gap-3">
                   <div style={{ padding: 8, background: '#ffedd5', color: '#ea580c', borderRadius: 8 }}><Clock size={18} /></div>
                   <span style={{ fontWeight: 500 }}>Screen Time</span>
                </div>
                <span style={{ fontWeight: 700, color: '#475569' }}>{friend.device?.usageTime}</span>
             </div>
          </div>
        </GlassCard>

        {/* Places */}
        <GlassCard>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16 }}>{t('stats.places')}</h3>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
             {[1,2,3].map(i => (
               <div key={i} style={{ minWidth: 100, height: 80, background: 'rgba(255,255,255,0.5)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8 }}>
                  <MapPin size={16} color="#3b82f6" style={{ marginBottom: 4 }} />
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>Central Park</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 4 }}>2h 30m</div>
               </div>
             ))}
          </div>
        </GlassCard>

      </div>
    </MobileLayout>
  );
};

export default FriendDetail;