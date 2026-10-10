import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import type { CmNotification } from '../../../api/CmApiTypes';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmNotifications } from '../../../shared/useCmNotifications';
import {
  MobileList,
  MobileListState,
  MobilePager,
  MobileScreen,
  useMobileFeedback,
} from '../../ui';

/** Mobile notifications: unread-first rows, tap to mark read and open the linked screen, check button and mark-all in the bar. */
const MobileNotificationsScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const { hasCapability } = useCmBootstrap();
  const { list, unreadCount, busy, present, isRead, markRead, markAll, open, goToPage } = useCmNotifications(feedback);

  const renderRow = (notification: CmNotification): React.ReactNode => {
    const view = present(notification);
    const read = isRead(notification);
    const detail = [view.body, ...view.notes].filter(Boolean).join(' · ');
    return (
      <div className={`cmm-a-notice ${read ? '' : 'is-unread'}`}>
        <button type="button" className="cmm-a-notice__main" onClick={() => void open(notification)}>
          <span className="cmm-a-notice__title">
            {view.title}
            {!read && <span className="cmm-a-sr">{t('notifications.unreadLabel')}</span>}
          </span>
          {detail && <span className="cmm-a-notice__detail">{detail}</span>}
          <time className="cmm-a-notice__time" dateTime={view.createdAt ?? undefined}>{view.time}</time>
        </button>
        {!read && (
          <button type="button" className="cmm-icon-btn" onClick={() => void markRead(notification.id)} aria-label={t('notifications.markRead')}>
            <Check aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <MobileScreen
      title={t('nav.notifications')}
      onRefresh={() => list.reload()}
      actions={hasCapability('notification.read') && (
        <button type="button" className="cmm-icon-btn" onClick={() => void markAll()} disabled={busy || unreadCount === 0} aria-label={t('notifications.markAllRead')}>
          <CheckCheck aria-hidden="true" />
        </button>
      )}
    >
      <p className="cmm-summary">{unreadCount > 0 ? t('notifications.unreadSummary', { count: unreadCount }) : t('notifications.allReadSummary')}</p>
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={t('notifications.emptyTitle')}
        emptyBody={t('notifications.emptyBody')}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <MobileList label={t('nav.notifications')}>
          {list.items.map((notification) => <React.Fragment key={notification.id}>{renderRow(notification)}</React.Fragment>)}
        </MobileList>
        <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={goToPage} />
      </MobileListState>
    </MobileScreen>
  );
};

export default MobileNotificationsScreen;
