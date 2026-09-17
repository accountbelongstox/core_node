/**
 * PcTopBar - top strip in the main column (in-flow, not viewport-fixed).
 * Hosts the global Laravel endpoint switcher; page content scrolls below it.
 *
 * Mobile (< md): a menu button on the left opens the collapsed sidebar drawer
 * (see PcLayout); the cross-end ShellControls gutter is not reserved so the
 * narrow viewport stays usable.
 *
 * Desktop right padding is computed from shell/shellChrome.ts so the switcher
 * stays left of the cross-end ShellControls dock (Apps / Home / Laravel Manager
 * / theme / language). See shellDockRightGutterPx() for the formula.
 */
import React from 'react';
import { Menu } from 'lucide-react';
import PcLaravelEndpointSwitcher from './PcLaravelEndpointSwitcher';
import PcPycoreTargetSwitcher from './PcPycoreTargetSwitcher';
import PcVersionChips from './PcVersionChips';
import { shellDockRightGutterPx } from '../../../shell/shellChrome';
import { useIsMobile } from '../hooks/useIsMobile';

interface PcTopBarProps {
  onOpenNav?: () => void;
}

export const PcTopBar: React.FC<PcTopBarProps> = ({ onOpenNav }) => {
  const isMobile = useIsMobile();

  return (
    <header
      className="shrink-0 z-30 flex items-center gap-3 pl-3 sm:pl-6 pr-4 py-2 min-h-[3.25rem] border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl"
      style={
        isMobile
          ? undefined
          : {
            // max(base px-6, shell gutter) - never overlap ShellControls top-right dock
            paddingRight: `max(1.5rem, ${shellDockRightGutterPx()}px)`,
          }
      }
    >
      {onOpenNav && (
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <PcVersionChips />
        <PcPycoreTargetSwitcher variant="header" />
        <PcLaravelEndpointSwitcher variant="header" />
      </div>
    </header>
  );
};

export default PcTopBar;
