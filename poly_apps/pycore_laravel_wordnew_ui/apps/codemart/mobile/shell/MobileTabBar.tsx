import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

const MAX_BADGE_COUNT = 99;

export interface MobileTabBarItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Navigates here; omit for an action tab that only has `onClick`. */
  path?: string;
  /** The tab is active on these paths (and their children unless `exact`); defaults to `path`. */
  activePaths?: readonly string[];
  exact?: boolean;
  badge?: number;
  onClick?: () => void;
}

const normalize = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';

/** Bottom tab bar; the active tab follows the route. */
export const MobileTabBar: React.FC<{ tabs: MobileTabBarItem[]; label: string }> = ({ tabs, label }) => {
  const { t } = useTranslation('cm');
  const current = normalize(useLocation().pathname);
  return (
    <nav className="cmm-tabbar" aria-label={label} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => {
        const Icon = tab.Icon;
        const badge = tab.badge ?? 0;
        const paths = tab.activePaths ?? (tab.path ? [tab.path] : []);
        const active = paths.some((path) => current === normalize(path) || (!tab.exact && current.startsWith(`${normalize(path)}/`)));
        const className = `cmm-tab ${active ? 'is-active' : ''}`;
        const content = (
          <>
            <span className="cmm-tab__icon">
              <Icon aria-hidden="true" />
              {badge > 0 && (
                <span className="cmm-tab__badge" aria-label={t('notifications.unreadCount', { count: badge })}>
                  {badge > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : badge}
                </span>
              )}
            </span>
            <span className="cmm-tab__label">{tab.label}</span>
          </>
        );
        return tab.path
          ? <Link key={tab.id} to={tab.path} className={className} aria-current={active ? 'page' : undefined}>{content}</Link>
          : <button key={tab.id} type="button" className={className} onClick={tab.onClick}>{content}</button>;
      })}
    </nav>
  );
};
