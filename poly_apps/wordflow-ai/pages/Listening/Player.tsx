
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';

const ListeningPlayerPage = () => {
  const { navigate } = useContext(AppContext);
  const [playing, setPlaying] = useState(false);
  
  return (
    <div className="h-full flex flex-col p-6 pt-safe pb-safe relative">
       {/* Glass Background */}
       <div className="absolute inset-0 bg-gradient-to-b from-indigo-100/50 to-blue-50/50 dark:from-indigo-900/40 dark:to-slate-900/80 backdrop-blur-xl -z-10"></div>

       {/* Header */}
       <div className="flex justify-between items-center mb-8">
          <button onClick={() => navigate('home')} className="p-2"><Icons.Back /></button>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">Passive Mode</span>
          <button className="p-2"><Icons.Settings /></button>
       </div>

       {/* Cover Art */}
       <div className="flex-1 flex flex-col items-center justify-center">
           <div className="w-64 h-64 rounded-[2rem] bg-gradient-to-tr from-blue-400 to-indigo-600 shadow-2xl shadow-indigo-500/30 flex items-center justify-center text-6xl text-white mb-10 animate-pulse-slow">
              🎧
           </div>
           
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Business English</h2>
           <p className="text-slate-500">Looping • 50 words</p>
       </div>

       {/* Progress */}
       <div className="mb-10">
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
             <div className="bg-blue-600 h-full w-1/3"></div>
          </div>
          <div className="flex justify-between text-xs text-slate-400 font-bold">
             <span>04:12</span>
             <span>12:45</span>
          </div>
       </div>

       {/* Controls */}
       <div className="flex items-center justify-between px-4 pb-8">
           <button className="text-slate-400 hover:text-blue-500"><span className="text-2xl">↺</span></button>
           <button className="text-slate-600 dark:text-white hover:scale-110 transition-transform"><Icons.Rewind /></button>
           
           <button 
             onClick={() => setPlaying(!playing)}
             className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-500/40 hover:scale-105 transition-all"
           >
              {playing ? <Icons.Pause /> : <Icons.Play />}
           </button>
           
           <button className="text-slate-600 dark:text-white hover:scale-110 transition-transform"><Icons.ChevronRight /></button>
           <button className="text-slate-400 hover:text-blue-500 font-bold text-xs">1.0x</button>
       </div>
    </div>
  );
};

export default ListeningPlayerPage;
