
import React from 'react';
import { Crown, Star, Key, ShieldCheck, Diamond, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const VIP: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen pb-24 bg-mil-base transition-colors duration-300">
        {/* VIP Header - Gold Theme */}
        <div className="bg-white dark:bg-gradient-to-b dark:from-yellow-900/30 dark:via-slate-900 dark:to-mil-base p-8 text-center border-b border-yellow-500/30 dark:border-yellow-600/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
            <Crown className="w-14 h-14 text-yellow-500 mx-auto mb-3 drop-shadow-md dark:drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse" />
            <h1 className="text-3xl font-black text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-yellow-300 dark:to-yellow-700 uppercase tracking-widest">
                {t.vip.title}
            </h1>
            <p className="text-[10px] font-mono text-yellow-600 dark:text-yellow-500/80 mt-2 tracking-[0.3em]">{t.vip.subtitle}</p>
            
            {isAuthenticated && (
                <div className="mt-4 inline-block bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/50 px-4 py-1 rounded-full">
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-bold uppercase">{t.vip.status}: VIP {user?.vipLevel}</span>
                </div>
            )}
        </div>

        <div className="p-4 space-y-8">
            
            {/* Exclusive Wealth Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-2">
                        <Diamond className="w-4 h-4" /> {t.vip.treasury}
                    </h2>
                    <span className="text-[9px] bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 px-2 py-0.5 border border-yellow-200 dark:border-yellow-900/50">{t.vip.level1}</span>
                </div>
                
                <div className="grid gap-4">
                    {/* Gold Card 1 */}
                    <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-yellow-600/40 p-1 rounded-sm relative group overflow-hidden shadow-md dark:shadow-none">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all"></div>
                        <div className="p-4 relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.vip.card1_title}</h3>
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-mono">
                                {t.vip.card1_desc}
                            </p>
                            <div className="flex items-end justify-between border-t border-slate-100 dark:border-slate-700/50 pt-3">
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through block">{t.vip.price_1_old}</span>
                                    <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{t.vip.price_1_new} <span className="text-[10px]">{t.vip.per_year}</span></span>
                                </div>
                                <button className="bg-yellow-500 text-white dark:text-black font-bold text-xs px-4 py-2 uppercase hover:bg-yellow-600 dark:hover:bg-yellow-500 transition-colors clip-corner-top">
                                    {t.vip.acquire}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Gold Card 2 */}
                    <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-yellow-600/40 p-1 rounded-sm relative group overflow-hidden shadow-md dark:shadow-none">
                        <div className="p-4 relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.vip.card2_title}</h3>
                                <Key className="w-5 h-5 text-yellow-500" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-mono">
                                {t.vip.card2_desc}
                            </p>
                            <div className="flex items-end justify-between border-t border-slate-100 dark:border-slate-700/50 pt-3">
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through block">{t.vip.price_2_old}</span>
                                    <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{t.vip.price_2_new} <span className="text-[10px]">{t.vip.comp}</span></span>
                                </div>
                                <button className="border border-yellow-500 text-yellow-600 dark:text-yellow-500 font-bold text-xs px-4 py-2 uppercase hover:bg-yellow-50 dark:hover:bg-yellow-600/10 transition-colors clip-corner-top">
                                    {t.vip.activate}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Locked High Level Content */}
            <div className="relative p-6 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-sm overflow-hidden text-center opacity-70">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 dark:opacity-20"></div>
                <Lock className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 uppercase">{t.vip.black_zone}</h3>
                <p className="text-xs text-slate-500 mb-4">{t.vip.black_req}</p>
                <div className="blur-sm select-none pointer-events-none">
                    <p className="text-xs text-slate-600">{t.vip.black_details}</p>
                </div>
            </div>
            
             <div className="bg-white dark:bg-mil-light p-4 rounded-sm flex items-center gap-4 border-l-2 border-yellow-600 shadow-lg">
                <ShieldCheck className="w-8 h-8 text-yellow-600" />
                <div>
                    <h4 className="font-bold text-sm text-yellow-600 dark:text-yellow-500 uppercase">{t.vip.concierge}</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.vip.concierge_desc}</p>
                </div>
             </div>
        </div>
    </div>
  );
};

export default VIP;