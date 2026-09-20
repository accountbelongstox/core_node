import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from '../../core/i18n/UiI18n';
import { CmBrand } from './components/CmBrand';
import { CmChromeControls } from './components/CmChromeControls';
import { useCmBootstrap } from './contexts/CmBootstrapContext';
import { CM_PAGES, type CmPageDef } from './cmPages';

const linkClassName = ({ isActive }: { isActive: boolean }): string => (
  `cm-workspace-nav__link ${isActive ? 'is-active' : ''}`
);

export const CmLayout: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability, bootstrap } = useCmBootstrap();
  const [menuOpen, setMenuOpen] = useState(false);
  const visiblePages = CM_PAGES.filter((page) => hasCapability(page.capability));
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
        <span>{t(page.labelKey)}</span>
      </NavLink>
    );
  };

  return (
    <div className="cm-workspace" data-end="codemart">
      <header className="cm-workspace-mobile-header">
        <Link to="/codemart"><CmBrand compact /></Link>
        <div className="cm-workspace-mobile-header__controls">
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
      <aside className={`cm-workspace-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link to="/codemart" className="cm-workspace-sidebar__brand" onClick={() => setMenuOpen(false)}>
          <CmBrand />
        </Link>
        <nav className="cm-workspace-nav" aria-label={t('brand.name')}>
          <div>{primaryPages.map(renderLink)}</div>
          <div className="cm-workspace-nav__account">
            {bootstrap?.is_admin && (
              <NavLink to="/codemart/admin" className={linkClassName} onClick={() => setMenuOpen(false)}>
                <ShieldCheck aria-hidden="true" />
                <span>{t('admin.badge')}</span>
              </NavLink>
            )}
            {accountPages.map(renderLink)}
          </div>
        </nav>
      </aside>
      <div className="cm-workspace-content">
        <div className="cm-workspace-topbar">
          <span className="cm-workspace-topbar__title">
            {bootstrap?.user?.nickname ?? bootstrap?.user?.username ?? ''}
          </span>
          <CmChromeControls />
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default CmLayout;
