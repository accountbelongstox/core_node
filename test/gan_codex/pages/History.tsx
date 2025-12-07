import React from 'react';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { MapPin, Navigation } from 'lucide-react';

const History: React.FC = () => {
  return (
    <MobileLayout showNav={false}>
      <Header title="History Track" backTo="/friends" />
      
      <div className="flex-1 relative flex flex-col">
        {/* Map Background Placeholder */}
        <div className="h-[250px] bg-slate-200 w-full relative">
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold">MAP ROUTE VISUALIZATION</div>
            
            <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              Today, Oct 24
            </div>
        </div>

        {/* Timeline Sheet */}
        <div className="flex-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-t-3xl -mt-6 relative z-10 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
           <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-6 opacity-50" />
           
           <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Distance</div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white">15.9 <span className="text-sm font-medium text-slate-500">KM</span></div>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Navigation size={20} />
              </div>
           </div>

           <div className="relative border-l-2 border-blue-200 ml-3 space-y-8">
              {[
                { time: '18:30', place: 'Home Sweet Home', dur: 'Arrived', active: true },
                { time: '17:15', place: 'City Gym Center', dur: '1h 15m', active: false },
                { time: '09:00', place: 'Tech Office Park', dur: '8h 00m', active: false },
                { time: '08:30', place: 'Starbucks Coffee', dur: '15m', active: false },
              ].map((item, idx) => (
                <div key={idx} className="relative pl-6">
                   <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${item.active ? 'bg-blue-500' : 'bg-slate-300'}`} />
                   <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-700 dark:text-slate-200">{item.place}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item.dur}</div>
                      </div>
                      <div className="text-xs font-mono font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {item.time}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default History;