import React from 'react';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import { ShieldCheck, ChevronRight } from 'lucide-react';

const About: React.FC = () => {
  const { t } = useStore();
  
  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.about')} backTo="/me" />
      
      <div className="px-5 py-4 flex-col items-center" style={{ display: 'flex' }}>
        <div className="login-logo-container" style={{ width: 96, height: 96, transform: 'none', marginBottom: 24, borderRadius: 32 }}>
          <ShieldCheck size={48} color="white" />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('app.name')}</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 40 }}>Version 1.0.2 (Build 2024)</p>
        
        <GlassCard style={{ width: '100%', padding: 0 }}>
           {['Feature Introduction', 'Privacy Policy', 'Terms of Service', 'Check Updates'].map((item) => (
             <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item}</span>
                <ChevronRight size={16} color="#cbd5e1" />
             </div>
           ))}
        </GlassCard>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.5 }}>
            Copyright © 2024 SafeGuardian Inc.<br/>All Rights Reserved.
          </p>
        </div>
      </div>
    </MobileLayout>
  );
};

export default About;