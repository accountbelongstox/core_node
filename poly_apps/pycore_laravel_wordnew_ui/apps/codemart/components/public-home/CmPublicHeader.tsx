import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { requestAuthLogin } from '../../../../core/auth/AuthRequestCenter';
import { useAuthSession } from '../../../../core/auth/useAuthSession';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBrand } from '../CmBrand';

const NAV_ITEMS = [
  { key: 'nav.projects', to: '/codemart/projects' },
  { key: 'nav.estimate', to: '/codemart/projects/new' },
  { key: 'nav.membership', to: '/codemart/dashboard' },
  { key: 'nav.developers', to: '/codemart/marketplace' },
  { key: 'nav.help', to: '#cm-delivery-process' },
] as const;

export const CmPublicHeader: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const authenticated = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const openAuthentication = (reason: string): void => {
    setMenuOpen(false);
    requestAuthLogin({ source: 'codemart', reason });
  };
  const openDashboard = (): void => {
    setMenuOpen(false);
    navigate('/codemart/dashboard');
  };

  return (
    <header className="cm-public-header">
      <div className="cm-public-container cm-public-header__inner">
        <Link to="/codemart" className="cm-public-header__brand" aria-label={t('brand.name')}>
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
            {NAV_ITEMS.map((item) => item.to.startsWith('#') ? (
              <a key={item.key} href={item.to} onClick={() => setMenuOpen(false)}>{t(item.key)}</a>
            ) : (
              <Link key={item.key} to={item.to} onClick={() => setMenuOpen(false)}>{t(item.key)}</Link>
            ))}
          </nav>
          <div className="cm-public-header__account">
            {authenticated ? (
              <button type="button" onClick={openDashboard}>{t('nav.dashboard')}</button>
            ) : (
              <>
                <button type="button" onClick={() => openAuthentication('sign-in')}>{t('nav.login')}</button>
                <button type="button" className="cm-public-header__register" onClick={() => openAuthentication('register')}>
                  {t('nav.register')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default CmPublicHeader;
