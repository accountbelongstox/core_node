/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp.
   Verified reference parity. Announcement slimmed to a subtle glass pill
   (was a flat web banner). */
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SearchOverlay } from './SearchOverlay';
import { AppLayoutProvider, useTopBarOverridesState } from '../contexts/AppLayoutContext';
import { MOCK_ANNOUNCEMENTS } from '../services/mockData';

const TOP_BAR_HEIGHT = 72;

export interface AppLayoutProps {
  children?: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const overrides = useTopBarOverridesState();

  return (
    <div className="h-full flex flex-col bg-transparent">
      <TopBar
        title={overrides?.title}
        showBack={overrides?.showBack}
        onBack={overrides?.onBack}
        onSearchClick={() => setSearchOpen(true)}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <main
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0"
        style={{ paddingTop: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px) + 0.5rem)` }}
      >
        <div className="ds-page flex-1">
          {MOCK_ANNOUNCEMENTS[0]?.message && (
            <div className="ds-glass ds-glass-edge flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5 mb-3 overflow-hidden">
              <span className="text-[9px] font-bold bg-[var(--klein-blue)] text-[var(--klein-on)] px-2 py-0.5 rounded-full flex-shrink-0">NEW</span>
              <div className="flex-1 text-xs font-medium text-[var(--color-text-secondary)] truncate">
                {MOCK_ANNOUNCEMENTS[0]?.message}
              </div>
            </div>
          )}
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <AppLayoutProvider>
      <AppLayoutInner {...props} />
    </AppLayoutProvider>
  );
}

export default AppLayout;
