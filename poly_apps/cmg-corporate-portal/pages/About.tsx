import React from 'react';
import { ChevronLeft, Crown, Building2, Target, Shield, Factory, Globe, MapPin, Phone, Mail, Briefcase, Users, TrendingUp, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import Assets from '../assets';

const About: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useAppContext();

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      
      {/* Header */}
      <div className="bg-gradient-to-b from-zinc-900 to-black px-6 pt-safe-top pb-6 sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-2 text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-serif font-bold text-yellow-500">{t('about.title')}</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8 animate-fade-in">
        
        {/* Company Overview */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-black border-2 border-yellow-600 rounded-full mx-auto mb-4 flex items-center justify-center p-2 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
              <img src={Assets.logo.full} alt="CMG Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-2">{t('about.company.title')}</h2>
            <p className="text-sm text-zinc-400 mb-4">{t('about.company.fullName')}</p>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-md mx-auto">
              {t('about.company.description')}
            </p>
          </div>

          {/* Company Info Grid */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-yellow-500" />
                <span className="text-xs text-zinc-400 font-bold uppercase">{t('about.company.established')}</span>
              </div>
              <p className="text-sm font-bold text-white">2025</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-yellow-500" />
                <span className="text-xs text-zinc-400 font-bold uppercase">{t('about.company.headquarters')}</span>
              </div>
              <p className="text-sm font-bold text-white">{t('about.company.headquartersLocation')}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5 col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-yellow-500" />
                <span className="text-xs text-zinc-400 font-bold uppercase">{t('about.company.coreBusiness')}</span>
              </div>
              <p className="text-sm text-white">{t('about.company.coreBusinessList')}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5 col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Award size={16} className="text-yellow-500" />
                <span className="text-xs text-zinc-400 font-bold uppercase">{t('about.company.mission')}</span>
              </div>
              <p className="text-sm text-white leading-relaxed">{t('about.company.missionText')}</p>
            </div>
          </div>
        </section>

        {/* Chairman Section */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Crown size={24} className="text-yellow-500" />
            <h2 className="text-xl font-serif font-bold text-white">{t('about.chairman.title')}</h2>
          </div>

          <div className="space-y-6">
            {/* Chairman Photo */}
            <div className="relative">
              <div className="w-full bg-zinc-800 rounded-xl overflow-hidden border-2 border-yellow-500/30 p-2">
                <div className="relative w-full" style={{ paddingBottom: '75%' }}>
                  <img 
                    src={Assets.chairman} 
                    alt={t('about.chairman.name')}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
              </div>
              <div className="mt-4 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-yellow-500/30">
                <h3 className="text-lg font-serif font-bold text-yellow-500 mb-1">{t('about.chairman.name')}</h3>
                <p className="text-xs text-zinc-400">{t('about.chairman.position')}</p>
              </div>
            </div>

            {/* Chairman Info */}
            <div className="space-y-4">
              <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5">
                <h4 className="text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                  <Briefcase size={16} />
                  {t('about.chairman.experience')}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {t('about.chairman.experienceText')}
                </p>
              </div>

              <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5">
                <h4 className="text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                  <Award size={16} />
                  {t('about.chairman.coreConcept')}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {t('about.chairman.coreConceptText')}
                </p>
              </div>

              <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5">
                <h4 className="text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                  <Target size={16} />
                  {t('about.chairman.representativeProjects')}
                </h4>
                <ul className="space-y-2 mt-2">
                  <li className="text-xs text-zinc-300 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">1.</span>
                    <span>{t('about.chairman.project1')}</span>
                  </li>
                  <li className="text-xs text-zinc-300 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">2.</span>
                    <span>{t('about.chairman.project2')}</span>
                  </li>
                  <li className="text-xs text-zinc-300 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">3.</span>
                    <span>{t('about.chairman.project3')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Subsidiaries Section */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Building2 size={24} className="text-yellow-500" />
            <h2 className="text-xl font-serif font-bold text-white">{t('about.subsidiaries.title')}</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Target size={20} className="text-red-500" />
                <h3 className="font-bold text-red-100">{t('about.subsidiaries.shootingRange')}</h3>
              </div>
              <p className="text-xs text-red-200/80">{t('about.subsidiaries.shootingRangeDesc')}</p>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Shield size={20} className="text-blue-500" />
                <h3 className="font-bold text-blue-100">{t('about.subsidiaries.securityGroup')}</h3>
              </div>
              <p className="text-xs text-blue-200/80">{t('about.subsidiaries.securityGroupDesc')}</p>
            </div>

            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Factory size={20} className="text-emerald-500" />
                <h3 className="font-bold text-emerald-100">{t('about.subsidiaries.rareEarth')}</h3>
              </div>
              <p className="text-xs text-emerald-200/80">{t('about.subsidiaries.rareEarthDesc')}</p>
            </div>
          </div>
        </section>

        {/* Project Locations Map */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <MapPin size={24} className="text-yellow-500" />
            <h2 className="text-xl font-serif font-bold text-white">{t('about.locations.title')}</h2>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
              <h4 className="text-sm font-bold text-yellow-500 mb-2">{t('about.locations.headquarters')}</h4>
              <p className="text-xs text-zinc-300">{t('corporate.address')}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
              <h4 className="text-sm font-bold text-red-500 mb-2">{t('about.locations.shootingRange')}</h4>
              <p className="text-xs text-zinc-300">{t('about.locations.shootingRangeLocation')}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
              <h4 className="text-sm font-bold text-emerald-500 mb-2">{t('about.locations.rareEarth')}</h4>
              <p className="text-xs text-zinc-300">{t('about.locations.rareEarthLocation')}</p>
            </div>
          </div>

          {/* OpenStreetMap */}
          <div className="w-full h-64 rounded-xl overflow-hidden border border-white/10 relative">
            <iframe 
              width="100%" 
              height="100%" 
              frameBorder="0" 
              scrolling="no" 
              marginHeight={0} 
              marginWidth={0} 
              src="https://www.openstreetmap.org/export/embed.html?bbox=102.5800%2C17.9400%2C102.6600%2C17.9900&amp;layer=mapnik&amp;marker=17.9757,102.6331&amp;marker=17.95,102.6&amp;marker=17.98,102.65" 
              className="absolute inset-0 w-full h-full grayscale opacity-60 hover:opacity-80 transition-opacity"
            ></iframe>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none"></div>
          </div>
        </section>

        {/* Investment & Partnership */}
        <section className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/40 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/20">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp size={24} className="text-yellow-500" />
            <h2 className="text-xl font-serif font-bold text-white">{t('about.investment.title')}</h2>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-yellow-100/90 leading-relaxed">
              {t('about.investment.description')}
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
                <h4 className="text-sm font-bold text-yellow-400 mb-2">{t('about.investment.opportunities')}</h4>
                <ul className="space-y-2 text-xs text-yellow-100/80">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>{t('about.investment.opportunity1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>{t('about.investment.opportunity2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>{t('about.investment.opportunity3')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-xl p-4 border border-yellow-500/30">
            <h4 className="text-sm font-bold text-yellow-400 mb-3">{t('about.investment.contact')}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-yellow-500 flex-shrink-0" />
                <a href={`tel:${t('corporate.phone').replace(/\s/g, '')}`} className="text-sm text-white hover:text-yellow-500 transition-colors">
                  {t('corporate.phone')}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-yellow-500 flex-shrink-0" />
                <a href={`mailto:${t('corporate.email')}`} className="text-sm text-white hover:text-yellow-500 transition-colors">
                  {t('corporate.email')}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Globe size={24} className="text-yellow-500" />
            <h2 className="text-xl font-serif font-bold text-white">{t('about.contact.title')}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-yellow-500 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs text-zinc-400 mb-1">{t('about.contact.address')}</p>
                <p className="text-sm text-white leading-relaxed">{t('corporate.address')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-zinc-400 mb-1">{t('about.contact.phone')}</p>
                <a href={`tel:${t('corporate.phone').replace(/\s/g, '')}`} className="text-sm text-white hover:text-yellow-500 transition-colors">
                  {t('corporate.phone')}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-zinc-400 mb-1">{t('about.contact.email')}</p>
                <a href={`mailto:${t('corporate.email')}`} className="text-sm text-white hover:text-yellow-500 transition-colors">
                  {t('corporate.email')}
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default About;

