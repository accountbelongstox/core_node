import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthSession } from '../../../../core/auth/useAuthSession';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBrand } from '../CmBrand';
import { CmChromeControls } from '../CmChromeControls';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from './cmPublicRoutes';
import { useCmProtectedNavigate } from './useCmProtectedNavigate';

const NAV_ITEMS = [
  { key: 'publicHome.nav.services', to: CM_PUBLIC_ROUTE.services },
  { key: 'publicHome.nav.process', to: CM_PUBLIC_ROUTE.delivery },
  { key: 'publicHome.nav.showcase', to: CM_PUBLIC_ROUTE.showcase },
  { key: 'publicHome.nav.estimate', to: CM_PUBLIC_ROUTE.estimate },
  { key: 'publicHome.nav.about', to: CM_PUBLIC_ROUTE.about },
] as const;

export const CmPublicHeader: React.FC = () => {
  const { t } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  const authenticated = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = (): void => setMenuOpen(false);
  const openWorkspace = (): void => {
    closeMenu();
    openProtected(CM_PROTECTED_ROUTE.dashboard, 'workspace-entry');
  };

  return (
    <header className="cm-public-header">
      <div className="cm-public-container cm-public-header__inner">
        <Link to={CM_PUBLIC_ROUTE.home} className="cm-public-header__brand" aria-label={t('brand.name')}>
          <CmBrand inverse />
        </Link>
        <button
          type="button"
          className="cm-public-header__menu-toggle"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
          aria-expanded={menuOpen}
          aria-controls="cm-public-navigation"
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <div id="cm-public-navigation" className={`cm-public-header__panel ${menuOpen ? 'is-open' : ''}`}>
          <nav className="cm-public-header__nav" aria-label={t('brand.name')}>
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.key} to={item.to} end onClick={closeMenu}>{t(item.key)}</NavLink>
            ))}
          </nav>
          <div className="cm-public-header__account">
            <CmChromeControls inverse />
            {authenticated ? (
              <button type="button" onClick={openWorkspace}>{t('nav.dashboard')}</button>
            ) : (
              <>
                <span className="cm-public-header__sign-in">
                  <Link to={CM_PUBLIC_ROUTE.login} onClick={closeMenu}>{t('nav.login')}</Link>
                  <Link to={CM_PUBLIC_ROUTE.forgotPassword} className="cm-public-header__forgot" onClick={closeMenu}>
                    {t('publicAuth.forgot.link')}
                  </Link>
                </span>
                <Link to={CM_PUBLIC_ROUTE.register} className="cm-public-header__register" onClick={closeMenu}>
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default CmPublicHeader;
