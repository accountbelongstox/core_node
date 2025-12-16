
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { SettingsLayout, SettingItem } from './Layout';
import { api } from '../../services/api';
import { SupportedLanguage } from '../../types';
import { LanguageCenter } from '../../i18n/LanguageCenter';

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
      // Assuming setUser updates the global user object immediately for UI
      setUser({ ...user, learningLanguages: newLangs });
      // In a real app, we'd also call api.updateProfile({ learningLanguages: newLangs })
  };

  return (
    <SettingsLayout title="Language & Audio">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2 mb-2 pl-2">App Interface</div>
      {langs.map(l => (
        <SettingItem key={`ui-${l.code}`} label={l.name} value={l.flag} type="radio" 
           onClick={() => {
             updateSettings({ language: { ...settings.language, appInterface: l.code } });
             api.setLanguage(l.code);
             LanguageCenter.setLanguage(l.code as any);
             window.location.reload();
           }} 
           active={settings.language.appInterface === l.code} 
        />
      ))}
      
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Languages to Learn (Multi-select)</div>
      <div className="grid grid-cols-2 gap-3 px-5 mb-4">
        {langs.map(l => {
            const isActive = user?.learningLanguages?.includes(l.code);
            return (
                <div 
                  key={`learn-${l.code}`} 
                  onClick={() => toggleLearningLang(l.code)}
                  className={`
                    p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all duration-300
                    ${isActive ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/50 dark:bg-slate-800/50 border-white/40 dark:border-slate-700 hover:bg-white/80'}
                  `}
                >
                    <span className="text-2xl">{l.flag}</span>
                    <span className="font-bold text-sm">{l.name}</span>
                    {isActive && <div className="ml-auto text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">✓</div>}
                </div>
            )
        })}
      </div>

      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2 pl-2">Audio Engine</div>
      <SettingItem label="Accent" value={settings.audio.voiceEngine} />
      <SettingItem label="Speed" value={`${settings.audio.speed}x`} />
      <SettingItem label="Provider" value={settings.audio.ttsProvider.toUpperCase()} />
      <SettingItem label="Auto Play" type="toggle" active={settings.audio.autoPlay} onClick={() => updateSettings({ audio: { ...settings.audio, autoPlay: !settings.audio.autoPlay } })} />
    </SettingsLayout>
  );
};

export default LanguageSettings;
