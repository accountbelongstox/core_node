import React from 'react';
import { CircleAlert, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmCanOpenPage, cmRoleForCapability, type CmAccessRole } from '../../auth/cmPageAccess';
import type { CmPageDef } from '../../cmPages';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CM_PROTECTED_ROUTE } from '../public-home/cmPublicRoutes';
import { CmAccessNotice, type CmAccessAction } from './CmAccessNotice';

const DEPOSIT_ROLES: readonly CmAccessRole[] = ['developer'];
const APPLICATION_ROLES: readonly CmAccessRole[] = ['reviewer', 'architect'];

/**
 * Route-level capability gate for a workspace page. The server remains the
 * authority; this only avoids rendering a page the account cannot use.
 */
export const CmCapabilityGate: React.FC<{ page: CmPageDef; children: React.ReactNode }> = ({ page, children }) => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading, error, refresh, hasCapability, hasRole } = useCmBootstrap();

  if (page.capability === null) return <>{children}</>;

  if (!bootstrap) {
    if (error && !loading) {
      return (
        <CmAccessNotice
          Icon={CircleAlert}
          tone="warning"
          titleKey="access.checkFailed.title"
          bodyKey="access.checkFailed.body"
          onRetry={() => void refresh()}
        />
      );
    }
    return <div className="cm-page-fallback" role="status">{t('access.checking')}</div>;
  }

  if (cmCanOpenPage(page, hasCapability)) return <>{children}</>;

  const role = cmRoleForCapability(page.capability);
  const roleLabel = role ? t(`roles.${role}`) : '';
  const hints: string[] = [];
  const actions: CmAccessAction[] = [];
  if (role) {
    hints.push(t(`access.unavailable.howTo.${role}`));
    if (hasRole(role)) hints.push(t('access.unavailable.rolePending', { role: roleLabel }));
    if (APPLICATION_ROLES.includes(role) && !hasCapability('task.browse')) hints.push(t('access.unavailable.developerFirst'));
  }
  if (hasCapability('onboarding.read')) {
    actions.push({ key: 'verification', to: CM_PROTECTED_ROUTE.verification, label: t('access.actions.verification'), Icon: ShieldCheck, primary: true });
  }
  if (role && DEPOSIT_ROLES.includes(role) && hasCapability('finance.read')) {
    actions.push({ key: 'wallet', to: CM_PROTECTED_ROUTE.wallet, label: t('access.actions.deposit'), Icon: WalletCards });
  }

  return (
    <CmAccessNotice
      Icon={LockKeyhole}
      titleKey="access.unavailable.title"
      bodyKey={role ? 'access.unavailable.body' : 'access.unavailable.bodyGeneric'}
      bodyValues={{ page: t(page.labelKey), role: roleLabel }}
      hints={hints}
      actions={actions}
      back={{ to: CM_PROTECTED_ROUTE.dashboard, label: t('access.actions.dashboard') }}
    />
  );
};

export default CmCapabilityGate;
