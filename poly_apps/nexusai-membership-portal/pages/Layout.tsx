
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from '../constants';
import { useAppContext } from '../App';
import Logo from '../components/Logo';
import LanguageSelector from '../components/LanguageSelector';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang, setLang, theme, setTheme, user, setUser, t } = useAppContext();
  const location = useLocation();

  const navItems = [
    { name: t.dashboard, path: '/', icon: <Icons.Cpu /> },
    { name: t.membership, path: '/membership', icon: <Icons.Zap /> },
    { name: t.apiKeys, path: '/keys', icon: <Icons.Shield /> },
    { name: t.docs, path: '/docs', icon: <Icons.Activity /> },
    { name: t.settings, path: '/settings', icon: <Icons.Check /> },
  ];

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Mobile/Desktop Sidebar */}
      <aside className="w-80 h-screen border-r dark:border-white/5 border-slate-200 hidden lg:flex flex-col p-12 bg-white/20 dark:bg-black/10 backdrop-blur-3xl z-50 shrink-0">
        <Logo className="mb-24 scale-110 origin-left" />
        
        <nav className="space-y-5 flex-grow overflow-y-auto custom-scrollbar pr-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`flex items-center gap-6 p-6 rounded-[2rem] transition-all font-black italic tracking-tight text-[11px] uppercase group ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/50' 
                    : 'dark:text-slate-500 text-slate-500 hover:bg-blue-600/15'
                }`}
              >
                <span className={`transition-transform group-hover:scale-110 group-hover:rotate-6 ${isActive ? 'text-white' : 'text-blue-500'}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="pt-12 border-t dark:border-white/5 border-slate-200 space-y-10">
          <div className="flex items-center justify-between px-3">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-14 h-14 rounded-[1.5rem] bg-slate-500/5 flex items-center justify-center hover:bg-blue-600/15 transition-all text-blue-500 shadow-lg"
              title={t.themeToggle}
            >
              <Icons.Zap />
            </button>
            <LanguageSelector variant="compact" />
          </div>

          <div className="p-7 bg-slate-500/5 rounded-[2.5rem] border border-dashed dark:border-white/10 border-slate-200 group relative overflow-hidden">
             <div className="flex items-center gap-5 mb-5 relative z-10">
                <img src="https://picsum.photos/id/1012/100/100" className="w-12 h-12 rounded-2xl shadow-xl group-hover:scale-110 transition-transform" />
                <div className="overflow-hidden">
                   <div className="text-[11px] font-black italic truncate group-hover:text-blue-500 transition-colors">{user.name}</div>
                   <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] truncate">{t.neuralNode}</div>
                </div>
             </div>
             <button 
               onClick={() => setUser(null)}
               className="w-full py-4 text-[9px] font-black uppercase tracking-[0.4em] dark:text-slate-600 text-slate-500 hover:text-red-500 transition-colors text-center relative z-10"
             >
               {t.logout}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow h-screen overflow-y-auto relative custom-scrollbar">
        <div className="p-6 sm:p-12 md:p-20 max-w-[1700px] mx-auto min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
