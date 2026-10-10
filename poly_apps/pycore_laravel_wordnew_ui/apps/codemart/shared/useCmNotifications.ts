import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmNotification, CmPage } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { cmNotificationBodyKey, cmNotificationLink, cmNotificationParams } from '../components/workspace/cmNotificationFormat';
import { cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import type { CmFeedback } from './cmFeedback';

const NOTE_PARAM_KEYS = ['reason', 'notes'] as const;
const MONEY_PARAM_KEYS = ['amount', 'gross', 'commission'] as const;

const fetchNotifications = (page: number) => cmApi.getNotifications(page);
const extractNotifications = (data: CmPage<CmNotification>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

export interface CmNotificationView {
  id: number;
  title: string;
  body: string | null;
  notes: string[];
  link: string | null;
  createdAt: string | null;
  time: string;
}

/** Localized title, body, notes and in-app link of a notification; the one rendering rule for both UIs. */
export function useCmNotificationPresenter(): (notification: CmNotification) => CmNotificationView {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, hasCapability } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? null;
  const canOpenTasks = hasCapability('task.read');

  return useCallback((notification) => {
    const params = cmNotificationParams(t, notification);
    MONEY_PARAM_KEYS.forEach((key) => {
      const value = params[key];
      if ((typeof value === 'string' || typeof value === 'number') && value !== '' && Number.isFinite(Number(value))) {
        params[key] = format.money(value, currency);
      }
    });
    const bodyKey = notification.body_key ? cmNotificationBodyKey(notification.body_key, params) : null;
    return {
      id: notification.id,
      title: t(notification.title_key, { ...params, defaultValue: t('notifications.fallbackTitle') }),
      body: bodyKey ? t(bodyKey, { ...params, defaultValue: '' }) : null,
      notes: NOTE_PARAM_KEYS.flatMap((key) => (
        typeof params[key] === 'string' && params[key] !== '' ? [t(`notifications.${key}Line`, { value: params[key] })] : []
      )),
      link: cmNotificationLink(notification, canOpenTasks),
      createdAt: notification.created_at,
      time: format.dateTime(notification.created_at),
    };
  }, [t, format, currency, canOpenTasks]);
}

export interface CmNotificationsModel {
  list: CmPagedList<CmNotification>;
  unreadCount: number;
  busy: boolean;
  present: (notification: CmNotification) => CmNotificationView;
  isRead: (notification: CmNotification) => boolean;
  markRead: (notificationId: number) => Promise<void>;
  markAll: () => Promise<void>;
  open: (notification: CmNotification) => Promise<void>;
  goToPage: (page: number) => void;
}

/** Notification list with read state, mark-read actions and deep-link opening. */
export function useCmNotifications(feedback: CmFeedback): CmNotificationsModel {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const { unreadCount, refreshUnread } = useCmBootstrap();
  const present = useCmNotificationPresenter();
  const list = useCmPagedList(fetchNotifications, extractNotifications, 'notifications.loadFailed');
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const isRead = useCallback((item: CmNotification): boolean => item.read || readIds.has(item.id), [readIds]);

  const markRead = useCallback(async (notificationId: number): Promise<void> => {
    const response = await cmApi.markNotificationRead(notificationId);
    if (response.success) {
      setReadIds((current) => new Set(current).add(notificationId));
      await refreshUnread();
    } else {
      feedback.error(cmErrorMessage(t, response, 'notifications.markFailed'));
    }
  }, [feedback, refreshUnread, t]);

  const markAll = useCallback(async (): Promise<void> => {
    setBusy(true);
    feedback.clear();
    const response = await cmApi.markAllNotificationsRead();
    setBusy(false);
    if (response.success) {
      feedback.success(t('notifications.allMarked'));
      setReadIds(new Set());
      await list.reload();
      await refreshUnread();
    } else {
      feedback.error(cmErrorMessage(t, response, 'notifications.markFailed'));
    }
  }, [feedback, list, refreshUnread, t]);

  const open = useCallback(async (notification: CmNotification): Promise<void> => {
    if (!isRead(notification)) await markRead(notification.id);
    navigate(present(notification).link ?? CM_PROTECTED_ROUTE.notifications);
  }, [isRead, markRead, navigate, present]);

  const goToPage = useCallback((page: number): void => {
    setReadIds(new Set());
    void list.load(page);
  }, [list]);

  return { list, unreadCount, busy, present, isRead, markRead, markAll, open, goToPage };
}
