
import React from 'react';
import { PLANS, Icons } from '../constants';
import { Plan } from '../types';
import { useAppContext } from '../App';

const PricingCard: React.FC<{ plan: Plan }> = ({ plan }) => {
  const { t } = useAppContext();
  
  // Get translated plan name and description
  const getPlanName = () => {
    if (plan.id === 'Free') return t.planFreeName;
    if (plan.id === 'Pro') return t.planProName;
    if (plan.id === 'Ultimate') return t.planUltimateName;
    return plan.name;
  };
  
  const getPlanDescription = () => {
    if (plan.id === 'Free') return t.planFreeDescription;
    if (plan.id === 'Pro') return t.planProDescription;
    if (plan.id === 'Ultimate') return t.planUltimateDescription;
    return plan.description;
  };
  
  const getPlanPeriod = () => {
    if (plan.id === 'Free') return t.planFreePeriod;
    if (plan.id === 'Pro') return t.planProPeriod;
    if (plan.id === 'Ultimate') return t.planUltimatePeriod;
    return plan.period;
  };
  
  // Feature translation mapping
  const getFeatureName = (featureName: string) => {
    const featureMap: Record<string, string> = {
      '50,000 monthly tokens': t.feature50kTokens,
      'Standard generation speed': t.featureStandardSpeed,
      'Basic models (Gemini Flash)': t.featureBasicModels,
      'Custom API access': t.featureCustomApi,
      'Priority support': t.featurePrioritySupport,
      '5,000,000 monthly tokens': t.feature5mTokens,
      'Turbo generation speed': t.featureTurboSpeed,
      'Advanced models (Claude/Gemini Pro)': t.featureAdvancedModels,
      'Unlimited API endpoints': t.featureUnlimitedApi,
      'Unlimited tokens': t.featureUnlimitedTokens,
      'Dedicated compute nodes': t.featureDedicatedNodes,
      'Ultra-low latency': t.featureUltraLowLatency,
      'Full governance & SSO': t.featureGovernanceSso,
      '24/7 Concierge support': t.featureConciergeSupport,
    };
    return featureMap[featureName] || featureName;
  };
  
  return (
    <div className={`relative flex flex-col p-10 rounded-[3rem] h-full transition-all duration-500 hover:-translate-y-4 ${
      plan.isPopular 
        ? 'glass border-blue-500/50 ring-4 ring-blue-600/10 shadow-[0_30px_60px_-15px_rgba(59,130,246,0.3)]' 
        : 'glass dark:border-white/5 border-slate-200 shadow-xl'
    }`}>
      {plan.isPopular && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-[0.3em] shadow-lg">
          {t.optimalRoute}
        </div>
      )}
      
      <div className="mb-10">
        <h3 className="text-2xl font-black mb-3 italic tracking-tight">{getPlanName()}</h3>
        <p className="dark:text-slate-500 text-slate-400 text-sm font-medium leading-relaxed">{getPlanDescription()}</p>
      </div>

      <div className="mb-12">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black tracking-tighter italic">{plan.price}</span>
          <span className="dark:text-slate-500 text-slate-400 text-xs font-bold uppercase tracking-widest">{getPlanPeriod()}</span>
        </div>
      </div>

      <ul className="space-y-5 mb-12 flex-grow">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-4 text-sm font-semibold">
            <span className={feature.included ? 'text-blue-500 mt-0.5' : 'text-slate-600 mt-0.5'}>
              {feature.included ? <Icons.Check /> : <Icons.X />}
            </span>
            <span className={feature.included ? 'dark:text-slate-300 text-slate-700' : 'text-slate-500'}>
              {getFeatureName(feature.name)}
            </span>
          </li>
        ))}
      </ul>

      <button className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${
        plan.isPopular 
          ? 'bg-blue-600 text-white hover:bg-blue-700 glow-button shadow-xl shadow-blue-500/20' 
          : 'dark:bg-white/5 bg-slate-900/5 dark:text-white text-slate-900 hover:bg-slate-900/10 dark:hover:bg-white/10'
      }`}>
        {plan.id === 'Free' ? t.currentDeployment : `${t.switchTo} ${getPlanName()}`}
      </button>
    </div>
  );
};

const PricingSection: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
      {PLANS.map(plan => (
        <PricingCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
};

export default PricingSection;
