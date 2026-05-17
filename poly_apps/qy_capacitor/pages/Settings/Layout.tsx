
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

export const SettingsLayout = ({ title, children }: any) => {
  const { navigate } = useContext(AppContext);
  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-slate-950 animate-slide-up-fade relative">
      {/* Floating Island Header */}
      <div className="fixed top-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-full pl-2 pr-6 py-2 flex items-center gap-3 shadow-xl shadow-slate-200/50 dark:shadow-black/50 pointer-events-auto min-w-[220px]">
              <button 
                onClick={() => navigate('settings')} 
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent dark:border-white/5 flex items-center justify-center text-slate-700 dark:text-white transition-all active:scale-90"
              >
                <Icons.Back />
              </button>
              <h1 className="text-xs font-bold text-slate-700 dark:text-white tracking-[0.2em] uppercase flex-1 text-center">{title}</h1>
          </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-32 pb-32 space-y-4 w-full sm:max-w-lg sm:mx-auto">
        {children}
      </div>
    </div>
  );
};

export const SettingItem = ({ label, value, onClick, type = 'arrow', active = false }: any) => (
  <div 
    onClick={onClick} 
    className={`
      flex justify-between items-center p-5 rounded-[1.5rem] cursor-pointer transition-all duration-300
      bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 backdrop-blur-md
      hover:bg-white/80 dark:hover:bg-white/10 hover:scale-[1.01] active:scale-[0.99]
      shadow-sm dark:shadow-none
    `}
  >
    <span className="font-serif font-medium text-slate-700 dark:text-slate-200 text-lg tracking-wide group-hover:text-black dark:group-hover:text-white transition-colors">{label}</span>
    
    <div className="flex items-center gap-3">
      {value && <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{value}</span>}
      
      {type === 'arrow' && <div className="text-slate-400 dark:text-slate-600"><Icons.ChevronRight /></div>}
      
      {type === 'toggle' && (
        <div className={`w-12 h-7 rounded-full p-1 transition-all duration-500 ease-out shadow-inner ${active ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/10'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${active ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
      )}
      
      {type === 'radio' && (
        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 ${active ? 'border-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'border-slate-300 dark:border-slate-600'}`}>
          <div className={`w-3 h-3 bg-blue-500 rounded-full transition-all duration-300 ${active ? 'scale-100' : 'scale-0'}`} />
        </div>
      )}
    </div>
  </div>
);
