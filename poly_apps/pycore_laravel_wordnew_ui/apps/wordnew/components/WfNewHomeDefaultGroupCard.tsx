import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { BentoGroup } from '../api';
import type { ElementTheme } from '../WfNewThemes';

const BACKDROP_IMAGES: Record<string, string> = {
  'bento-cosmic-1': 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=60&w=800',
  'bento-silicon-2': 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=60&w=800',
  'bento-literary-3': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=60&w=800',
};
const DEFAULT_BACKDROP_IMAGE = BACKDROP_IMAGES['bento-literary-3'];
const WATERFALL_ROWS = 12;
const WATERFALL_WORDS = ['INDEXED', 'VOCAB', 'FLOW', 'SYNAPSE'];
const PROGRESS_ANIMATION_SECONDS = 1.5;
const PROGRESS_STAGGER_SECONDS = 0.1;

const DECOR_SVGS: Record<string, { colorClass: string; shapes: React.ReactNode }> = {
  nebula: {
    colorClass: 'text-indigo-500',
    shapes: (
      <>
        <circle cx="50" cy="50" r="30" strokeWidth="1" strokeDasharray="4 2" />
        <circle cx="50" cy="50" r="20" strokeWidth="2" strokeDasharray="8 8" className="animate-[spin_20s_linear_infinite]" />
        <path d="M10,50 L90,50 M50,10 L50,90" strokeWidth="0.5" strokeDasharray="1 3" />
      </>
    ),
  },
  matrix: {
    colorClass: 'text-emerald-500',
    shapes: (
      <>
        <path d="M20,10 V90 M40,20 V80 M60,10 V90 M80,20 V80" strokeWidth="1.5" strokeDasharray="5 15" className="animate-[pulse_2s_infinite]" />
        <circle cx="20" cy="40" r="3" fill="currentColor" />
        <circle cx="60" cy="70" r="3" fill="currentColor" />
      </>
    ),
  },
  stars: {
    colorClass: 'text-rose-500',
    shapes: (
      <>
        <polygon points="50,10 53,40 85,43 55,55 60,85 50,65 40,85 45,55 15,43 47,40" strokeWidth="1" className="animate-pulse" />
        <circle cx="15" cy="15" r="2" fill="currentColor" />
        <circle cx="85" cy="85" r="2" fill="currentColor" className="animate-ping" />
      </>
    ),
  },
  waves: {
    colorClass: 'text-sky-500',
    shapes: (
      <>
        <path d="M10,30 Q30,60 50,30 T90,30" strokeWidth="1.5" className="animate-[bounce_3s_infinite]" />
        <path d="M10,50 Q30,80 50,50 T90,50" strokeWidth="1" opacity="0.6" />
        <path d="M10,70 Q30,100 50,70 T90,70" strokeWidth="0.5" opacity="0.3" />
      </>
    ),
  },
  rings: {
    colorClass: 'text-amber-500',
    shapes: (
      <>
        <circle cx="50" cy="50" r="35" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="25" strokeWidth="1" strokeDasharray="2 2" className="animate-[spin_10s_linear_infinite]" />
        <circle cx="50" cy="50" r="15" strokeWidth="1.5" />
      </>
    ),
  },
  bars: {
    colorClass: 'text-fuchsia-500',
    shapes: (
      <>
        <rect x="20" y="40" width="10" height="40" strokeWidth="1" className="animate-[pulse_1.5s_infinite]" />
        <rect x="40" y="20" width="10" height="60" strokeWidth="1.5" className="animate-pulse" />
        <rect x="60" y="50" width="10" height="30" strokeWidth="1" className="animate-[pulse_2.5s_infinite]" />
      </>
    ),
  },
};

interface WfNewHomeDefaultGroupCardProps {
  group: BentoGroup;
  index: number;
  dark: boolean;
  activeTheme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  onOpen: () => void;
  onEnroll: () => void;
}

