
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';

const NotificationSettings = () => {
  const { settings, updateSettings } = useContext(AppContext);

  const toggleDaily = () => updateSettings({ notifications: { ...settings.notifications, dailyReminder: !settings.notifications.dailyReminder } });

  return (
    <SettingsLayout title="Notifications">
       <SettingItem label="Daily Reminder" type="toggle" active={settings.notifications.dailyReminder} onClick={toggleDaily} />
       {settings.notifications.dailyReminder && (
           <SettingItem label="Reminder Time" value={settings.notifications.reminderTime} />
       )}
       <SettingItem label="Review Alerts" type="toggle" active={settings.notifications.reviewReminder} onClick={() => updateSettings({ notifications: { ...settings.notifications, reviewReminder: !settings.notifications.reviewReminder } })} />
       <SettingItem label="Achievement Badges" type="toggle" active={true} />
       <SettingItem label="New Course Alerts" type="toggle" active={false} />
    </SettingsLayout>
  );
};

export default NotificationSettings;
