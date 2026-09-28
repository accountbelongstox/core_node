import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmNotification, CmPage } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { cmNotificationLink, cmNotificationParams } from '../components/workspace/cmNotificationFormat';
import { cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList } from '../components/workspace/useCmPagedList';

const NOTE_PARAM_KEYS = ['reason', 'notes'] as const;
const MONEY_PARAM_KEYS = ['amount', 'gross', 'commission'] as const;

const fetchNotifications = (page: number) => cmApi.getNotifications(page);
const extractNotifications = (data: CmPage<CmNotification>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

export const CmNotificationsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const navigate = useNavigate();
  const { bootstrap, unreadCount, refreshUnread } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? null;
  const notice = useCmNotice();
  const list = useCmPagedList(fetchNotifications, extractNotifications, 'notifications.loadFailed');
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const isRead = useCallback((item: CmNotification): boolean => item.read || readIds.has(item.id), [readIds]);

  const markRead = async (notificationId: number): Promise<void> => {
    const response = await cmApi.markNotificationRead(notificationId);
    if (response.success) {
      setReadIds((current) => new Set(current).add(notificationId));
      await refreshUnread();
    } else {
      notice.error(cmErrorMessage(t, response, 'notifications.markFailed'));
    }
  };

  const markAll = async (): Promise<void> => {
    setBusy(true);
    notice.clear();
    const response = await cmApi.markAllNotificationsRead();
    setBusy(false);
    if (response.success) {
      notice.success(t('notifications.allMarked'));
      setReadIds(new Set());
      await list.reload();
      await refreshUnread();
    } else {
      notice.error(cmErrorMessage(t, response, 'notifications.markFailed'));
    }
  };

  const open = async (notification: CmNotification, link: string): Promise<void> => {
    if (!isRead(notification)) await markRead(notification.id);
    navigate(link);
  };

  const paramsFor = (notification: CmNotification): Record<string, unknown> => {
    const params = cmNotificationParams(t, notification);
    MONEY_PARAM_KEYS.forEach((key) => {
      const value = params[key];
      if ((typeof value === 'string' || typeof value === 'number') && value !== '' && Number.isFinite(Number(value))) {
        params[key] = format.money(value, currency);
      }
    });
    return params;
  };

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
        <CmErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : list.items.length === 0 ? (
        <CmEmptyState title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />
      ) : (
        <section className="cm-notification-list" aria-label={t('nav.notifications')}>
          {list.items.map((notification) => {
            const params = paramsFor(notification);
            const link = cmNotificationLink(notification);
            const read = isRead(notification);
            return (
              <article key={notification.id} className={`cm-notification ${read ? '' : 'is-unread'}`}>
                <span className="cm-notification__dot" aria-hidden="true" />
                <div className="cm-notification__body">
                  <h2>
                    {t(notification.title_key, { ...params, defaultValue: t('notifications.fallbackTitle') })}
                    {!read && <span className="cm-visually-hidden">{t('notifications.unreadLabel')}</span>}
                  </h2>
                  {notification.body_key && <p>{t(notification.body_key, { ...params, defaultValue: '' })}</p>}
                  {NOTE_PARAM_KEYS.map((key) => (
                    typeof params[key] === 'string' && params[key] !== '' && (
                      <p key={key} className="cm-notification__note">{t(`notifications.${key}Line`, { value: params[key] })}</p>
                    )
                  ))}
                  <time dateTime={notification.created_at ?? undefined}>{format.dateTime(notification.created_at)}</time>
                </div>
                <div className="cm-notification__actions">
                  {link && (
                    <button type="button" className="cm-workspace-button is-small" onClick={() => void open(notification, link)}>
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
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => { setReadIds(new Set()); void list.load(next); }} />
    </main>
  );
};

export default CmNotificationsPage;
