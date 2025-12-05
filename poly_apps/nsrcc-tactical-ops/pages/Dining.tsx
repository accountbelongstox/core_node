
import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Dining: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen pb-24 p-4 flex flex-col items-center justify-center text-center">
      <div className="bg-slate-800 p-6 rounded-full mb-6 border border-slate-700 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <UtensilsCrossed className="w-12 h-12 text-slate-500" />
      </div>
      <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-300">{t.dining.title}</h2>
      <p className="text-slate-500 font-mono text-xs mt-2 max-w-xs">
        {t.dining.desc}
      </p>
    </div>
  );
};

export default Dining;
