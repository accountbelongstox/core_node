
import React, { useState, useEffect, useContext, createContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Phone, Mail, MapPin, ArrowRight, Crown, Globe, Moon, Sun, User as UserIcon, LogIn, Apple, Smartphone, Download, Check, X as CloseIcon, Home as HomeIcon, Target, Umbrella, LayoutGrid, Shield, Pickaxe, Bell, Headset, Flag, LandPlot, Building2, FerrisWheel, Calendar, Settings as SettingsIcon } from 'lucide-react';
import Home from './pages/Home';
import ShootingRange from './pages/ShootingRange';
import Security from './pages/Security';
import RareEarth from './pages/RareEarth';
import Resort from './pages/Resort';
import VIP from './pages/VIP';
import Concierge from './pages/Concierge';
import Golf from './pages/Golf';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import About from './pages/About';
import DownloadApp from './pages/DownloadApp';
import CorporateDrawer from './components/CorporateDrawer';
import HotelBookingDrawer from './components/HotelBookingDrawer';
import ShootingBookingDrawer from './components/ShootingBookingDrawer';
import GolfBookingDrawer from './components/GolfBookingDrawer';
import { AppContextType, Language } from './types';
import { getTranslation } from './i18n/translations';
import { languages } from './i18n/types';
import Assets from './assets';
import { User } from './data/models/user';
import { createMockUser } from './data/mock/userGenerator';

// --- Context Setup ---
const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};

// --- Mobile Header ---
const MobileHeader: React.FC = () => {
    const { toggleTheme, themeMode, openLogin, isLoggedIn, user, setCorporateDrawerOpen, language, setLanguage } = useAppContext();
    const navigate = useNavigate();
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);

    const handleUserClick = () => {
        if (isLoggedIn) {
            navigate('/profile');
        } else {
            openLogin();
        }
    };

    const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-white/70 dark:bg-black/70 backdrop-blur-lg border-b border-gray-100 dark:border-white/5 px-6 pt-safe-top pb-3 h-[60px] flex items-center justify-between transition-colors">
            <button onClick={() => setCorporateDrawerOpen(true)} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-black border border-yellow-600/50 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                    <img src={Assets.logo.min} alt="CMG" className="w-full h-full object-cover p-0.5" />
                </div>
                <span className="font-serif font-bold text-lg text-black dark:text-white tracking-wide">CMG</span>
            </button>
            <div className="flex items-center gap-2">
                <Link to="/concierge" className="text-gray-500 dark:text-gray-400 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <Headset size={20} />
                </Link>
                {/* Language Selector */}
                <div className="relative">
                    <button 
                        onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                        className="text-gray-500 dark:text-gray-400 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
                    >
                        <Globe size={18} />
                        <span className="text-xs">{currentLanguage.flag}</span>
                    </button>
                    {isLanguageDropdownOpen && (
                        <>
                            <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsLanguageDropdownOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-800 min-w-[140px] z-50 overflow-hidden">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            setLanguage(lang.code);
                                            setIsLanguageDropdownOpen(false);
                                        }}
                                        className={`w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                                            language === lang.code ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                        }`}
                                    >
                                        <span className="text-base">{lang.flag}</span>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lang.nativeName}</span>
                                        {language === lang.code && (
                                            <Check size={14} className="ml-auto text-yellow-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
                <button onClick={toggleTheme} className="text-gray-500 dark:text-gray-400 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    {themeMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button onClick={handleUserClick} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden border border-gray-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors">
                    {isLoggedIn && user?.avatar ? (
                        <img src={user.avatar} alt={user.nickname} className="w-full h-full object-cover" />
                    ) : (
                        <LogIn size={18} className="text-gray-500 dark:text-gray-400" />
                    )}
                </button>
            </div>
        </header>
    )
}

