import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CircleAlert,
  CreditCard,
  History,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  ListChecks,
  Menu,
  MessageSquareQuote,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmSignOut } from '../auth/useCmSignOut';
import { CmAccessNotice } from '../components/access/CmAccessNotice';
import { CmBootstrapRefreshNotice } from '../components/access/CmBootstrapRefreshNotice';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmChromeControls } from '../components/CmChromeControls';
import { CmBrand } from '../components/CmBrand';
import { CM_ADMIN_ROUTE, CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';

const ADMIN_NAV = [
  { id: 'overview', path: CM_ADMIN_ROUTE.home, labelKey: 'admin.nav.overview', Icon: LayoutDashboard, end: true },
  { id: 'users', path: CM_ADMIN_ROUTE.users, labelKey: 'admin.nav.users', Icon: Users, end: false },
  { id: 'kyc', path: CM_ADMIN_ROUTE.kyc, labelKey: 'admin.nav.kyc', Icon: ShieldCheck, end: false },
  { id: 'deposits', path: CM_ADMIN_ROUTE.deposits, labelKey: 'admin.nav.deposits', Icon: WalletCards, end: false },
  { id: 'refunds', path: CM_ADMIN_ROUTE.refunds, labelKey: 'admin.nav.refunds', Icon: RotateCcw, end: false },
  { id: 'withdrawals', path: CM_ADMIN_ROUTE.withdrawals, labelKey: 'admin.nav.withdrawals', Icon: Banknote, end: false },
  { id: 'payments', path: CM_ADMIN_ROUTE.payments, labelKey: 'admin.nav.payments', Icon: CreditCard, end: false },
  { id: 'projects', path: CM_ADMIN_ROUTE.projects, labelKey: 'admin.nav.projects', Icon: BriefcaseBusiness, end: false },
  { id: 'tasks', path: CM_ADMIN_ROUTE.tasks, labelKey: 'admin.nav.tasks', Icon: ListChecks, end: false },
  { id: 'testimonials', path: CM_ADMIN_ROUTE.testimonials, labelKey: 'admin.nav.testimonials', Icon: MessageSquareQuote, end: false },
  { id: 'reviewers', path: CM_ADMIN_ROUTE.reviewerApplications, labelKey: 'admin.nav.reviewers', Icon: BadgeCheck, end: false },
  { id: 'contact', path: CM_ADMIN_ROUTE.contactMessages, labelKey: 'admin.nav.contact', Icon: Inbox, end: false },
  { id: 'activity', path: CM_ADMIN_ROUTE.activity, labelKey: 'admin.nav.activity', Icon: History, end: false },
  { id: 'policy', path: CM_ADMIN_ROUTE.policy, labelKey: 'admin.nav.policy', Icon: SlidersHorizontal, end: false },
] as const;

/**
 * CodeMart administration console. A deliberately separate interface from the
 * user workspace: own layout, own navigation, admin-only gate.
 */
export const CmAdminLayout: React.FC = () => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading, error, refresh } = useCmBootstrap();
  const { signOut, signingOut } = useCmSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const userName = bootstrap?.user?.name || bootstrap?.user?.nickname || bootstrap?.user?.username || '';

  if (!bootstrap && (loading || !error)) {
    return <div className="cm-page-fallback" role="status">{t('admin.checkingAccess')}</div>;
  }

  if (!bootstrap?.is_admin) {
    return (
      <CmAccessNotice
        standalone
        Icon={bootstrap ? LockKeyhole : CircleAlert}
        tone={bootstrap ? 'info' : 'warning'}
        titleKey={bootstrap ? 'admin.forbidden' : 'admin.accessUnavailable'}
        bodyKey={bootstrap ? 'admin.forbiddenBody' : 'admin.accessUnavailableBody'}
        hints={bootstrap ? [t('access.denied.hint')] : []}
        onRetry={bootstrap ? undefined : () => void refresh()}
        back={{ to: CM_PROTECTED_ROUTE.dashboard, label: t('admin.backToWorkspace') }}
      />
    );
  }

  return (
    <div className="cm-workspace cm-admin" data-end="codemart">
      <header className="cm-workspace-mobile-header">
        <Link to={CM_ADMIN_ROUTE.home}><CmBrand compact /></Link>
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
        <Link to={CM_ADMIN_ROUTE.home} className="cm-workspace-sidebar__brand" onClick={() => setMenuOpen(false)}>
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
            <Link to={CM_PROTECTED_ROUTE.dashboard} className="cm-workspace-nav__link" onClick={() => setMenuOpen(false)}>
              <ArrowLeft aria-hidden="true" />
              <span>{t('admin.backToWorkspace')}</span>
            </Link>
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
            {t('admin.consoleTitle')}{userName && ` · ${t('nav.signedInAs', { name: userName })}`}
          </span>
          <CmChromeControls />
        </div>
        <CmBootstrapRefreshNotice />
        <Outlet />
      </div>
    </div>
  );
};

export default CmAdminLayout;
