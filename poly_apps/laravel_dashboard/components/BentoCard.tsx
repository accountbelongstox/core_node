import React from 'react';
import { NOISE_TEXTURE_BG_CLASS } from '../utils/noiseTexture';

interface BentoCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  headerControls?: React.ReactNode;
  glowing?: boolean;
  /** When true, body gets standard console padding (p-4 sm:p-5). */
  padded?: boolean;
  bodyClassName?: string;
}

const BentoCard: React.FC<BentoCardProps> = ({
  children,
  title,
  className = '',
  headerControls,
  glowing = false,
  padded = false,
  bodyClassName = '',
}) => {
  return (
    <div className={`
      relative overflow-hidden
      bg-white/50 dark:bg-white/[0.03]
      backdrop-blur-xl
      border border-slate-200/70 dark:border-white/10
      rounded-2xl
      shadow-sm
      flex flex-col
      transition-all duration-300
      ${glowing ? 'dark:shadow-[0_0_20px_rgba(56,189,248,0.15)] dark:border-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.1)] border-sky-500/20' : 'hover:border-slate-300/80 dark:hover:border-white/15 hover:shadow-md'}
      ${className}
    `}>
      {/* Subtle Gradient Noise Texture Overlay */}
      <div className={`absolute inset-0 opacity-5 pointer-events-none ${NOISE_TEXTURE_BG_CLASS} brightness-100 contrast-150 mix-blend-overlay`}></div>
      
      {(title || headerControls) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.03] relative z-10">
          {title && (
            <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400 uppercase">
              {title}
            </h3>
          )}
          {headerControls && (
            <div className="flex items-center gap-2">
              {headerControls}
            </div>
          )}
        </div>
      )}
      <div className={`relative z-10 flex-1 min-h-0 overflow-auto scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10 scrollbar-track-transparent ${padded ? 'p-4 sm:p-5' : ''} ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default BentoCard;