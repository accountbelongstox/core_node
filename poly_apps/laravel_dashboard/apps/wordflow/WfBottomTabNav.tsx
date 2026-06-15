/* [v4.1-Iris] WfBottomTabNav — centered floating gradient island.
 * Ported from poly_apps/qy_capacitor/components/BottomTabNav.tsx. Self-contained:
 * uses react-router useNavigate/useLocation + wfPath() so every tab targets a
 * /wordflow/... route. Icon-only circular glass side tabs + gradient center orb
 * (ds-bar-cta), matching design-reference-{light,dark}.webp. */
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from './WfUI';
import { useWfT } from './WfAppContext';

/** Build a /wordflow-prefixed path and collapse any double slashes. */
export function wfPath(p: string): string {
  return ('/wordflow/' + p).replace(/\/+/g, '/');
}

interface WfTabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  route: string;          // relative to /wordflow
  matchRoutes: string[];  // relative-to-/wordflow prefixes that activate this tab
}

export const WfBottomTabNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useWfT();

  const tabs: WfTabConfig[] = [
    {
      id: 'home',
      label: t('nav.home'),
      icon: <Icons.Home />,
      activeIcon: <Icons.Home />,
      route: 'learn/home',
      matchRoutes: ['', 'learn/home', 'home', 'dashboard'],
    },
    {
      id: 'library',
      label: t('nav.library'),
      icon: <Icons.Library />,
      activeIcon: <Icons.Library />,
      route: 'learn/library',
      matchRoutes: ['learn/library', 'courses', 'vocabulary_library'],
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
      route: 'learn/practice',
      matchRoutes: ['learn/practice', 'reading', 'flashcard'],
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
      route: 'tools',
      matchRoutes: ['tools', 'dictionary'],
    },
    {
      id: 'mine',
      label: t('nav.mine'),
      icon: <Icons.User />,
      activeIcon: <Icons.User />,
      route: 'mine',
      matchRoutes: ['mine', 'profile', 'settings', 'social', 'leaderboard', 'friends'],
    },
  ];

  // Current path relative to /wordflow (no leading slash).
  const rel = location.pathname.replace(/^\/wordflow\/?/, '').replace(/\/+$/, '');

  const isTabActive = (tab: WfTabConfig): boolean =>
    tab.matchRoutes.some((route) => {
      if (route === '') return rel === '';
      return rel === route || rel.startsWith(route + '/') || rel.startsWith(route);
    });

  return (
    <nav className="ds-bar-pill" aria-label="Bottom navigation">
      <div className="ds-bar-pill-inner">
        {tabs.map((tab, index) => {
          const isActive = isTabActive(tab);
          // The central tab becomes the elevated floating-island action.
          const isCenterAction = index === Math.floor(tabs.length / 2);

          if (isCenterAction) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(wfPath(tab.route))}
                className={`ds-bar-cta ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
              >
                {tab.activeIcon}
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(wfPath(tab.route))}
              className={`ds-bar-tab ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <div className="ds-bar-tab-icon-wrap">
                {isActive ? tab.activeIcon : tab.icon}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default WfBottomTabNav;
