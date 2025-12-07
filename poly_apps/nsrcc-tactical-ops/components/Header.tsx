import React from 'react';
import { Settings, Shield, User } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { PageRoutes } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 bg-mil-base/95 backdrop-blur-md border-b border-slate-700 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-colors duration-300 pt-safe">
      <div className="h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(PageRoutes.HOME)}>
            <div className="relative">
                <Shield className={`w-7 h-7 ${isAuthenticated ? 'text-tac-green' : 'text-slate-500'}`} />
                {isAuthenticated && <div className="absolute top-0 right-0 w-2 h-2 bg-tac-green rounded-full animate-pulse"></div>}
            </div>
            <div className="flex flex-col">
            <span className="font-black text-lg tracking-[0.2em] leading-none text-mil-base transition-colors uppercase whitespace-nowrap">{t.app.name}</span>
            <span className="text-[9px] text-tac-orange font-mono tracking-tighter uppercase">{t.app.subtitle}</span>
            </div>
        </div>
        
        {isAuthenticated ? (
            <button 
                onClick={() => navigate(PageRoutes.SETTINGS)}
                className="flex items-center gap-2 p-1 pl-3 pr-1 rounded-full bg-slate-800 border border-slate-600 hover:border-tac-orange transition-all"
            >
                <div className="flex flex-col items-end mr-1">
                    <span className="text-[10px] font-bold text-tac-gold leading-none">{t.common.vip} {user?.vipLevel}</span>
                    <span className="text-[9px] text-slate-400 font-mono leading-none">{user?.name}</span>
                </div>
                <div className="p-1.5 bg-slate-700 rounded-full">
                    <Settings className="w-4 h-4 text-slate-300" />
                </div>
            </button>
        ) : (
            <button 
                onClick={() => navigate(PageRoutes.LOGIN)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-tac-orange/10 border border-tac-orange text-tac-orange hover:bg-tac-orange hover:text-white transition-all"
            >
                <span className="text-xs font-bold uppercase tracking-wider">{t.common.login}</span>
                <User className="w-4 h-4" />
            </button>
        )}
      </div>
    </header>
  );
};

export default Header;