import React, { useState } from 'react';
import { Shield, Lock, User, ChevronRight, Fingerprint } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageRoutes } from '../types';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      login(username || 'Operative');
      navigate(PageRoutes.HOME);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-mil-base flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://picsum.photos/1000/1000?grayscale&blur=10')] opacity-20 dark:opacity-10 bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-mil-base via-transparent to-transparent"></div>

        <div className="w-full max-w-md bg-white/80 dark:bg-mil-light/90 backdrop-blur-xl border border-white dark:border-slate-700 p-8 rounded-sm shadow-2xl relative z-10 clip-corner">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-tac-orange to-transparent"></div>
            
            <div className="text-center mb-10">
                <Shield className="w-16 h-16 text-tac-orange mx-auto mb-4 animate-pulse-fast" />
                <h1 className="text-3xl font-black text-slate-800 dark:text-mil-base uppercase tracking-[0.2em] mb-1">{t.app.name}</h1>
                <p className="text-xs text-slate-500 font-mono tracking-widest">{t.login.subtitle}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t.login.id_label}</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-tac-orange transition-colors" />
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="ENTER ID" 
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-mil-base pl-10 pr-4 py-3 text-sm font-mono rounded-sm focus:border-tac-orange focus:ring-1 focus:ring-tac-orange outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t.login.pass_label}</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-tac-orange transition-colors" />
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-mil-base pl-10 pr-4 py-3 text-sm font-mono rounded-sm focus:border-tac-orange focus:ring-1 focus:ring-tac-orange outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600"
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-tac-orange hover:bg-orange-600 text-white font-bold py-4 uppercase tracking-[0.2em] clip-corner relative overflow-hidden group transition-all"
                >
                    {isLoading ? (
                         <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>{t.login.btn_loading}</span>
                         </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 group-hover:gap-4 transition-all">
                            <span>{t.login.btn_init}</span>
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
                <button className="flex items-center justify-center gap-2 mx-auto text-slate-500 hover:text-tac-orange transition-colors text-xs font-mono uppercase tracking-wider">
                    <Fingerprint className="w-4 h-4" />
                    {t.login.bio}
                </button>
            </div>
        </div>
        
        <div className="mt-8 text-[10px] text-slate-500 dark:text-slate-600 font-mono text-center">
            {t.login.system_ver}
        </div>
    </div>
  );
};

export default Login;