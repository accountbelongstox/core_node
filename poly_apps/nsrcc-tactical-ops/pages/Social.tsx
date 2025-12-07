import React, { useState } from 'react';
import { Target, Crown, Dumbbell, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { PageRoutes } from '../types';
import { useLanguage } from '../context/LanguageContext';

enum SocialTab {
  SPORTS = 'SPORTS',
  RECREATION = 'REC',
  RETAIL = 'RETAIL',
  VIP = 'VIP'
}

const Social: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SocialTab>(SocialTab.SPORTS);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const tabs = [
    { id: SocialTab.SPORTS, icon: Dumbbell, label: t.social.tab_ops },
    { id: SocialTab.RECREATION, icon: ShoppingBag, label: t.social.tab_rec }, 
    { id: SocialTab.VIP, icon: Crown, label: t.social.tab_vip },
  ];

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-mil-base transition-colors duration-300">
       {/* Tab Navigation */}
       <div className="grid grid-cols-3 bg-white dark:bg-mil-light border-b border-slate-200 dark:border-slate-700 sticky top-16 z-40">
          {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                    flex items-center justify-center gap-2 py-4 text-xs font-bold tracking-widest transition-colors relative
                    ${activeTab === tab.id ? 'text-tac-orange bg-slate-50 dark:bg-slate-800' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}
                `}
              >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-tac-orange shadow-[0_0_10px_#f97316]"></div>
                  )}
              </button>
          ))}
       </div>

       <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === SocialTab.SPORTS && (
              <div className="space-y-4 animate-fade-in">
                  {/* Shooting Range Card */}
                  <div 
                    onClick={() => navigate(PageRoutes.SHOOTING)}
                    className="bg-[url('https://picsum.photos/600/300?grayscale')] bg-cover bg-center rounded-sm overflow-hidden border border-slate-300 dark:border-slate-600 relative group cursor-pointer h-40 shadow-sm"
                  >
                      <div className="absolute inset-0 bg-slate-900/70 group-hover:bg-slate-900/50 transition-all"></div>
                      <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4">
                          <Target className="w-10 h-10 text-tac-orange mb-2" />
                          <h3 className="text-xl font-bold uppercase tracking-widest text-white">{t.social.shooting_title}</h3>
                          <p className="text-[10px] text-slate-300 font-mono mt-1">{t.social.shooting_sub}</p>
                      </div>
                      <div className="absolute bottom-0 right-0 bg-tac-orange text-white px-3 py-1 text-xs font-bold flex items-center gap-1 clip-corner-top">
                          {t.social.book_now} <ArrowUpRight className="w-3 h-3" />
                      </div>
                  </div>

                  {/* Gym Card */}
                  <div className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-4 rounded-sm flex items-center justify-between shadow-sm dark:shadow-none">
                      <div className="flex items-center gap-3">
                          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-sm">
                              <Dumbbell className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                              <h3 className="font-bold text-sm uppercase text-mil-base">{t.social.training}</h3>
                              <p className="text-xs text-slate-500">{t.social.hours}</p>
                          </div>
                      </div>
                      <button className="text-xs border border-slate-300 dark:border-slate-600 px-3 py-1 text-slate-500 dark:text-slate-400 rounded-sm hover:border-tac-orange hover:text-tac-orange transition-colors">{t.social.info}</button>
                  </div>
              </div>
          )}

          {activeTab === SocialTab.VIP && (
              <div className="space-y-4 text-center py-8">
                  <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-mil-base">{t.social.restricted}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t.social.clearance}</p>
                  <button 
                    onClick={() => navigate(PageRoutes.VIP)}
                    className="bg-yellow-500/10 dark:bg-yellow-600/20 border border-yellow-600 text-yellow-600 dark:text-yellow-500 px-6 py-2 rounded-sm uppercase tracking-widest text-xs font-bold hover:bg-yellow-600 hover:text-white transition-colors"
                  >
                    {t.social.enter_vip}
                  </button>
              </div>
          )}
          
          {activeTab === SocialTab.RECREATION && (
              <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="bg-white dark:bg-mil-light border border-slate-200 dark:border-slate-700 p-3 rounded-sm text-center shadow-sm">
                          <div className="w-full h-20 bg-slate-100 dark:bg-slate-800 mb-2 rounded-sm"></div>
                          <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 mx-auto rounded-full"></div>
                      </div>
                  ))}
              </div>
          )}
       </div>
    </div>
  );
};

export default Social;