// --- Mobile Bottom Navigation ---
const BottomNav: React.FC<{onMenuClick: () => void}> = ({onMenuClick}) => {
    const location = useLocation();
    const { t } = useAppContext();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="fixed bottom-6 left-4 right-4 bg-gradient-to-r from-black/90 to-purple-900/90 dark:from-black/90 dark:to-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full py-3 px-6 shadow-[0_10px_30px_rgba(0,0,0,0.3)] z-50 flex justify-between items-center h-[70px]">
            <Link to="/" className={`flex flex-col items-center gap-1 transition-all ${isActive('/') ? 'text-yellow-500 scale-105' : 'text-zinc-400 hover:text-white'}`}>
                <Calendar size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.home')}</span>
            </Link>

            <Link to="/resort" className={`flex flex-col items-center gap-1 transition-all ${isActive('/resort') ? 'text-yellow-500 scale-105' : 'text-zinc-400 hover:text-white'}`}>
                <Umbrella size={22} strokeWidth={isActive('/resort') ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.resort')}</span>
            </Link>

            <div className="relative -top-6">
                <Link to="/vip" className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full shadow-lg border-4 border-zinc-900 hover:scale-105 transition-transform">
                    <Crown size={24} className="text-black fill-black/20" />
                </Link>
            </div>

            <Link to="/golf" className={`flex flex-col items-center gap-1 transition-all ${isActive('/golf') ? 'text-yellow-500 scale-105' : 'text-zinc-400 hover:text-white'}`}>
                <Flag size={22} strokeWidth={isActive('/golf') ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.golf')}</span>
            </Link>

            <button onClick={onMenuClick} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors">
                <LayoutGrid size={22} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{t('nav.menu')}</span>
            </button>
        </div>
    );
}

const AppContent: React.FC = () => {
  const { t, openLogin, openRegister, language, setLanguage, isLoggedIn } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false); 
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white selection:bg-yellow-500 selection:text-black">
        {/* Hide header on Login/Register pages for clean look */}
        {!['/login', '/register'].includes(location.pathname) && <MobileHeader />}
        
        {/* Drawer Overlays */}
        <CorporateDrawer />
        <HotelBookingDrawer />
        <ShootingBookingDrawer />
        <GolfBookingDrawer />

        <main className={`${!['/login', '/register'].includes(location.pathname) ? 'pt-[60px]' : ''} flex-grow animate-fade-in relative z-0`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shooting" element={<ShootingRange />} />
            <Route path="/security" element={<Security />} />
            <Route path="/mining" element={<RareEarth />} />
            <Route path="/resort" element={<Resort />} />
            <Route path="/golf" element={<Golf />} />
            <Route path="/vip" element={<VIP />} />
            <Route path="/concierge" element={<Concierge />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/about" element={<About />} />
            <Route path="/download-app" element={<DownloadApp />} />
          </Routes>
        </main>
        
        {/* Hide Bottom Nav on Login/Register pages */}
        {!['/login', '/register'].includes(location.pathname) && <BottomNav onMenuClick={() => setIsMobileMenuOpen(true)} />}

        {/* Mobile More Menu Drawer */}
        {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[60]">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-[2rem] p-6 animate-slide-up pb-[env(safe-area-inset-bottom)]">
                    <div className="w-12 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mb-6"></div>
                    
                    <h3 className="text-xl font-serif font-bold mb-6 pl-2">{t('common.services')}</h3>
                    <div className="grid grid-cols-4 gap-4 mb-8">
                         <Link to="/shooting" className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                <Target size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center">{t('nav.shooting')}</span>
                         </Link>
                         <Link to="/resort" className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                <FerrisWheel size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center">{t('nav.tourism')}</span>
                         </Link>
                         <Link to="/security" className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                <Shield size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center">{t('nav.security')}</span>
                         </Link>
                         <Link to="/mining" className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                <Pickaxe size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center">{t('nav.mining')}</span>
                         </Link>
                         <Link to="/resort" className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                <Building2 size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center">{t('nav.realestate')}</span>
                         </Link>
                         <Link to="/concierge" className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                <Headset size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center">{t('corporate.concierge')}</span>
                         </Link>
                         <Link to="/settings" className="flex flex-col items-center gap-2">
                             <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                 <SettingsIcon size={24}/>
                             </div>
                             <span className="text-xs font-medium text-center">{t('settings.title')}</span>
                         </Link>
                         <div className="relative flex flex-col items-center gap-2">
                            <button 
                                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                                className="flex flex-col items-center gap-2 w-full"
                            >
                                <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 rounded-2xl flex items-center justify-center hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors">
                                    <Globe size={24}/>
                                </div>
                                <span className="text-xs font-medium text-center">{t('common.switchLanguage')}</span>
                            </button>
                            {isLanguageMenuOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-[70]" 
                                        onClick={() => setIsLanguageMenuOpen(false)}
                                    />
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-800 min-w-[160px] z-[80] overflow-hidden">
                                        {languages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                onClick={() => {
                                                    setLanguage(lang.code);
                                                    setIsLanguageMenuOpen(false);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                                                    language === lang.code ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                                }`}
                                            >
                                                <span className="text-base">{lang.flag}</span>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lang.nativeName}</span>
                                                {language === lang.code && (
                                                    <Check size={14} className="ml-auto text-yellow-600" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                         </div>
                         {/* APP Download - Keep but not linked */}
                         <div className="flex flex-col items-center gap-2 opacity-50">
                            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 rounded-2xl flex items-center justify-center">
                                <Download size={24}/>
                            </div>
                            <span className="text-xs font-medium text-center text-gray-400 dark:text-zinc-600">App</span>
                         </div>
                    </div>

                    <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl p-2 mb-6">
                        {isLoggedIn ? (
                             <Link to="/profile" className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl transition-colors">
                                 <span className="font-medium text-yellow-600">{t('profile.title')}</span>
                                 <ArrowRight size={16} className="text-gray-400"/>
                             </Link>
                        ) : (
                            <>
                                <div onClick={openLogin} className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700/50 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-t-xl transition-colors">
                                    <span className="font-medium">{t('auth.login')}</span>
                                    <ArrowRight size={16} className="text-gray-400"/>
                                </div>
                                <div onClick={openRegister} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-b-xl transition-colors">
                                    <span className="font-medium">{t('auth.register')}</span>
                                    <ArrowRight size={16} className="text-gray-400"/>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

// Provider Wrapper to separate Router context from Provider logic
const AppProvider: React.FC<{
    children: React.ReactNode; 
    language: Language; 
    setLanguage: (l: Language) => void;
    themeMode: 'light' | 'dark';
    toggleTheme: () => void;
    t: (k: string) => string;
}> = ({ children, language, setLanguage, themeMode, toggleTheme, t }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(() => {
        // Load user from localStorage on init
        try {
            const savedUser = localStorage.getItem('cmg-user');
            if (savedUser) {
                return JSON.parse(savedUser);
            }
        } catch (e) {
            console.error('Failed to load user from storage', e);
        }
        return null;
    });
    const [isCorporateDrawerOpen, setCorporateDrawerOpen] = useState(false);
    const [isHotelDrawerOpen, setHotelDrawerOpen] = useState(false);
    const [isShootingDrawerOpen, setShootingDrawerOpen] = useState(false);
    const [isGolfDrawerOpen, setGolfDrawerOpen] = useState(false);

    const isLoggedIn = user !== null;

    const openLogin = () => navigate('/login');
    const openRegister = () => navigate('/register');
    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem('cmg-user', JSON.stringify(userData));
        navigate('/profile');
    };
    const logout = () => {
        setUser(null);
        localStorage.removeItem('cmg-user');
        navigate('/');
    };

    return (
        <AppContext.Provider value={{ 
            language, setLanguage, themeMode, toggleTheme, t, 
            openLogin, openRegister, isLoggedIn, user, login, logout, 
            isCorporateDrawerOpen, setCorporateDrawerOpen,
            isHotelDrawerOpen, setHotelDrawerOpen,
            isShootingDrawerOpen, setShootingDrawerOpen,
            isGolfDrawerOpen, setGolfDrawerOpen
        }}>
            {children}
        </AppContext.Provider>
    );
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('zh');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedLang = localStorage.getItem('cmg-lang') as Language;
    // Validate language code
    const validLanguages: Language[] = ['en', 'zh', 'lo', 'ja'];
    if (savedLang && validLanguages.includes(savedLang)) {
      setLanguage(savedLang);
    } else {
      // Default to browser language or English
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'zh') {
        setLanguage('zh');
      } else {
        setLanguage('en');
      }
    }
    
    const savedTheme = localStorage.getItem('cmg-theme') as 'light' | 'dark';
    if (savedTheme) {
        setThemeMode(savedTheme);
    } else {
        setThemeMode('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cmg-lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('cmg-theme', themeMode);
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const t = (key: string): string => {
    return getTranslation(language, key);
  };

  return (
    <HashRouter>
        <AppProvider language={language} setLanguage={setLanguage} themeMode={themeMode} toggleTheme={toggleTheme} t={t}>
            <AppContent />
        </AppProvider>
    </HashRouter>
  );
};

export default App;
