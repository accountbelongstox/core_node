import React, { useState } from 'react';
import { ChevronLeft, Mail, Smartphone, Facebook, Chrome, Apple, ArrowRight, Crown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import Assets from '../assets';
import { createMockUser } from '../data/mock/userGenerator';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, t, language } = useAppContext();
  const [method, setMethod] = useState<'mobile' | 'email'>('mobile');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // Create mock user with input data
    const userData = createMockUser({
      email: method === 'email' ? email : undefined,
      phone: method === 'mobile' ? mobile : undefined,
      language: language as 'en' | 'zh',
    });
    login(userData);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-safe-top pb-4 flex items-center justify-between">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <ChevronLeft size={24} />
         </button>
         <Link to="/register" className="text-sm font-bold text-yellow-600">
            {t('auth.signUp')}
         </Link>
      </div>

      <div className="flex-1 px-8 pt-4 pb-12 flex flex-col">
         {/* Logo Area */}
         <div className="mb-10 text-center">
            <div className="w-16 h-16 bg-black border-2 border-yellow-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl overflow-hidden">
                <img src={Assets.logo.full} className="w-full h-full object-cover" alt="Logo"/>
            </div>
            <h1 className="text-3xl font-serif font-bold mb-2">{t('login.title')}</h1>
            <p className="text-gray-500 text-sm">{t('login.subtitle')}</p>
         </div>

         {/* Tabs */}
         <div className="flex bg-gray-100 dark:bg-zinc-900 rounded-xl p-1 mb-8">
            <button 
                onClick={() => setMethod('mobile')}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${method === 'mobile' ? 'bg-white dark:bg-zinc-800 shadow-md text-black dark:text-white' : 'text-gray-400'}`}
            >
                <Smartphone size={16} /> {t('login.mobile')}
            </button>
            <button 
                onClick={() => setMethod('email')}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${method === 'email' ? 'bg-white dark:bg-zinc-800 shadow-md text-black dark:text-white' : 'text-gray-400'}`}
            >
                <Mail size={16} /> {t('login.email')}
            </button>
         </div>

         {/* Form */}
         <div className="space-y-4 mb-8">
            {method === 'mobile' ? (
                <div className="flex gap-3">
                    <div className="w-[100px] bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-4 flex items-center justify-center font-bold relative">
                        <span className="mr-1">🇱🇦</span> +856
                    </div>
                    <input 
                        type="tel" 
                        placeholder={t('login.mobileNumber')}
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium"
                    />
                </div>
            ) : (
                <input 
                    type="email" 
                    placeholder={t('login.emailAddress')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium"
                />
            )}
            
            <input 
                type="password" 
                placeholder={t('login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium"
            />

            <div className="text-right">
                <a href="#" className="text-xs text-gray-500 hover:text-black dark:hover:text-white transition-colors">{t('login.forgotPassword')}</a>
            </div>
         </div>

         {/* Login Button */}
         <button onClick={handleLogin} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-lg mb-8 shadow-xl hover:scale-[1.02] transition-transform">
            {t('login.signIn')}
         </button>

         {/* Social Divider */}
         <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-zinc-950 text-gray-500">{t('login.orContinueWith')}</span>
            </div>
         </div>

         {/* Social Icons */}
         <div className="grid grid-cols-3 gap-4 mb-12">
            <button className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 py-3 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <Chrome size={20} />
            </button>
            <button className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 py-3 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <Facebook size={20} className="text-blue-600"/>
            </button>
            <button className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 py-3 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <Apple size={20} />
            </button>
         </div>

         {/* VIP Promo */}
         <div className="mt-auto bg-gradient-to-r from-zinc-900 to-black p-6 rounded-2xl border border-yellow-900/30 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Crown size={64} />
             </div>
             <div className="relative z-10">
                 <h3 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
                     <Crown size={16} fill="currentColor"/> {t('login.blackDiamond')}
                 </h3>
                 <p className="text-zinc-400 text-xs mb-4">
                     {t('login.blackDiamondDesc')}
                 </p>
                 <Link to="/vip" className="text-xs font-bold text-white flex items-center gap-1 hover:gap-2 transition-all">
                     {t('login.viewPrivileges')} <ArrowRight size={12}/>
                 </Link>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Login;
