import React, { useState } from 'react';
import { useStore } from '../store';
import { MobileLayout, GlassCard, Input, Button } from '../components/Shared';
import { ShieldCheck, MessageCircle, CreditCard, ScanLine } from 'lucide-react';

const Login: React.FC = () => {
  const { login, t } = useStore();
  const [phone, setPhone] = useState('');

  const handleLogin = () => {
    if (phone) login(phone);
  };

  return (
    <div className="mobile-layout dynamic-bg flex-center" style={{ padding: 24, justifyContent: 'center' }}>
      <div className="flex-col items-center mb-4 anim-fade-down" style={{ display: 'flex', marginBottom: 40, width: '100%' }}>
        <div className="login-logo-container">
          <ShieldCheck size={40} color="#3b82f6" />
        </div>
        <h1 className="gradient-text" style={{ marginBottom: 8 }}>
          {t('app.name')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {t('login.title')}
        </p>
      </div>

      <GlassCard className="anim-fade-up" style={{ width: '100%', gap: 16, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.7)' }}>
        <div>
          <Input 
            type="tel" 
            placeholder={t('login.phone')} 
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ background: 'white' }}
          />
        </div>
        <div className="flex-row gap-3">
          <Input type="text" placeholder={t('login.code')} style={{ flex: 1, background: 'white' }} />
          <button style={{ padding: '0 16px', borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '0.875rem' }}>
            Get Code
          </button>
        </div>
        
        <div className="flex-row items-center gap-2" style={{ padding: '8px 0' }}>
          <input type="checkbox" style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('login.agree')}</span>
        </div>

        <Button onClick={handleLogin}>
          {t('login.btn')}
        </Button>
      </GlassCard>

      <div className="social-login-container anim-fade-up" style={{ animationDelay: '0.2s' }}>
         <button className="social-btn" title="WeChat">
            <MessageCircle color="white" size={24} />
         </button>
         <button className="social-btn" title="QQ">
            <ScanLine color="white" size={24} /> 
         </button>
         <button className="social-btn" title="Alipay">
            <CreditCard color="white" size={24} />
         </button>
      </div>
    </div>
  );
};

export default Login;