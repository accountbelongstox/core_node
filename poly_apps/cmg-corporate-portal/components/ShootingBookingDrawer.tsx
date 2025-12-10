
import React from 'react';
import { X, ArrowRight, Target, Star, Crown, Percent, Crosshair, Shield, Sparkles, Gift, ChevronLeft, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { mockHomeActivitiesData } from '../data';

const ShootingBookingDrawer: React.FC = () => {
  const { isShootingDrawerOpen, setShootingDrawerOpen, t, isLoggedIn, openRegister } = useAppContext();
  const navigate = useNavigate();
  const dropdown = mockHomeActivitiesData.dropdowns.find(d => d.type === 'shooting');
  const vipPrivileges = mockHomeActivitiesData.vipPrivileges;

  if (!isShootingDrawerOpen || !dropdown) return null;

  const getVIPIcon = (icon: string) => {
    switch (icon) {
      case 'star':
        return <Star size={18} className="text-red-600 dark:text-red-500" />;
      case 'crown':
        return <Crown size={18} className="text-red-600 dark:text-red-500" />;
      case 'percent':
        return <Percent size={18} className="text-red-600 dark:text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setShootingDrawerOpen(false)}
      ></div>

      {/* Fixed Back Button - Top Left */}
      <button
        onClick={() => setShootingDrawerOpen(false)}
        className="fixed top-4 left-4 z-[60] w-12 h-12 rounded-full bg-white dark:bg-zinc-800 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-lg border border-gray-200 dark:border-white/10"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Fixed Pull Up Button - Center Above Bottom Nav */}
      <button 
        onClick={() => setShootingDrawerOpen(false)}
        className="fixed bottom-[90px] left-1/2 transform -translate-x-1/2 z-[60] w-14 h-14 rounded-full bg-white dark:bg-zinc-800 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-lg border border-gray-200 dark:border-white/10"
      >
        <ChevronUp size={24} />
      </button>

      {/* Drawer Content */}
      <div className="relative bg-stone-100 dark:bg-zinc-900 text-gray-900 dark:text-white rounded-b-[3rem] shadow-2xl overflow-hidden animate-slide-down max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col">
        
        {/* Banner */}
        <div className="relative h-72 overflow-hidden shrink-0">
          <img 
            src={dropdown.bannerImage} 
            alt={t(dropdown.titleKey)} 
            className="w-full h-full object-cover filter contrast-125 grayscale-[30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-red-950/90 via-red-900/20 to-transparent mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
          
          {/* Header Controls */}
          <div className="absolute top-safe-top right-6 flex items-center pt-4">
            <button
              onClick={() => setShootingDrawerOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors text-white border border-white/20"
            >
              <X size={20} />
            </button>
          </div>

          <div className="absolute bottom-8 left-8 right-8">
             <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-red-600/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-red-500/50">
                    <Target size={12} /> Tactical Range
                </span>
             </div>
             <h2 className="text-4xl font-black italic text-white mb-2 leading-none tracking-tight uppercase">{t(dropdown.titleKey)}</h2>
             <p className="text-red-100/80 text-sm font-medium font-mono">{t('home.dropdowns.shooting.subtitle')}</p>
          </div>
        </div>

        <div className="px-8 py-10 bg-white dark:bg-zinc-900 pb-20">
          
          {/* Packages */}
          <div className="space-y-5 mb-10">
            <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-white/5 pb-2">
                <h3 className="font-bold text-lg uppercase tracking-wide text-gray-900 dark:text-white">Elite Packages</h3>
                <button onClick={() => navigate(dropdown.link)} className="text-red-600 dark:text-red-500 text-[10px] font-bold uppercase flex items-center gap-1 hover:gap-2 transition-all">View All <ArrowRight size={12}/></button>
            </div>
            
            {dropdown.items.map((item) => (
              <div
                key={item.id}
                className="bg-stone-50 dark:bg-zinc-800/60 rounded-xl p-1 border-l-4 border-l-red-600 border-y border-r border-gray-100 dark:border-white/5 hover:bg-red-50 dark:hover:bg-zinc-800 transition-all shadow-sm cursor-pointer group"
                onClick={() => navigate(dropdown.link)}
              >
                <div className="flex gap-4 p-3">
                  {item.image && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-md grayscale hover:grayscale-0 transition-all">
                      <img src={item.image} alt={t(item.titleKey)} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-black text-gray-900 dark:text-white text-sm mb-1 uppercase tracking-tight">{t(item.titleKey)}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-2 font-mono">{t(item.descriptionKey)}</p>
                    
                    {item.priceKey && (
                      <div className="flex items-center justify-between">
                        <span className="text-red-700 dark:text-red-500 font-black text-lg font-mono tracking-tighter">{t(item.priceKey)}</span>
                        <div className="bg-red-700 dark:bg-red-600 text-white w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={12} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Training Events */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Crosshair size={16} className="text-red-600 dark:text-red-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('home.dropdowns.latestActivities')}</h3>
            </div>
            <div className="flex flex-col gap-3">
              {dropdown.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white dark:bg-zinc-800/40 rounded-xl p-3 border border-gray-200 dark:border-white/5 flex gap-4 items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
                >
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
                        <img src={activity.image} alt={t(activity.titleKey)} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-xs">{t(activity.titleKey)}</h4>
                            {activity.badge && (
                                <span className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {t(activity.badge)}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug font-mono">{t(activity.descriptionKey)}</p>
                    </div>
                </div>
              ))}
            </div>
          </div>

          {/* Member Privileges */}
          <div className="bg-zinc-900 text-white rounded-3xl p-6 border border-zinc-800 shadow-md relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Target size={120} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6 border-b border-zinc-700/50 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-red-900/20 rounded border border-red-500/30 text-red-500">
                        <Crown size={16} />
                    </div>
                    <h3 className="text-base font-bold uppercase tracking-widest">{t('home.vipPrivileges.title')}</h3>
                </div>
                {!isLoggedIn && (
                    <button
                    onClick={openRegister}
                    className="text-red-500 text-[10px] font-bold hover:text-white transition-colors uppercase tracking-wider"
                    >
                    {t('home.vipPrivileges.joinVIP')}
                    </button>
                )}
                </div>
                
                <div className="grid gap-5">
                {vipPrivileges.map((privilege) => (
                    <div key={privilege.id} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-red-500 border border-zinc-700">
                        {getVIPIcon(privilege.icon)}
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white text-xs mb-1 uppercase tracking-wide">{t(privilege.titleKey)}</h4>
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-mono">{t(privilege.descriptionKey)}</p>
                    </div>
                    </div>
                ))}
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ShootingBookingDrawer;
