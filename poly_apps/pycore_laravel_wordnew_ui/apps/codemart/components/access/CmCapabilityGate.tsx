import React from 'react';
import { CircleAlert, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmCanOpenPage } from '../../auth/cmPageAccess';
import type { CmPageDef } from '../../cmPages';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CM_PROTECTED_ROUTE } from '../public-home/cmPublicRoutes';
import { CmAccessNotice, type CmAccessAction } from './CmAccessNotice';

/**
 * Route-level capability gate for a workspace page. The server remains the
 * authority; this only avoids rendering a page the account cannot use.
 */
export const CmCapabilityGate: React.FC<{ page: CmPageDef; children: React.ReactNode }> = ({ page, children }) => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading, error, refresh, hasCapability, hasRole, roleForCapability } = useCmBootstrap();

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

  const role = roleForCapability(page.capability);
  const roleLabel = role ? t(`roles.${role}`) : '';
  const hints: string[] = [];
  const actions: CmAccessAction[] = [];
  if (role) {
    hints.push(t(`access.unavailable.howTo.${role}`));
    if (hasRole(role)) hints.push(t('access.unavailable.rolePending', { role: roleLabel }));
    if (page.applyCapability !== undefined && !hasCapability(page.applyCapability)) hints.push(t('access.unavailable.developerFirst'));
  }
  if (hasCapability('onboarding.read')) {
    actions.push({ key: 'verification', to: CM_PROTECTED_ROUTE.verification, label: t('access.actions.verification'), Icon: ShieldCheck, primary: true });
  }
  const depositAmount = role ? Number(bootstrap.vocabulary.policy.deposit_amounts?.[role] ?? 0) : 0;
  if (depositAmount > 0 && hasCapability('finance.read')) {
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
