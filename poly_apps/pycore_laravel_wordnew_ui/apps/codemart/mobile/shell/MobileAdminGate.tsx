import React from 'react';
import { Outlet } from 'react-router-dom';
import { CircleAlert, LockKeyhole } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmAccessNotice } from '../../components/access/CmAccessNotice';
import { CM_PROTECTED_ROUTE } from '../../components/public-home/cmPublicRoutes';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { MobileSkeletonList } from '../ui/MobileSkeleton';

/** Admin-lite screens render only for administrators; everyone else gets the localized access-denied notice. */
export const MobileAdminGate: React.FC = () => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading, error, refresh } = useCmBootstrap();

  if (!bootstrap && (loading || !error)) return <MobileSkeletonList rows={3} />;
  if (!bootstrap?.is_admin) {
    return (
      <CmAccessNotice
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
  return <Outlet />;
};
