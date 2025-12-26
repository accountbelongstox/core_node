import React from 'react';
import { Phone, MessageCircle, Mail, ChevronLeft, User, Clock, Shield, MapPin, Send, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { getMockWeather, getTimeInfo } from '../utils/weather';

const Concierge: React.FC = () => {
  const { t, isLoggedIn, user, openLogin } = useAppContext();
  const navigate = useNavigate();

  return (
    <div className="bg-black text-white min-h-screen pb-24 font-sans selection:bg-yellow-600 selection:text-white">
      
      {/* Header */}
      <div className="relative pt-safe-top px-6 pb-8 bg-gradient-to-b from-zinc-900 to-black">
        <div className="flex justify-between items-center mb-6 pt-4">
             <Link to="/" className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 transition-colors">
                <ChevronLeft size={24} />
             </Link>
             <h1 className="text-lg font-serif tracking-wide text-yellow-500">{t('concierge.title')}</h1>
             <div className="w-10"></div> {/* Spacer */}
        </div>
        
        {!isLoggedIn ? (
          // Non-Login State
          <div className="bg-zinc-900/60 backdrop-blur-xl rounded-xl p-4 border border-white/5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-white mb-1">{t('home.welcome.title')}</h2>
                <p className="text-xs text-gray-400">{t('home.welcome.subtitle')}</p>
              </div>
              <button
                onClick={openLogin}
                className="bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-yellow-700 transition-colors flex items-center gap-1"
              >
                <LogIn size={12} />
                {t('auth.login')}
              </button>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t('concierge.loginPrompt')}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-serif font-bold mb-2">{t('concierge.greeting')} <br/> <span className="text-yellow-500">{user?.nickname || t('concierge.greetingName')}</span></h2>
            <p className="text-zinc-400 text-sm">{t('concierge.subtitle')}</p>
          </>
        )}
      </div>

      <div className="px-6 pt-6">
        
        {/* Quick Contact Actions */}
        <div className="grid grid-cols-3 gap-4 mb-8">
            <a href="tel:+85620515718000" className="bg-zinc-900 p-4 rounded-2xl flex flex-col items-center gap-2 border border-zinc-800 hover:border-yellow-600 hover:bg-zinc-800 transition-all focus:outline-none">
                <div className="w-10 h-10 bg-green-900/30 text-green-500 rounded-full flex items-center justify-center">
                    <Phone size={20} />
                </div>
                <span className="text-xs font-bold">{t('concierge.callNow')}</span>
            </a>
            <button className="bg-zinc-900 p-4 rounded-2xl flex flex-col items-center gap-2 border border-zinc-800 hover:border-yellow-600 hover:bg-zinc-800 transition-all focus:outline-none">
                <div className="w-10 h-10 bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center">
                    <MessageCircle size={20} />
                </div>
                <span className="text-xs font-bold">{t('concierge.liveChat')}</span>
            </button>
            <a href="mailto:capitalmgcltd@gmail.com" className="bg-zinc-900 p-4 rounded-2xl flex flex-col items-center gap-2 border border-zinc-800 hover:border-yellow-600 hover:bg-zinc-800 transition-all focus:outline-none">
                <div className="w-10 h-10 bg-purple-900/30 text-purple-500 rounded-full flex items-center justify-center">
                    <Mail size={20} />
                </div>
                <span className="text-xs font-bold">{t('concierge.email')}</span>
            </a>
        </div>

        {/* Support Staff Profile */}
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-8 flex items-center gap-4">
             <div className="relative">
                 <img src="https://ui-avatars.com/api/?name=Sarah+Chen&background=d4af37&color=000" className="w-14 h-14 rounded-full border-2 border-zinc-800" alt="Agent"/>
                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"></div>
             </div>
             <div>
                 <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">{t('concierge.dedicatedAgent')}</p>
                 <h3 className="text-lg font-bold text-white">Sarah Chen</h3>
                 <p className="text-[10px] text-yellow-600 bg-yellow-900/20 px-2 py-0.5 rounded inline-block mt-1">{t('concierge.seniorConcierge')}</p>
             </div>
        </div>

        {/* Service Request Form */}
        <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Send size={18} className="text-yellow-500"/> {t('concierge.quickRequest')}
            </h3>
            <div className="bg-zinc-900 rounded-2xl p-1 border border-zinc-800">
                <textarea 
                    className="w-full bg-transparent p-4 text-sm text-white placeholder-zinc-600 focus:outline-none min-h-[120px] resize-none"
                    placeholder={t('concierge.requestPlaceholder')}
                ></textarea>
                <div className="flex justify-between items-center p-2 border-t border-zinc-800">
                    <div className="flex gap-2">
                        <button className="p-2 text-zinc-500 hover:text-white transition-colors"><MapPin size={18}/></button>
                        <button className="p-2 text-zinc-500 hover:text-white transition-colors"><Clock size={18}/></button>
                    </div>
                    <button className="bg-yellow-600 text-black px-6 py-2 rounded-xl font-bold text-sm hover:bg-yellow-500 transition-colors">
                        {t('concierge.sendRequest')}
                    </button>
                </div>
            </div>
        </div>

        {/* FAQ Section */}
        <div>
            <h3 className="text-lg font-bold mb-4 text-zinc-400">{t('concierge.commonTopics')}</h3>
            <div className="space-y-3">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center group cursor-pointer">
                    <span className="text-sm font-medium group-hover:text-yellow-500 transition-colors">{t('concierge.howToUpgrade')}</span>
                    <ChevronLeft size={16} className="rotate-180 text-zinc-600 group-hover:text-yellow-500"/>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center group cursor-pointer">
                    <span className="text-sm font-medium group-hover:text-yellow-500 transition-colors">{t('concierge.bookingSecurity')}</span>
                    <ChevronLeft size={16} className="rotate-180 text-zinc-600 group-hover:text-yellow-500"/>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center group cursor-pointer">
                    <span className="text-sm font-medium group-hover:text-yellow-500 transition-colors">{t('concierge.helicopterRates')}</span>
                    <ChevronLeft size={16} className="rotate-180 text-zinc-600 group-hover:text-yellow-500"/>
                </div>
            </div>
        </div>
        
        {/* Contact Info Footer */}
        <div className="mt-8 pt-8 border-t border-zinc-800 text-center">
            <p className="text-zinc-500 text-xs mb-2">{t('concierge.directLine')}</p>
            <p className="text-xl font-mono text-white mb-2">{t('corporate.phone')}</p>
            <p className="text-zinc-400 text-sm mb-4">{t('corporate.email')}</p>
            <p className="text-zinc-600 text-[10px]">
                {t('corporate.address')}
            </p>
        </div>

      </div>
    </div>
  );
};

export default Concierge;