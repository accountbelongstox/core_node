
import React from 'react';
import { useAppContext } from '../App';
import PricingSection from '../components/PricingSection';

const SubscribeCenterPage = () => {
  const { t } = useAppContext();
  
  return (
    <div className="min-h-screen p-6 sm:p-12 md:p-24">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black mb-6 tracking-tighter italic">{t.subscribeTitle}</h1>
          <p className="dark:text-slate-400 text-slate-500 text-xl font-medium">{t.subscribeDescription}</p>
        </div>
        <PricingSection />
      </div>
    </div>
  );
};

export default SubscribeCenterPage;

