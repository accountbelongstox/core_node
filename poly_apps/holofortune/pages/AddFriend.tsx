import React from 'react';
import { MobileLayout, Header, Input, GlassCard } from '../components/Shared';
import { QrCode, Search, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

const AddFriend: React.FC = () => {
  return (
    <MobileLayout showNav={false}>
      <Header title="Add Family" backTo="/friends" />
      
      <div className="px-5" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>
        
        {/* Search Box */}
        <div style={{ position: 'relative' }}>
           <Input placeholder="Search by Phone Number" style={{ paddingLeft: 48, paddingRight: 80 }} />
           <Search style={{ position: 'absolute', left: 16, top: 16, color: '#94a3b8' }} size={20} />
           <button style={{ position: 'absolute', right: 8, top: 8, bottom: 8, background: '#3b82f6', color: 'white', padding: '0 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem' }}>
             Search
           </button>
        </div>

        {/* Scan Card */}
        <GlassCard className="scan-area">
           <div style={{ width: 64, height: 64, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', color: '#2563eb' }}>
             <QrCode size={32} />
           </div>
           <div className="text-center">
             <h3 style={{ fontWeight: 700, color: '#334155' }}>Scan QR Code</h3>
             <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Scan face-to-face to add quickly</p>
           </div>
        </GlassCard>

        {/* Recent Search Mock */}
        <div>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Found User</h3>
          <Link to="/friends/request" style={{ display: 'block', textDecoration: 'none' }}>
            <GlassCard className="flex-row justify-between items-center">
              <div className="flex-row items-center gap-3">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" style={{ width: 40, height: 40, borderRadius: '50%', background: '#e2e8f0' }} alt="User" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>John Doe</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>138****8888</div>
                </div>
              </div>
              <div style={{ padding: 8, background: '#dbeafe', color: '#2563eb', borderRadius: 99 }}>
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