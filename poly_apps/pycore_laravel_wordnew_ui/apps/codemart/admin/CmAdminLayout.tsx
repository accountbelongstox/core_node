import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Menu, ShieldCheck, Users, WalletCards, FileText, BriefcaseBusiness, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmChromeControls } from '../components/CmChromeControls';
import { CmBrand } from '../components/CmBrand';

const ADMIN_NAV = [
  { id: 'overview', path: '/codemart/admin', labelKey: 'admin.nav.overview', Icon: LayoutDashboard, end: true },
  { id: 'users', path: '/codemart/admin/users', labelKey: 'admin.nav.users', Icon: Users, end: false },
  { id: 'kyc', path: '/codemart/admin/kyc', labelKey: 'admin.nav.kyc', Icon: ShieldCheck, end: false },
  { id: 'deposits', path: '/codemart/admin/deposits', labelKey: 'admin.nav.deposits', Icon: WalletCards, end: false },
  { id: 'refunds', path: '/codemart/admin/refunds', labelKey: 'admin.nav.refunds', Icon: FileText, end: false },
  { id: 'projects', path: '/codemart/admin/projects', labelKey: 'admin.nav.projects', Icon: BriefcaseBusiness, end: false },
] as const;

/**
 * CodeMart administration console. A deliberately separate interface from the
 * user workspace: own layout, own navigation, admin-only gate.
 */
export const CmAdminLayout: React.FC = () => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading } = useCmBootstrap();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!loading && bootstrap && !bootstrap.is_admin) {
    return (
      <main className="cm-access-gate" data-end="codemart">
        <section className="cm-access-gate__card">
          <h1>{t('admin.forbidden')}</h1>
          <p>{t('admin.forbiddenBody')}</p>
          <Link to="/codemart/dashboard"><ArrowLeft aria-hidden="true" /> {t('admin.backToWorkspace')}</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="cm-workspace cm-admin" data-end="codemart">
      <header className="cm-workspace-mobile-header">
        <Link to="/codemart/admin"><CmBrand compact /></Link>
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
        <Link to="/codemart/admin" className="cm-workspace-sidebar__brand" onClick={() => setMenuOpen(false)}>
          <CmBrand />
          <span className="cm-admin-badge">{t('admin.badge')}</span>
        </Link>
        <nav className="cm-workspace-nav" aria-label={t('admin.badge')}>
          <div>
            {ADMIN_NAV.map((item) => {
              const Icon = item.Icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `cm-workspace-nav__link ${isActive ? 'is-active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </div>
          <div className="cm-workspace-nav__account">
            <Link to="/codemart/dashboard" className="cm-workspace-nav__link" onClick={() => setMenuOpen(false)}>
              <ArrowLeft aria-hidden="true" />
              <span>{t('admin.backToWorkspace')}</span>
            </Link>
          </div>
        </nav>
      </aside>
      <div className="cm-workspace-content">
        <div className="cm-workspace-topbar">
          <span className="cm-workspace-topbar__title">{t('admin.consoleTitle')}</span>
          <CmChromeControls />
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default CmAdminLayout;
