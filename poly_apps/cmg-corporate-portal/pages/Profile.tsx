
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, CreditCard, Shield, Clock, Calendar, Crown, ChevronRight, Wallet, User, Bell } from 'lucide-react';
import { useAppContext } from '../App';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, logout, t } = useAppContext();

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white pb-24 font-sans">
      
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 px-6 pt-safe-top pb-6 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-serif font-bold">{t('profile.title')}</h1>
            <div className="flex gap-3">
                <button onClick={() => navigate('/settings')} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300">
                    <Settings size={20} />
                </button>
                <button onClick={logout} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-400">
                    <LogOut size={20} />
                </button>
            </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-4">
            <div className="relative">
                <img 
                    src="https://ui-avatars.com/api/?name=Guo+Xiansheng&background=d4af37&color=000&size=128" 
                    className="w-20 h-20 rounded-full border-4 border-white dark:border-zinc-800 shadow-lg" 
                    alt="Profile"
                />
                <div className="absolute -bottom-1 -right-1 bg-black text-yellow-500 p-1.5 rounded-full border-2 border-white dark:border-zinc-800">
                    <Crown size={14} fill="currentColor" />
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold">Guo Xiansheng</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID: CMG-8888-9999</p>
                <div className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    Black Diamond
                </div>
            </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 animate-fade-in">
        
        {/* Assets Overview */}
        <div className="bg-black text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-600/20 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex justify-between items-start mb-6">
                <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">{t('profile.totalAssetValue')}</p>
                    <h3 className="text-3xl font-serif font-bold">$12,450,000</h3>
                </div>
                <div className="bg-zinc-800 p-2 rounded-xl">
                    <Wallet className="text-yellow-500" size={24} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-zinc-900/80 p-3 rounded-xl">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">{t('profile.points')}</p>
                    <p className="font-bold text-lg text-yellow-500">85,400</p>
                </div>
                <div className="bg-zinc-900/80 p-3 rounded-xl">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">{t('profile.vouchers')}</p>
                    <p className="font-bold text-lg text-white">12</p>
                </div>
            </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-sm text-blue-600 dark:text-blue-400">
                    <CreditCard size={24} />
                </div>
                <span className="text-[10px] font-bold">{t('profile.cards')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-sm text-green-600 dark:text-green-400">
                    <Calendar size={24} />
                </div>
                <span className="text-[10px] font-bold">{t('profile.bookings')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-sm text-red-600 dark:text-red-400">
                    <Shield size={24} />
                </div>
                <span className="text-[10px] font-bold">{t('profile.security')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-sm text-purple-600 dark:text-purple-400">
                    <Bell size={24} />
                </div>
                <span className="text-[10px] font-bold">{t('profile.alerts')}</span>
            </div>
        </div>

        {/* Recent Activity / Menu List */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-2 shadow-sm">
            <div className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer transition-colors">
                <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 rounded-full flex items-center justify-center">
                    <Clock size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-sm">{t('profile.shootingRangeReservation')}</h4>
                    <p className="text-xs text-gray-500">Tomorrow, 14:00 PM</p>
                </div>
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">{t('profile.confirmed')}</span>
            </div>

            <div className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer transition-colors border-t border-gray-50 dark:border-zinc-800/50">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-500 rounded-full flex items-center justify-center">
                    <User size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-sm">{t('profile.updatePersonalInfo')}</h4>
                    <p className="text-xs text-gray-500">{t('profile.securityCheckRequired')}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
            </div>
        </div>

        {/* Promo Banner */}
        <div className="bg-gradient-to-r from-red-900 to-red-800 p-6 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1">{t('profile.invitePartner')}</h3>
                <p className="text-xs text-red-100 mb-4 opacity-80">
                    {t('profile.invitePartnerDesc')}
                </p>
                <button className="bg-white text-red-900 px-4 py-2 rounded-lg text-xs font-bold">{t('profile.getReferralCode')}</button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12">
                <Shield size={100} />
            </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
