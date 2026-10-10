import React from 'react';
import { CheckCheck } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmNotifications } from '../../../shared/useCmNotifications';
import {
  MobileList,
  MobileListRow,
  MobileListState,
  MobilePager,
  MobileScreen,
  useMobileFeedback,
} from '../../ui';

/** Mobile notifications: unread-first list, tap to mark read and open the linked screen, mark-all in the bar. */
const MobileNotificationsScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const { hasCapability } = useCmBootstrap();
  const { list, unreadCount, busy, present, isRead, markAll, open, goToPage } = useCmNotifications(feedback);

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
          {list.items.map((notification) => {
            const view = present(notification);
            const read = isRead(notification);
            return (
              <MobileListRow
                key={notification.id}
                unread={!read}
                title={view.title}
                subtitle={[view.body, ...view.notes].filter(Boolean).join(' · ') || undefined}
                meta={view.time}
                onClick={() => void open(notification)}
                chevron={Boolean(view.link)}
              />
            );
          })}
        </MobileList>
        <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={goToPage} />
      </MobileListState>
    </MobileScreen>
  );
};

export default MobileNotificationsScreen;
