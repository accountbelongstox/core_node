import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmNotification } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

export const CmNotificationsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const [notifications, setNotifications] = useState<CmNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getNotifications();
    if (response.success && response.data) {
      setNotifications(Array.isArray(response.data.items) ? response.data.items : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (notificationId: number): Promise<void> => {
    await cmApi.markNotificationRead(notificationId);
    await load();
    await refresh();
  };

  const markAll = async (): Promise<void> => {
    await cmApi.markAllNotificationsRead();
    await load();
    await refresh();
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('notifications.eyebrow')}</span>
        <h1>{t('nav.notifications')}</h1>
        <p>{t('notifications.description')}</p>
        <div className="cm-page-heading__actions">
          <button type="button" className="cm-workspace-button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
          <button type="button" className="cm-workspace-button" onClick={() => void markAll()}>
            <CheckCheck aria-hidden="true" /> {t('notifications.markAllRead')}
          </button>
        </div>
      </header>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : notifications.length === 0 ? (
        <section className="cm-marketplace-empty">
          <Bell aria-hidden="true" />
          <h2>{t('notifications.emptyTitle')}</h2>
          <p>{t('notifications.emptyBody')}</p>
        </section>
      ) : (
        <section className="cm-card-list">
          {notifications.map((notification) => (
            <article key={notification.id} className={`cm-record-card ${notification.read ? '' : 'is-unread'}`}>
              <div className="cm-record-card__main">
                <h2>{t(notification.title_key, notification.params ?? {})}</h2>
                {notification.body_key && <p>{t(notification.body_key, notification.params ?? {})}</p>}
                <div className="cm-record-card__meta">
                  <span>{notification.created_at ? notification.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                </div>
              </div>
              {!notification.read && (
                <button type="button" className="cm-workspace-button" onClick={() => void markRead(notification.id)}>
                  {t('notifications.markRead')}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default CmNotificationsPage;
