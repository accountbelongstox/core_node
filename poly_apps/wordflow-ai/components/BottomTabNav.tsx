import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { Icons } from './UI';

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  route: string;
  matchRoutes: string[]; // Routes that should highlight this tab
}

export const BottomTabNav = () => {
  const { navigate, t } = useContext(AppContext);
  const location = useLocation();

  const tabs: TabConfig[] = [
    {
      id: 'home',
      label: t('nav.home'),
      icon: <Icons.Home />,
      activeIcon: <Icons.Home />,
      route: '/',
      matchRoutes: ['/', '/home', '/dashboard'],
    },
    {
      id: 'library',
      label: t('nav.library'),
      icon: <Icons.Library />,
      activeIcon: <Icons.Library />,
      route: '/learn/library',
      matchRoutes: ['/learn/library', '/library'],
    },
    {
      id: 'practice',
      label: t('nav.practice'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      route: '/learn/practice',
      matchRoutes: ['/learn/practice', '/reading', '/flashcards'],
    },
    {
      id: 'tools',
      label: t('nav.tools'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
        </svg>
      ),
      route: '/tools',
      matchRoutes: ['/tools', '/dictionary', '/translation'],
    },
    {
      id: 'mine',
      label: t('nav.mine'),
      icon: <Icons.User />,
      activeIcon: <Icons.User />,
      route: '/mine',
      matchRoutes: ['/mine', '/profile', '/settings', '/social'],
    },
  ];

  const isTabActive = (tab: TabConfig): boolean => {
    const currentPath = location.pathname;
    return tab.matchRoutes.some(route => {
      if (route === '/') {
        return currentPath === '/';
      }
      return currentPath.startsWith(route);
    });
  };

  const handleTabClick = (tab: TabConfig) => {
    // Navigate using the custom navigate function from AppContext
    const routePath = tab.route.startsWith('/') ? tab.route.slice(1) : tab.route;
    navigate(routePath);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe">
      <div className="w-full px-2">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = isTabActive(tab);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`
                  flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl
                  transition-all duration-200 min-w-[64px] group
                  ${isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }
                `}
              >
                {/* Icon with active state animation */}
                <div className={`
                  transition-all duration-200
                  ${isActive ? 'scale-110' : 'scale-100 group-hover:scale-105'}
                `}>
                  {isActive ? tab.activeIcon : tab.icon}
                </div>

                {/* Label */}
                <span className={`
                  text-xs font-medium transition-all duration-200
                  ${isActive ? 'font-bold' : 'font-normal'}
                `}>
                  {tab.label}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Safe area spacer for iOS devices */}
      <div className="h-safe" />
    </nav>
  );
};

// Export default for convenience
export default BottomTabNav;
