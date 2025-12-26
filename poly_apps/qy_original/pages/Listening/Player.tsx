import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

const ListeningPlayerPage = () => {
  const { navigate } = useContext(AppContext);
  const [playing, setPlaying] = useState(true);
  
  return (
    <div className="passive-player-layout animate-fade-in">
       {/* Background Ambience */}
       <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-transparent -z-10"></div>

       {/* Top Controls */}
       <div className="w-full flex justify-between items-center z-10">
          <button onClick={() => navigate('home')} className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white"><Icons.Back /></button>
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-blue-300">Neural Sync</span>
          <button className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white"><Icons.Settings /></button>
       </div>

       {/* Main Visual */}
       <div className="flex-1 flex flex-col items-center justify-center z-10 w-full">
           <div className="passive-visualizer mb-12">
              <div className={`text-6xl text-white transition-all duration-500 ${playing ? 'scale-100 opacity-100' : 'scale-90 opacity-50'}`}>
                  {playing ? 'ılı' : '⏵'}
              </div>
           </div>
           
           <div className="text-center space-y-2 max-w-xs">
               <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Business English</h2>
               <p className="text-blue-300 font-mono text-xs uppercase tracking-wider">Chapter 4 • Marketing Terms</p>
           </div>
       </div>

       {/* Bottom Controls */}
       <div className="w-full glass-control-bar bg-white/5 border border-white/10 rounded-[2.5rem] p-6 backdrop-blur-xl z-10">
           {/* Progress */}
           <div className="w-full h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
               <div className="h-full bg-blue-500 w-1/3 shadow-[0_0_15px_var(--accent-blue)]"></div>
           </div>
           
           <div className="flex items-center justify-between px-4">
               <button className="text-white/40 hover:text-white transition-colors"><Icons.Rewind /></button>
               
               <button 
                  onClick={() => setPlaying(!playing)}
                  className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
               >
                   {playing ? <Icons.Pause /> : <Icons.Play />}
               </button>
               
               <button className="text-white/40 hover:text-white transition-colors"><Icons.ChevronRight /></button>
           </div>
       </div>
    </div>
  );
};

export default ListeningPlayerPage;
