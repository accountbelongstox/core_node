import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { WfNewLogo } from '../WfNewBrand';
import type { WordNewPageHeader } from '../routing/WordNewHashRoutes';

/**
 * WfNewNavLogo — the GLOBAL top-left brand/back control of the WfNewApp header.
 *
 * Home (no page header) shows the brand LOGO (goHome). Every other page shows
 * one bordered pill: a narrow back chevron (only when the nav stack has a
 * previous page) and the page's identity ICON (goHome). The page title is the
 * icon's tooltip/accessible label, so long titles never crowd the header.
 */
interface WfNewNavLogoProps {
  canGoBack: boolean;
  onBack: () => void;
  onHome: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  page: WordNewPageHeader | null;
}

export const WfNewNavLogo: React.FC<WfNewNavLogoProps> = ({ canGoBack, onBack, onHome, trans, page }) => {
  if (!page) {
    return (
      <button
        onClick={onHome}
        title="WordNew"
        aria-label={trans('nav.home')}
        className="flex items-center justify-center w-10 h-10 rounded-2xl overflow-hidden shadow-lg cursor-pointer shrink-0"
      >
        <WfNewLogo size={40} rounded={false} className="w-full h-full" />
      </button>
    );
  }

  const Icon = page.icon;
  const label = page.subtitle ? `${page.title} · ${page.subtitle}` : page.title;
  return (
    <div className="flex items-center h-10 shrink-0 rounded-2xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-700 dark:text-zinc-200 overflow-hidden">
      {canGoBack && (
        <button
          onClick={onBack}
          title={trans('common.back')}
          aria-label={trans('common.back')}
          className="flex items-center justify-center w-5 h-full hover:bg-slate-900/10 dark:hover:bg-white/10 border-r border-slate-900/10 dark:border-white/10 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={onHome}
        title={label}
        aria-label={label}
        className="flex items-center justify-center w-10 h-full hover:bg-slate-900/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-indigo-500 dark:text-indigo-400"
      >
        <Icon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default WfNewNavLogo;
