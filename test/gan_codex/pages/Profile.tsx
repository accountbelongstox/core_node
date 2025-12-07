import React from 'react';
import { MobileLayout, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import { User, Settings, Info, ChevronRight, LogOut, Moon, Globe, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, logout, theme, toggleTheme, language, setLanguage, t } = useStore();

  if (!user) return null;

  const MenuItem = ({ icon: Icon, label, to, onClick, value }: any) => (
    <div 
      onClick={onClick || (() => {})} 
      className={`flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5 last:border-0 ${to || onClick ? 'cursor-pointer active:bg-black/5' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 dark:bg-white/10 text-blue-600 dark:text-blue-300 rounded-lg">
          <Icon size={18} />
        </div>
        <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-slate-400">{value}</span>}
        {(to || onClick) && <ChevronRight size={16} className="text-slate-300" />}
      </div>
    </div>
  );

  return (
    <MobileLayout>
      <div className="px-5 py-8">
        
        {/* Header Card */}
        <GlassCard className="flex items-center gap-4 mb-6">
          <img src={user.avatar} className="w-16 h-16 rounded-full bg-slate-200" />
          <div className="flex-1">
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-xs text-slate-500 mt-1">{user.phone}</p>
          </div>
          <Link to="/me/edit">
            <QrCode className="text-slate-400" />
          </Link>
        </GlassCard>

        {/* Settings Group */}
        <GlassCard className="p-0 mb-6 overflow-hidden">
          <Link to="/me/edit">
            <MenuItem icon={User} label={t('me.profile')} to="/me/edit" />
          </Link>
          <MenuItem 
            icon={Moon} 
            label={t('me.theme')} 
            onClick={toggleTheme} 
            value={theme === 'dark' ? 'Dark' : 'Light'} 
          />
          <MenuItem 
            icon={Globe} 
            label={t('me.lang')} 
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} 
            value={language === 'en' ? 'English' : '中文'} 
          />
        </GlassCard>

        <GlassCard className="p-0 mb-6 overflow-hidden">
          <Link to="/about">
            <MenuItem icon={Info} label={t('me.about')} to="/about" />
          </Link>
          <MenuItem icon={Settings} label={t('me.settings')} to="/settings" />
        </GlassCard>

        <button 
          onClick={logout}
          className="w-full py-4 rounded-xl bg-red-50 text-red-500 font-bold text-sm flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Log Out
        </button>

      </div>
    </MobileLayout>
  );
};

export default Profile;