<<<<<<< HEAD

=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';

const NotificationSettings = () => {
  const { settings, updateSettings } = useContext(AppContext);

  const toggleDaily = () => updateSettings({ notifications: { ...settings.notifications, dailyReminder: !settings.notifications.dailyReminder } });

  return (
    <SettingsLayout title="Notifications">
<<<<<<< HEAD
       <SettingItem label="Daily Reminder" type="toggle" active={settings.notifications.dailyReminder} onClick={toggleDaily} />
       {settings.notifications.dailyReminder && (
           <SettingItem label="Reminder Time" value={settings.notifications.reminderTime} />
       )}
       <SettingItem label="Review Alerts" type="toggle" active={settings.notifications.reviewReminder} onClick={() => updateSettings({ notifications: { ...settings.notifications, reviewReminder: !settings.notifications.reviewReminder } })} />
       <SettingItem label="Achievement Badges" type="toggle" active={true} />
       <SettingItem label="New Course Alerts" type="toggle" active={false} />
=======
       <div className="settings-section-title">Study Reminders</div>
       <div className="settings-glass-group">
         <SettingItem label="Daily Reminder" type="toggle" active={settings.notifications.dailyReminder} onClick={toggleDaily} />
         {settings.notifications.dailyReminder && (
             <SettingItem label="Reminder Time" value={settings.notifications.reminderTime} />
         )}
         <SettingItem label="Review Alerts" type="toggle" active={settings.notifications.reviewReminder} onClick={() => updateSettings({ notifications: { ...settings.notifications, reviewReminder: !settings.notifications.reviewReminder } })} />
       </div>
       
       <div className="settings-section-title">Updates</div>
       <div className="settings-glass-group">
         <SettingItem label="Achievement Badges" type="toggle" active={true} />
         <SettingItem label="New Course Alerts" type="toggle" active={false} />
       </div>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    </SettingsLayout>
  );
};

<<<<<<< HEAD
export default NotificationSettings;
=======
export default NotificationSettings;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
