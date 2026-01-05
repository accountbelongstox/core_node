
import React from 'react';
import { useApp } from '../contexts/AppContext';
import { apiService } from '../services/apiService';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Camera, 
  Save, 
  Lock, 
  Bell, 
  Smartphone,
  ChevronRight
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, t } = useApp();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('user.profile')}</h2>
          <p className="text-sm text-slate-500">Manage your personal information and security settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          {/* Avatar Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm flex flex-col items-center text-center">
            <div className="relative group mb-6">
              <img 
                src={user ? apiService.getAvatarUrl(user.avatar ?? user.id, 150, 'pravatar') : apiService.getAvatarUrl('user', 150, 'pravatar')} 
                className="w-32 h-32 rounded-full border-4 border-indigo-50 dark:border-indigo-900/30" 
                alt="Profile"
              />
              <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={18} />
              </button>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{user?.name}</h3>
            <p className="text-sm text-indigo-600 font-bold uppercase tracking-wider mt-1">{user?.role}</p>
            <p className="text-xs text-slate-400 mt-2">Member since 2024</p>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Account Status</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">2FA Status</span>
                <span className="text-xs font-bold text-emerald-500 px-2 py-0.5 bg-emerald-50 rounded uppercase">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Account Type</span>
                <span className="text-xs font-bold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded uppercase">Verified</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info Form */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <User size={18} className="text-indigo-600" />
                Personal Information
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      defaultValue={user?.name}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="email" 
                      defaultValue={user?.email}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      placeholder="+1-234-567-890"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Role</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      disabled
                      value={user?.role.toUpperCase()}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed text-slate-400 font-bold" 
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                <button className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* Security & Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Lock size={18} className="text-rose-500" />
                Security
              </h3>
              <button className="w-full py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-between px-4 group">
                Change Password
                <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Bell size={18} className="text-amber-500" />
                Notifications
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Email Alerts</span>
                <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

