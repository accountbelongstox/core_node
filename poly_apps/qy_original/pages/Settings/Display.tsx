
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
       <SettingItem label="Theme Mode" value={settings.display.theme === 'light' ? 'Light' : 'Dark'} type="toggle" active={settings.display.theme === 'dark'} onClick={toggleTheme} />
       <SettingItem label="Font Size" value={settings.display.fontSize} />
       
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Reading Card</div>
       <SettingItem label="Show Phonetic" type="toggle" active={settings.display.showPhonetic} onClick={() => updateSettings({ display: { ...settings.display, showPhonetic: !settings.display.showPhonetic } })} />
       <SettingItem label="Show Translation" type="toggle" active={settings.display.showTranslation} onClick={() => updateSettings({ display: { ...settings.display, showTranslation: !settings.display.showTranslation } })} />
       <SettingItem label="Animations" type="toggle" active={settings.display.enableAnimations} onClick={() => updateSettings({ display: { ...settings.display, enableAnimations: !settings.display.enableAnimations } })} />
    </SettingsLayout>
  );
};

export default DisplaySettings;
