import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Library, GraduationCap, AudioLines, Settings } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import type { WordNewTab } from '../routing/WordNewHashRoutes';
const SOFT_EDGE_MASK = 'radial-gradient(closest-side, #000 35%, transparent 100%)';

const DOCK_KEYFRAMES =
  '@keyframes wfnewDockRing{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.25);opacity:.7}}' +
  '@keyframes wfnewDockGlow{0%,100%{transform:scale(.95);opacity:.4}50%{transform:scale(1.1);opacity:.85}}' +
  '@keyframes wfnewDockIcon{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(8deg) scale(1.08)}75%{transform:rotate(-8deg) scale(1.08)}}';

interface WfNewBottomDockProps {
  activeTab: WordNewTab;
  setActiveTab: (tab: WordNewTab) => void;
  trans: (key: string) => string;
  activeTheme: ElementTheme;
  dark?: boolean;
}

export const WfNewBottomDock: React.FC<WfNewBottomDockProps> = ({
  activeTab,
  setActiveTab,
  trans,
  activeTheme,
  dark = true
}) => {
  // 5 discrete tab definitions with explicit high-contrast active text colors so icons remain highly visible
  const tabs = [
    { id: 'home', icon: <Cpu className="w-5 h-5" />, label: trans('nav.home'), color: 'from-blue-500 to-indigo-500', activeTextColor: 'text-blue-500 dark:text-blue-400', pulseColor: 'rgba(59,130,246,0.35)' },
    { id: 'shelf', icon: <Library className="w-5 h-5" />, label: trans('nav.library'), color: 'from-emerald-500 to-teal-500', activeTextColor: 'text-emerald-500 dark:text-emerald-400', pulseColor: 'rgba(16,185,129,0.35)' },
    { id: 'practice', icon: <GraduationCap className="w-6 h-6 text-white" />, label: trans('nav.practice'), color: 'from-fuchsia-500 via-rose-500 to-pink-500', activeTextColor: 'text-white', pulseColor: 'rgba(236,72,153,0.45)', isCenter: true },
    { id: 'orch-audio', icon: <AudioLines className="w-5 h-5" />, label: trans('orchAudio.title'), color: 'from-cyan-500 to-sky-500', activeTextColor: 'text-cyan-500 dark:text-cyan-400', pulseColor: 'rgba(6,182,212,0.35)' },
    { id: 'settings', icon: <Settings className="w-5 h-5" />, label: trans('nav.settings'), color: 'from-indigo-500 to-violet-600', activeTextColor: 'text-indigo-500 dark:text-indigo-450', pulseColor: 'rgba(99,102,241,0.35)' }
  ] as const;

  // Render a secondary bar that guides users back to active suites if we are deep in a tool
  const isDeepTab = ['walkman', 'subtitles', 'stats', 'bilingual', 'labs', 'social', 'profile', 'auth', 'admin'].includes(activeTab);

  return (
    <div className="hide-on-soft-keyboard wf-safe-bottom fixed left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl pointer-events-none flex flex-col items-center gap-2">
      {/* If current mode is walkman, subtitles, or stats, offer a quick home return portal */}
      {isDeepTab && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveTab('home')}
          className="pointer-events-auto px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-mono font-bold bg-white/10 hover:bg-white/20 dark:bg-black/40 dark:hover:bg-black/60 text-zinc-300 border border-white/5 cursor-pointer flex items-center gap-1.5 transition-all shadow-md backdrop-blur-md"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{trans('dock.returnHome')}</span>
        </motion.button>
      )}

      {/* Main Breathing Backing bar */}
      <div className="relative w-full pointer-events-auto">
        <div
          aria-hidden
          className={`absolute inset-0 rounded-[32px] border backdrop-blur-2xl transition-all duration-500 ${
            dark ? 'bg-slate-950/85 border-white/10 shadow-2xl' : 'bg-white border-zinc-200/80 shadow-xl'
          }`}
        />
        <div className={`relative isolate px-3 py-2 flex justify-between items-center ${dark ? 'text-zinc-100' : 'text-slate-800'}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id || (tab.id === 'home' && isDeepTab);
          
          if ('isCenter' in tab && tab.isCenter) {
            // Render the elevated glorious central Recital Sphere Button
            return (
              <div key={tab.id} className="relative flex flex-col items-center justify-center -top-3.5 px-2">
                {/* Outer Breathing Ring for the Circle */}
                <style>{DOCK_KEYFRAMES}</style>
                <div
                  style={{ animation: 'wfnewDockRing 2.5s ease-in-out 4', willChange: 'transform, opacity', WebkitMaskImage: SOFT_EDGE_MASK, maskImage: SOFT_EDGE_MASK }}
                  className={`absolute w-15 h-15 rounded-full bg-gradient-to-tr ${tab.color} scale-110 -z-10`}
                />
                
                {/* Main circle button */}
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-tr ${tab.color} shadow-[0_4px_20px_rgba(236,72,153,0.4)] cursor-pointer hover:scale-108 active:scale-95 transition-all duration-300 relative group z-10 border-2 ${
                    isActive ? 'border-white' : 'border-white/40'
                  }`}
                  title={tab.label}
                >
                  <div style={isActive ? { animation: 'wfnewDockIcon 3s ease-in-out 4', willChange: 'transform' } : undefined}>
                    {tab.icon}
                  </div>
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 relative py-3 flex flex-col items-center justify-center rounded-2xl transition-all duration-300 group cursor-pointer"
              title={tab.label}
            >
              {/* Highlight background blob with active theme-specific colored pulse backing */}
              {isActive && (
                <motion.div
                  layoutId="activeDockIndicatorNew"
                  className="absolute inset-x-1.5 inset-y-1 rounded-xl border border-slate-900/10 dark:border-white/10 overflow-hidden"
                  transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                >
                  <div className={`w-full h-full bg-gradient-to-r ${tab.color} opacity-15`} />
                </motion.div>
              )}

              {/* Dynamic Breathing Underglow Glow filter on Focus */}
              {isActive && (
                <div
                  style={{ animation: 'wfnewDockGlow 3s ease-in-out 4', willChange: 'transform, opacity', WebkitMaskImage: SOFT_EDGE_MASK, maskImage: SOFT_EDGE_MASK }}
                  className={`absolute -bottom-1 w-6 h-1 rounded-full bg-gradient-to-r ${tab.color}`}
                />
              )}

              {/* Icon component with color morphing on active state */}
              <div className={`relative z-10 p-1 rounded-full transition-all duration-300 ${
                isActive 
                  ? `${tab.activeTextColor} scale-115 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]` 
                  : `${dark ? 'text-zinc-500 hover:text-zinc-200' : 'text-slate-400 hover:text-slate-800'} hover:scale-110`
              }`}>
                {tab.icon}
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
};
