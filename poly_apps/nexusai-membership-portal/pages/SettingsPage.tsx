
import React from 'react';
import { useAppContext } from '../App';

const SettingsPage = () => {
  const { t, user } = useAppContext();
  return (
    <div className="animate-in fade-in duration-700">
      <h1 className="text-5xl font-black mb-16 tracking-tight italic">{t.settings}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-4">
          {[t.identitySyndicate, t.chainBilling, t.routingKeys, t.securityMatrix].map((tab, i) => (
            <button key={tab} className={`w-full text-left px-10 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all ${i === 0 ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/30' : 'hover:bg-slate-500/5 dark:text-slate-500 text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="lg:col-span-3 space-y-12">
          <div className="glass p-16 rounded-[4.5rem] border-white/5 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row items-center gap-14 mb-20 relative z-10">
              <div className="w-40 h-40 rounded-[3.5rem] overflow-hidden ring-[12px] ring-blue-500/10 relative group shadow-2xl">
                <img src="https://picsum.photos/id/1012/500/500" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md">
                  <span className="text-[11px] font-black text-white uppercase tracking-widest">{t.shiftAvatar}</span>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-5xl font-black mb-3 italic tracking-tighter">{user.name}</h2>
                <p className="dark:text-slate-500 text-slate-400 font-mono text-base mb-8">{user.email}</p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                  <span className="bg-blue-600/10 text-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-500/20 shadow-xl shadow-blue-500/5">{t.proSyndicate}</span>
                  <span className="bg-slate-500/10 dark:text-slate-400 text-slate-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border dark:border-white/5 border-slate-200">{t.matrixId}</span>
                </div>
              </div>
            </div>
            <div className="grid gap-10 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div className="space-y-5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">{t.chainSynchronizer}</label>
                  <div className="glass p-8 rounded-[2rem] border-white/5 font-black italic text-base shadow-inner bg-black/5 dark:bg-white/[0.02]">{t.timezone}</div>
                </div>
                <div className="space-y-5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">{t.chainInterfaceLang}</label>
                  <div className="glass p-8 rounded-[2rem] border-white/5 font-black italic text-base shadow-inner bg-black/5 dark:bg-white/[0.02]">{t.simplifiedChineseChain}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

