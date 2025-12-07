import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';
import { api } from '../../services/api';
import { SupportedLanguage } from '../../types';

const LanguageSettings = () => {
  const { settings, updateSettings, user, setUser } = useContext(AppContext);
  const [langs, setLangs] = useState<SupportedLanguage[]>([]);
  
  useEffect(() => { api.getSupportedLanguages().then(setLangs) }, []);

  const toggleLearningLang = (code: string) => {
      if (!user) return;
      let newLangs = [...(user.learningLanguages || [])];
      if (newLangs.includes(code)) {
          newLangs = newLangs.filter(l => l !== code);
      } else {
          newLangs.push(code);
      }
      setUser({ ...user, learningLanguages: newLangs });
  };

  return (
    <SettingsLayout title="Language & Audio">
      <div className="settings-section-title">App Interface</div>
      <div className="settings-glass-group">
        {langs.map(l => (
          <SettingItem key={`ui-${l.code}`} label={l.name} value={l.flag} type="radio" 
             onClick={() => { updateSettings({ language: { ...settings.language, appInterface: l.code }}); api.setLanguage(l.code); }} 
             active={settings.language.appInterface === l.code} 
          />
        ))}
      </div>
      
      <div className="settings-section-title">Target Languages</div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {langs.map(l => {
            const isActive = user?.learningLanguages?.includes(l.code);
            return (
                <div 
                  key={`learn-${l.code}`} 
                  onClick={() => toggleLearningLang(l.code)}
                  className={`
                    p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all duration-300
                    ${isActive ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 dark:bg-slate-800/50 border-white/20 dark:border-white/10 hover:bg-white/10'}
                  `}
                >
                    <span className="text-2xl">{l.flag}</span>
                    <span className="font-bold text-sm">{l.name}</span>
                    {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-white shadow-lg"></div>}
                </div>
            )
        })}
      </div>

      <div className="settings-section-title">Audio Engine</div>
      <div className="settings-glass-group">
        <SettingItem label="Accent" value={settings.audio.voiceEngine} />
        <SettingItem label="Speed" value={`${settings.audio.speed}x`} />
        <SettingItem label="Provider" value={settings.audio.ttsProvider.toUpperCase()} />
        <SettingItem label="Auto Play" type="toggle" active={settings.audio.autoPlay} onClick={() => updateSettings({ audio: { ...settings.audio, autoPlay: !settings.audio.autoPlay } })} />
      </div>
    </SettingsLayout>
  );
};

export default LanguageSettings;