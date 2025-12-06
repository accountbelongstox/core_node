import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';

export const SettingsLayout = ({ title, children }: any) => {
  const { navigate } = useContext(AppContext);
  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up">
      {/* Glass Header */}
      <div className="px-5 py-5 flex items-center gap-5 sticky top-0 z-20">
        <button 
          onClick={() => navigate('settings')} 
          className="w-12 h-12 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-sm active:scale-95 transition-transform hover:bg-white/80"
        >
          <Icons.Back />
        </button>
        <h1 className="text-3xl font-bold dark:text-white text-slate-800 tracking-tight">{title}</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar space-y-4">
        {children}
      </div>
    </div>
  );
};

export const SettingItem = ({ label, value, onClick, type = 'arrow', active = false }: any) => (
  <div 
    onClick={onClick} 
    className={`
      flex justify-between items-center p-5 rounded-2xl cursor-pointer transition-all duration-300
      holo-card hover:bg-white/70 dark:hover:bg-slate-800/70 hover:scale-[1.01] hover:shadow-lg
      active:scale-[0.98]
    `}
  >
    <span className="font-semibold text-slate-700 dark:text-slate-200 text-lg tracking-tight">{label}</span>
    
    <div className="flex items-center gap-3">
      {value && <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{value}</span>}
      
      {type === 'arrow' && <div className="text-slate-400"><Icons.ChevronRight /></div>}
      
      {type === 'toggle' && (
        <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-out shadow-inner ${active ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
          <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${active ? 'translate-x-6' : 'translate-x-0'}`} />
        </div>
      )}
      
      {type === 'radio' && (
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
          <div className={`w-3 h-3 bg-blue-500 rounded-full transition-all duration-300 ${active ? 'scale-100' : 'scale-0'}`} />
        </div>
      )}
    </div>
  </div>
);