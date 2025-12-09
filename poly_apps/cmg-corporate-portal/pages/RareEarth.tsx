import React from 'react';
import { Pickaxe, MapPin, Factory, Settings, ChevronLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const RareEarth: React.FC = () => {
  return (
    <div className="bg-white min-h-screen pb-24 font-sans text-gray-900">
       
       <div className="bg-gray-100 p-6 pt-safe-top">
          <Link to="/" className="inline-block mb-6 text-gray-500">
             <ChevronLeft size={28} />
          </Link>
          <div className="inline-block bg-emerald-600 text-white px-3 py-1 text-[10px] font-bold uppercase rounded mb-4">
              National Strategic Project
          </div>
          <h1 className="text-3xl font-bold leading-tight mb-2">Viset Rare Earth<br/>Industrial Chain</h1>
          <p className="text-gray-500 text-sm">Resource Development & Processing</p>
       </div>

       <div className="px-6 py-8 space-y-8">
           
           {/* Key Stats */}
           <div className="grid grid-cols-2 gap-4">
               <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                   <p className="text-emerald-600 font-bold text-2xl">50</p>
                   <p className="text-xs text-gray-400 uppercase">Sq. Km Area</p>
               </div>
               <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                   <p className="text-emerald-600 font-bold text-2xl">3000t</p>
                   <p className="text-xs text-gray-400 uppercase">Annual Oxide</p>
               </div>
           </div>

           {/* Location Info */}
           <div>
               <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                   <MapPin size={20} className="text-gray-400" /> Location & Assets
               </h2>
               <div className="bg-white border border-gray-100 shadow-lg rounded-2xl p-6">
                   <div className="mb-4 border-b border-gray-100 pb-4">
                       <h3 className="font-bold text-sm text-gray-900">Mining Rights</h3>
                       <p className="text-sm text-gray-500 mt-1">Huaphan Province (50 km² exploration rights with government support).</p>
                   </div>
                   <div>
                       <h3 className="font-bold text-sm text-gray-900">Factory Address</h3>
                       <p className="text-sm text-gray-500 mt-1">Khong Sa-an Village, Xaythany District, Vientiane (7.2 Hectares).</p>
                   </div>
               </div>
           </div>

           {/* Processing Cap */}
           <div>
               <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                   <Factory size={20} className="text-gray-400" /> Processing Capacity
               </h2>
               <div className="space-y-3">
                   <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                       <span className="text-sm font-medium">Monazite Concentrate</span>
                       <span className="text-sm font-bold text-emerald-700">5,000 Tons/Yr</span>
                   </div>
                   <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                       <span className="text-sm font-medium">Rare Earth Oxide</span>
                       <span className="text-sm font-bold text-emerald-700">3,000 Tons/Yr</span>
                   </div>
                   <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                       <span className="text-sm font-medium">Solid Chloride</span>
                       <span className="text-sm font-bold text-emerald-700">6,300 Tons</span>
                   </div>
               </div>
           </div>

           {/* Tech Adv */}
           <div className="bg-emerald-900 text-white p-6 rounded-3xl">
               <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                   <Settings size={20} className="text-emerald-400" /> Technology
               </h2>
               <ul className="space-y-4">
                   <li className="flex items-start gap-3">
                       <CheckCircle size={18} className="text-emerald-400 mt-0.5" />
                       <p className="text-sm text-emerald-100">China-Laos Dual Base Linkage (Laos Factory).</p>
                   </li>
                   <li className="flex items-start gap-3">
                       <CheckCircle size={18} className="text-emerald-400 mt-0.5" />
                       <p className="text-sm text-emerald-100">Fully enclosed extraction and separation technology.</p>
                   </li>
                   <li className="flex items-start gap-3">
                       <CheckCircle size={18} className="text-emerald-400 mt-0.5" />
                       <p className="text-sm text-emerald-100">Approved by Ministry of Planning & Investment.</p>
                   </li>
               </ul>
           </div>

       </div>
    </div>
  );
};

export default RareEarth;