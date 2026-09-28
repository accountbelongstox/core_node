import React from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CmNotice } from '../workspace/CmStateViews';

/** Non-blocking notice for a failed bootstrap refresh while the last loaded state stays on screen. */
export const CmBootstrapRefreshNotice: React.FC = () => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading, error, refresh } = useCmBootstrap();
  if (!bootstrap || !error || loading) return null;
  return (
    <div className="cm-workspace-page cm-refresh-notice">
      <CmNotice notice={{ tone: 'error', text: t('access.refreshFailed') }} onRetry={() => void refresh()} />
    </div>
  );
};

export default CmBootstrapRefreshNotice;
