import React, { useState, useEffect } from 'react';
import { MapPin, Headset, ArrowRight, Target, Tent, FlagTriangleRight, AlertOctagon, Navigation } from 'lucide-react';
import { useNavigate } from '../context/AuthContext';
import { PageRoutes } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { TacticalDevice, TacticalCoordinates } from '../services/TacticalDevice';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [coords, setCoords] = useState<TacticalCoordinates | null>(null);

  useEffect(() => {
    // Acquire tactical position on mount
    const getPos = async () => {
        const position = await TacticalDevice.acquirePosition();
        if (position) {
            setCoords(position);
        }
    };
    getPos();
  }, []);

  return (
    <div className="pb-24 animate-fade-in transition-colors duration-300">
      
      {/* Guest Warning Banner */}
      {!isAuthenticated && (
        <div className="bg-red-500/10 border-b border-red-500/30 p-2 flex items-center justify-center gap-2 text-red-500">
            <AlertOctagon className="w-4 h-4" />
            <span className="text-xs font-mono font-bold tracking-widest uppercase">{t.home.guest_warn}</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative h-[45vh] w-full border-b border-slate-200 dark:border-slate-700">
        <img src="https://picsum.photos/1200/800?grayscale&blur=2" className="w-full h-full object-cover opacity-60 dark:opacity-40" alt="Hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-mil-base via-mil-base/50 to-transparent transition-colors duration-300"></div>
        
        {/* GPS Coordinates Overlay */}
        <div className="absolute top-4 left-4 font-mono text-[9px] text-tac-orange/80 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm border border-tac-orange/20 flex items-center gap-2">
            <Navigation className="w-3 h-3 animate-pulse" />
            {coords ? (
                <span>LOC: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
            ) : (
                <span className="animate-pulse">ACQUIRING GPS SIGNAL...</span>
            )}
        </div>

        <div className="absolute bottom-6 left-4 right-4">
            <h1 className="text-4xl font-black text-mil-base uppercase tracking-tighter leading-none mb-2 drop-shadow-md">
                {t.home.hero_title} <br /> <span className="text-tac-orange">{t.home.hero_subtitle}</span>
            </h1>
            <p className="text-sm text-mil-muted max-w-xs font-mono border-l-2 border-tac-orange pl-3">
                {t.home.hero_desc}
            </p>
        </div>
      </div>

      <div className="p-4 space-y-10">
        
        {/* SHOOTING RANGE SECTION (Red Theme) */}
        <section className="space-y-3">
            <div className="flex items-center gap-2 text-tac-red mb-1">
                <Target className="w-5 h-5" />
                <h2 className="font-bold tracking-[0.2em] uppercase text-sm">{t.home.sections.shooting}</h2>
            </div>
            <div 
                onClick={() => navigate(PageRoutes.SHOOTING)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden group hover:border-tac-red transition-all cursor-pointer shadow-sm dark:shadow-none"
            >
                <div className="h-40 relative">
                    <img src="https://picsum.photos/800/400?random=1" className="w-full h-full object-cover opacity-90 dark:opacity-80 group-hover:opacity-100 transition-opacity" alt="Shooting" />
                    <div className="absolute inset-0 bg-tac-red/10 mix-blend-overlay"></div>
                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-black/70 text-tac-red text-[10px] font-mono px-2 py-0.5 border border-tac-red/50">
                        {t.home.tags.live_fire}
                    </div>
                </div>
                <div className="p-4 relative">
                    <div className="absolute -top-6 right-4 bg-tac-red text-white p-3 rounded-full shadow-lg group-hover:scale-110 transition-transform ring-4 ring-mil-base">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">{t.home.sections.shooting_title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                        {t.home.sections.shooting_desc}
                    </p>
                </div>
            </div>
        </section>

        {/* BUNGALOW SECTION (Blue Theme) */}
        <section className="space-y-3">
            <div className="flex items-center gap-2 text-tac-cyan mb-1">
                <Tent className="w-5 h-5" />
                <h2 className="font-bold tracking-[0.2em] uppercase text-sm">{t.home.sections.bungalow}</h2>
            </div>
            <div 
                onClick={() => navigate(PageRoutes.BUNGALOW)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden group hover:border-tac-cyan transition-all cursor-pointer shadow-sm dark:shadow-none"
            >
                <div className="h-40 relative">
                    <img src="https://picsum.photos/800/400?random=2" className="w-full h-full object-cover opacity-90 dark:opacity-80 group-hover:opacity-100 transition-opacity" alt="Bungalow" />
                    <div className="absolute inset-0 bg-tac-cyan/10 mix-blend-overlay"></div>
                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-black/70 text-tac-cyan text-[10px] font-mono px-2 py-0.5 border border-tac-cyan/50">
                        {t.home.tags.vacancy}
                    </div>
                </div>
                <div className="p-4 relative">
                    <div className="absolute -top-6 right-4 bg-tac-cyan text-white dark:text-black p-3 rounded-full shadow-lg group-hover:scale-110 transition-transform ring-4 ring-mil-base">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">{t.home.sections.bungalow_title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                        {t.home.sections.bungalow_desc}
                    </p>
                </div>
            </div>
        </section>

        {/* GOLF SECTION (Green Theme) */}
        <section className="space-y-3">
            <div className="flex items-center gap-2 text-tac-green mb-1">
                <FlagTriangleRight className="w-5 h-5" />
                <h2 className="font-bold tracking-[0.2em] uppercase text-sm">{t.home.sections.golf}</h2>
            </div>
            <div 
                onClick={() => navigate(PageRoutes.GOLF)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden group hover:border-tac-green transition-all cursor-pointer shadow-sm dark:shadow-none"
            >
                <div className="h-40 relative">
                    <img src="https://picsum.photos/800/400?random=3" className="w-full h-full object-cover opacity-90 dark:opacity-80 group-hover:opacity-100 transition-opacity" alt="Golf" />
                    <div className="absolute inset-0 bg-tac-green/10 mix-blend-overlay"></div>
                </div>
                <div className="p-4 relative">
                    <div className="absolute -top-6 right-4 bg-tac-green text-white dark:text-black p-3 rounded-full shadow-lg group-hover:scale-100 transition-transform ring-4 ring-mil-base">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">{t.home.sections.golf_title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                         {t.home.sections.golf_desc}
                    </p>
                </div>
            </div>
        </section>

        {/* Support CTA */}
        <div className="mt-8 text-center">
            <button 
                onClick={() => navigate(PageRoutes.CUSTOMER_SERVICE)}
                className="flex items-center justify-center gap-2 mx-auto text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-tac-orange transition-colors border border-dashed border-slate-400 dark:border-slate-700 px-4 py-2 rounded-sm"
            >
                <Headset className="w-4 h-4" />
                {t.home.cta.support}
            </button>
        </div>

      </div>
    </div>
  );
};

export default Home;