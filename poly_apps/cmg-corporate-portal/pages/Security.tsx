import React from 'react';
import { Shield, UserCheck, Briefcase, ChevronLeft, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

const Security: React.FC = () => {
  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans text-slate-900">
      
       {/* Simple Header */}
      <div className="bg-slate-900 text-white pt-6 pb-12 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
         
         <div className="flex justify-between items-center mb-6 relative z-10">
            <Link to="/" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <ChevronLeft size={24} />
            </Link>
            <Shield className="text-blue-500" />
         </div>
         
         <h1 className="text-3xl font-bold mb-2 relative z-10">China-Laos<br/>Int'l Security Group</h1>
         <p className="text-slate-400 text-sm relative z-10">High-end security services in Southeast Asia</p>
      </div>

      <div className="px-6 -mt-8 relative z-10 space-y-6">
        
        {/* Market Pos Card */}
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
            <h2 className="text-sm font-bold uppercase text-slate-400 mb-4 tracking-wider">Market Positioning</h2>
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-100">
                <div>
                    <div className="text-blue-600 font-black text-xl">Top 1%</div>
                    <div className="text-[10px] text-slate-500">Elite Cert.</div>
                </div>
                <div>
                    <div className="text-blue-600 font-black text-xl">2000+</div>
                    <div className="text-[10px] text-slate-500">Trained/Yr</div>
                </div>
                <div>
                    <div className="text-blue-600 font-black text-xl">Rapid</div>
                    <div className="text-[10px] text-slate-500">Response</div>
                </div>
            </div>
        </div>

        {/* Instructor Profile */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="bg-slate-100 p-6 flex gap-4 items-center">
                 <img src="https://ui-avatars.com/api/?name=Li+Xu&background=0f172a&color=fff&size=64" className="w-16 h-16 rounded-full shadow-md" alt="Li Xu"/>
                 <div>
                     <h3 className="font-bold text-lg">Li Xu (Instructor)</h3>
                     <p className="text-xs text-slate-500">China's #1 Bodyguard · 30+ Years Exp.</p>
                 </div>
             </div>
             <div className="p-6">
                 <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Founder of Nine Life Bodyguard Academy (2006). Combining advanced tactics from Russia, UK, and Israel. First person in China to write books promoting international bodyguard concepts.
                 </p>
                 <div className="flex gap-2 flex-wrap">
                     <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] rounded font-bold">IBF China Head</span>
                     <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] rounded font-bold">IBSA China Head</span>
                 </div>
             </div>
        </div>

        {/* Services List */}
        <h2 className="text-lg font-bold pl-2">Service Sectors</h2>
        <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                    <UserCheck size={24} />
                </div>
                <div>
                    <h3 className="font-bold">VIP Protection</h3>
                    <p className="text-xs text-slate-500 mt-1">National-level summits, diplomats, and family escort.</p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                    <Briefcase size={24} />
                </div>
                <div>
                    <h3 className="font-bold">Business Security</h3>
                    <p className="text-xs text-slate-500 mt-1">Risk control for executives and cross-border investment teams.</p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                    <Shield size={24} />
                </div>
                <div>
                    <h3 className="font-bold">Armed Transit</h3>
                    <p className="text-xs text-slate-500 mt-1">Escort for valuables and cash with strict risk control.</p>
                </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                    <Award size={24} />
                </div>
                <div>
                    <h3 className="font-bold">Tactical Training</h3>
                    <p className="text-xs text-slate-500 mt-1">Standardized courses for Laos military and police (IBF/IBSA certified).</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Security;