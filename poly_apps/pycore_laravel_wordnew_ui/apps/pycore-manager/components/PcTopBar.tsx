/**
 * PcTopBar — top strip in the main column (in-flow, not viewport-fixed).
 * Hosts the global Laravel endpoint switcher; page content scrolls below it.
 *
 * Right padding is computed from shell/shellChrome.ts so the switcher stays
 * left of the cross-end ShellControls dock (Apps / Home / Laravel Manager /
 * theme / language). See shellDockRightGutterPx() for the formula.
 */
import React from 'react';
import PcLaravelEndpointSwitcher from './PcLaravelEndpointSwitcher';
import PcPycoreTargetSwitcher from './PcPycoreTargetSwitcher';
import PcVersionChips from './PcVersionChips';
import { shellDockRightGutterPx } from '../../../shell/shellChrome';

/** 12 + 240 + 12 = 264px — clears ShellControls panel when open */
const SHELL_DOCK_GUTTER_PX = shellDockRightGutterPx();

export const PcTopBar: React.FC = () => (
  <header
    className="shrink-0 z-30 flex items-center justify-end gap-3 pl-4 sm:pl-6 py-2 min-h-[3.25rem] border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl"
    style={{
      // max(base px-6, shell gutter) — never overlap ShellControls top-right dock
      paddingRight: `max(1.5rem, ${SHELL_DOCK_GUTTER_PX}px)`,
    }}
  >
    <PcVersionChips />
    <PcPycoreTargetSwitcher variant="header" />
    <PcLaravelEndpointSwitcher variant="header" />
  </header>
);

export default PcTopBar;
