import React from 'react';
import { Flag, Calendar, Users, Star, Crown, ChevronLeft, ArrowRight, Sun, Trophy, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';
import { mockGolfData } from '../data';

const Golf: React.FC = () => {
  const { t } = useAppContext();
  const data = mockGolfData;

  return (
    <div className="bg-emerald-950 text-white min-h-screen pb-24 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Hero Header */}
      <div className="relative h-[320px]">
        <img 
            src="https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?q=80&w=800&auto=format&fit=crop" 
            className="absolute inset-0 w-full h-full object-cover opacity-80" 
            alt="Golf Hero"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/20 to-transparent"></div>
        <Link to="/" className="absolute top-4 left-4 w-10 h-10 bg-black/20 backdrop-blur rounded-full flex items-center justify-center text-white z-10 hover:bg-black/40 transition-colors">
            <ChevronLeft size={24} />
        </Link>
        <div className="absolute bottom-0 left-0 right-0 p-6">
             <div className="flex items-center gap-2 text-emerald-400 mb-2">
                 <Flag size={18} fill="currentColor" />
                 <span className="text-xs font-bold uppercase tracking-widest">{t('golf.standard')}</span>
             </div>
             <h1 className="text-4xl font-serif text-white font-bold leading-tight mb-2">{t('golf.title')}</h1>
             <p className="text-emerald-100/80 text-sm">{t('golf.subtitle')}</p>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10">
        
        {/* Booking Widget */}
        <div className="bg-white text-emerald-950 p-6 rounded-3xl shadow-xl mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-emerald-600"/> {t('golf.bookTeeTime')}
            </h2>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <label className="text-[10px] text-emerald-600 uppercase font-bold">{t('golf.date')}</label>
                        <div className="font-bold text-lg">Oct 24</div>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <label className="text-[10px] text-emerald-600 uppercase font-bold">{t('golf.time')}</label>
                        <div className="font-bold text-lg">08:00 AM</div>
                    </div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <label className="text-[10px] text-emerald-600 uppercase font-bold">{t('golf.players')}</label>
                    <div className="flex justify-between items-center mt-1">
                        <span className="font-bold text-lg">4 {t('golf.players')}</span>
                        <div className="flex gap-2">
                            <button className="w-8 h-8 rounded-full bg-white text-emerald-700 flex items-center justify-center font-bold shadow-sm">-</button>
                            <button className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">+</button>
                        </div>
                    </div>
                </div>
                <button className="w-full bg-emerald-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-900 transition-colors">
                    {t('golf.confirmBooking')} <ArrowRight size={18} />
                </button>
            </div>
        </div>

        {/* Course Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-emerald-900/50 p-4 rounded-2xl border border-emerald-800 text-center">
                <span className="block text-2xl font-serif text-white mb-1">{data.stats.holes}</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">{t('golf.stats.holes')}</span>
            </div>
            <div className="bg-emerald-900/50 p-4 rounded-2xl border border-emerald-800 text-center">
                <span className="block text-2xl font-serif text-white mb-1">{data.stats.par}</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">{t('golf.stats.par')}</span>
            </div>
            <div className="bg-emerald-900/50 p-4 rounded-2xl border border-emerald-800 text-center">
                <span className="block text-2xl font-serif text-white mb-1">{data.stats.yards / 1000}k</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">{t('golf.stats.yards')}</span>
            </div>
        </div>

        {/* Introduction */}
        <div className="mb-8">
            <h2 className="text-xl font-serif text-white mb-4">{t('golf.course.title')}</h2>
            <p className="text-emerald-100/70 text-sm leading-relaxed mb-4">
                {t(data.descriptionKey)}
            </p>
            <div className="bg-emerald-900 rounded-xl p-4 flex items-start gap-4">
                <Trophy className="text-yellow-500 shrink-0" size={24} />
                <div>
                    <h3 className="font-bold text-white text-sm">{t(data.championship.titleKey)}</h3>
                    <p className="text-xs text-emerald-300 mt-1">{t(data.championship.descriptionKey)}</p>
                </div>
            </div>
        </div>

        {/* Pricing */}
        <div className="mb-8">
            <h2 className="text-xl font-serif text-white mb-4">{t('golf.greenFees.title')}</h2>
            <div className="space-y-3">
                {data.greenFees.map((fee) => (
                    <div key={fee.id} className="bg-white/5 p-4 rounded-xl flex justify-between items-center hover:bg-white/10 transition-colors cursor-pointer border border-white/5">
                        <div>
                            <h4 className="font-bold text-white">{t(fee.nameKey)}</h4>
                            <p className="text-xs text-emerald-400">{t(fee.descriptionKey)}</p>
                        </div>
                        <span className="text-lg font-bold text-white">${fee.price}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* VIP Privileges */}
        <div className="bg-gradient-to-br from-yellow-900/40 to-black p-6 rounded-3xl border border-yellow-700/30">
            <div className="flex items-center gap-3 mb-6">
                <Crown className="text-yellow-500" size={24} />
                <h2 className="text-xl font-serif text-yellow-500">{t('golf.memberPrivileges')}</h2>
            </div>
            <ul className="space-y-4">
                {data.privileges.map((priv) => (
                    <li key={priv.id} className="flex items-start gap-3">
                        {priv.icon === 'star' && <Star className="text-yellow-600 mt-0.5" size={16} />}
                        {priv.icon === 'mapPin' && <MapPin className="text-yellow-600 mt-0.5" size={16} />}
                        {priv.icon === 'users' && <Users className="text-yellow-600 mt-0.5" size={16} />}
                        <div>
                            <h4 className="font-bold text-white text-sm">{t(priv.titleKey)}</h4>
                            <p className="text-xs text-zinc-400">{t(priv.descriptionKey)}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>

      </div>
    </div>
  );
};

export default Golf;
