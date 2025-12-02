import React, { useState } from 'react';
import { useStore } from '../store';
import { MobileLayout, GlassCard, Input, Button } from '../components/Shared';
import { ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const { login, t } = useStore();
  const [phone, setPhone] = useState('');

  const handleLogin = () => {
    // Accept any input, even empty - will create temporary user
    login(phone);
  };

  return (
    <MobileLayout showNav={false} className="justify-center p-6">
      <div className="flex flex-col items-center mb-10 animate-fade-in-down">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6 rotate-12">
          <ShieldCheck size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
          {t('app.name')}
        </h1>
        <p className="text-slate-400 text-sm tracking-widest uppercase">{t('login.title')}</p>
      </div>

      <GlassCard className="space-y-4 animate-fade-in-up">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
          <p className="text-xs text-blue-700 text-center">
            🎯 Enter any phone number or leave blank to create a temporary guest account
          </p>
        </div>

        <div>
          <Input
            type="tel"
            placeholder={t('login.phone')}
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Input type="text" placeholder={t('login.code')} className="flex-1" />
          <button className="px-4 py-3 rounded-xl bg-blue-100 text-blue-600 font-bold text-sm whitespace-nowrap">
            Get Code
          </button>
        </div>

        <div className="flex items-center gap-2 py-2">
          <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-xs text-slate-500">{t('login.agree')}</span>
        </div>

        <Button onClick={handleLogin}>
          {t('login.btn')}
        </Button>
      </GlassCard>
    </MobileLayout>
  );
};

export default Login;