
import React, { useState, useEffect } from 'react';
import { Target, Shield, MapPin, ArrowRight, Sun, Crown, ChevronRight, Crosshair, LandPlot, Cloud, CloudSun, CloudRain, Phone, Bell, Hotel, Clapperboard, ChevronUp, Pickaxe, Calendar, Clock, Flag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { getMockWeather, getTimeInfo, WeatherInfo, TimeInfo } from '../utils/weather';
import { getVIPLevelName, getVIPLevelColor } from '../data/mock/userGenerator';
import { mockHomeActivitiesData } from '../data/mock/activities';

const Home: React.FC = () => {
  const { t, setHotelDrawerOpen, setShootingDrawerOpen, setGolfDrawerOpen, isLoggedIn, user, openLogin, language } = useAppContext();
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [timeInfo, setTimeInfo] = useState<TimeInfo | null>(null);

  useEffect(() => {
    const userTimezone = user?.timezone;
    const userLocation = user?.location;
    setWeather(getMockWeather(userLocation));
    setTimeInfo(getTimeInfo(userTimezone));

    const timeInterval = setInterval(() => {
      setTimeInfo(getTimeInfo(userTimezone));
    }, 60000);

    return () => clearInterval(timeInterval);
  }, [user]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.greeting.morning') : hour < 18 ? t('home.greeting.afternoon') : t('home.greeting.evening');

  const getWeatherIcon = (icon: string, size: number = 14) => {
    switch (icon) {
      case 'sun':
        return <Sun size={size} className="text-yellow-600 dark:text-yellow-500" />;
      case 'cloud':
        return <Cloud size={size} className="text-gray-400" />;
      case 'cloud-sun':
        return <CloudSun size={size} className="text-yellow-600 dark:text-yellow-400" />;
      case 'cloud-rain':
        return <CloudRain size={size} className="text-blue-500 dark:text-blue-400" />;
      default:
        return <Sun size={size} className="text-yellow-600 dark:text-yellow-500" />;
    }
  };

  const handleConciergeClick = () => {
    if (user?.dedicatedService) {
      window.location.href = `tel:${user.dedicatedService.phone}`;
    } else {
      navigate('/concierge');
    }
  };

  return (
    <div className="relative min-h-screen px-4 pt-2 pb-32 overflow-hidden bg-stone-50 dark:bg-black transition-colors duration-500 font-sans">
      
      {/* Dynamic Aurora Background - Dark Mode Only */}
      <div className="fixed inset-0 w-full h-full -z-10 hidden dark:block bg-black pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 rounded-full mix-blend-screen filter blur-[80px] opacity-20 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/30 rounded-full mix-blend-screen filter blur-[80px] opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full mix-blend-screen filter blur-[80px] opacity-20 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[30px]"></div>
      </div>

      {/* 1. Header Greetings & Welcome Area */}
      <div className="mb-8 relative z-10 animate-fade-in">
        {!isLoggedIn ? (
          <div className="relative overflow-hidden bg-white dark:bg-zinc-900/60 backdrop-blur-2xl rounded-2xl p-5 border border-stone-100 dark:border-white/5 shadow-xl group">
              
              {/* Decorative Background Elements */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-600/10 dark:to-transparent rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none opacity-60 dark:opacity-20"></div>
              <div className="absolute right-4 top-4 opacity-5 dark:opacity-[0.03] pointer-events-none">
                  <Crown size={80} />
              </div>

              <div className="relative z-10">
                  {/* Top Row: Context */}
                  <div className="flex justify-between items-start mb-5">
                      <div className="flex flex-col">
                          <span className="text-[9px] font-bold tracking-[0.2em] text-stone-400 dark:text-stone-500 uppercase mb-1">{greeting}</span>an>
                          <div className="flex items-center gap-2 text-stone-600 dark:text-gray-300">
                             {weather && getWeatherIcon(weather.icon, 14)}
                             <span className="text-xs font-medium font-serif">{weather?.temperature}°C Vientiane</span>
                          </div>
                      </div>
                      {timeInfo && (
                          <div className="text-right">
                              <span className="block text-xl font-serif font-medium text-stone-900 dark:text-white leading-none tracking-tight">{timeInfo.time}</span>
                              <span className="text-[9px] text-stone-400 dark:text-stone-600 uppercase tracking-wider font-bold">{timeInfo.date}</span>an>
                          </div>
                      )}
                  </div>

                  {/* Middle: Headline - Editorial Style */}
                  <div className="mb-6">
                      <h1 className="text-3xl md:text-4xl font-serif font-medium text-stone-900 dark:text-white leading-[1.1] mb-2 tracking-tight">
                        {t('home.welcome.title')}
                      </h1>
                      <div className="h-0.5 w-12 bg-yellow-500 mb-2"></div>
                      <p className="text-stone-500 dark:text-gray-400 text-xs font-light leading-relaxed italic font-serif">
                        {t('home.welcome.subtitle')}
                      </p>
                  </div>

                  {/* Bottom: Action - Redesigned Button */}
                  <div className="flex items-center justify-between border-t border-stone-100 dark:border-white/5 pt-4">
                      <span className="text-[9px] font-bold text-stone-400 dark:text-stone-600 uppercase tracking-widest">Elite Access Only</span>an>
                      <button
                          onClick={openLogin}
                          className="flex items-center gap-2 bg-white dark:bg-white text-stone-900 dark:text-black px-5 py-2 rounded-full font-bold text-[11px] hover:scale-105 active:scale-95 transition-all shadow-lg border border-stone-200 dark:border-stone-300"0"
                      >
                          {t('auth.login')} <ArrowRight size={12} />
                      </button>
                  </div>
              </div>
          </div>
        ) : (
          // Login State: Premium Member Dashboard
          <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-xl rounded-[2.5rem] p-6 border border-stone-100 dark:border-white/5 shadow-xl dark:shadow-none">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                {user.avatar && (
                  <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-stone-50 shadow-lg dark:border-yellow-500/20">
                    <img src={user.avatar} alt={user.nickname} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-stone-400 dark:text-gray-500 uppercase tracking-widest font-bold mb-1">Welcome Back</span>
                    <h1 className="text-2xl font-serif font-bold text-stone-900 dark:text-white leading-none mb-2">{user.nickname}</h1>
                    <span 
                      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md font-bold self-start border dark:border-0 uppercase tracking-wide"
                      style={{
                        backgroundColor: getVIPLevelColor(user.vipLevel) === 'orange' ? 'rgba(249, 115, 22, 0.1)' :
                                       getVIPLevelColor(user.vipLevel) === 'gray' ? 'rgba(107, 114, 128, 0.1)' :
                                       getVIPLevelColor(user.vipLevel) === 'yellow' ? 'rgba(234, 179, 8, 0.1)' :
                                       getVIPLevelColor(user.vipLevel) === 'blue' ? 'rgba(59, 130, 246, 0.1)' :
                                       'rgba(168, 85, 247, 0.1)',
                        color: getVIPLevelColor(user.vipLevel) === 'orange' ? 'rgb(234, 88, 12)' :
                               getVIPLevelColor(user.vipLevel) === 'gray' ? 'rgb(75, 85, 99)' :
                               getVIPLevelColor(user.vipLevel) === 'yellow' ? 'rgb(202, 138, 4)' :
                               getVIPLevelColor(user.vipLevel) === 'blue' ? 'rgb(37, 99, 235)' :
                               'rgb(147, 51, 234)',
                        borderColor: 'rgba(0,0,0,0.05)'
                      }}
                    >
                      {getVIPLevelName(user.vipLevel, language as 'en' | 'zh')}
                    </span>
                  </div>
                </div>
              </div>
              <button className="w-10 h-10 rounded-full bg-stone-50 dark:bg-white/5 text-stone-400 dark:text-white/50 hover:text-stone-900 dark:hover:text-white flex items-center justify-center transition-colors">
                  <Bell size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-50 dark:bg-zinc-800/60 rounded-2xl p-5 border border-stone-100 dark:border-white/5 flex flex-col justify-between h-28">
                 <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1">{t('home.user.balance')}</p>
                 <div className="mt-auto">
                    <span className="text-2xl font-serif font-bold text-stone-900 dark:text-white block mb-1">${(user.balance / 1000).toFixed(1)}k</span>
                    <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded font-bold">+2.4%</span>
                 </div>
              </div>
              <button
                onClick={handleConciergeClick}
                className="bg-stone-900 dark:bg-gradient-to-br dark:from-yellow-600/20 dark:to-yellow-800/20 border border-stone-800 dark:border-yellow-500/30 rounded-2xl p-5 flex flex-col justify-between h-28 items-start group hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 text-white dark:text-yellow-500">
                    <div className="p-1.5 bg-white/10 rounded-lg">
                        <Phone size={14} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide">{t('home.user.dedicatedService')}</span>
                </div>
                <p className="text-[10px] text-stone-400 dark:text-yellow-200/50 group-hover:text-white transition-colors mt-auto text-left leading-tight">
                    {t('home.user.oneClick')}
                </p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Quick Actions - Unified Compact Design */}
      <div className="mb-6 relative z-10 animate-fade-in">
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {[
            { 
              icon: Hotel,
              labelKey: "home.quickActions.bookHotel",
              action: () => setHotelDrawerOpen(true),
              color: 'orange'
            },
            { 
              icon: Crosshair,
              labelKey: "home.quickActions.reserveRange",
              action: () => setShootingDrawerOpen(true),
              color: 'red'
            },
            { 
              icon: Flag,
              labelKey: "home.quickActions.teeTime",
              action: () => setGolfDrawerOpen(true),
              color: 'emerald'
            },
            { 
              icon: Shield,
              labelKey: "home.quickActions.bodyguard",
              action: () => navigate('/security'),
              color: 'blue'
            },
          ].map((item, idx) => {
            const IconComponent = item.icon;
            const colorClasses = {
              orange: {
                bg: 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20',
                icon: 'text-orange-600 dark:text-orange-400',
                border: 'border-orange-100 dark:border-orange-500/30',
                iconBg: 'bg-orange-100 dark:bg-orange-900/40',
                gradient: 'from-orange-500 to-amber-500'
              },
              red: {
                bg: 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20',
                icon: 'text-red-600 dark:text-red-400',
                border: 'border-red-100 dark:border-red-500/30',
                iconBg: 'bg-red-100 dark:bg-red-900/40',
                gradient: 'from-red-500 to-rose-500'
              },
              emerald: {
                bg: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20',
                icon: 'text-emerald-600 dark:text-emerald-400',
                border: 'border-emerald-100 dark:border-emerald-500/30',
                iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
                gradient: 'from-emerald-500 to-teal-500'
              },
              blue: {
                bg: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20',
                icon: 'text-blue-600 dark:text-blue-400',
                border: 'border-blue-100 dark:border-blue-500/30',
                iconBg: 'bg-blue-100 dark:bg-blue-900/40',
                gradient: 'from-blue-500 to-cyan-500'
              }
            };
            const colors = colorClasses[item.color as keyof typeof colorClasses];
            
            return (
              <button
                key={idx}
                onClick={item.action}
                className={`flex-none h-[40px] px-4 py-2 rounded-2xl flex items-center gap-2.5 font-bold text-xs transition-all duration-300 relative overflow-hidden group border ${colors.border} bg-gradient-to-br ${colors.bg} hover:shadow-lg hover:scale-105`}
              >
                {/* Icon */}
                <div className={`p-1.5 rounded-lg ${colors.iconBg} backdrop-blur-sm group-hover:scale-110 transition-all shadow-sm`}>
                  <IconComponent 
                    size={14} 
                    strokeWidth={2.5}
                    className={colors.icon}
                  />
                </div>
                
                {/* Text */}
                <span className={`${colors.icon} font-bold whitespace-nowrap`}>
                  {t(item.labelKey)}
                </span>
                
                {/* Hover Accent */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-2xl`}></div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Bento Grid - Expanded to 4 Items */}
      <div className="grid grid-cols-2 gap-4 relative z-10 pb-4">
        
        {/* 1. International Shooting Range */}
        <Link to="/shooting" className="col-span-1 bg-white dark:bg-red-950/20 backdrop-blur-lg rounded-3xl p-5 relative overflow-hidden shadow-sm dark:shadow-none h-[220px] flex flex-col justify-between group border border-stone-100 dark:border-white/5 transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595590424283-b8f17842773f?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-65 dark:opacity-50 group-hover:opacity-75 dark:group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/15 to-white/35 dark:from-black/40 dark:via-black/30 dark:to-black/45"></div>
            <div className="relative z-10 w-12 h-12 bg-white/70 dark:bg-red-900/40 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 text-red-700 dark:text-red-400 shadow-sm">
                <Crosshair size={24}/>
            </div>
            <div className="relative z-10">
                <h3 className="font-serif font-bold text-base text-stone-700 dark:text-gray-200 leading-tight mb-2">{t('home.defense.title')}</h3>
                <div className="w-8 h-0.5 bg-red-700 dark:bg-red-400 mb-2"></div>
                <p className="text-[10px] text-stone-600 dark:text-gray-300 font-bold uppercase tracking-wider">{t('home.defense.tagline')}</p>
            </div>
        </Link>

        {/* 2. Golf */}
        <Link to="/golf" className="col-span-1 bg-stone-900 dark:bg-emerald-950/20 backdrop-blur-lg rounded-3xl p-5 relative overflow-hidden shadow-sm dark:shadow-none h-[220px] flex flex-col justify-between group border border-stone-800 dark:border-white/5 transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1535131749006-b7f58c99034b?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-70 dark:opacity-55 group-hover:opacity-80 dark:group-hover:opacity-65 transition-opacity duration-500"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-stone-900/40 via-stone-900/25 to-stone-900/50 dark:from-black/45 dark:via-black/35 dark:to-black/50"></div>
            <div className="relative z-10 w-12 h-12 bg-white/25 dark:bg-emerald-900/40 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 text-stone-200 dark:text-emerald-400 shadow-sm">
                <LandPlot size={24}/>
            </div>
            <div className="relative z-10">
                <h3 className="font-serif font-bold text-base text-stone-200 dark:text-gray-300 leading-tight mb-2">{t('home.golf.title')}</h3>
                <div className="w-8 h-0.5 bg-stone-200 dark:bg-emerald-400 mb-2"></div>
                <p className="text-[10px] text-stone-300 dark:text-gray-300 font-bold uppercase tracking-wider">{t('home.golf.tagline')}</p>
            </div>
        </Link>

        {/* 3. Hotel/Resort */}
        <Link to="/resort" className="col-span-1 bg-orange-50 dark:bg-orange-950/20 backdrop-blur-lg rounded-3xl p-5 relative overflow-hidden shadow-sm dark:shadow-none h-[160px] flex flex-col justify-between group border border-orange-100 dark:border-white/5 transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-65 dark:opacity-50 group-hover:opacity-75 dark:group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-orange-50/40 via-orange-50/20 to-orange-50/50 dark:from-black/40 dark:via-black/30 dark:to-black/45"></div>
            <div className="relative z-10 w-12 h-12 bg-white/70 dark:bg-orange-900/40 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 text-orange-700 dark:text-orange-400 shadow-sm">
                <Hotel size={24}/>
            </div>
            <div className="relative z-10">
                <h3 className="font-serif font-bold text-base text-stone-700 dark:text-gray-200 leading-tight mb-2">{t('home.hotel.title')}</h3>
                <div className="w-8 h-0.5 bg-orange-700 dark:bg-orange-400 mb-2"></div>
                <p className="text-[10px] text-stone-600 dark:text-gray-300 font-bold uppercase tracking-wider">{t('home.hotel.tagline')}</p>
            </div>
        </Link>

        {/* 4. Cinema City */}
        <Link to="/resort" className="col-span-1 bg-white dark:bg-purple-950/20 backdrop-blur-lg rounded-3xl p-5 relative overflow-hidden shadow-sm dark:shadow-none h-[160px] flex flex-col justify-between group border border-stone-100 dark:border-white/5 transition-all hover:shadow-lg">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-65 dark:opacity-50 group-hover:opacity-75 dark:group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/15 to-white/35 dark:from-black/40 dark:via-black/30 dark:to-black/45"></div>
            <div className="relative z-10 w-12 h-12 bg-white/70 dark:bg-purple-900/40 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 text-purple-700 dark:text-purple-400 shadow-sm">
                <Clapperboard size={24}/>
            </div>
            <div className="relative z-10">
                <h3 className="font-serif font-bold text-base text-stone-700 dark:text-gray-200 leading-tight mb-2">{t('home.cinema.title')}</h3>
                <div className="w-8 h-0.5 bg-purple-700 dark:bg-purple-400 mb-2"></div>
                <p className="text-[10px] text-stone-600 dark:text-gray-300 font-bold uppercase tracking-wider">{t('home.cinema.tagline')}</p>
            </div>
        </Link>

        {/* 5. Security Group */}
        <Link to="/security" className="bg-white dark:bg-zinc-800/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-center items-center gap-3 text-center shadow-sm dark:shadow-none hover:shadow-md transition-all border border-stone-100 dark:border-white/5">
            <div className="text-blue-600 dark:text-blue-400">
                <Shield size={28} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold text-stone-900 dark:text-blue-100">{t('home.security.title')}</span>
        </Link>

        {/* 6. Rare Earth */}
        <Link to="/mining" className="bg-white dark:bg-zinc-800/40 backdrop-blur-md rounded-[1.5rem] p-5 flex flex-col justify-center items-center gap-3 text-center shadow-sm dark:shadow-none hover:shadow-md transition-all border border-stone-100 dark:border-white/5">
            <div className="text-stone-600 dark:text-gray-400">
                <Pickaxe size={28} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold text-stone-900 dark:text-gray-100">{t('home.rareEarth.title')}</span>
        </Link>

        {/* Events & Competitions Section - Single Block with Internal Scroll */}
        <div className="col-span-2 mt-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-stone-400 dark:text-gray-500" />
              <h3 className="text-[10px] font-bold text-stone-400 dark:text-gray-500 uppercase tracking-widest">{t('home.shootingEvents.title')}</h3>
            </div>
            {mockHomeActivitiesData.shootingEvents && mockHomeActivitiesData.shootingEvents.length > 3 && (
              <button className="text-[9px] text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 font-bold uppercase tracking-wider transition-colors">
                {t('home.dropdowns.viewAll')}
              </button>
            )}
          </div>
          <div className="bg-gradient-to-br from-white to-stone-50 dark:from-zinc-900/80 dark:to-zinc-800/60 backdrop-blur-xl rounded-2xl border border-stone-200/50 dark:border-white/10 overflow-hidden">
            <div className="flex gap-3 overflow-x-auto no-scrollbar p-4">
              {mockHomeActivitiesData.shootingEvents?.map((event, index) => {
                const isCompetition = event.type === 'competition';
                const dateParts = event.date.split('-');
                const month = dateParts[1];
                const day = dateParts[2];
                
                return (
                  <div
                    key={event.id}
                    className="flex-none w-[280px] cursor-pointer group hover:opacity-90 transition-all duration-300 relative"
                  >
                    <div className="relative z-10 flex items-start gap-3">
                      {/* Date Badge */}
                      <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2 ${
                        isCompetition 
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-500/30' 
                          : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/30'
                      }`}>
                        <span className={`text-[8px] font-bold uppercase tracking-wider ${
                          isCompetition 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {month}
                        </span>
                        <span className={`text-lg font-serif font-bold leading-none ${
                          isCompetition 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-blue-700 dark:text-blue-300'
                        }`}>
                          {day}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-serif font-bold text-stone-900 dark:text-white leading-tight line-clamp-2 flex-1">
                            {t(event.titleKey)}
                          </h4>
                          <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                            isCompetition 
                              ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400' 
                              : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                          }`}>
                            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                            isCompetition 
                              ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300' 
                              : 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          }`}>
                            {isCompetition ? t('home.shootingEvents.competition') : t('home.shootingEvents.training')}
                          </span>
                          <span className="text-[9px] text-stone-500 dark:text-gray-400 font-medium">
                            {event.time}
                          </span>
                        </div>
                        
                        {/* Subtle Divider */}
                        <div className={`h-px w-full ${
                          isCompetition 
                            ? 'bg-red-200/50 dark:bg-red-500/20' 
                            : 'bg-blue-200/50 dark:bg-blue-500/20'
                        }`}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Map Location Tile */}
        <Link to="/shooting" className="col-span-2 h-[160px] rounded-3xl relative overflow-hidden shadow-sm border border-stone-100 dark:border-white/10 group mt-4">
            <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src="https://www.openstreetmap.org/export/embed.html?bbox=102.5800%2C17.9400%2C102.6600%2C17.9900&amp;layer=mapnik" 
                className="absolute inset-0 w-full h-full opacity-60 dark:opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700 dark:invert"
            ></iframe>
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/40 to-transparent dark:from-black/95 dark:via-black/40 dark:to-transparent pointer-events-none p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-stone-900 dark:text-yellow-500 mb-2">
                    <MapPin size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('home.location.prime')}</span>
                </div>
                <h3 className="text-stone-900 dark:text-white font-serif font-bold text-2xl">{t('home.location.title')}</h3>
                <p className="text-stone-500 dark:text-gray-400 text-xs mt-1 font-serif italic">{t('home.location.address')}</p>
            </div>
        </Link>

        {/* Large Tile: Company Profile */}
        <div className="col-span-2 bg-white dark:bg-zinc-900/60 backdrop-blur-xl rounded-3xl p-8 relative overflow-hidden shadow-sm dark:shadow-none min-h-[220px] flex flex-col justify-between border border-stone-100 dark:border-white/5 mt-2 mb-10">
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
                <Crown size={140} className="text-stone-900 dark:text-white" />
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none z-0">
                <Building2 size={140} className="text-stone-900 dark:text-white" />
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none z-0">
                <Building2 size={140} className="text-stone-900 dark:text-white" />
            </div>
            <div className="relative z-10">
                <p className="text-stone-400 dark:text-yellow-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-4">{t('home.corporate.profile')}</p>
                <h2 className="text-3xl font-serif font-bold leading-tight max-w-[90%] text-stone-900 dark:text-white">{t('home.corporate.title')}</h2>
            </div>
                  className="bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 backdrop-blur-md rounded-full px-6 py-3 text-xs font-bold flex items-center border border-stone-200 dark:border-white/10 text-stone-900 dark:text-white transition-colors uppercase tracking-wider"
                <div className="text-xs text-stone-500 dark:text-gray-400 font-medium font-serif italic">
                    {t('home.corporate.viewProfile')} <ChevronRight size={14} className="ml-1"/>
                  className="bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 backdrop-blur-md rounded-full px-6 py-3 text-xs font-bold flex items-center border border-stone-200 dark:border-white/10 text-stone-900 dark:text-white transition-colors uppercase tracking-wider"
                <button 
                    {t('home.corporate.viewProfile')} <ChevronRight size={14} className="ml-1"/>
                  className="bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 backdrop-blur-md rounded-full px-6 py-3 text-xs font-bold flex items-center border border-stone-200 dark:border-white/10 text-stone-900 dark:text-white transition-colors uppercase tracking-wider"
                >
                    {t('home.corporate.viewProfile')} <ChevronRight size={14} className="ml-1"/>
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Home;
