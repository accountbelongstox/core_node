import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, LogOut, Monitor, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmCanOpenPage, cmIsApplyEntry } from '../../auth/cmPageAccess';
import { useCmSignOut } from '../../auth/useCmSignOut';
import { CmIcon } from '../../components/CmImage';
import { CM_ADMIN_ROUTE, cmWorkspacePath } from '../../components/public-home/cmPublicRoutes';
import { CM_APP_VERSION } from '../../cmFlavor';
import { CM_PAGES } from '../../cmPages';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { useCmAccount } from '../../shared/cmAccount';
import { isCmUiModeForced, setCmUiMode } from '../../shared/cmUiMode';
import { MobileStatusBadge } from '../ui/MobileStatusBadge';
import { useMobileOverlay } from '../ui/useMobileOverlay';
import { MobilePreferences } from './MobilePreferences';

const DRAWER_ICON_SIZE = 24;
/** Opened from a dedicated action, not as a destination. */
const HIDDEN_PAGE_IDS: readonly string[] = ['dashboard', 'project-create'];

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Page ids already shown as bottom tabs. */
  tabPageIds: readonly string[];
}

/** Left drawer: account card, held roles, secondary destinations, admin link, preferences and sign-out. */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({ open, onClose, tabPageIds }) => {
  const { t } = useTranslation('cm');
  const { hasCapability } = useCmBootstrap();
  const account = useCmAccount();
  const { signOut, signingOut } = useCmSignOut();
  useMobileOverlay(open, onClose);

  const destinations = CM_PAGES.filter((page) => (
    !HIDDEN_PAGE_IDS.includes(page.id) && !tabPageIds.includes(page.id) && cmCanOpenPage(page, hasCapability)
  ));

  return (
    <div className={`cmm-drawer-layer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="cmm-scrim" tabIndex={open ? 0 : -1} aria-label={t('mobile.shell.closeMenu')} onClick={onClose} />
      <aside className="cmm-drawer" aria-label={t('mobile.shell.menu')}>
        <header className="cmm-drawer__account">
          <button type="button" className="cmm-icon-btn cmm-drawer__close" onClick={onClose} aria-label={t('mobile.shell.closeMenu')}><X aria-hidden="true" /></button>
          {account && (
            <>
              <span className="cmm-avatar">{account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : account.initial}</span>
              <strong>{account.displayName || account.username}</strong>
              <small>{account.email || `@${account.username}`}</small>
              <div className="cmm-drawer__roles" aria-label={t('mobile.shell.rolesTitle')}>
                {account.heldRoles.length === 0 && <span className="cmm-badge" data-tone="neutral">{account.isAdmin ? t('dashboard.adminOnly') : t('dashboard.noRoles')}</span>}
                {account.heldRoles.map((item) => (
                  <span key={item.role} className="cmm-role">{t(`roles.${item.role}`)} <MobileStatusBadge group="role" status={item.status} /></span>
                ))}
              </div>
            </>
          )}
        </header>
        <nav className="cmm-drawer__nav" aria-label={t('workspace.navLabel')}>
          {destinations.map((page) => (
            <NavLink key={page.id} to={cmWorkspacePath(page.path)} className={({ isActive }) => `cmm-drawer__item ${isActive ? 'is-active' : ''}`} onClick={onClose}>
              <CmIcon name={page.icon} size={DRAWER_ICON_SIZE} decorative />
              <span>{t(cmIsApplyEntry(page, hasCapability) && page.applyLabelKey ? page.applyLabelKey : page.labelKey)}</span>
              <ChevronRight aria-hidden="true" />
            </NavLink>
          ))}
          {account?.isAdmin && (
            <NavLink to={CM_ADMIN_ROUTE.home} className={({ isActive }) => `cmm-drawer__item ${isActive ? 'is-active' : ''}`} onClick={onClose}>
              <ShieldCheck aria-hidden="true" />
              <span>{t('admin.badge')}</span>
              <ChevronRight aria-hidden="true" />
            </NavLink>
          )}
        </nav>
        <section className="cmm-drawer__prefs"><MobilePreferences /></section>
        <footer className="cmm-drawer__foot">
          {isCmUiModeForced() && (
            <button type="button" className="cmm-drawer__item" onClick={() => { onClose(); setCmUiMode('web'); }}>
              <Monitor aria-hidden="true" />
              <span>{t('mobile.shell.useWebVersion')}</span>
            </button>
          )}
          <button type="button" className="cmm-drawer__item is-danger" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut aria-hidden="true" />
            <span>{signingOut ? t('nav.signingOut') : t('nav.signOut')}</span>
          </button>
          {CM_APP_VERSION && <small className="cmm-drawer__version">{t('mobile.shell.version', { version: CM_APP_VERSION })}</small>}
        </footer>
      </aside>
    </div>
  );
};
