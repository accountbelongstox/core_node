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
      
      <div className="px-5 pt-4 pb-10 space-y-6">
        <div className="flex justify-center">
           <div className="relative">
             <img src={user?.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-md" />
             <div className="absolute bottom-0 right-0 p-1.5 bg-blue-500 rounded-full border-2 border-white text-white">
               {/* Camera icon placeholder */}
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
             </div>
           </div>
        </div>

        <GlassCard className="space-y-4">
          {[
            { label: 'Name', name: 'name', type: 'text' },
            { label: 'Signature', name: 'signature', type: 'text' },
            { label: 'Phone', name: 'phone', type: 'tel', disabled: true },
            { label: 'Email', name: 'email', type: 'email' },
            { label: 'Address', name: 'address', type: 'text' },
            { label: 'ID Card (Real Name)', name: 'idCard', type: 'text', secure: true },
          ].map((field) => (
             <div key={field.name}>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">{field.label}</label>
                <Input 
                  name={field.name} 
                  value={(formData as any)[field.name]} 
                  onChange={handleChange}
                  disabled={field.disabled}
                  type={field.type}
                  className={field.disabled ? "opacity-60 bg-slate-100" : ""}
                />
             </div>
          ))}
          
          <div className="pt-4">
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </div>
        </GlassCard>
      </div>
    </MobileLayout>
  );
};

export default EditProfile;