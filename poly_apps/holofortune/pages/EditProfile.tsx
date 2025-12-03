import React, { useState } from 'react';
import { MobileLayout, Header, GlassCard, Input, Button } from '../components/Shared';
import { useStore } from '../store';

const EditProfile: React.FC = () => {
  const { user, updateUser, t } = useStore();
  const [formData, setFormData] = useState(user || {});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    updateUser(formData);
    window.history.back();
  };

  return (
    <MobileLayout showNav={false}>
      <Header title="My Profile" backTo="/me" />
      
      <div className="px-5 pt-4 pb-4" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="flex-center">
           <div style={{ position: 'relative' }}>
             <img src={user?.avatar} style={{ width: 96, height: 96, borderRadius: '50%', border: '4px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} alt="Avatar" />
             <div style={{ position: 'absolute', bottom: 0, right: 0, padding: 6, background: '#3b82f6', borderRadius: '50%', border: '2px solid white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
             </div>
           </div>
        </div>

        <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Name', name: 'name', type: 'text' },
            { label: 'Signature', name: 'signature', type: 'text' },
            { label: 'Phone', name: 'phone', type: 'tel', disabled: true },
            { label: 'Email', name: 'email', type: 'email' },
            { label: 'Address', name: 'address', type: 'text' },
            { label: 'ID Card (Real Name)', name: 'idCard', type: 'text', secure: true },
          ].map((field) => (
             <div key={field.name}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginLeft: 4, marginBottom: 4, display: 'block' }}>{field.label}</label>
                <Input 
                  name={field.name} 
                  value={(formData as any)[field.name]} 
                  onChange={handleChange}
                  disabled={field.disabled}
                  type={field.type}
                  style={field.disabled ? { opacity: 0.6, background: '#f1f5f9' } : {}}
                />
             </div>
          ))}
          
          <div style={{ paddingTop: 16 }}>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </div>
        </GlassCard>
      </div>
    </MobileLayout>
  );
};

export default EditProfile;