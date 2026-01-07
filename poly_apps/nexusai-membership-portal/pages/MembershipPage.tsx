
import React from 'react';
import { useAppContext } from '../App';
import PricingSection from '../components/PricingSection';

const MembershipPage = () => {
  const { t } = useAppContext();
  
  return (
    <div className="animate-in fade-in duration-1000">
      <div className="max-w-4xl mx-auto text-center mb-28">
        <h1 className="text-8xl font-black mb-8 tracking-tighter italic">{t.choosePower}</h1>
        <p className="dark:text-slate-400 text-slate-500 text-3xl font-medium leading-relaxed">{t.scaleOps}</p>
      </div>
      <PricingSection />
    </div>
  );
};

export default MembershipPage;

