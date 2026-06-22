/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, BackButton, IconButton, ProgressBar } from '../../components/UI';
import { Headphones, Repeat } from 'lucide-react';

const ListeningPlayerPage = () => {
  const { navigate } = useContext(AppContext);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="ds-page h-full flex flex-col p-6 pt-safe pb-32 relative">
       {/* Header */}
       <div className="flex justify-between items-center mb-8 gap-3">
          <BackButton onClick={() => navigate('home')} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-secondary)]">Passive Mode</span>
          <IconButton icon={<Icons.Settings />} label="Settings" disabled />
       </div>

       {/* Cover Art */}
       <div className="flex-1 flex flex-col items-center justify-center">
           <div
             className="w-64 h-64 max-w-[80vw] aspect-square rounded-[var(--radius-card)] flex items-center justify-center text-[var(--klein-on)] mb-10 animate-pulse-slow"
             style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
           >
              <Headphones className="w-24 h-24" />
           </div>

           <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Business English</h2>
           <p className="text-[var(--color-text-secondary)]">Looping • 50 words</p>
       </div>

       {/* Progress */}
       <div className="mb-10">
          <ProgressBar value={33} className="mb-2" />
          <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] font-bold">
             <span>04:12</span>
             <span>12:45</span>
          </div>
       </div>

       {/* Controls */}
       <div className="flex items-center justify-between px-4 pb-8">
           <button aria-label="Loop" className="ds-touch-target flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--klein-blue)] transition-colors"><Repeat className="w-6 h-6" /></button>
           <button className="ds-touch-target flex items-center justify-center text-[var(--color-text-primary)] hover:scale-110 transition-transform"><Icons.Rewind /></button>

           <button
             onClick={() => setPlaying(!playing)}
             className="w-20 h-20 text-[var(--klein-on)] rounded-full flex items-center justify-center hover:scale-105 transition-all active:scale-95"
             style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
           >
              {playing ? <Icons.Pause /> : <Icons.Play />}
           </button>

           <button className="ds-touch-target flex items-center justify-center text-[var(--color-text-primary)] hover:scale-110 transition-transform"><Icons.ChevronRight /></button>
           <button className="ds-touch-target flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--klein-blue)] font-bold text-xs transition-colors">1.0x</button>
       </div>
    </div>
  );
};

export default ListeningPlayerPage;
