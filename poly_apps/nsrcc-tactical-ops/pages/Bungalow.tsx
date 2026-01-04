
import React from 'react';
import { Home, CalendarCheck, Info, CheckCircle2, Wifi, Waves } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Bungalow: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen pb-24 bg-mil-base transition-colors duration-300">
      {/* Header - Blue Theme */}
      <div className="relative h-48 border-b border-cyan-500/30 dark:border-cyan-900/50">
         <img src="https://picsum.photos/800/600?image=15" className="w-full h-full object-cover opacity-50" alt="Bungalow" />
         <div className="absolute inset-0 bg-gradient-to-r from-mil-base to-transparent transition-colors duration-300"></div>
         <div className="absolute bottom-4 left-4">
            <h1 className="text-3xl font-black uppercase tracking-widest text-mil-base dark:text-white">{t.bungalow.title} <span className="text-tac-cyan">{t.bungalow.subtitle}</span></h1>
            <p className="text-[10px] text-tac-cyan font-mono border px-1 inline-block border-tac-cyan">{t.bungalow.label}</p>
         </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Room Type Selector - Card Style */}
        <div className="space-y-4">
             {/* Card 1 */}
            <div className="relative group cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-tac-cyan transition-colors overflow-hidden rounded-sm shadow-sm dark:shadow-none">
                <div className="h-40 w-full relative">
                    <img src="https://picsum.photos/800/400?random=10" className="w-full h-full object-cover" alt="Bungalow" />
                    <div className="absolute top-2 right-2 flex gap-1">
                        <span className="bg-black/70 backdrop-blur-md text-white p-1 rounded-sm"><Wifi className="w-3 h-3" /></span>
                        <span className="bg-black/70 backdrop-blur-md text-white p-1 rounded-sm"><Waves className="w-3 h-3" /></span>
                    </div>
                </div>
                <div className="p-3">
                     <div className="flex justify-between items-start">
                        <div>
                             <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.bungalow.room_name}</h3>
                             <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mb-2">{t.bungalow.room_detail}</p>
                        </div>
                        <div className="text-right">
                             <span className="block text-lg font-bold text-tac-cyan">{t.bungalow.price}</span>
                             <span className="text-[9px] text-slate-500 uppercase">{t.bungalow.per_night}</span>
                        </div>
                     </div>
                </div>
            </div>
        </div>

         {/* Booking Form */}
         <div className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-4 rounded-sm shadow-lg relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-tac-cyan/10 rounded-full blur-xl"></div>
            
            <h3 className="text-sm font-bold text-tac-cyan uppercase mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <CalendarCheck className="w-4 h-4" /> Secure Quarters
            </h3>
            
            <div className="space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-mono text-slate-500 uppercase">{t.bungalow.checkin}</label>
                        <input type="date" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 p-2 text-sm text-slate-900 dark:text-white rounded-sm focus:border-tac-cyan outline-none transition-colors" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-mono text-slate-500 uppercase">{t.bungalow.checkout}</label>
                        <input type="date" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 p-2 text-sm text-slate-900 dark:text-white rounded-sm focus:border-tac-cyan outline-none transition-colors" />
                    </div>
                </div>

                <div className="space-y-2 pt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-tac-cyan" />
                        <span>{t.bungalow.bbq}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-tac-cyan" />
                        <span>{t.bungalow.wifi}</span>
                    </div>
                </div>

                <button className="w-full bg-tac-cyan hover:bg-cyan-600 text-white dark:text-black font-bold py-3 uppercase tracking-widest clip-corner active:scale-[0.98] transition-all mt-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    {t.bungalow.book_btn}
                </button>
            </div>
         </div>
         
         <div className="flex items-start gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-900/30 rounded-sm">
            <Info className="w-4 h-4 text-tac-cyan flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-cyan-800 dark:text-cyan-200/70 leading-relaxed font-mono">
                {t.bungalow.info}
            </p>
         </div>
      </div>
    </div>
  );
};

export default Bungalow;