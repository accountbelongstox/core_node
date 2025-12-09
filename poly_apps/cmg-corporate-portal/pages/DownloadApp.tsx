
import React from 'react';
import { Apple, Smartphone, Star, Shield, Zap, Globe, Download, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import Assets from '../assets';

const DownloadApp: React.FC = () => {
  const { t } = useAppContext();
  const navigate = useNavigate();
  
  const features = [
    { icon: <Shield size={24}/>, title: 'VIP Security', desc: 'Instant bodyguard booking.' },
    { icon: <Zap size={24}/>, title: 'Real-time Assets', desc: 'Track rare earth indices.' },
    { icon: <Star size={24}/>, title: 'Priority Access', desc: 'Exclusive resort reservations.' },
    { icon: <Globe size={24}/>, title: 'Concierge', desc: '24/7 Multi-language support.' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white pb-12 font-sans overflow-x-hidden">
      
      {/* Header */}
      <div className="px-6 pt-safe-top pb-4 flex items-center justify-between sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <ArrowLeft size={24} />
         </button>
         <span className="font-serif font-bold text-lg">CMG Mobile</span>
         <div className="w-8"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        
        {/* Hero Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-16 pt-8">
           {/* Text Content */}
           <div className="md:w-1/2 space-y-8 animate-fade-in relative z-10">
              <div className="inline-flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-500 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-100 dark:border-yellow-500/20">
                 <Download size={14} /> Official App
              </div>
              <h1 className="text-5xl md:text-7xl font-serif font-bold leading-tight">
                Control Your <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-400">Capital Empire</span>
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg font-serif italic">
                "Experience the full power of Capital Management Group in the palm of your hand. From secure communications to asset management."
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <button className="flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-xl active:scale-95 border border-transparent dark:border-white">
                    <Apple size={28} />
                    <div className="text-left">
                       <div className="text-[10px] uppercase opacity-60 font-bold tracking-wider">Download on the</div>
                       <div className="text-lg font-bold leading-none font-sans">App Store</div>
                    </div>
                 </button>
                 <button className="flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-200 dark:border-zinc-800 px-8 py-4 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-lg active:scale-95">
                    <Smartphone size={28} />
                    <div className="text-left">
                       <div className="text-[10px] uppercase opacity-60 font-bold tracking-wider">Get it on</div>
                       <div className="text-lg font-bold leading-none font-sans">Google Play</div>
                    </div>
                 </button>
              </div>

              <div className="flex items-center gap-6 pt-4 text-sm text-gray-500 font-medium">
                 <div className="flex -space-x-3">
                    <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800 border-2 border-white dark:border-black flex items-center justify-center text-[10px] font-bold">VIP</div>
                    <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-zinc-700 border-2 border-white dark:border-black flex items-center justify-center text-[10px] font-bold">VIP</div>
                    <div className="w-10 h-10 rounded-full bg-yellow-500 border-2 border-white dark:border-black flex items-center justify-center text-[10px] font-bold text-black">+2k</div>
                 </div>
                 <p className="font-serif">Join 2,000+ Elite Members</p>
              </div>
           </div>

           {/* Phone Mockup */}
           <div className="md:w-1/2 relative flex justify-center animate-slide-up">
              {/* Background Blob */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-gradient-to-br from-yellow-500/10 to-purple-500/10 rounded-full blur-3xl -z-10"></div>
              
              <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden ring-1 ring-white/20">
                 {/* Notch */}
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-zinc-800 rounded-b-2xl z-20"></div>
                 {/* Screen Content */}
                 <div className="w-full h-full bg-zinc-950 text-white pt-14 px-6 flex flex-col relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    
                    <div className="flex justify-between items-center mb-8 relative z-10">
                       <div className="w-12 h-12 bg-black border border-yellow-600 rounded-full p-1 overflow-hidden">
                          <img src={Assets.logo.min} className="w-full h-full object-cover rounded-full" alt="logo" />
                       </div>
                       <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                          <Globe size={18} className="text-gray-400"/>
                       </div>
                    </div>
                    
                    <h2 className="text-2xl font-serif font-bold mb-6 relative z-10 leading-tight">Welcome,<br/>Mr. Guo</h2>
                    
                    <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 p-6 rounded-3xl mb-6 shadow-lg shadow-yellow-900/20 relative z-10">
                       <div className="text-yellow-100 text-[10px] uppercase mb-2 font-bold tracking-wider">Total Assets</div>
                       <div className="text-3xl font-serif font-bold text-white">$12.4M</div>
                    </div>
                    
                    <div className="space-y-4 relative z-10">
                       <div className="bg-zinc-900/80 backdrop-blur p-4 rounded-2xl flex items-center gap-4 border border-white/5">
                          <div className="p-3 bg-red-900/30 rounded-xl text-red-500"><Shield size={20}/></div>
                          <div className="flex-1">
                             <div className="font-bold text-sm text-white">Security</div>
                             <div className="text-[10px] text-gray-400">Sector 4 Secure</div>
                          </div>
                          <CheckCircle size={16} className="text-green-500"/>
                       </div>
                       <div className="bg-zinc-900/80 backdrop-blur p-4 rounded-2xl flex items-center gap-4 border border-white/5">
                          <div className="p-3 bg-green-900/30 rounded-xl text-green-500"><Zap size={20}/></div>
                          <div className="flex-1">
                             <div className="font-bold text-sm text-white">Rare Earth</div>
                             <div className="text-[10px] text-gray-400">+15% Growth</div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-gray-100 dark:border-zinc-800 pt-12 pb-12">
           {features.map((f, i) => (
              <div key={i} className="p-6 rounded-3xl bg-gray-50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 hover:shadow-xl group">
                 <div className="w-12 h-12 bg-white dark:bg-black rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-yellow-600 mb-4 shadow-sm transition-colors">
                    {f.icon}
                 </div>
                 <h3 className="font-serif font-bold text-lg mb-2">{f.title}</h3>
                 <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {f.desc}
                 </p>
              </div>
           ))}
        </div>

      </div>
    </div>
  );
};

export default DownloadApp;
