
import React, { useState, useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationProps> = ({ notification, onClose }) => {
  useEffect(() => {
    const duration = notification.duration || 3000;
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [notification.id, notification.duration, onClose]);

  const colors = {
    success: 'bg-[#05ffa1]/20 border-[#05ffa1]/50 text-[#05ffa1]',
    error: 'bg-[#ff2a6d]/20 border-[#ff2a6d]/50 text-[#ff2a6d]',
    warning: 'bg-[#ffd60a]/20 border-[#ffd60a]/50 text-[#ffd60a]',
    info: 'bg-[#00f2ff]/20 border-[#00f2ff]/50 text-[#00f2ff]'
  };

  const icons = {
    success: 'ph-check-circle',
    error: 'ph-x-circle',
    warning: 'ph-warning',
    info: 'ph-info'
  };

  return (
    <div
      className={`
        glass-panel border rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg
        animate-[slideIn_0.3s_ease-out] min-w-[300px] max-w-[500px]
        ${colors[notification.type]}
      `}
    >
      <i className={`ph ${icons[notification.type]} text-lg flex-shrink-0`}></i>
      <span className="flex-1 text-sm font-medium">{notification.message}</span>
      <button
        onClick={() => onClose(notification.id)}
        className="text-current/60 hover:text-current transition-colors flex-shrink-0"
      >
        <i className="ph ph-x text-sm"></i>
      </button>
    </div>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map(notification => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

// Hook for managing notifications
let notificationIdCounter = 0;

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = (type: NotificationType, message: string, duration?: number) => {
    const id = `notification-${Date.now()}-${notificationIdCounter++}`;
    const notification: Notification = { id, type, message, duration };
    setNotifications(prev => [...prev, notification]);
    return id;
  };

  const closeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const closeAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    showNotification,
    closeNotification,
    closeAll,
    NotificationContainer: () => (
      <NotificationContainer notifications={notifications} onClose={closeNotification} />
    )
  };
};

