import React from 'react';
import { MobileLayout, Header, Input, GlassCard } from '../components/Shared';
import { QrCode, Search, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

const AddFriend: React.FC = () => {
  return (
    <MobileLayout showNav={false}>
      <Header title="Add Family" backTo="/friends" />
      
      <div className="px-5 space-y-6 pt-4">
        
        {/* Search Box */}
        <div className="relative">
           <Input placeholder="Search by Phone Number" className="pl-12 py-4 shadow-sm" />
           <Search className="absolute left-4 top-4 text-slate-400" />
           <button className="absolute right-2 top-2 bottom-2 bg-blue-500 text-white px-4 rounded-lg font-bold text-xs">
             Search
           </button>
        </div>

        {/* Scan Card */}
        <GlassCard className="flex flex-col items-center justify-center py-10 gap-4 border-dashed border-2 border-blue-200 bg-blue-50/50">
           <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-blue-600">
             <QrCode size={32} />
           </div>
           <div className="text-center">
             <h3 className="font-bold text-slate-700">Scan QR Code</h3>
             <p className="text-xs text-slate-400 mt-1">Scan face-to-face to add quickly</p>
           </div>
        </GlassCard>

        {/* Recent Search Mock */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Found User</h3>
          <Link to="/friends/request">
            <GlassCard className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" className="w-10 h-10 rounded-full bg-slate-200" />
                <div>
                  <div className="font-bold text-sm">John Doe</div>
                  <div className="text-xs text-slate-400">138****8888</div>
                </div>
              </div>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                <UserPlus size={18} />
              </div>
            </GlassCard>
          </Link>
        </div>

      </div>
    </MobileLayout>
  );
};

export default AddFriend;