import React, { useState } from 'react';
import { Star, MapPin, Sun, Calendar, Users, ShoppingBag, Flag, Coffee, ChevronLeft, ArrowRight, BedDouble, Bath, Wifi, Ticket, Building2, FerrisWheel } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../App';
import { mockResortData } from '../data';

const Resort: React.FC = () => {
  const { t } = useAppContext();
  const [section, setSection] = useState<'hotel' | 'fun'>('hotel');
  const data = mockResortData;

  return (
    <div className="bg-stone-50 font-sans text-stone-900 min-h-screen pb-24">
      
      {/* Hero Header */}
      <div className="relative h-[280px]">
        <img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=800&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover" alt="Resort Hero"/>
        <div className="absolute inset-0 bg-black/20"></div>
        <Link to="/" className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white z-10">
            <ChevronLeft size={24} />
        </Link>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-stone-900 to-transparent">
             <h1 className="text-3xl font-serif text-white mb-1">{t('resort.title')}</h1>
             <p className="text-stone-300 text-sm">{t('resort.subtitle')}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex px-4 py-4 bg-white sticky top-[60px] z-30 shadow-sm overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setSection('hotel')}
            className={`flex-none px-6 py-3 rounded-full text-sm font-bold mr-2 transition-colors flex items-center gap-2 ${section === 'hotel' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}
          >
            <Building2 size={16} /> {t('resort.tabs.realEstate')}
          </button>
          <button 
            onClick={() => setSection('fun')}
            className={`flex-none px-6 py-3 rounded-full text-sm font-bold mr-2 transition-colors flex items-center gap-2 ${section === 'fun' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-500'}`}
          >
            <FerrisWheel size={16} /> {t('resort.tabs.culturalTourism')}
          </button>
      </div>

      <div className="px-4 py-6">
        
        {/* HOTEL / REAL ESTATE SECTION */}
        {section === 'hotel' && (
            <div className="animate-fade-in space-y-8">
                
                {/* Introduction */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
                    <h2 className="text-2xl font-serif mb-4">{t('resort.introduction.title')}</h2>
                    <p className="text-stone-600 text-sm leading-relaxed mb-4">
                        {t('resort.introduction.description')}
                    </p>
                </div>

                {/* Date Picker (Visual Only) */}
                <div className="bg-stone-900 p-4 rounded-2xl text-white flex justify-between items-center shadow-lg">
                    <div className="flex-1 border-r border-stone-700 pr-4">
                         <label className="text-[10px] text-stone-400 uppercase tracking-widest">{t('resort.booking.checkIn')}</label>
                         <div className="font-bold flex items-center gap-2"><Calendar size={14}/> Oct 24</div>
                    </div>
                    <div className="flex-1 pl-4">
                         <label className="text-[10px] text-stone-400 uppercase tracking-widest">{t('resort.booking.guests')}</label>
                         <div className="font-bold flex items-center gap-2"><Users size={14}/> 2 {t('resort.booking.adults')}</div>
                    </div>
                </div>

                {/* Villa Cards */}
                <div className="space-y-6">
                    {data.villas.map((villa) => (
                        <div key={villa.id} className="bg-white rounded-3xl shadow-lg overflow-hidden border border-stone-100 group">
                            <div className="h-56 relative overflow-hidden">
                                <img src={villa.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={t(villa.nameKey)} />
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-stone-900 shadow-sm">
                                    {t('resort.booking.available')}
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-serif font-bold text-xl">{t(villa.nameKey)}</h3>
                                    <div className="text-right">
                                        <span className="block text-lg font-bold text-stone-900">${villa.price}</span>
                                        <span className="text-[10px] text-stone-500 uppercase">{t('resort.booking.perNight')}</span>
                                    </div>
                                </div>
                                <p className="text-stone-500 text-sm mb-4 leading-relaxed">{t(villa.descriptionKey)}</p>
                                
                                <div className="flex gap-4 mb-6 border-t border-stone-100 pt-4">
                                    {villa.features.map((feat, i) => (
                                        <span key={i} className="text-xs font-medium bg-stone-50 text-stone-600 px-2 py-1 rounded">
                                            {t(feat.valueKey)}
                                        </span>
                                    ))}
                                </div>

                                <button className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors">
                                    {t('resort.booking.bookThisVilla')} <ArrowRight size={16}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* CULTURAL TOURISM / ENTERTAINMENT SECTION */}
        {section === 'fun' && (
             <div className="animate-fade-in space-y-6">
                 {data.sections.map((section) => (
                     <div key={section.id} className="relative h-64 rounded-3xl overflow-hidden group">
                         <img src={section.image} className="w-full h-full object-cover" alt={t(section.titleKey)} />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                             <h2 className="text-white font-bold text-xl">{t(section.titleKey)}</h2>
                             <p className="text-gray-300 text-xs mt-1">{t(section.descriptionKey)}</p>
                         </div>
                     </div>
                 ))}

                 {/* Ticket Pricing */}
                 <h3 className="font-bold text-lg text-orange-900 pl-2">{t('resort.tickets.admission')}</h3>
                 <div className="grid grid-cols-2 gap-4">
                     {data.tickets.map((ticket) => (
                         <div key={ticket.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex flex-col justify-between h-full">
                             <div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                                    ticket.color === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                    {ticket.icon === 'ticket' && <Ticket size={20}/>}
                                    {ticket.icon === 'sun' && <Sun size={20}/>}
                                </div>
                                <h3 className="font-bold text-sm mb-1">{t(ticket.nameKey)}</h3>
                                <p className="text-xs text-stone-500 mb-3">{t(ticket.descriptionKey)}</p>
                             </div>
                             <div className="mt-auto">
                                <span className={`block text-xl font-bold mb-2 ${
                                    ticket.color === 'orange' ? 'text-orange-600' : 'text-blue-600'
                                }`}>${ticket.price}</span>
                                <button className={`w-full py-2 text-white rounded-lg text-xs font-bold ${
                                    ticket.color === 'orange' ? 'bg-orange-600' : 'bg-blue-600'
                                }`}>{t('resort.tickets.buyTicket')}</button>
                             </div>
                         </div>
                     ))}
                 </div>

                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                     <div className="flex justify-between items-start mb-4">
                         <div>
                             <h3 className="font-bold text-stone-900">{t(data.theater.nameKey)}</h3>
                             <p className="text-xs text-stone-500 mt-1">{t(data.theater.descriptionKey)}</p>
                         </div>
                         <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded">{data.theater.showTime}</span>
                     </div>
                     <div className="flex items-center justify-between border-t border-stone-100 pt-4">
                         <div>
                             <span className="text-xs text-stone-400 uppercase">{t('resort.tickets.vipSeat')}</span>
                             <span className="block font-bold text-lg">${data.theater.vipPrice}</span>
                         </div>
                         <button className="px-6 py-2 border-2 border-stone-900 text-stone-900 rounded-lg text-xs font-bold">{t('resort.tickets.reserveSeat')}</button>
                     </div>
                 </div>

                 <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                     <h3 className="font-bold text-orange-900 mb-3">{t('resort.commercialDistrict.title')}</h3>
                     <p className="text-sm text-orange-800/70 mb-4 leading-relaxed">
                        {t('resort.commercialDistrict.description')}
                     </p>
                     <button className="bg-orange-600 text-white px-6 py-2 rounded-lg text-xs font-bold">{t('resort.commercialDistrict.viewShopDirectory')}</button>
                 </div>
             </div>
        )}

      </div>
    </div>
  );
};

export default Resort;
