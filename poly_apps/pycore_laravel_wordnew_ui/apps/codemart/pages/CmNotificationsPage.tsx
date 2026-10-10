import React from 'react';
import { ArrowRight, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { useCmNotifications } from '../shared/useCmNotifications';

export const CmNotificationsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { list, unreadCount, busy, present, isRead, markRead, markAll, open, goToPage } = useCmNotifications(notice);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="notifications.eyebrow"
        titleKey="nav.notifications"
        purposeKey="notifications.description"
        actions={(
          <>
            <button type="button" className="cm-workspace-button" onClick={() => void list.reload()} disabled={list.loading}>
              <RefreshCw aria-hidden="true" /> {t('common.refresh')}
            </button>
            <button type="button" className="cm-workspace-button is-primary" onClick={() => void markAll()} disabled={busy || unreadCount === 0}>
              <CheckCheck aria-hidden="true" /> {t('notifications.markAllRead')}
            </button>
          </>
        )}
      />
      <p className="cm-inline-summary">{unreadCount > 0 ? t('notifications.unreadSummary', { count: unreadCount }) : t('notifications.allReadSummary')}</p>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />
      ) : list.items.length === 0 ? (
        <CmEmptyState title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />
      ) : (
        <section className="cm-notification-list" aria-label={t('nav.notifications')}>
          {list.items.map((notification) => {
            const view = present(notification);
            const read = isRead(notification);
            return (
              <article key={notification.id} className={`cm-notification ${read ? '' : 'is-unread'}`}>
                <span className="cm-notification__dot" aria-hidden="true" />
                <div className="cm-notification__body">
                  <h2>
                    {view.title}
                    {!read && <span className="cm-visually-hidden">{t('notifications.unreadLabel')}</span>}
                  </h2>
                  {notification.body_key && <p>{view.body}</p>}
                  {view.notes.map((note) => <p key={note} className="cm-notification__note">{note}</p>)}
                  <time dateTime={view.createdAt ?? undefined}>{view.time}</time>
                </div>
                <div className="cm-notification__actions">
                  {view.link && (
                    <button type="button" className="cm-workspace-button is-small" onClick={() => void open(notification)}>
                      {t('notifications.open')} <ArrowRight aria-hidden="true" />
                    </button>
                  )}
                  {!read && (
                    <button type="button" className="cm-workspace-button is-small" onClick={() => void markRead(notification.id)} aria-label={t('notifications.markRead')}>
                      <Check aria-hidden="true" /> {t('notifications.markRead')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={goToPage} />
    </main>
  );
};

export default CmNotificationsPage;
