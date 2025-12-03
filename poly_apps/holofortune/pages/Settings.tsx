import React, { useState } from 'react';
import { MobileLayout, Header, GlassCard, Button } from '../components/Shared';
import { useStore } from '../store';
import { Moon, Globe, Shield, CheckCircle, XCircle, MapPin, Camera, FolderOpen, Loader2 } from 'lucide-react';

const Settings: React.FC = () => {
  const { theme, toggleTheme, language, setLanguage, t } = useStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [permissions, setPermissions] = useState({
    location: false,
    camera: false,
    storage: false
  });
  const [isChecking, setIsChecking] = useState(false);

  const startAuthorization = async () => {
    setShowAuthModal(true);
    setIsChecking(true);
    
    // Simulate checking sequence
    setTimeout(() => setPermissions(p => ({ ...p, location: true })), 1000);
    setTimeout(() => setPermissions(p => ({ ...p, camera: true })), 2000);
    setTimeout(() => {
        setPermissions(p => ({ ...p, storage: true }));
        setIsChecking(false);
    }, 3000);

    // In a real app, you would trigger:
    // navigator.geolocation.getCurrentPosition(...)
    // navigator.mediaDevices.getUserMedia(...)
  };

  const OptionRow: React.FC<{ icon: any, label: string, value?: string, onClick?: () => void, toggle?: boolean }> = ({ icon: Icon, label, value, onClick, toggle }) => (
    <div 
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
         <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}>
            <Icon size={18} />
         </div>
         <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{label}</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
         {value && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{value}</span>}
         {toggle && (
            <div style={{ 
                width: 44, height: 24, borderRadius: 99, padding: 2, 
                background: value === 'Dark' ? 'var(--primary-color)' : '#cbd5e1',
                transition: 'background 0.3s'
            }}>
                <div style={{ 
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transform: value === 'Dark' ? 'translateX(20px)' : 'translateX(0)',
                    transition: 'transform 0.3s'
                }} />
            </div>
         )}
      </div>
    </div>
  );

  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.settings')} backTo="/me" />
      
      <div className="px-5 pt-4">
        
        {/* Authorization Card */}
        <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 }}>{t('settings.permissions')}</h3>
            <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ padding: 10, background: 'var(--primary-gradient)', borderRadius: '50%', color: 'white' }}>
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{t('settings.one_tap')}</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('settings.auth_desc')}</p>
                    </div>
                </div>
                <Button onClick={startAuthorization} style={{ borderRadius: 24, height: 44 }}>
                   {t('settings.one_tap')}
                </Button>
            </GlassCard>
        </div>

        {/* General Settings */}
        <div>
             <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 }}>General</h3>
             <GlassCard style={{ padding: '0 16px' }}>
                <OptionRow 
                    icon={Moon} 
                    label={t('me.theme')} 
                    value={theme === 'dark' ? 'Dark' : 'Light'} 
                    toggle
                    onClick={toggleTheme}
                />
                <OptionRow 
                    icon={Globe} 
                    label={t('me.lang')} 
                    value={language === 'en' ? 'English' : '中文'} 
                    onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                />
             </GlassCard>
        </div>

      </div>

      {/* Permission Modal */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
            <div className="anim-fade-up" style={{ width: '85%', maxWidth: 360, background: 'var(--bg-color)', borderRadius: 24, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                <div className="text-center mb-4">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>{t('settings.permissions')}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Please keep these permissions enabled for the app to function correctly.</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                    {[
                        { key: 'location', label: t('perm.location'), icon: MapPin },
                        { key: 'camera', label: t('perm.camera'), icon: Camera },
                        { key: 'storage', label: t('perm.storage'), icon: FolderOpen },
                    ].map((item, idx) => (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <item.icon size={20} color="#64748b" />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</span>
                            </div>
                            {/* @ts-ignore */}
                            {permissions[item.key] ? (
                                <CheckCircle size={20} color="#22c55e" />
                            ) : (
                                isChecking && idx === 0 ? <Loader2 size={20} className="animate-spin" color="#3b82f6" /> : 
                                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #cbd5e1' }} />
                            )}
                        </div>
                    ))}
                </div>

                <Button onClick={() => !isChecking && setShowAuthModal(false)} disabled={isChecking}>
                    {isChecking ? t('perm.checking') : 'Done'}
                </Button>
            </div>
        </div>
      )}
    </MobileLayout>
  );
};

export default Settings;