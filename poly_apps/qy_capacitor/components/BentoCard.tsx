import React from 'react';

interface BentoCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  headerControls?: React.ReactNode;
  glowing?: boolean;
  colSpan?: 1 | 2;
}

const BentoCard: React.FC<BentoCardProps> = ({ 
  children, 
  title, 
  className = '', 
  headerControls, 
  glowing = false,
  colSpan = 1 
}) => {
  return (
    <div className={`
      relative overflow-hidden
      bg-white/40 dark:bg-slate-800/40 
      backdrop-blur-xl
      border border-black/5 dark:border-white/10
      rounded-2xl
      shadow-xl
      flex flex-col
      transition-all duration-300
      ${glowing ? 'dark:shadow-[0_0_20px_rgba(56,189,248,0.15)] dark:border-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.1)] border-sky-500/20' : 'hover:border-black/10 dark:hover:border-white/20'}
      ${colSpan === 2 ? 'col-span-2' : ''}
      ${className}
    `}>
      {/* Subtle Gradient Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150 mix-blend-overlay"></div>
      
      {(title || headerControls) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/5 relative z-10">
          {title && (
            <h3 className="text-sm font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400 uppercase">
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
      <div className="relative z-10 flex-1 min-h-0 overflow-auto scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
        {children}
      </div>
    </div>
  );
};

export default BentoCard;

