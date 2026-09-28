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
      
      <div className="px-5 space-y-4 pb-10">
        
        {/* Map Preview */}
        <Link to="/history" className="block">
          <GlassCard className="p-0 h-40 relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-100 flex items-center justify-center">
              <span className="text-blue-300 font-bold text-4xl opacity-20">MAP VIEW</span>
            </div>
             <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/60 backdrop-blur-md flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                   <MapPin size={12} className="text-blue-500" />
                   {friend.location.address}
                </div>
                <div className="text-[10px] text-slate-500">Updated: 1 min ago</div>
             </div>
          </GlassCard>
        </Link>

        {/* Health Stats */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="flex flex-col items-center justify-center p-3 gap-2">
            <Footprints className="text-orange-400" size={24} />
            <div className="font-bold text-lg text-slate-700">{friend.health?.steps}</div>
            <div className="text-[10px] text-slate-400 uppercase">Steps</div>
          </GlassCard>
          <GlassCard className="flex flex-col items-center justify-center p-3 gap-2">
            <Heart className="text-red-400" size={24} />
            <div className="font-bold text-lg text-slate-700">{friend.health?.heartRate} <span className="text-xs">bpm</span></div>
            <div className="text-[10px] text-slate-400 uppercase">Heart</div>
          </GlassCard>
          <GlassCard className="flex flex-col items-center justify-center p-3 gap-2">
            <Thermometer className="text-blue-400" size={24} />
            <div className="font-bold text-lg text-slate-700">{friend.health?.temp}°C</div>
            <div className="text-[10px] text-slate-400 uppercase">Temp</div>
          </GlassCard>
        </div>

        {/* Device Report */}
        <GlassCard>
          <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">{t('stats.device')}</h3>
          <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Wifi size={18} /></div>
                   <span className="font-medium">Network</span>
                </div>
                <span className="font-bold text-slate-600">{friend.device?.network}</span>
             </div>
             <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Smartphone size={18} /></div>
                   <span className="font-medium">Unlocks</span>
                </div>
                <span className="font-bold text-slate-600">{friend.device?.unlocks} times</span>
             </div>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Clock size={18} /></div>
                   <span className="font-medium">Screen Time</span>
                </div>
                <span className="font-bold text-slate-600">{friend.device?.usageTime}</span>
             </div>
          </div>
        </GlassCard>

        {/* Places */}
        <GlassCard>
          <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">{t('stats.places')}</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
             {[1,2,3].map(i => (
               <div key={i} className="min-w-[100px] h-[80px] bg-white/50 rounded-xl border border-white/40 flex flex-col items-center justify-center p-2 text-center">
                  <MapPin size={16} className="text-blue-500 mb-1" />
                  <div className="text-xs font-bold leading-tight">Central Park</div>
                  <div className="text-[10px] text-slate-400 mt-1">2h 30m</div>
               </div>
             ))}
          </div>
        </GlassCard>

      </div>
    </MobileLayout>
  );
};

export default FriendDetail;