import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from '../../core/i18n/UiI18n';
import { cmCanOpenPage, cmIsApplyEntry } from './auth/cmPageAccess';
import { useCmSignOut } from './auth/useCmSignOut';
import { CmBrand } from './components/CmBrand';
import { CmChromeControls } from './components/CmChromeControls';
import { useCmBootstrap } from './contexts/CmBootstrapContext';
import { CM_PAGES, type CmPageDef } from './cmPages';

const NOTIFICATIONS_PAGE_ID = 'notifications';
const MAX_BADGE_COUNT = 99;

const linkClassName = ({ isActive }: { isActive: boolean }): string => (
  `cm-workspace-nav__link ${isActive ? 'is-active' : ''}`
);

const formatBadge = (count: number): string => (count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count));

export const CmLayout: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability, bootstrap, unreadCount } = useCmBootstrap();
  const { signOut, signingOut } = useCmSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const bellLink = hasCapability('notification.read') ? (
    <Link
      to="/codemart/notifications"
      className="cm-topbar-bell"
      aria-label={t('notifications.unreadCount', { count: unreadCount })}
    >
      <Bell aria-hidden="true" />
      {unreadCount > 0 && <span className="cm-nav-badge">{formatBadge(unreadCount)}</span>}
    </Link>
  ) : null;
  const userName = bootstrap?.user?.name || bootstrap?.user?.nickname || bootstrap?.user?.username || '';
  const isApplyEntry = (page: CmPageDef): boolean => cmIsApplyEntry(page, hasCapability);
  const visiblePages = CM_PAGES.filter((page) => cmCanOpenPage(page, hasCapability));
  const primaryPages = visiblePages.filter((page) => page.group === 'primary');
  const accountPages = visiblePages.filter((page) => page.group === 'account');
  const renderLink = (page: CmPageDef): React.ReactElement => {
    const Icon = page.Icon;
    return (
      <NavLink
        key={page.id}
        to={`/codemart/${page.path}`}
        className={linkClassName}
        onClick={() => setMenuOpen(false)}
      >
        <Icon aria-hidden="true" />
        <span>{t(isApplyEntry(page) && page.applyLabelKey ? page.applyLabelKey : page.labelKey)}</span>
        {page.id === NOTIFICATIONS_PAGE_ID && unreadCount > 0 && (
          <span className="cm-nav-badge" aria-label={t('notifications.unreadCount', { count: unreadCount })}>
            {formatBadge(unreadCount)}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="cm-workspace" data-end="codemart">
      <header className="cm-workspace-mobile-header">
        <Link to="/codemart"><CmBrand compact /></Link>
        <div className="cm-workspace-mobile-header__controls">
          {bellLink}
          <CmChromeControls />
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>
      {menuOpen && <button type="button" className="cm-workspace-backdrop" aria-label={t('common.closeMenu')} onClick={() => setMenuOpen(false)} />}
      <aside className={`cm-workspace-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link to="/codemart" className="cm-workspace-sidebar__brand" onClick={() => setMenuOpen(false)}>
          <CmBrand />
        </Link>
        <nav className="cm-workspace-nav" aria-label={t('workspace.navLabel')}>
          <div>{primaryPages.map(renderLink)}</div>
          <div className="cm-workspace-nav__account">
            {bootstrap?.is_admin && (
              <NavLink to="/codemart/admin" className={linkClassName} onClick={() => setMenuOpen(false)}>
                <ShieldCheck aria-hidden="true" />
                <span>{t('admin.badge')}</span>
              </NavLink>
            )}
            {accountPages.map(renderLink)}
            <button type="button" className="cm-workspace-nav__link cm-sign-out" onClick={() => void signOut()} disabled={signingOut}>
              <LogOut aria-hidden="true" />
              <span>{signingOut ? t('nav.signingOut') : t('nav.signOut')}</span>
            </button>
          </div>
        </nav>
      </aside>
      <div className="cm-workspace-content">
        <div className="cm-workspace-topbar">
          <span className="cm-workspace-topbar__title">
            {userName && t('nav.signedInAs', { name: userName })}
          </span>
          {bellLink}
          <CmChromeControls />
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default CmLayout;
