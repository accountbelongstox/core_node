/**
 * WfNewAbout — the dedicated "About" page (navigated to from Settings, not an
 * inline expand). Positions WordNew as an AI multilingual vocabulary-learning
 * platform: a brand hero (logo + name + version + tagline + description) and a
 * grid of the four pillars. The page TITLE lives in the global nav header
 * (wfNewPageHeader 'about'); this body carries the branding content only.
 *
 * All copy via trans() (proofread across en/zh/ja/ko); English-only in code.
 */
import React from 'react';
import { Sparkles, Repeat, BookOpen, FlaskConical } from 'lucide-react';
import { WfNewLogo } from '../WfNewBrand';
import { ElementTheme } from '../WfNewTypes';

interface WfNewAboutProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const FEATURES: Array<{ Icon: React.ComponentType<{ className?: string }>; key: string }> = [
  { Icon: Sparkles, key: 'f1' },
  { Icon: Repeat, key: 'f2' },
  { Icon: BookOpen, key: 'f3' },
  { Icon: FlaskConical, key: 'f4' },
];

export const WfNewAbout: React.FC<WfNewAboutProps> = ({ activeTheme, trans }) => (
  <div className="space-y-6">
    {/* Brand hero */}
    <div className={`p-8 rounded-3xl ${activeTheme.cardClass} shadow-md flex flex-col items-center text-center gap-4`}>
      <WfNewLogo size={88} className="shadow-xl" />
      <div className="space-y-1.5">
        <h2 className="text-2xl font-black tracking-tight text-indigo-950 dark:text-white">
          {trans('about.appName')}
          <span className="ml-2 text-xs font-mono font-bold text-zinc-400 align-middle">{trans('about.version')}</span>
        </h2>
        <p className="text-sm font-bold text-indigo-500 dark:text-indigo-400">{trans('about.tagline')}</p>
      </div>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-prose">
        {trans('about.desc')}
      </p>
    </div>

    {/* The four pillars */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {FEATURES.map(({ Icon, key }) => (
        <div key={key} className={`p-4 rounded-2xl ${activeTheme.cardClass} shadow-sm flex items-start gap-3`}>
          <div className="shrink-0 w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-extrabold text-indigo-950 dark:text-white">{trans(`about.${key}Title`)}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{trans(`about.${key}Desc`)}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default WfNewAbout;
