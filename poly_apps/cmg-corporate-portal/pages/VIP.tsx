import React from 'react';
import { Crown, Shield, Gem, Key, Star, Check, QrCode, Calendar, ArrowRight, Bell } from 'lucide-react';
import { useAppContext } from '../App';

const VIP: React.FC = () => {
  const { t } = useAppContext();
  return (
    <div className="bg-black text-white font-sans selection:bg-yellow-600 selection:text-white pb-24">
      
      {/* 1. VIP Digital Card Header */}
      <section className="relative h-[400px] flex items-center justify-center overflow-hidden px-6 pt-12">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-900/30 via-black to-black"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        
        {/* The Digital Card */}
        <div className="relative z-10 w-full max-w-sm aspect-[1.6/1] bg-gradient-to-br from-zinc-800 to-black rounded-3xl border border-yellow-600/30 shadow-[0_0_50px_rgba(234,179,8,0.2)] p-6 flex flex-col justify-between transform transition-transform hover:scale-105 duration-700 group overflow-hidden">
            
            {/* Holographic Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>

            <div className="flex justify-between items-start">
                <Crown className="text-yellow-500" size={32} />
                <div className="text-right">
                    <p className="text-[10px] text-yellow-600 font-bold tracking-widest uppercase">{t('vip.memberSince')}</p>
                    <p className="text-sm font-serif text-yellow-500">2025</p>
                </div>
            </div>

            <div>
                <p className="text-2xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-600 tracking-wide mb-1">
                    GUO XIANSHENG
                </p>
                <p className="text-xs text-zinc-500 font-mono tracking-wider">CMG-VIP-001-8888</p>
            </div>

            <div className="flex justify-between items-end border-t border-white/10 pt-4">
                 <div>
                     <p className="text-[10px] text-zinc-500 uppercase">{t('vip.status')}</p>
                     <p className="text-sm font-bold text-white">{t('vip.blackDiamond')}</p>
                 </div>
                 <QrCode className="text-white/20" size={32} />
            </div>
        </div>
      </section>

      {/* 2. Exclusive Privileges Marquee */}
      <div className="bg-yellow-900/10 border-y border-yellow-900/20 py-3 overflow-hidden">
          <div className="flex gap-8 animate-marquee whitespace-nowrap text-xs text-yellow-600 font-bold uppercase tracking-widest">
              <span>• {t('vip.privileges.privateJetAccess')}</span>
              <span>• {t('vip.privileges.armedSecurity')}</span>
              <span>• {t('vip.privileges.rareEarthIpo')}</span>
              <span>• {t('vip.privileges.villaManorPriority')}</span>
              <span>• {t('vip.privileges.diplomaticChannel')}</span>
              <span>• {t('vip.privileges.privateJetAccess')}</span>
              <span>• {t('vip.privileges.armedSecurity')}</span>
              <span>• {t('vip.privileges.rareEarthIpo')}</span>
          </div>
      </div>

      {/* 3. Privilege Timeline / Events */}
      <section className="py-12 px-6">
        <h2 className="text-2xl font-serif text-yellow-500 mb-8 flex items-center gap-3">
            <Calendar size={24} /> {t('vip.exclusiveAgenda')}
        </h2>
        
        <div className="space-y-6 relative border-l border-zinc-800 ml-3 pl-8">
            {/* Event 1 */}
            <div className="relative">
                <div className="absolute -left-[39px] w-5 h-5 bg-yellow-600 rounded-full border-4 border-black"></div>
                <p className="text-xs text-yellow-600 font-bold uppercase mb-1">Oct 15, 2025</p>
                <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-yellow-900 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-2">{t('vip.rareEarthAuction')}</h3>
                    <p className="text-zinc-400 text-sm mb-4">
                        {t('vip.rareEarthAuctionDesc')}
                    </p>
                    <button className="text-xs bg-white text-black px-4 py-2 rounded font-bold">{t('vip.rsvpNow')}</button>
                </div>
            </div>

             {/* Event 2 */}
             <div className="relative">
                <div className="absolute -left-[39px] w-5 h-5 bg-zinc-800 rounded-full border-4 border-black"></div>
                <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Nov 01, 2025</p>
                <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 hover:border-yellow-900 transition-colors opacity-60">
                    <h3 className="text-lg font-bold text-white mb-2">{t('vip.shootingCup')}</h3>
                    <p className="text-zinc-400 text-sm">
                        {t('vip.shootingCupDesc')}
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* 4. Membership Tiers Grid (Redesigned) */}
      <section className="py-12 px-6 bg-zinc-900/50">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-serif text-white mb-2">{t('vip.ascendRanks')}</h2>
            <p className="text-zinc-500 text-sm">{t('vip.unlockLevels')}</p>
          </div>

          <div className="space-y-4">
            {/* Gold Tier */}
            <div className="bg-gradient-to-r from-zinc-900 to-black border border-yellow-600/30 p-6 rounded-2xl relative overflow-hidden">
               <div className="absolute -right-4 -top-4 text-yellow-600/10">
                   <Crown size={120} />
               </div>
               <div className="relative z-10 flex justify-between items-center mb-4">
                   <h3 className="text-xl font-serif text-yellow-500">Gold</h3>
                   <span className="bg-yellow-600/20 text-yellow-500 text-[10px] px-2 py-1 rounded font-bold">$50k / Year</span>
               </div>
               <ul className="space-y-2 mb-6">
                   <li className="flex items-center gap-2 text-sm text-zinc-300"><Check size={14} className="text-yellow-600"/> Butler 24/7</li>
                   <li className="flex items-center gap-2 text-sm text-zinc-300"><Check size={14} className="text-yellow-600"/> Unlimited Golf</li>
                   <li className="flex items-center gap-2 text-sm text-zinc-300"><Check size={14} className="text-yellow-600"/> 30 Days Security Detail</li>
               </ul>
               <button className="w-full bg-yellow-700/20 hover:bg-yellow-700/40 text-yellow-500 border border-yellow-700/50 py-3 rounded-xl font-bold text-sm transition-colors">
                   Upgrade Status
               </button>
            </div>

            {/* Black Tier */}
            <div className="bg-black border border-zinc-800 p-6 rounded-2xl relative overflow-hidden grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
               <div className="relative z-10 flex justify-between items-center mb-4">
                   <h3 className="text-xl font-serif text-white">Black</h3>
                   <span className="bg-zinc-800 text-white text-[10px] px-2 py-1 rounded font-bold">Invite Only</span>
               </div>
               <p className="text-sm text-zinc-500 mb-6">
                   Strategic partnership level. Direct investment rights and family office services.
               </p>
               <button className="w-full bg-zinc-900 text-zinc-500 border border-zinc-800 py-3 rounded-xl font-bold text-sm cursor-not-allowed">
                   Contact Chairman
               </button>
            </div>
          </div>
      </section>

      {/* 5. Contact / Concierge */}
      <section className="py-12 px-6 pb-32">
        <div className="bg-yellow-600 rounded-3xl p-8 text-center shadow-lg shadow-yellow-900/40">
           <Bell className="mx-auto text-black mb-4" size={32} />
           <h2 className="text-2xl font-serif text-black font-bold mb-2">Need Assistance?</h2>
           <p className="text-black/70 text-sm mb-6">
               Your private concierge is ready to handle your requests, from booking to security arrangements.
           </p>
           <button className="bg-black text-white px-8 py-4 rounded-xl font-bold w-full">
               Call Concierge
           </button>
        </div>
      </section>

    </div>
  );
};

export default VIP;