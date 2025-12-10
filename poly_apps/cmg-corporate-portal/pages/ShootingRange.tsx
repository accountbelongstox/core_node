import React from 'react';
import { Crosshair, Target, Truck, Users, Activity, Trophy, ChevronLeft, MapPin, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';
import { mockShootingData } from '../data';

const ShootingRange: React.FC = () => {
  const { t } = useAppContext();
  const data = mockShootingData;

  return (
    <div className="bg-neutral-900 text-gray-200 min-h-screen pb-24">
      {/* Header Image */}
      <div className="relative h-[240px]">
        <img 
            src="https://picsum.photos/800/600?military" 
            alt="Tactical Background" 
            className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neutral-900"></div>
        <Link to="/" className="absolute top-4 left-4 w-10 h-10 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white z-10">
            <ChevronLeft size={24} />
        </Link>
        <div className="absolute bottom-6 left-6">
            <span className="text-red-500 font-bold text-xs tracking-widest uppercase mb-1 block">{t('shooting.subtitle')}</span>
            <h1 className="text-3xl font-black text-white leading-none">{t('shooting.title')}</h1>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10">
        
        {/* Stats Row */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar mb-8">
            <div className="min-w-[120px] bg-neutral-800 p-4 rounded-2xl border-l-4 border-red-600">
                <h3 className="text-2xl font-black text-white">{data.stats.hectares}</h3>
                <p className="text-[10px] text-gray-400 uppercase">{t('shooting.stats.hectares')}</p>
            </div>
            <div className="min-w-[120px] bg-neutral-800 p-4 rounded-2xl border-l-4 border-white">
                <h3 className="text-2xl font-black text-white">{data.stats.muArea}</h3>
                <p className="text-[10px] text-gray-400 uppercase">{t('shooting.stats.muArea')}</p>
            </div>
            <div className="min-w-[120px] bg-neutral-800 p-4 rounded-2xl border-l-4 border-red-600">
                <h3 className="text-xl font-black text-white">{data.stats.standard}</h3>
                <p className="text-[10px] text-gray-400 uppercase">{t('shooting.stats.standard')}</p>
            </div>
        </div>

        {/* Shooting Projects Packages */}
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Crosshair className="text-red-500" size={18}/> {t('shooting.popularPackages')}
        </h2>
        
        <div className="grid grid-cols-1 gap-4 mb-8">
            {data.packages.map((pkg) => (
                <div key={pkg.id} className="bg-neutral-800 rounded-2xl p-1 flex items-stretch">
                    <div className="w-1/3 bg-neutral-700 rounded-xl bg-cover" style={{ backgroundImage: `url(${pkg.image})` }}></div>
                    <div className="flex-1 p-4">
                        <h3 className="font-bold text-white">{t(pkg.nameKey)}</h3>
                        <p className="text-xs text-gray-400 mb-2">{t(pkg.descriptionKey)}</p>
                        <div className="flex items-center gap-2 mb-3">
                            {pkg.tags.map((tagKey, idx) => (
                                <span 
                                    key={idx} 
                                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                        idx === 0 
                                            ? 'bg-red-900/50 text-red-400' 
                                            : 'bg-neutral-900 text-gray-400'
                                    }`}
                                >
                                    {t(tagKey)}
                                </span>
                            ))}
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-white font-bold">${pkg.price}</span>
                            <button className="bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('shooting.book')}</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Zones List */}
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target className="text-red-500" size={18}/> {t('shooting.coreZones')}
        </h2>

        <div className="space-y-4 mb-12">
            {data.zones.map((zone) => (
                <div key={zone.id} className="bg-neutral-800 rounded-2xl p-5 border-l-2 border-transparent hover:border-red-500 transition-colors">
                    <h3 className="text-white font-bold mb-2">{zone.number}. {t(zone.titleKey)}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-3">
                        {t(zone.descriptionKey)}
                    </p>
                    {zone.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {zone.tags.map((tagKey, idx) => (
                                <span key={idx} className="px-2 py-1 bg-neutral-900 rounded text-[10px] text-gray-300">{t(tagKey)}</span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>

        {/* Location Map Section */}
        <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MapPin className="text-red-500" size={18}/> {t('shooting.location.title')}
            </h2>
            <div className="bg-neutral-800 p-2 rounded-3xl">
                <div className="h-[200px] w-full rounded-2xl overflow-hidden relative">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        scrolling="no" 
                        marginHeight={0} 
                        marginWidth={0} 
                        src={data.location.mapUrl}
                        className="filter grayscale contrast-125"
                    ></iframe>
                    <div className="absolute bottom-3 right-3">
                        <button className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <Navigation size={12} /> {t('shooting.getDirections')}
                        </button>
                    </div>
                </div>
                <div className="p-4">
                    <h3 className="text-white font-bold">{t(data.location.titleKey)}</h3>
                    <p className="text-gray-400 text-sm">{t(data.location.addressKey)}</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default ShootingRange;
