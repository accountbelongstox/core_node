/**
 * Shell layout: renders the active end via <Outlet/>, plus the cross-end chrome
 * (floating control dock + global AI chat slide-over). Kept intentionally thin so
 * each end keeps its own internal navigation (dashboard sidebar, WordNew island).
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { ShellControls } from './ShellControls';
import { ShellProvider } from './ShellContext';
import { AiChatPanel } from '../shared/AiChatKit/AiChatPanel';
import { SHELL_DOCK_GUTTER_CSS_VAR, shellDockRightGutterPx } from './shellChrome';

export const ShellLayout: React.FC = () => {
  return (
    <ShellProvider>
      <div
        className="shell-root min-h-screen"
        style={{ [SHELL_DOCK_GUTTER_CSS_VAR]: `${shellDockRightGutterPx()}px` }}
      >
        <Outlet />
        <ShellControls />
        <AiChatPanel />
      </div>
    </ShellProvider>
  );
};

export default ShellLayout;