/** The full-width Default Vocabulary Group card of the home tab. */
export const WfNewHomeDefaultGroupCard: React.FC<WfNewHomeDefaultGroupCardProps> = ({ group, index, dark, activeTheme, trans, onOpen, onEnroll }) => {
  const decor = group.decorativeSvg ? DECOR_SVGS[group.decorativeSvg] : undefined;
  return (
    <motion.div
      onClick={onOpen}
      whileHover={{ scale: 1.015, y: -4 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`w-full h-[160px] rounded-3xl relative overflow-hidden cursor-pointer group flex flex-col justify-between p-6 transition-all duration-300 border ${
        dark
          ? `bg-slate-900/40 border-white/5 hover:border-indigo-500/30 ${activeTheme.glowClass}`
          : 'bg-white/40 border-zinc-200 hover:border-indigo-400/40 shadow-sm hover:shadow-indigo-100/40'
      }`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-[0.14] dark:opacity-[0.08] pointer-events-none transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url("${BACKDROP_IMAGES[group.id] ?? DEFAULT_BACKDROP_IMAGE}")` }}
      />

      <div className="absolute inset-0 overflow-hidden opacity-[0.06] dark:opacity-[0.04] pointer-events-none select-none font-mono text-[8px] uppercase tracking-widest leading-none">
        <div className={`flex flex-col gap-2 ${index % 2 === 0 ? 'animate-[pulse_4s_infinite]' : 'animate-pulse'}`}>
          {Array.from({ length: WATERFALL_ROWS }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 whitespace-nowrap animate-marquee">
              <span>{group.type}</span>
              <span>{group.name.split(' ')[0]}</span>
              {WATERFALL_WORDS.map((word) => <span key={word}>{word}</span>)}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-2 bottom-2 w-32 h-32 opacity-20 dark:opacity-15 pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12">
        {decor && (
          <svg className={`w-full h-full fill-none stroke-current ${decor.colorClass}`} viewBox="0 0 100 100">{decor.shapes}</svg>
        )}
      </div>

      <div className="relative z-10 space-y-1">
        <div className="flex justify-between items-center gap-2">
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] font-black font-mono uppercase tracking-widest bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/10">
              {group.badge}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-500/10" title={trans('tip.langCode')}>
              {trans('home.langTag', { lang: group.language || 'en' })}
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onEnroll(); }}
            className="px-2 py-1 text-[9px] font-mono font-bold tracking-tight uppercase bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer z-20"
            title={trans('tip.sync1click')}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>{trans('home.enroll')}</span>
          </button>
        </div>

        <h4 className="text-md font-black tracking-tight mt-2.5 group-hover:text-indigo-500 transition-colors">{group.name}</h4>
        <p className="text-[11px] text-zinc-500 font-sans line-clamp-2 leading-snug mt-1 max-w-[85%]">{group.description}</p>
      </div>

      <div className="relative z-10 pt-4 mt-4 border-t border-zinc-200/50 dark:border-white/5 space-y-2">
        <div className="flex justify-between items-end text-[10px] font-mono select-none">
          <div className="space-y-0.5">
            <span className="text-zinc-600 dark:text-zinc-400 block">{group.statsLabel}</span>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onOpen(); }}
              className="font-bold text-sky-500 dark:text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-indigo-200"
              title={trans('home.openCurrentGroup')}
            >
              {trans('home.lexAvail', { n: group.count })}
            </button>
          </div>
          <div className="text-right">
            <span className="font-bold text-emerald-500">{trans('home.pctMastered', { n: group.progress })}</span>
          </div>
        </div>

        <div className="w-full bg-zinc-200/60 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${group.progress}%` }}
            transition={{ duration: PROGRESS_ANIMATION_SECONDS, delay: index * PROGRESS_STAGGER_SECONDS }}
          />
        </div>
      </div>
    </motion.div>
  );
};
