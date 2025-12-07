import React, { useState, useEffect } from 'react';
import { User, CreditCard, Bell, HelpCircle, LogOut, ChevronRight, Shield, Globe, Moon, Sun, Smartphone, Camera } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { PageRoutes } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { TacticalDevice } from '../services/TacticalDevice';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    // Load cached avatar on mount
    const loadAvatar = async () => {
      const cached = await TacticalDevice.getCachedIntel<string>('user_avatar');
      if (cached) {
        setAvatar(cached);
      }
    };
    loadAvatar();
  }, []);

  const handleAvatarUpdate = async () => {
    try {
      // Trigger Capacitor Camera
      const photo = await TacticalDevice.captureIntel();
      if (photo && photo.base64String) {
        const dataUrl = `data:image/jpeg;base64,${photo.base64String}`;
        setAvatar(dataUrl);
        // Cache the image
        await TacticalDevice.cacheIntel('user_avatar', dataUrl);
      }
    } catch (e) {
      console.error("Avatar update failed", e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(PageRoutes.LOGIN);
  };

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-[10px] font-mono font-bold text-tac-orange uppercase tracking-wider mb-2 px-1">{title}</h3>
      <div className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 rounded-sm divide-y divide-slate-100 dark:divide-slate-700/50 shadow-sm dark:shadow-none">
        {children}
      </div>
    </div>
  );

  const Item = ({ icon: Icon, label, value, onClick, action }: { icon: any, label: string, value?: string, onClick?: () => void, action?: React.ReactNode }) => (
    <div onClick={onClick} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-black/5 transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-slate-400 dark:text-mil-muted group-hover:text-tac-orange dark:group-hover:text-mil-base transition-colors" />
        <span className="text-sm font-medium text-mil-base">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-mil-muted font-mono">{value}</span>}
        {action ? action : <ChevronRight className="w-3 h-3 text-slate-300 dark:text-mil-muted" />}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 bg-mil-base text-mil-base animate-fade-in transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center pt-10 pb-10 shadow-sm dark:shadow-none">
        <div className="relative mb-3 group cursor-pointer" onClick={handleAvatarUpdate}>
          <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-tac-orange flex items-center justify-center shadow-lg overflow-hidden relative">
             {avatar ? (
               <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
             ) : (
               <User className="w-8 h-8 text-slate-400" />
             )}
             
             {/* Camera Overlay Hint */}
             <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
             </div>
          </div>
          <div className="absolute bottom-0 right-0 bg-tac-orange text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white dark:border-slate-900">
             {t.common.vip} {user?.vipLevel || 1}
          </div>
        </div>
        <h2 className="text-lg font-bold text-mil-base uppercase tracking-wider">{user?.name || 'Operative'}</h2>
        <p className="text-[10px] font-mono text-slate-400">{user?.id || 'ID: UNKNOWN'}</p>
        <div className="mt-4 flex gap-2">
             <span className="text-[9px] bg-yellow-50 dark:bg-tac-gold/10 text-yellow-600 dark:text-tac-gold px-2 py-1 border border-yellow-200 dark:border-tac-gold/30 rounded-sm">{t.settings.status}</span>
        </div>
      </div>

      <div className="p-4 -mt-4 relative z-10">
        <Section title={t.settings.personnel}>
          <Item icon={User} label={t.settings.profile} onClick={handleAvatarUpdate} />
          <Item icon={CreditCard} label={t.settings.card} />
          <Item icon={Smartphone} label={t.settings.bookings} />
        </Section>

        <Section title={t.settings.system}>
          {/* Language Toggle */}
          <Item 
            icon={Globe} 
            label={t.settings.lang} 
            action={
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-sm p-0.5 border border-slate-200 dark:border-slate-600">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setLanguage('en'); }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-colors ${language === 'en' ? 'bg-tac-orange text-white shadow-sm' : 'text-slate-400'}`}
                  >EN</button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setLanguage('zh'); }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-colors ${language === 'zh' ? 'bg-tac-orange text-white shadow-sm' : 'text-slate-400'}`}
                  >中文</button>
              </div>
            }
          />
          
          {/* Theme Toggle */}
          <Item 
            icon={theme === 'dark' ? Moon : Sun} 
            label={t.settings.theme} 
            action={
              <button 
                onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                className={`relative w-10 h-5 rounded-full transition-colors border border-slate-300 dark:border-slate-600 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}
              >
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-300 flex items-center justify-center ${theme === 'dark' ? 'left-5 bg-tac-orange' : 'left-1 bg-white'}`}>
                    {theme === 'dark' ? <Moon className="w-2 h-2 text-white" /> : <Sun className="w-2 h-2 text-yellow-500" />}
                  </div>
              </button>
            }
          />
          
          <Item icon={Bell} label={t.settings.notifications} value="ON" />
        </Section>

        <Section title={t.settings.support}>
           <Item icon={HelpCircle} label={t.settings.support} onClick={() => navigate(PageRoutes.CUSTOMER_SERVICE)} />
        </Section>

        <button 
          onClick={handleLogout}
          className="w-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-red-500 hover:text-red-500 text-slate-500 dark:text-slate-400 py-3 rounded-sm flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t.settings.logout}
        </button>
        
        <div className="text-center mt-6">
            <Shield className="w-6 h-6 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{t.app.version}</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;