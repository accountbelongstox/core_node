import React, { useState } from 'react';
import { ChevronLeft, Mail, Smartphone, Globe, Shield, Star, Zap, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { createMockUser } from '../data/mock/userGenerator';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t, login, language } = useAppContext();
  const [region, setRegion] = useState('Laos');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = () => {
    // Create mock user with input data
    const userData = createMockUser({
      fullName: fullName || undefined,
      phone: mobile || undefined,
      language: language as 'en' | 'zh',
    });
    login(userData);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-safe-top pb-4">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <ChevronLeft size={24} />
         </button>
      </div>

      <div className="flex-1 px-8 pb-12 overflow-y-auto">
         
         <h1 className="text-3xl font-serif font-bold mb-2">{t('register.title')}</h1>
         <p className="text-gray-500 text-sm mb-8">{t('register.subtitle')}</p>

         {/* VIP Incentive Banner */}
         <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-2xl p-5 mb-8">
             <h3 className="font-bold text-yellow-800 dark:text-yellow-500 text-sm mb-3">{t('register.membershipBenefits')}</h3>
             <div className="grid grid-cols-2 gap-3">
                 <div className="flex items-center gap-2 text-xs text-yellow-900 dark:text-yellow-200/80">
                     <Shield size={14} /> {t('register.benefits.securityAccess')}
                 </div>
                 <div className="flex items-center gap-2 text-xs text-yellow-900 dark:text-yellow-200/80">
                     <Star size={14} /> {t('register.benefits.villaPriority')}
                 </div>
                 <div className="flex items-center gap-2 text-xs text-yellow-900 dark:text-yellow-200/80">
                     <Zap size={14} /> {t('register.benefits.investmentIpo')}
                 </div>
                 <div className="flex items-center gap-2 text-xs text-yellow-900 dark:text-yellow-200/80">
                     <Globe size={14} /> {t('register.benefits.globalConcierge')}
                 </div>
             </div>
         </div>

         {/* Form */}
         <div className="space-y-4 mb-8">
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('register.fullName')}</label>
                <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('register.regionCountry')}</label>
                <div className="relative">
                    <select 
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium appearance-none"
                    >
                        <option value="Laos">🇱🇦 Laos</option>
                        <option value="China">🇨🇳 China</option>
                        <option value="Thailand">🇹🇭 Thailand</option>
                        <option value="Vietnam">🇻🇳 Vietnam</option>
                        <option value="Singapore">🇸🇬 Singapore</option>
                        <option value="USA">🇺🇸 USA</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <Globe size={16} />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('register.mobileNumber')}</label>
                <input 
                    type="tel" 
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('register.password')}</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500 transition-colors font-medium"
                />
            </div>

            <div className="flex items-start gap-3 mt-2">
                <div className="w-5 h-5 rounded border border-gray-300 dark:border-zinc-700 flex items-center justify-center mt-0.5">
                    <Check size={12} className="text-transparent" />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                    {t('register.agreeTerms').replace('Terms of Service', '').replace('Privacy Policy', '').trim()} <span className="text-black dark:text-white font-bold">{t('register.termsOfService')}</span> {t('common.and')} <span className="text-black dark:text-white font-bold">{t('register.privacyPolicy')}</span>.
                </p>
            </div>
         </div>

         {/* Submit Button */}
         <button onClick={handleRegister} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-lg mb-6 shadow-xl hover:scale-[1.02] transition-transform">
            {t('register.createAccount')}
         </button>

         <div className="text-center">
             <p className="text-sm text-gray-500">
                 {t('register.alreadyHaveAccount')} <Link to="/login" className="text-yellow-600 font-bold">{t('register.signIn')}</Link>
             </p>
         </div>

      </div>
    </div>
  );
};

export default Register;
