
import React from 'react';
import { Crosshair, Calendar, Users, Clock, Wind, Flag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Golf: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen pb-24 bg-mil-base transition-colors duration-300">
      {/* Hero Section - Green Theme */}
      <div className="relative h-64 w-full clip-corner-top">
        <img 
          src="https://picsum.photos/800/600?image=10" 
          alt="Golf Course" 
          className="w-full h-full object-cover filter contrast-125 sepia-[.3]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-mil-base via-mil-base/50 to-transparent mix-blend-multiply transition-colors duration-300"></div>
        <div className="absolute bottom-4 left-4">
          <div className="flex items-center gap-2 mb-1">
             <Flag className="w-4 h-4 text-tac-green" />
             <span className="text-xs font-mono text-tac-green bg-white/90 dark:bg-green-900/50 px-2 py-0.5">{t.golf.sector}</span>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white drop-shadow-lg leading-none">
            {t.golf.golf_title}
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Course Status */}
        <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-between shadow-sm dark:shadow-none">
                <span className="text-[10px] text-slate-500 font-mono uppercase">{t.golf.wind}</span>
                <div className="flex items-center gap-1 text-tac-green font-bold text-xs">
                    <Wind className="w-3 h-3" /> {t.golf.stats_wind}
                </div>
            </div>
             <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-between shadow-sm dark:shadow-none">
                <span className="text-[10px] text-slate-500 font-mono uppercase">{t.golf.green}</span>
                <span className="text-tac-green font-bold text-xs">{t.golf.stats_stimp}</span>
            </div>
        </div>

        {/* Mission Briefing */}
        <div className="space-y-2 border-l-2 border-tac-green pl-3">
            <h2 className="text-sm font-bold text-tac-green uppercase tracking-wider">{t.golf.briefing}</h2>
            <p className="text-sm text-mil-muted leading-relaxed font-mono text-[11px]">
                {t.golf.briefing_text}
            </p>
        </div>

        {/* Booking Module */}
        <div className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-1 rounded-sm shadow-xl dark:shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5 dark:opacity-10 pointer-events-none">
                <Crosshair className="w-24 h-24 text-tac-green" />
            </div>
            
            <div className="p-4 relative z-10 space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <Crosshair className="w-5 h-5 text-tac-green animate-spin-slow" />
                    <h3 className="font-bold tracking-widest text-sm text-mil-base">{t.golf.params}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-500 uppercase">{t.golf.date}</label>
                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 p-2 rounded-sm text-sm group focus-within:border-tac-green transition-colors">
                            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                            <input type="date" className="bg-transparent text-slate-900 dark:text-white w-full outline-none text-xs" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-500 uppercase">{t.golf.time}</label>
                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 p-2 rounded-sm text-sm group focus-within:border-tac-green transition-colors">
                            <Clock className="w-4 h-4 mr-2 text-slate-400" />
                            <select className="bg-transparent text-slate-900 dark:text-white w-full outline-none text-xs appearance-none">
                                <option>0700 HRS</option>
                                <option>0800 HRS</option>
                                <option>0900 HRS</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">{t.golf.squad}</label>
                    <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 p-2 rounded-sm text-sm justify-between">
                        <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-slate-400" />
                            <span className="text-xs text-slate-900 dark:text-white">{t.golf.pax_info}</span>
                        </div>
                        <span className="text-[10px] text-tac-green font-bold bg-green-500/10 dark:bg-green-900/20 px-1 border border-green-500/30 dark:border-green-900">{t.golf.avail}</span>
                    </div>
                </div>

                <button className="w-full bg-tac-green hover:bg-emerald-600 text-white dark:text-black font-bold py-3 uppercase tracking-widest clip-hex active:scale-[0.98] transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)] mt-2">
                    {t.golf.book_btn}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Golf;