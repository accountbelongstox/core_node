
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';
import { LanguageCenter, SupportedLanguage } from '../../i18n/LanguageCenter';
import { api } from '../../services/api';

const DisplaySettings = () => {
  const { settings, updateSettings } = useContext(AppContext);
  
  const toggleTheme = () => {
      const next = settings.display.theme === 'light' ? 'dark' : 'light';
      updateSettings({ display: { ...settings.display, theme: next } });
  };

  const handleInterfaceLanguageChange = (lang: SupportedLanguage) => {
    // Update settings
    updateSettings({ language: { ...settings.language, appInterface: lang } });
    
    // Update LanguageCenter
    LanguageCenter.setLanguage(lang);
    
    // Update API
    api.setLanguage(lang);
    
    // Reload page to apply language changes
    window.location.reload();
  };

  const currentInterfaceLang = Array.isArray(settings.language.appInterface)
    ? settings.language.appInterface[0] || 'en'
    : (settings.language.appInterface || 'en');
  
  const supportedLanguages = LanguageCenter.getSupportedLanguages();

  return (
    <SettingsLayout title="Display & Theme">
       <SettingItem label="Theme Mode" value={settings.display.theme === 'light' ? 'Light' : 'Dark'} type="toggle" active={settings.display.theme === 'dark'} onClick={toggleTheme} />
       <SettingItem label="Font Size" value={settings.display.fontSize} />
       
       <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-6 mb-4 pl-2">
         App Interface Language
       </div>
       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-8">
         {supportedLanguages.map(lang => {
           const isActive = currentInterfaceLang === lang.code;
           return (
             <div
               key={`interface-${lang.code}`}
               onClick={() => handleInterfaceLanguageChange(lang.code)}
               className={`
                 relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300
                 flex flex-col items-center justify-center gap-2 min-h-[100px]
                 ${isActive
                   ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                   : 'bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-700/60 hover:scale-105'
                 }
               `}
             >
               <span className="text-3xl">{lang.flag}</span>
               <span className={`font-bold text-xs text-center leading-tight ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                 {lang.nativeName}
               </span>
               {isActive && (
                 <div className="absolute top-2 right-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                   <span className="text-white text-xs">✓</span>
                 </div>
               )}
             </div>
           );
         })}
       </div>
       
       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Reading Card</div>
       <SettingItem label="Show Phonetic" type="toggle" active={settings.display.showPhonetic} onClick={() => updateSettings({ display: { ...settings.display, showPhonetic: !settings.display.showPhonetic } })} />
       <SettingItem label="Show Translation" type="toggle" active={settings.display.showTranslation} onClick={() => updateSettings({ display: { ...settings.display, showTranslation: !settings.display.showTranslation } })} />
       <SettingItem label="Animations" type="toggle" active={settings.display.enableAnimations} onClick={() => updateSettings({ display: { ...settings.display, enableAnimations: !settings.display.enableAnimations } })} />
    </SettingsLayout>
  );
};

export default DisplaySettings;
