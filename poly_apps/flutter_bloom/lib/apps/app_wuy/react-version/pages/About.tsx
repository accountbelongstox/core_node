import React from 'react';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import { ShieldCheck, ChevronRight } from 'lucide-react';

const About: React.FC = () => {
  const { t } = useStore();
  
  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.about')} backTo="/me" />
      
      <div className="px-6 py-10 flex flex-col items-center">
        <div className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6">
          <ShieldCheck size={48} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{t('app.name')}</h1>
        <p className="text-slate-400 text-sm mb-10">Version 1.0.2 (Build 2024)</p>
        
        <GlassCard className="w-full p-0">
           {['Feature Introduction', 'Privacy Policy', 'Terms of Service', 'Check Updates'].map((item) => (
             <div key={item} className="flex items-center justify-between p-4 border-b border-black/5 last:border-0 active:bg-black/5">
                <span className="text-sm font-medium">{item}</span>
                <ChevronRight size={16} className="text-slate-300" />
             </div>
           ))}
        </GlassCard>

        <div className="mt-auto pt-10 text-center">
          <p className="text-[10px] text-slate-400">
            Copyright © 2024 SafeGuardian Inc.<br/>All Rights Reserved.
          </p>
        </div>
      </div>
    </MobileLayout>
  );
};

export default About;