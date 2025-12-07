import React from 'react';
import { MobileLayout, Header, GlassCard, Input, Button } from '../components/Shared';

const SendRequest: React.FC = () => {
  return (
    <MobileLayout showNav={false}>
      <Header title="Verify Request" backTo="/friends/add" />
      
      <div className="px-6 pt-6">
        <div className="flex flex-col items-center mb-8">
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" className="w-20 h-20 rounded-full border-4 border-white shadow-lg mb-3" />
           <h2 className="text-xl font-bold">John Doe</h2>
           <p className="text-slate-400 text-sm">Beijing, China</p>
        </div>

        <GlassCard className="space-y-4">
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Message</label>
             <Input defaultValue="Hi, I'm Alex. Please add me." />
           </div>
           
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Alias/Remark</label>
             <Input defaultValue="Uncle John" />
           </div>

           <div>
             <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Relation</label>
             <select className="w-full px-4 py-3 rounded-xl outline-none bg-white/50 border border-white/60 focus:ring-2 focus:ring-blue-400">
               <option>Family</option>
               <option>Partner</option>
               <option>Friend</option>
             </select>
           </div>

           <div className="pt-4">
             <Button>Send Request</Button>
           </div>
        </GlassCard>
      </div>
    </MobileLayout>
  );
};

export default SendRequest;