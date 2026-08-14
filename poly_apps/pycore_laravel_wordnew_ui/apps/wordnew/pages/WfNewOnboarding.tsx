import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Shield, Target, Paintbrush, Play, Layout, CheckCircle2 } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { CUSTOM_THEMES } from '../WfNewThemes';
import { WfNewLogo } from '../WfNewBrand';

interface WfNewOnboardingProps {
  onComplete: () => void;
  activeTheme: ElementTheme;
  onSelectTheme: (themeId: string) => void;
  onSetGoal: (goal: number) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewOnboarding: React.FC<WfNewOnboardingProps> = ({
  onComplete,
  activeTheme,
  onSelectTheme,
  onSetGoal,
  trans
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(20);
  const [selectedThemeId, setSelectedThemeId] = useState(activeTheme.id);

  const steps = [
    {
      title: trans('onb.s1Title'),
      description: trans('onb.s1Desc'),
      icon: <Layout className="w-12 h-12 text-indigo-400" />,
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
            <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">{trans('onb.activeSystems')}</h4>
            <ul className="text-xs space-y-1.5 text-zinc-400 font-mono">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{trans('onb.sys1')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{trans('onb.sys2')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>{trans('onb.sys3')}</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-zinc-500 italic">{trans('onb.s1Hint')}</p>
        </div>
      )
    },
    {
      title: trans('onb.s2Title'),
      description: trans('onb.s2Desc'),
      icon: <Target className="w-12 h-12 text-pink-400" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            {[10, 20, 50].map((num) => (
              <button
                key={num}
                onClick={() => {
                  setSelectedGoal(num);
                  onSetGoal(num);
                }}
                className={`py-3.5 px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  selectedGoal === num
                    ? 'bg-pink-500/10 border-pink-500/50 text-pink-400'
                    : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                <span className="block text-lg font-black">{num}</span>
                <span className="text-[9px] uppercase font-mono block mt-1">{trans('onb.wordsPerDay')}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 font-mono text-center">{trans('onb.targetPre')} <span className="text-pink-400 font-bold">{selectedGoal} {trans('profile.wordsUnit')}</span> {trans('onb.targetPost')}</p>
        </div>
      )
    },
    {
      title: trans('onb.s3Title'),
      description: trans('onb.s3Desc'),
      icon: <Paintbrush className="w-12 h-12 text-amber-400" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {CUSTOM_THEMES.map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    setSelectedThemeId(theme.id);
                    onSelectTheme(theme.id);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                      : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/8'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">{theme.nameZh}</span>
                    <span className="text-[9px] font-mono opacity-60 block">{theme.nameEn}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-zinc-500 font-mono text-center">{trans('onb.selectedAesthetic')} <span className="text-amber-400 font-bold">{CUSTOM_THEMES.find(t => t.id === selectedThemeId)?.nameZh}</span></p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const activeStepItem = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Heavy frosted glass backing */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg" />

      {/* Onboarding Dialog Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900/90 border border-white/10 p-6 md:p-8 rounded-[32px] shadow-2xl relative z-10 space-y-6"
      >
        {/* Step Indicator Bullets */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <WfNewLogo size={32} className="shadow-md" />
            <span className="text-xs font-mono font-bold tracking-widest text-zinc-400">{trans('onb.brand')}</span>
          </div>

          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === idx ? 'w-8 bg-indigo-500' : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Slide Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/5 rounded-2xl">
              {activeStepItem.icon}
            </div>
            <div>
              <h2 className="text-sm font-mono tracking-wider text-indigo-300 uppercase">{trans('onb.missionSeq')}</h2>
              <h3 className="text-lg font-black tracking-tight text-white">{activeStepItem.title}</h3>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-white/2 p-3.5 rounded-2xl border border-white/2">
            {activeStepItem.description}
          </p>

          <div className="pt-2">
            {activeStepItem.content}
          </div>
        </div>

        {/* Buttons / Navigation controls */}
        <div className="flex items-center justify-between border-t border-white/5 pt-5 gap-3">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-4 py-2 text-xs font-mono rounded-full font-bold transition-all ${
              currentStep === 0 
                ? 'opacity-30 cursor-not-allowed text-zinc-650' 
                : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10'
            }`}
          >
            {trans('onb.prev')}
          </button>

          <button
            onClick={handleNext}
            className="flex-1 py-3 px-5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:scale-102 active:scale-98 transition-all text-white font-mono text-xs font-black flex items-center justify-center gap-1.5 shadow-lg group cursor-pointer"
          >
            <span>{currentStep === steps.length - 1 ? trans('onb.launch') : trans('onb.next')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
