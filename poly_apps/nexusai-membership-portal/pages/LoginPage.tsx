
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HISTORICAL_UPTIME, Icons } from '../constants';
import { useAppContext } from '../App';
import UptimeBar from '../components/UptimeBar';
import ModelStatusCard from '../components/ModelStatusCard';
import Logo from '../components/Logo';
import AnnouncementCenter from '../components/AnnouncementCenter';
import LanguageSelector from '../components/LanguageSelector';

const LoginPage = () => {
  const { setUser, t, state, stateCenter, theme, setTheme } = useAppContext();
  const [email, setEmail] = useState('');
  
  // Get availability data from state center
  const availabilityData = state.availabilityData.length > 0 
    ? state.availabilityData 
    : stateCenter.getAvailability();
  
  // Load availability data on mount
  useEffect(() => {
    stateCenter.refreshAvailability();
  }, [stateCenter]);
  
  return (
    <div className="min-h-screen relative flex flex-col overflow-x-visible">
      {/* Top Navigation Bar */}
      <div className="relative z-50 w-full glass border-b dark:border-white/5 border-slate-200">
        <div className="max-w-[1700px] mx-auto px-6 sm:px-12 md:px-20 py-6">
          <div className="flex items-center justify-between">
            <Logo className="scale-90" />
            
            <div className="flex items-center gap-4">
              {/* Navigation Links */}
              <Link 
                to="/subscribe" 
                className="px-6 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-500 hover:bg-blue-600/15 hover:text-blue-500 transition-all"
              >
                {t.subscribeCenter}
              </Link>
              <Link 
                to="/pricing" 
                className="px-6 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-500 hover:bg-blue-600/15 hover:text-blue-500 transition-all"
              >
                {t.modelPricing}
              </Link>
              <Link 
                to="/docs" 
                className="px-6 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest dark:text-slate-400 text-slate-500 hover:bg-blue-600/15 hover:text-blue-500 transition-all"
              >
                {t.docs}
              </Link>
              
              {/* Theme Toggle */}
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-12 h-12 rounded-[1.5rem] bg-slate-500/5 flex items-center justify-center hover:bg-blue-600/15 transition-all text-blue-500 shadow-lg"
                title={theme === 'dark' ? t.lightMode : t.darkMode}
              >
                <Icons.Zap />
              </button>
              
              {/* Language Selector */}
              <LanguageSelector />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-end p-4 sm:p-12 md:p-24 overflow-x-visible">
        <div className="w-full max-w-[1700px] mx-auto relative h-full">
          {/* Dynamic Cinematic Content (Left Side) */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-x-visible">
          <div className="absolute top-[55%] left-12 md:left-24 -translate-y-1/2 max-w-4xl w-auto right-[650px] hidden lg:block animate-in fade-in slide-in-from-left-10 duration-1000">
            <div className="space-y-12">
              <div className="max-w-xl">
                <h2 className="text-7xl font-black leading-none tracking-tighter dark:text-white text-slate-900 mb-8">
                  <span>{t.loginEnter} </span>
                  <span className="gradient-text italic">{t.loginMultiModel}</span>
                </h2>
                <p className="text-xl dark:text-slate-400 text-slate-600 font-medium max-w-xl leading-relaxed mb-10">
                  {t.loginDescription}
                </p>
              </div>
              
              {/* Announcement Center */}
              <div className="pointer-events-auto max-w-xl">
                <AnnouncementCenter />
              </div>
              
              {/* Multi-AI Availability History on Home Page */}
              <Link to="/status" className="grid grid-cols-2 gap-4 max-w-xl pointer-events-auto group">
                {availabilityData.slice(0, 4).map((service, index) => (
                  <div key={`${service.name}-${index}`} className="group-hover:scale-[1.02] transition-transform cursor-pointer">
                    <ModelStatusCard service={service} />
                  </div>
                ))}
                <div className="col-span-2 glass p-6 rounded-[2rem] border-blue-500/10 mt-4 group-hover:border-blue-500/30 transition-all cursor-pointer">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] group-hover:text-blue-500 transition-colors">{t.globalBackbonePulse}</span>
                      <span className="text-[10px] font-black text-green-500 group-hover:text-blue-500 transition-colors">{t.healthStatus}</span>
                   </div>
                   <UptimeBar history={HISTORICAL_UPTIME.slice(0, 30)} size="h-6" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Login Card (Right Side Float) */}
        <div className="relative z-10 w-full max-w-2xl ml-auto mr-16 animate-in zoom-in-95 fade-in duration-1000">
          <div className="glass p-12 md:p-16 pr-20 md:pr-24 rounded-[4rem] border-white/10 dark:border-white/5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] bg-white/10 dark:bg-white/[0.01] backdrop-blur-3xl">
            <div className="lg:hidden mb-12 flex justify-center"><Logo /></div>
            
            <div className="mb-12">
              <h1 className="text-4xl font-black tracking-tight mb-3 dark:text-white text-slate-900 italic pr-16">{t.loginTitle}</h1>
              <p className="dark:text-slate-500 text-slate-500 font-medium text-sm">{t.loginSubtitle}</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setUser({ name: 'Creator', email }); }} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-[0.2em] px-1">{t.email}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none text-blue-500">
                     <Icons.Shield />
                  </div>
                  <input 
                    required
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="w-full bg-slate-500/5 dark:bg-white/5 border dark:border-white/10 border-slate-200 rounded-[2rem] py-5 pl-16 pr-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black dark:text-slate-500 text-slate-400 uppercase tracking-[0.2em] px-1">{t.password}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-7 flex items-center pointer-events-none text-purple-500">
                     <Icons.Zap />
                  </div>
                  <input 
                    required
                    type="password" 
                    placeholder={t.passwordPlaceholder}
                    className="w-full bg-slate-500/5 dark:bg-white/5 border dark:border-white/10 border-slate-200 rounded-[2rem] py-5 pl-16 pr-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                  />
                </div>
              </div>
              
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] transition-all glow-button shadow-2xl shadow-blue-500/30 uppercase tracking-[0.3em] text-[10px]">
                {t.signIn}
              </button>
            </form>

            <div className="mt-14 pt-10 border-t dark:border-white/5 border-slate-200">
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 text-center">{t.infrastructureVersion}</div>
               <div className="flex justify-around items-center">
                  {[t.modelClaude, t.modelGemini, t.modelGpt4].map(model => (
                    <div key={model} className="flex flex-col items-center gap-1 group">
                      <div className="text-[9px] font-black italic text-slate-500 group-hover:text-blue-500 transition-colors">{model}</div>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                  ))}
               </div>
            </div>
            
            <p className="text-center text-[9px] dark:text-slate-700 text-slate-400 mt-12 uppercase tracking-[0.5em] font-black">{t.demoAccount}</p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

