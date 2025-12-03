import React from 'react';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { Navigation, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store';

const History: React.FC = () => {
    const { friends } = useStore();
    const activeFriend = friends[0]; 

  return (
    <MobileLayout showNav={false}>
      <Header title="History Track" backTo="/friends" />
      
      {/* Friend Banner Header */}
      <div style={{ position: 'relative', marginBottom: 60 }}>
          <div style={{ height: 120, background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', opacity: 0.9 }}></div>
          <div style={{ position: 'absolute', bottom: -40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
             <img src={activeFriend.avatar} style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', background: 'white' }} />
          </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* Stats */}
        <div className="text-center mb-4">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{activeFriend.name}</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '4px 12px', borderRadius: 20, marginTop: 8 }}>
                <Navigation size={14} color="#3b82f6" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>15.9 KM Today</span>
            </div>
        </div>

        {/* Timeline Sheet */}
        <div className="timeline-sheet" style={{ flex: 1, background: '#f8fafc', margin: 0, paddingTop: 40 }}>
           
           <div className="timeline-centered">
               {/* Vertical Line */}
               <div className="timeline-line-center" />

               {/* Date Marker */}
               <div className="timeline-date-marker">Today, Oct 24</div>

               {/* Timeline Items */}
               {[
                { time: '18:30', place: 'Home Sweet Home', dur: 'Arrived', align: 'left' },
                { time: '17:15', place: 'City Gym Center', dur: '1h 15m', align: 'right' },
                { time: '14:30', place: 'Starbucks Coffee', dur: '45m', align: 'left' },
                { time: '09:00', place: 'Tech Office Park', dur: '8h 00m', align: 'right' },
              ].map((item, idx) => (
                  <div key={idx} className="timeline-item">
                      <div className={clsx("timeline-content", item.align === 'left' ? 'left' : 'right', item.align === 'right' && 'invisible')} style={{ visibility: item.align === 'left' ? 'visible' : 'hidden' }}>
                          <div style={{ fontWeight: 700 }}>{item.place}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.dur}</div>
                          <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, marginTop: 4 }}>{item.time}</div>
                      </div>
                      
                      <div className="timeline-dot" />

                      <div className={clsx("timeline-content", item.align === 'right' ? 'right' : 'left')} style={{ visibility: item.align === 'right' ? 'visible' : 'hidden' }}>
                          <div style={{ fontWeight: 700 }}>{item.place}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.dur}</div>
                          <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, marginTop: 4 }}>{item.time}</div>
                      </div>
                  </div>
              ))}
               
               {/* Older Records */}
               <div className="timeline-date-marker">Yesterday, Oct 23</div>
               
               <div className="timeline-item">
                    <div className="timeline-content left">
                          <div style={{ fontWeight: 700 }}>Central Park</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>2h 30m</div>
                          <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, marginTop: 4 }}>16:00</div>
                    </div>
                    <div className="timeline-dot" style={{ background: '#cbd5e1' }} />
                    <div className="timeline-content right" style={{ visibility: 'hidden' }}></div>
               </div>

           </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default History;