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
    </div>
  );
};

export default SettingsIndex;
