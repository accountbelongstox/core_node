
import React from 'react';
import { X, ArrowRight, Trophy, Star, Crown, Percent, Flag, Calendar, Sparkles, Gift, ChevronLeft, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { mockHomeActivitiesData } from '../data';

const GolfBookingDrawer: React.FC = () => {
  const { isGolfDrawerOpen, setGolfDrawerOpen, t, isLoggedIn, openRegister } = useAppContext();
  const navigate = useNavigate();
  const dropdown = mockHomeActivitiesData.dropdowns.find(d => d.type === 'golf');
  const vipPrivileges = mockHomeActivitiesData.vipPrivileges;

  if (!isGolfDrawerOpen || !dropdown) return null;

  const getVIPIcon = (icon: string) => {
    switch (icon) {
      case 'star':
        return <Star size={18} className="text-emerald-600 dark:text-emerald-500" />;
      case 'crown':
        return <Crown size={18} className="text-emerald-600 dark:text-emerald-500" />;
      case 'percent':
        return <Percent size={18} className="text-emerald-600 dark:text-emerald-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setGolfDrawerOpen(false)}
      ></div>

      {/* Fixed Back Button - Top Left */}
      <button
        onClick={() => setGolfDrawerOpen(false)}
        className="fixed top-4 left-4 z-[60] w-12 h-12 rounded-full bg-white dark:bg-zinc-800 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-lg border border-gray-200 dark:border-white/10"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Fixed Pull Up Button - Center Above Bottom Nav */}
      <button 
        onClick={() => setGolfDrawerOpen(false)}
        className="fixed bottom-[90px] left-1/2 transform -translate-x-1/2 z-[60] w-14 h-14 rounded-full bg-white dark:bg-zinc-800 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-lg border border-gray-200 dark:border-white/10"
      >
        <ChevronUp size={24} />
      </button>

      {/* Drawer Content */}
      <div className="relative bg-emerald-50 dark:bg-zinc-900 text-gray-900 dark:text-white rounded-b-[3rem] shadow-2xl overflow-hidden animate-slide-down max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col">
        
        {/* Banner */}
        <div className="relative h-72 overflow-hidden shrink-0">
          <img 
            src={dropdown.bannerImage} 
            alt={t(dropdown.titleKey)} 
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-[2s]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          
          {/* Header Controls */}
          <div className="absolute top-safe-top right-6 flex items-center pt-4">
            <button
              onClick={() => setGolfDrawerOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors text-white border border-white/20"
            >
              <X size={20} />
            </button>
          </div>

          <div className="absolute bottom-8 left-8 right-8">
             <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-emerald-700/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-emerald-500/50">
                    <Flag size={12} /> PGA Standard
                </span>
             </div>
             <h2 className="text-4xl font-serif font-bold text-white mb-2 leading-none italic">{t(dropdown.titleKey)}</h2>
             <p className="text-emerald-100/90 text-sm font-medium font-serif">{t('home.dropdowns.golf.subtitle')}</p>
          </div>
        </div>

        <div className="px-8 py-10 bg-emerald-50/50 dark:bg-zinc-900 pb-20">
          
          {/* Green Fees */}
          <div className="space-y-5 mb-10">
            <div className="flex items-center justify-between mb-4 border-b border-emerald-200 dark:border-white/5 pb-2">
                <h3 className="font-serif font-bold text-xl text-emerald-900 dark:text-emerald-100">Green Fees</h3>
                <button onClick={() => navigate(dropdown.link)} className="text-emerald-700 dark:text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all">View All <ArrowRight size={12}/></button>
            </div>
            
            {dropdown.items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-800/60 rounded-2xl p-4 border border-emerald-100 dark:border-white/5 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all shadow-sm group cursor-pointer"
                onClick={() => navigate(dropdown.link)}
              >
                <div className="flex gap-5 items-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-500">
                    <Trophy size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-bold text-gray-900 dark:text-white text-base mb-1">{t(item.titleKey)}</h3>
                    <p className="text-xs text-emerald-600/80 dark:text-gray-400 mb-2 font-medium">{t(item.descriptionKey)}</p>
                  </div>
                  {item.priceKey && (
                      <div className="text-right pl-2">
                        <span className="block text-emerald-800 dark:text-emerald-400 font-serif font-bold text-xl italic">{t(item.priceKey)}</span>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400 group-hover:text-emerald-600 transition-colors flex justify-end">
                          Book <ArrowRight size={10} className="ml-1"/>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Tournaments */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Calendar size={16} className="text-emerald-600 dark:text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-800/60 dark:text-gray-500">{t('home.dropdowns.latestActivities')}</h3>
            </div>
            <div className="space-y-4">
              {dropdown.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white dark:bg-zinc-800/40 rounded-2xl p-3 border border-emerald-100 dark:border-white/5 flex gap-4 items-start shadow-sm"
                >
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={activity.image} alt={t(activity.titleKey)} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 py-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-serif font-bold text-gray-900 dark:text-white text-sm">{t(activity.titleKey)}</h4>
                        {activity.badge && (
                          <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            {t(activity.badge)}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{t(activity.descriptionKey)}</p>
                    </div>
                </div>
              ))}
            </div>
          </div>

          {/* Club Privileges */}
          <div className="bg-emerald-900 dark:bg-black/40 text-white rounded-3xl p-6 border border-emerald-800 dark:border-emerald-500/20 shadow-lg relative overflow-hidden mb-8">
            <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
               <Crown size={120} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6 border-b border-emerald-700/50 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-emerald-800 rounded-full border border-emerald-600 text-yellow-400">
                        <Crown size={16} />
                    </div>
                    <h3 className="text-lg font-serif font-bold text-white">{t('home.vipPrivileges.title')}</h3>
                </div>
                {!isLoggedIn && (
                    <button
                    onClick={openRegister}
                    className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider hover:text-white transition-colors"
                    >
                    {t('home.vipPrivileges.joinVIP')}
                    </button>
                )}
                </div>
                
                <div className="grid gap-5">
                {vipPrivileges.map((privilege) => (
                    <div key={privilege.id} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-yellow-400 border border-emerald-700/50">
                        {getVIPIcon(privilege.icon)}
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white text-xs mb-1 uppercase tracking-wide">{t(privilege.titleKey)}</h4>
                        <p className="text-[11px] text-emerald-200 leading-relaxed font-serif">{t(privilege.descriptionKey)}</p>
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

export default GolfBookingDrawer;
