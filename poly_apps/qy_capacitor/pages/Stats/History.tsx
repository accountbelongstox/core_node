/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, BackButton, SectionTitle } from '../../components/UI';

const HistoryPage = () => {
  const { navigate } = useContext(AppContext);

  // Mock Calendar Data (last 30 days)
  const days = Array.from({length: 30}, (_, i) => ({
    date: i,
    intensity: Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0
  }));

  const getIntensityStyle = (i: number): React.CSSProperties => {
    switch(i) {
      case 1: return { background: 'color-mix(in srgb, var(--klein-blue) 25%, transparent)' };
      case 2: return { background: 'color-mix(in srgb, var(--klein-blue) 50%, transparent)' };
      case 3: return { background: 'color-mix(in srgb, var(--klein-blue) 75%, transparent)' };
      case 4: return { background: 'var(--klein-blue)' };
      default: return {};
    }
  };

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 animate-slide-up pb-24">
       <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate('stats')} />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Study History</h1>
       </div>

       <Card className="!p-6">
          <SectionTitle title="Consistency Heatmap" className="mb-4" />
          <div className="grid grid-cols-7 gap-2">
             {days.map((d, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-md ${d.intensity === 0 ? 'bg-[var(--border-highlight)]' : ''}`}
                  style={getIntensityStyle(d.intensity)}
                ></div>
             ))}
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-3 font-medium">
             <span>Less</span>
             <span>More</span>
          </div>
       </Card>

       <div>
       <SectionTitle title="Recent Sessions" className="mb-3 px-1" />
       <div className="ds-stack ds-stack-tight overflow-y-auto no-scrollbar">
          {[1,2,3,4,5].map(i => (
             <div key={i} className="ds-row flex justify-between items-center p-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                   <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-[var(--klein-blue)] flex-shrink-0" style={{ background: 'var(--klein-blue-soft)' }}>
                      {['RD','FC','QZ','LS','RD'][i-1]}
                   </div>
                   <div className="min-w-0">
                      <h4 className="font-bold text-[var(--color-text-primary)] truncate">
                         {['Reading Mode', 'Flashcards', 'Quiz', 'Listening', 'Reading Mode'][i-1]}
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)]">Today, 10:{30 + i} AM</p>
                   </div>
                </div>
                <div className="text-right flex-shrink-0">
                   <div className="font-bold text-emerald-500">+{10 * i} words</div>
                   <div className="text-xs text-[var(--color-text-tertiary)]">15 mins</div>
                </div>
             </div>
          ))}
       </div>
       </div>
    </div>
  );
};

export default HistoryPage;
