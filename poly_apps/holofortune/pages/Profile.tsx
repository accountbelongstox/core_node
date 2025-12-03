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
      className="menu-item"
    >
      <div className="flex-row items-center gap-3">
        <div className="icon-box">
          <Icon size={18} />
        </div>
        <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <div className="flex-row items-center gap-2">
        {value && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{value}</span>}
        {(to || onClick) && <ChevronRight size={16} color="#cbd5e1" />}
      </div>
    </div>
  );

  return (
    <MobileLayout className="bg-gray-50">
        {/* Banner */}
        <div className="profile-banner"></div>
        
        {/* Overlapping Header */}
        <div className="profile-header-overlay">
            <img src={user.avatar} className="avatar-overlap" alt="Avatar" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 12 }}>{user.name}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{user.phone}</p>
        </div>

      <div className="px-5 py-4" style={{ marginTop: -20 }}>
        
        {/* Actions Row */}
        <div className="flex-row gap-3 mb-4">
             <Link to="/me/edit" style={{ flex: 1, textDecoration: 'none' }}>
                <GlassCard className="flex-center flex-col" style={{ padding: 12, gap: 4 }}>
                    <QrCode size={20} color="var(--primary-color)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>My Code</span>
                </GlassCard>
             </Link>
             <Link to="/settings" style={{ flex: 1, textDecoration: 'none' }}>
                <GlassCard className="flex-center flex-col" style={{ padding: 12, gap: 4 }}>
                    <Settings size={20} color="var(--primary-color)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('me.settings')}</span>
                </GlassCard>
             </Link>
        </div>

        {/* Settings Group */}
        <GlassCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <Link to="/me/edit" style={{ display: 'block', textDecoration: 'none' }}>
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

        <GlassCard style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <Link to="/about" style={{ display: 'block', textDecoration: 'none' }}>
            <MenuItem icon={Info} label={t('me.about')} to="/about" />
          </Link>
        </GlassCard>

        <button 
          onClick={logout}
          style={{ width: '100%', padding: 16, borderRadius: 12, background: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <LogOut size={18} /> Log Out
        </button>

      </div>
    </MobileLayout>
  );
};

export default Profile;