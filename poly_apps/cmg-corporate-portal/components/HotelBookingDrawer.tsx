
import React from 'react';
import { X, ArrowRight, Hotel, Star, Crown, Percent, Calendar, Sparkles, Gift, MapPin, ChevronLeft, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { mockHomeActivitiesData } from '../data';

const HotelBookingDrawer: React.FC = () => {
  const { isHotelDrawerOpen, setHotelDrawerOpen, t, isLoggedIn, openRegister } = useAppContext();
  const navigate = useNavigate();
  const dropdown = mockHomeActivitiesData.dropdowns.find(d => d.type === 'hotel');
  const vipPrivileges = mockHomeActivitiesData.vipPrivileges;

  if (!isHotelDrawerOpen || !dropdown) return null;

  const getVIPIcon = (icon: string) => {
    switch (icon) {
      case 'star':
        return <Star size={18} className="text-orange-500" />;
      case 'crown':
        return <Crown size={18} className="text-orange-500" />;
      case 'percent':
        return <Percent size={18} className="text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setHotelDrawerOpen(false)}
      ></div>

      {/* Fixed Back Button - Top Left */}
      <button
        onClick={() => setHotelDrawerOpen(false)}
        className="fixed top-4 left-4 z-[60] w-12 h-12 rounded-full bg-white dark:bg-zinc-800 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-lg border border-gray-200 dark:border-white/10"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Fixed Pull Up Button - Center Above Bottom Nav */}
      <button 
        onClick={() => setHotelDrawerOpen(false)}
        className="fixed bottom-[90px] left-1/2 transform -translate-x-1/2 z-[60] w-14 h-14 rounded-full bg-white dark:bg-zinc-800 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-lg border border-gray-200 dark:border-white/10"
      >
        <ChevronUp size={24} />
      </button>

      {/* Drawer Content - From Top */}
      <div className="relative bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-b-[3rem] shadow-2xl overflow-hidden animate-slide-down max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col">
        
        {/* Cinematic Banner Image */}
        <div className="relative h-72 overflow-hidden shrink-0">
          <img 
            src={dropdown.bannerImage} 
            alt={t(dropdown.titleKey)} 
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-[2s]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
          
          {/* Header Controls */}
          <div className="absolute top-safe-top right-6 flex items-center pt-4">
            <button
              onClick={() => setHotelDrawerOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors border border-white/20 text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="absolute bottom-8 left-8 right-8">
             <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-orange-600/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-orange-500/50">
                    <Hotel size={12} /> CMG Estates
                </span>
             </div>
             <h2 className="text-4xl font-serif font-bold text-white mb-2 leading-none">{t(dropdown.titleKey)}</h2>
             <p className="text-white/80 text-sm font-serif italic">{t('home.dropdowns.hotel.subtitle')}</p>
          </div>
        </div>

        <div className="px-8 py-10 pb-20">
          
          {/* Products - Luxury Cards */}
          <div className="space-y-6 mb-10">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                <h3 className="font-serif font-bold text-xl text-gray-900 dark:text-white">Recommended Villas</h3>
                <button onClick={() => navigate(dropdown.link)} className="text-orange-600 dark:text-orange-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all">View All <ArrowRight size={12}/></button>
            </div>
            
            {dropdown.items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-800/40 rounded-3xl p-2 border border-gray-100 dark:border-white/5 hover:border-orange-200 dark:hover:border-orange-500/30 transition-all shadow-sm group cursor-pointer"
                onClick={() => navigate(dropdown.link)}
              >
                <div className="flex gap-5 items-center p-3">
                  {item.image && (
                    <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                      <img src={item.image} alt={t(item.titleKey)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <h3 className="font-serif font-bold text-gray-900 dark:text-white text-lg leading-tight">{t(item.titleKey)}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-2 font-serif italic">{t(item.descriptionKey)}</p>
                    
                    {item.priceKey && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-orange-600 dark:text-orange-500 font-bold text-sm">{t(item.priceKey)}</span>
                        <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-white/5 flex items-center justify-center text-orange-600 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={14}/>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Special Offers Grid */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={16} className="text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('home.dropdowns.latestActivities')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {dropdown.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-orange-50 dark:bg-zinc-800/40 rounded-2xl p-4 border border-orange-100 dark:border-white/5 hover:bg-orange-100 dark:hover:bg-zinc-800 transition-colors flex flex-col gap-3 group"
                >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative shadow-sm">
                        <img src={activity.image} alt={t(activity.titleKey)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        {activity.badge && (
                          <div className="absolute top-2 left-2 bg-white/90 dark:bg-black/80 backdrop-blur text-orange-600 dark:text-orange-400 text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm">
                            {t(activity.badge)}
                          </div>
                        )}
                    </div>
                    <div>
                        <h4 className="font-serif font-bold text-gray-900 dark:text-white text-sm mb-1 leading-tight">{t(activity.titleKey)}</h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{t(activity.descriptionKey)}</p>
                    </div>
                </div>
              ))}
            </div>
          </div>

          {/* VIP Privileges Section - Clean List */}
          <div className="bg-gradient-to-br from-stone-50 to-white dark:from-zinc-900 dark:to-black rounded-3xl p-6 border border-stone-100 dark:border-orange-500/20 shadow-sm relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <div className="relative z-10 flex items-center justify-between mb-6 border-b border-stone-200 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-full text-orange-600 dark:text-orange-500">
                    <Crown size={18} />
                </div>
                <h3 className="text-lg font-serif font-bold text-gray-900 dark:text-orange-100">{t('home.vipPrivileges.title')}</h3>
              </div>
              {!isLoggedIn && (
                <button
                  onClick={openRegister}
                  className="text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider hover:underline"
                >
                  {t('home.vipPrivileges.joinVIP')}
                </button>
              )}
            </div>
            
            <div className="relative z-10 grid gap-5">
              {vipPrivileges.map((privilege) => (
                <div key={privilege.id} className="flex items-start gap-4 group">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors shadow-sm border border-stone-100 dark:border-white/5">
                    {getVIPIcon(privilege.icon)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs mb-1 uppercase tracking-wide">{t(privilege.titleKey)}</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-serif">{t(privilege.descriptionKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HotelBookingDrawer;
