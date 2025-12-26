<<<<<<< HEAD

import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingItem } from './Layout';
import { Button } from '../../components/UI';

const SettingsIndex = () => {
  const { navigate, user, logout } = useContext(AppContext);
  return (
    <div className="h-full flex flex-col p-4 pt-12 animate-slide-up pb-24">
       <h1 className="text-3xl font-bold mb-6 dark:text-white">Settings</h1>
       
       <div className="glass-card p-4 rounded-xl flex items-center gap-4 mb-8 cursor-pointer hover:bg-white/50" onClick={() => navigate('profile')}>
         <img src={user?.avatar} className="w-16 h-16 rounded-full border-2 border-white" />
         <div>
            <div className="font-bold text-lg dark:text-white">{user?.name}</div>
            <div className="text-blue-500 text-sm font-semibold">{user?.isPro ? 'PRO Account' : 'Free Plan'}</div>
         </div>
       </div>

       <div className="space-y-3">
         <SettingItem label="Language & Audio" value="En, 1.0x" onClick={() => navigate('settings_lang')} />
         <SettingItem label="Learning Goals" value="20/day" onClick={() => navigate('settings_learning')} />
         <SettingItem label="Display & Theme" value="Light" onClick={() => navigate('settings_display')} />
         <SettingItem label="Notifications" value="On" onClick={() => navigate('settings_notifications')} />
         <SettingItem label="Data & Sync" value="Backup On" onClick={() => navigate('settings_data')} />
         <SettingItem label="Privacy & Security" value="" onClick={() => navigate('settings_privacy')} />
         <SettingItem label="About" value="v1.0.0" onClick={() => navigate('settings_about')} />
       </div>

       <Button variant="secondary" className="mt-8 text-red-500 border-red-200 hover:bg-red-50" onClick={logout}>Sign Out</Button>
=======
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingItem } from './Layout';
import { Button, Icons } from '../../components/UI';

const SettingsIndex = () => {
  const { navigate, user, logout } = useContext(AppContext);
  
  return (
    <div className="settings-page animate-slide-up">
       <div className="settings-header-fixed">
           <div className="settings-header-capsule">
               <button onClick={() => navigate('home')} className="settings-close-btn">
                   <Icons.Close />
               </button>
               <span className="settings-header-title">Settings</span>
               <div className="settings-header-spacer"></div>
           </div>
       </div>
       
       <div className="settings-list-container">
         {/* Profile Section */}
         <div 
            className="settings-profile-card" 
            onClick={() => navigate('profile')}
         >
           <img src={user?.avatar} className="settings-profile-avatar" alt={user?.name} />
           <div className="settings-profile-info">
              <div className="settings-profile-name">{user?.name}</div>
              <div className={`settings-profile-badge ${user?.isPro ? 'pro' : 'free'}`}>
                  {user?.isPro ? 'PRO MEMBER' : 'FREE PLAN'}
              </div>
           </div>
           <Icons.ChevronRight />
         </div>

         <div className="aurora-settings-group">
           <div className="settings-section-label">PREFERENCES</div>
           <SettingItem label="Language & Audio" value="EN" onClick={() => navigate('settings_lang')} />
           <SettingItem label="Learning Goals" value="20/DAY" onClick={() => navigate('settings_learning')} />
           <SettingItem label="Display & Theme" value="AUTO" onClick={() => navigate('settings_display')} />
         </div>
           
         <div className="aurora-settings-group settings-group-spaced">
           <div className="settings-section-label">SYSTEM</div>
           <SettingItem label="Notifications" value="ON" onClick={() => navigate('settings_notifications')} />
           <SettingItem label="Data & Sync" value="ACTIVE" onClick={() => navigate('settings_data')} />
           <SettingItem label="About" value="V1.0" onClick={() => navigate('settings_about')} />
         </div>

         <div className="settings-signout-section">
            <Button variant="danger" onClick={logout} className="settings-signout-btn">Sign Out</Button>
            <p className="settings-user-id">ID: {user?.id}</p>
         </div>
       </div>
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    </div>
  );
};

export default SettingsIndex;
