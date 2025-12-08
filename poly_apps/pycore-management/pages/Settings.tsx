import React from 'react';
import { Moon, Sun, Monitor, Globe, Bell } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const Settings: React.FC = () => {
  const { settings, updateSettings, t } = useApp();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('settings.title')}</h1>

      {/* Appearance */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
         <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('settings.appearance')}</h2>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('settings.theme')}</label>
                 <div className="grid grid-cols-3 gap-3">
                     <button 
                        onClick={() => updateSettings({ theme: 'light' })}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                            settings.theme === 'light' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                        }`}
                     >
                         <Sun size={20} className="mb-2" />
                         <span className="text-xs font-medium">{t('settings.theme.light')}</span>
                     </button>
                     <button 
                        onClick={() => updateSettings({ theme: 'dark' })}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                            settings.theme === 'dark' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                        }`}
                     >
                         <Moon size={20} className="mb-2" />
                         <span className="text-xs font-medium">{t('settings.theme.dark')}</span>
                     </button>
                     <button 
                        onClick={() => updateSettings({ theme: 'auto' })}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                            settings.theme === 'auto' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                        }`}
                     >
                         <Monitor size={20} className="mb-2" />
                         <span className="text-xs font-medium">{t('settings.theme.auto')}</span>
                     </button>
                 </div>
             </div>

             <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('settings.language')}</label>
                 <div className="space-y-2">
                     <button
                        onClick={() => updateSettings({ language: 'en' })}
                        className={`flex items-center w-full px-4 py-3 rounded-lg border transition-all ${
                            settings.language === 'en'
                             ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                             : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                     >
                         <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden relative mr-3">
                             <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">EN</span>
                         </div>
                         <span className="text-sm font-medium">English</span>
                     </button>
                     
                     <button
                        onClick={() => updateSettings({ language: 'zh' })}
                         className={`flex items-center w-full px-4 py-3 rounded-lg border transition-all ${
                            settings.language === 'zh'
                             ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                             : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                     >
                         <div className="w-5 h-5 rounded-full bg-red-500 overflow-hidden relative mr-3 flex items-center justify-center">
                             <span className="text-[8px] text-white font-bold">CN</span>
                         </div>
                         <span className="text-sm font-medium">中文 (Chinese)</span>
                     </button>
                 </div>
             </div>
         </div>
      </div>

      {/* General */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('settings.general')}</h2>
          
          <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <Bell size={20} className="text-slate-600 dark:text-slate-300" />
                      </div>
                      <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">System Notifications</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Receive alerts about system status changes</div>
                      </div>
                  </div>
                  <button 
                    onClick={() => updateSettings({ notifications: !settings.notifications })}
                    className={`w-11 h-6 flex items-center rounded-full transition-colors ${settings.notifications ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                 >
                     <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${settings.notifications ? 'translate-x-6' : 'translate-x-1'}`}></div>
                 </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Settings;