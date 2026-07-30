import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { WfNewLogo } from '../WfNewBrand';

/**
 * WfNewNavLogo — the GLOBAL top-left brand/back control (one component, used in
 * the WfNewApp header for every page — never per-page back rows).
 *
 * It merges the app LOGO and the "back to previous page" arrow into a single
 * slot driven by the navigation stack (WfNewApp's navStack):
 *   - stack has a previous page  → show a BACK arrow (goBack → the page you came
 *     from, NOT home). This frees the vertical space a per-page breadcrumb/back
 *     row used to take.
 *   - stack is empty             → show the LOGO (goHome → home directly).
 *
 * Same 40×40 footprint for the control either way, so the header never reflows.
 *
 * Beside the control it shows the CURRENT PAGE header — a big title + small
 * subtitle — in a FIXED-WIDTH, overflow-hidden box: long names truncate with an
 * ellipsis and never push the search box / right-side icons. Omitting `title`
 * (e.g. on home) shows just the control.
 */
interface WfNewNavLogoProps {
  /** True when navStack has at least one entry (there is a previous page). */
  canGoBack: boolean;
  /** Pop the stack and return to the previous page. */
  onBack: () => void;
  /** Jump straight to home (clears the stack). */
  onHome: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Current page title (big). Omit on pages with no header — only the control shows. */
  title?: string;
  /** Current page subtitle (small, under the title). */
  subtitle?: string;
}

export const WfNewNavLogo: React.FC<WfNewNavLogoProps> = ({ canGoBack, onBack, onHome, trans, title, subtitle }) => {
  const control = canGoBack ? (
    <button
      onClick={onBack}
      title={trans('common.back')}
      aria-label={trans('common.back')}
      className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 transition-all cursor-pointer shrink-0"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  ) : (
    <button
      onClick={onHome}
      title="WordNew"
      aria-label="WordNew home"
      className="flex items-center justify-center w-10 h-10 rounded-2xl overflow-hidden shadow-lg cursor-pointer shrink-0"
    >
      <WfNewLogo size={40} rounded={false} className="w-full h-full" />
    </button>
  );

  return (
    <div className="flex items-center gap-3 min-w-0">
      {control}
      {title && (
        // FIXED width + overflow-hidden: the page title/subtitle truncate instead
        // of pushing the search box or the right-side icons off-screen.
        <div className="w-32 sm:w-48 md:w-60 shrink-0 overflow-hidden leading-tight">
          <h1 className="truncate text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-[10px] sm:text-xs font-mono text-zinc-500">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default WfNewNavLogo;
