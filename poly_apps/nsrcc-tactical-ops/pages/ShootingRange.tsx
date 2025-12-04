import React, { useState } from 'react';
import { Target, AlertTriangle, Crosshair, ChevronRight, Skull } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const ShootingRange: React.FC = () => {
  const navigate = useNavigate();
  const [selectedWeapon, setSelectedWeapon] = useState('pistol');
  const { t } = useLanguage();

  return (
    <div className="min-h-screen pb-24 bg-mil-base text-mil-base transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-tac-red/30 p-4 sticky top-16 z-30 flex items-center justify-between shadow-sm">
          <h1 className="font-bold text-lg uppercase tracking-widest flex items-center gap-2 text-tac-red">
              <Target className="w-5 h-5" />
              {t.shooting.title}
          </h1>
          <button onClick={() => navigate(-1)} className="text-xs text-slate-500 hover:text-tac-red font-mono">{t.shooting.return}</button>
      </div>

      <div className="p-4 space-y-6">
          {/* Visual Carousel Placeholder */}
          <div className="w-full h-56 bg-black relative clip-corner overflow-hidden border border-slate-200 dark:border-slate-800">
              <img src="https://picsum.photos/800/400?grayscale&contrast=1.2" className="w-full h-full object-cover opacity-60" alt="Range" />
              {/* Scanline overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none"></div>
              
              <div className="absolute bottom-0 left-0 p-4 bg-gradient-to-t from-black to-transparent w-full">
                  <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-tac-red rounded-full animate-pulse"></span>
                      <span className="text-tac-red font-mono text-[10px] tracking-widest uppercase">{t.shooting.status_active}</span>
                  </div>
                  <h2 className="text-white font-black text-2xl uppercase italic">{t.shooting.range_name}</h2>
              </div>
          </div>

          {/* Safety Warning */}
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 flex gap-3 items-start relative overflow-hidden rounded-sm">
              <div className="absolute -right-4 -top-4 text-red-500/10 dark:text-red-900/20"><Skull className="w-16 h-16" /></div>
              <AlertTriangle className="w-6 h-6 text-tac-red shrink-0 mt-0.5 animate-pulse" />
              <div className="relative z-10">
                  <h4 className="text-tac-red font-bold text-xs uppercase tracking-[0.2em] mb-1">{t.shooting.warning}</h4>
                  <p className="text-[10px] text-red-800 dark:text-red-200/70 leading-relaxed font-mono">
                      {t.shooting.warning_text}
                  </p>
              </div>
          </div>

          {/* Booking Config */}
          <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                 <h3 className="text-sm font-bold text-mil-base uppercase tracking-wider">{t.shooting.loadout}</h3>
                 <span className="text-[10px] font-mono text-slate-500">STEP 1/3</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setSelectedWeapon('pistol')}
                    className={`p-4 border rounded-sm flex flex-col items-center justify-center gap-3 transition-all relative overflow-hidden group ${selectedWeapon === 'pistol' ? 'bg-red-50 dark:bg-tac-red/10 border-tac-red text-tac-red' : 'bg-white dark:bg-mil-light border-slate-200 dark:border-slate-700 text-slate-500'}`}
                  >
                      <Crosshair className="w-8 h-8" />
                      <span className="text-xs font-bold tracking-widest">{t.shooting.sidearm}</span>
                      {selectedWeapon === 'pistol' && <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-tac-red"></div>}
                  </button>
                  <button 
                    onClick={() => setSelectedWeapon('rifle')}
                    className={`p-4 border rounded-sm flex flex-col items-center justify-center gap-3 transition-all relative overflow-hidden group ${selectedWeapon === 'rifle' ? 'bg-red-50 dark:bg-tac-red/10 border-tac-red text-tac-red' : 'bg-white dark:bg-mil-light border-slate-200 dark:border-slate-700 text-slate-500'}`}
                  >
                      <Target className="w-8 h-8" />
                      <span className="text-xs font-bold tracking-widest">{t.shooting.rifle}</span>
                      {selectedWeapon === 'rifle' && <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-tac-red"></div>}
                  </button>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">{t.shooting.time}</label>
                  <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-mil-base text-sm p-3 rounded-sm outline-none focus:border-tac-red appearance-none font-mono">
                      <option>0900 - 1000 HRS</option>
                      <option>1000 - 1100 HRS</option>
                      <option>1400 - 1500 HRS</option>
                  </select>
              </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">{t.shooting.ammo}</label>
                  <div className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-3 rounded-sm flex justify-between items-center group hover:border-tac-red transition-colors">
                      <div>
                          <div className="text-sm font-bold text-mil-base uppercase">{t.shooting.basic}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.shooting.rounds}</div>
                      </div>
                      <div className="text-tac-red font-mono font-bold text-lg">$45</div>
                  </div>
              </div>
          </div>

          <button className="w-full bg-tac-red hover:bg-red-600 text-white font-bold py-4 uppercase tracking-[0.2em] clip-corner flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              {t.shooting.book_btn} <ChevronRight className="w-4 h-4" />
          </button>
      </div>
    </div>
  );
};

export default ShootingRange;