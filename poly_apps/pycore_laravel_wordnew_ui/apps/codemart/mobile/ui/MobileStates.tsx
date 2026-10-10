import React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { MobileButton } from './MobileButton';
import { MobileSkeletonList } from './MobileSkeleton';

export const MobileEmptyState: React.FC<{ title: string; body?: string; action?: React.ReactNode; icon?: React.ReactNode }> = ({ title, body, action, icon }) => (
  <div className="cmm-state">
    <span className="cmm-state__icon">{icon ?? <Inbox aria-hidden="true" />}</span>
    <h2>{title}</h2>
    {body && <p>{body}</p>}
    {action && <div className="cmm-state__action">{action}</div>}
  </div>
);

export const MobileErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const { t } = useTranslation('cm');
  return (
    <div className="cmm-state is-error" role="alert">
      <span className="cmm-state__icon"><AlertTriangle aria-hidden="true" /></span>
      <h2>{t('common.errorTitle')}</h2>
      <p>{message}</p>
      {onRetry && <div className="cmm-state__action"><MobileButton icon={<RefreshCw aria-hidden="true" />} onClick={onRetry}>{t('common.retry')}</MobileButton></div>}
    </div>
  );
};

interface MobileListStateProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  skeletonRows?: number;
  children: React.ReactNode;
}

/** Skeleton while loading, error with retry, empty state, otherwise the list. */
export const MobileListState: React.FC<MobileListStateProps> = ({ loading, error, empty, emptyTitle, emptyBody, emptyAction, onRetry, skeletonRows, children }) => {
  if (loading) return <MobileSkeletonList rows={skeletonRows} />;
  if (error) return <MobileErrorState message={error} onRetry={onRetry} />;
  if (empty) return <MobileEmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />;
  return <>{children}</>;
};
