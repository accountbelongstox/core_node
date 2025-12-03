import React from 'react';
import { MobileLayout, Header, GlassCard, Input, Button } from '../components/Shared';

const SendRequest: React.FC = () => {
  return (
    <MobileLayout showNav={false}>
      <Header title="Verify Request" backTo="/friends/add" />
      
      <div className="px-5 pt-4">
        <div className="flex-col items-center mb-4" style={{ display: 'flex' }}>
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginBottom: 12 }} alt="User" />
           <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>John Doe</h2>
           <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Beijing, China</p>
        </div>

        <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
           <div>
             <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginLeft: 4, marginBottom: 4, display: 'block' }}>Message</label>
             <Input defaultValue="Hi, I'm Alex. Please add me." />
           </div>
           
           <div>
             <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginLeft: 4, marginBottom: 4, display: 'block' }}>Alias/Remark</label>
             <Input defaultValue="Uncle John" />
           </div>

           <div>
             <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginLeft: 4, marginBottom: 4, display: 'block' }}>Relation</label>
             <select className="input-field" style={{ appearance: 'none', background: 'var(--input-bg)' }}>
               <option>Family</option>
               <option>Partner</option>
               <option>Friend</option>
             </select>
           </div>

           <div style={{ paddingTop: 16 }}>
             <Button>Send Request</Button>
           </div>
        </GlassCard>
      </div>
    </MobileLayout>
  );
};

export default SendRequest;