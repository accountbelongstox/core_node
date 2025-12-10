
import React from 'react';
import { ChevronLeft, Moon, Sun, Globe, Bell, Shield, FileText, Info, ChevronRight, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { languages, Language } from '../i18n/types';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { themeMode, toggleTheme, language, setLanguage, t } = useAppContext();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white pb-24 font-sans">
      
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 px-6 pt-safe-top pb-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-1 -ml-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-serif font-bold">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8 animate-fade-in">
        
        {/* Appearance Section */}
        <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 ml-2">{t('settings.appearance.title')}</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800">
                {/* Theme Toggle */}
                <div 
                    onClick={toggleTheme}
                    className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            {themeMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                        </div>
                        <span className="font-medium">{t('settings.appearance.darkMode')}</span>
                    </div>
                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${themeMode === 'dark' ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${themeMode === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                </div>

                {/* Language Selector */}
                <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Globe size={16} />
                        </div>
                        <span className="font-medium">{t('settings.appearance.language')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLanguage(lang.code as Language);
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                    language === lang.code
                                        ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-700'
                                }`}
                            >
                                <span className="text-lg">{lang.flag}</span>
                                <span>{lang.nativeName}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>

        {/* Preferences Section */}
        <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 ml-2">{t('settings.preferences.title')}</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center">
                            <Bell size={16} />
                        </div>
                        <span className="font-medium">{t('settings.preferences.notifications')}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>
                <div className="flex items-center justify-between p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <Shield size={16} />
                        </div>
                        <span className="font-medium">{t('settings.preferences.privacySecurity')}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>
            </div>
        </section>

        {/* About Section */}
        <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 ml-2">{t('settings.about.title')}</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <FileText size={16} />
                        </div>
                        <span className="font-medium">{t('settings.about.termsOfService')}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>
                <div 
                    onClick={() => navigate('/about')}
                    className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                            <Building2 size={16} />
                        </div>
                        <span className="font-medium">{t('settings.about.companyProfile')}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>
                <div className="flex items-center justify-between p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                            <Info size={16} />
                        </div>
                        <span className="font-medium">{t('settings.about.version')}</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">v1.2.0 (Build 88)</span>
                </div>
            </div>
        </section>

        {/* Footer */}
        <div className="text-center pt-8 opacity-40">
            <h3 className="font-serif font-bold text-lg mb-1">{t('settings.footer.company')}</h3>
            <p className="text-[10px] uppercase tracking-widest">{t('settings.footer.fullName')}</p>
            <p className="text-[10px] mt-2">{t('settings.footer.copyright')}</p>
        </div>

      </div>
    </div>
  );
};

export default Settings;
    