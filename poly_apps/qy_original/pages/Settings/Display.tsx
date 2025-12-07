import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';

const DisplaySettings = () => {
  const { settings, updateSettings } = useContext(AppContext);
  
  const toggleTheme = () => {
      const next = settings.display.theme === 'light' ? 'dark' : 'light';
      updateSettings({ display: { ...settings.display, theme: next } });
  };

  return (
    <SettingsLayout title="Display & Theme">
       <div className="settings-section-title">Appearance</div>
       <div className="settings-glass-group">
         <SettingItem label="Theme Mode" value={settings.display.theme === 'light' ? 'Light' : 'Dark'} type="toggle" active={settings.display.theme === 'dark'} onClick={toggleTheme} />
         <SettingItem label="Font Size" value={settings.display.fontSize} />
       </div>
       
       <div className="settings-section-title">Reading Experience</div>
       <div className="settings-glass-group">
         <SettingItem label="Show Phonetic" type="toggle" active={settings.display.showPhonetic} onClick={() => updateSettings({ display: { ...settings.display, showPhonetic: !settings.display.showPhonetic } })} />
         <SettingItem label="Show Translation" type="toggle" active={settings.display.showTranslation} onClick={() => updateSettings({ display: { ...settings.display, showTranslation: !settings.display.showTranslation } })} />
         <SettingItem label="Animations" type="toggle" active={settings.display.enableAnimations} onClick={() => updateSettings({ display: { ...settings.display, enableAnimations: !settings.display.enableAnimations } })} />
       </div>
    </SettingsLayout>
  );
};

export default DisplaySettings;