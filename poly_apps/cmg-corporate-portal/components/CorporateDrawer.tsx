import React from 'react';
import { Search, ChevronUp, Briefcase, Users, Target, Shield, Factory, Globe, Building2, Crown, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';
import Assets from '../assets';

const CorporateDrawer: React.FC = () => {
    const { isCorporateDrawerOpen, setCorporateDrawerOpen, t } = useAppContext();

    if (!isCorporateDrawerOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setCorporateDrawerOpen(false)}
            ></div>

            {/* Drawer Content */}
            <div className="relative bg-zinc-900 text-white rounded-b-[2.5rem] shadow-2xl overflow-hidden animate-slide-down max-h-[90vh] overflow-y-auto no-scrollbar">
                
                {/* Search Bar (Top Fixed) */}
                <div className="sticky top-0 z-20 bg-zinc-900/90 backdrop-blur-md px-6 py-4 border-b border-white/5">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder={t('corporate.searchPlaceholder')} 
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-600 transition-colors"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    </div>
                </div>

                <div className="px-6 pb-8 pt-4">
                    
                    {/* Header Info */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-black border-2 border-yellow-600 rounded-full mx-auto mb-4 flex items-center justify-center p-1 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                            <img src={Assets.logo.full} alt="CMG Logo" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-2xl font-serif font-bold text-white mb-1">{t('corporate.title')}</h2>
                        <p className="text-xs text-zinc-400 mb-2">{t('corporate.fullName')}</p>
                        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                            {t('corporate.description')}
                        </p>
                    </div>

                    {/* Bento Box Org Chart */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        
                        {/* Board */}
                        <div className="col-span-2 bg-gradient-to-r from-zinc-800 to-zinc-900 p-4 rounded-2xl border border-yellow-600/30 flex items-center justify-between">
                            <div>
                                <h3 className="text-yellow-500 font-bold text-sm uppercase tracking-wider mb-1">{t('corporate.boardOfDirectors')}</h3>
                                <p className="text-xs text-zinc-400">{t('corporate.strategicDecision')}</p>
                            </div>
                            <Crown className="text-yellow-600" size={24} />
                        </div>

                        {/* Direct Management */}
                        <div className="col-span-2 grid grid-cols-3 gap-2">
                             <div className="bg-zinc-800 p-3 rounded-xl text-center border border-white/5">
                                 <Briefcase className="mx-auto text-blue-400 mb-2" size={20} />
                                 <p className="text-[10px] font-bold text-zinc-300">{t('corporate.financeRisk')}</p>
                             </div>
                             <div className="bg-zinc-800 p-3 rounded-xl text-center border border-white/5">
                                 <Target className="mx-auto text-red-400 mb-2" size={20} />
                                 <p className="text-[10px] font-bold text-zinc-300">{t('corporate.strategicInv')}</p>
                             </div>
                             <div className="bg-zinc-800 p-3 rounded-xl text-center border border-white/5">
                                 <Users className="mx-auto text-green-400 mb-2" size={20} />
                                 <p className="text-[10px] font-bold text-zinc-300">{t('corporate.opsMgmt')}</p>
                             </div>
                        </div>

                        {/* Subsidiaries Header */}
                        <div className="col-span-2 mt-2">
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest pl-1">{t('corporate.subsidiaries')}</p>
                        </div>

                        {/* Shooting Range */}
                        <Link to="/shooting" onClick={() => setCorporateDrawerOpen(false)} className="bg-red-900/20 p-4 rounded-2xl border border-red-900/30 hover:bg-red-900/30 transition-colors">
                            <Target className="text-red-500 mb-2" size={24} />
                            <h4 className="font-bold text-sm text-red-100">{t('corporate.intlShootingRange')}</h4>
                            <p className="text-[10px] text-red-300/60 mt-1">{t('corporate.defenseTourism')}</p>
                        </Link>

                        {/* Security */}
                        <Link to="/security" onClick={() => setCorporateDrawerOpen(false)} className="bg-blue-900/20 p-4 rounded-2xl border border-blue-900/30 hover:bg-blue-900/30 transition-colors">
                            <Shield className="text-blue-500 mb-2" size={24} />
                            <h4 className="font-bold text-sm text-blue-100">{t('corporate.securityGroup')}</h4>
                            <p className="text-[10px] text-blue-300/60 mt-1">{t('corporate.protectionEscort')}</p>
                        </Link>

                        {/* Rare Earth */}
                        <Link to="/mining" onClick={() => setCorporateDrawerOpen(false)} className="bg-emerald-900/20 p-4 rounded-2xl border border-emerald-900/30 hover:bg-emerald-900/30 transition-colors">
                            <Factory className="text-emerald-500 mb-2" size={24} />
                            <h4 className="font-bold text-sm text-emerald-100">{t('corporate.visetRareEarth')}</h4>
                            <p className="text-[10px] text-emerald-300/60 mt-1">{t('corporate.miningProcessing')}</p>
                        </Link>

                        {/* Partners */}
                        <div className="bg-purple-900/20 p-4 rounded-2xl border border-purple-900/30 flex flex-col justify-center">
                            <Globe className="text-purple-500 mb-2" size={24} />
                            <h4 className="font-bold text-sm text-purple-100">{t('corporate.globalPartners')}</h4>
                            <p className="text-[10px] text-purple-300/60 mt-1">{t('corporate.capitalTech')}</p>
                        </div>

                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/concierge" onClick={() => setCorporateDrawerOpen(false)} className="bg-white text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                            {t('corporate.concierge')} <ArrowRight size={16} />
                        </Link>
                        <Link to="/resort" onClick={() => setCorporateDrawerOpen(false)} className="bg-yellow-600 text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                            {t('corporate.booking')} <Building2 size={16} />
                        </Link>
                    </div>

                </div>

                {/* Close Handle */}
                <button 
                    onClick={() => setCorporateDrawerOpen(false)}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                    <ChevronUp size={24} />
                </button>
            </div>
        </div>
    );
};

export default CorporateDrawer;