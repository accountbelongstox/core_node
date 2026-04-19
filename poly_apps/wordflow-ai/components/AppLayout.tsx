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
          <div className="flex items-center gap-2 overflow-hidden py-1 opacity-80 hover:opacity-100 transition-opacity mb-2">
            <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded shadow-sm shadow-blue-500/30">NEW</span>
            <div className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
              {MOCK_ANNOUNCEMENTS[0]?.message}
            </div>
          </div>
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
