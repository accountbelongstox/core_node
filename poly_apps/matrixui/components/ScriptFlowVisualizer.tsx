
import React from 'react';
import { ScriptDef, ScriptStep } from '../types';
import { useI18n } from '../services/i18n';

interface ScriptFlowVisualizerProps {
  script: ScriptDef;
}

export const ScriptFlowVisualizer: React.FC<ScriptFlowVisualizerProps> = ({ script }) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center py-6 px-4 relative">
      {/* Central Line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gradient-to-b from-[#00f2ff]/0 via-[#00f2ff]/30 to-[#00f2ff]/0 -translate-x-1/2 z-0"></div>

      {/* Start Node */}
      <div className="mb-8 z-10 flex flex-col items-center animate-[scan_0.5s_ease-out]">
        <div className="px-4 py-1.5 rounded-full bg-[#05ffa1]/10 border border-[#05ffa1]/50 text-[#05ffa1] text-[10px] font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(5,255,161,0.2)]">
          {t('script_flow.start')}
        </div>
      </div>

      {/* Steps */}
      <div className="w-full flex flex-col gap-8 z-10">
        {script.steps.map((step, index) => (
          <StepNode key={step.id} step={step} index={index} total={script.steps.length} />
        ))}
      </div>

      {/* End Node */}
      <div className="mt-8 z-10 flex flex-col items-center animate-[scan_0.5s_ease-out_0.5s_both]">
         <div className="w-3 h-3 rounded-full bg-[#ff2a6d] shadow-[0_0_15px_#ff2a6d]"></div>
         <span className="text-[9px] text-slate-500 mt-2 font-mono uppercase tracking-widest">{t('script_flow.complete')}</span>
      </div>
    </div>
  );
};

const StepNode: React.FC<{ step: ScriptStep; index: number; total: number }> = ({ step, index }) => {
  const { t } = useI18n();
  const getIcon = (type: string) => {
    switch (type) {
      case 'open_app': return 'ph-app-window';
      case 'swipe': return 'ph-hand-arrow-up'; // hand-swipe-up doesn't exist in Phosphor, use hand-arrow-up
      case 'click': return 'ph-cursor-click';
      case 'input': return 'ph-keyboard';
      case 'delay': return 'ph-hourglass';
      case 'check': return 'ph-git-branch';
      case 'loop': return 'ph-arrows-clockwise';
      default: return 'ph-circle';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'open_app': return 'border-[#00f2ff]/50 text-[#00f2ff] bg-[#00f2ff]/10';
      case 'check': return 'border-[#bd00ff]/50 text-[#bd00ff] bg-[#bd00ff]/10';
      case 'delay': return 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10';
      default: return 'border-white/20 text-slate-300 bg-black/40';
    }
  };

  return (
    <div 
      className="relative flex items-center w-full group"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Node Connector (Dot) */}
      <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#0a0c10] border border-slate-600 z-20 group-hover:border-[#00f2ff] group-hover:scale-125 transition-all"></div>

      {/* Card Content - Alternating Sides */}
      <div className={`flex-1 flex ${index % 2 === 0 ? 'justify-end pr-8' : 'justify-start pl-8 order-2'}`}>
        <div 
          className={`
            relative p-3 rounded-lg border backdrop-blur-md w-full max-w-[200px] transition-all duration-300 hover:scale-105 hover:shadow-lg
            ${getColor(step.type)}
          `}
        >
          {/* Connection Line to Center */}
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-r from-transparent to-slate-600/50 
              ${index % 2 === 0 ? '-right-8' : '-left-8'}
            `}
          ></div>

          <div className="flex items-start gap-3">
             <div className="p-1.5 rounded-md bg-black/30 border border-white/5 shrink-0">
               <i className={`ph-fill ${getIcon(step.type)} text-lg`}></i>
             </div>
             <div>
                <div className="text-xs font-bold leading-tight mb-0.5">{step.label}</div>
                <div className="text-[9px] opacity-70 leading-relaxed line-clamp-2">{step.description}</div>
                {step.duration && (
                  <div className="mt-1.5 flex items-center gap-1 text-[8px] font-mono opacity-50 bg-black/20 px-1.5 py-0.5 rounded w-fit">
                     <i className="ph-bold ph-clock"></i> {step.duration}s
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
      
      {/* Empty Space for alignment */}
      <div className="flex-1"></div>
    </div>
  );
};
