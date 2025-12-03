import React from 'react';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import { MapPin, Star, ShoppingBag } from 'lucide-react';

const Shop: React.FC = () => {
  const { t } = useStore();

  const products = [
    { id: 1, name: 'Kids Smart Watch', price: '$49.99', dist: '1.2km', img: 'https://api.dicebear.com/7.x/icons/svg?seed=watch', rating: 4.8 },
    { id: 2, name: 'Safety Alarm Keychain', price: '$12.50', dist: '0.5km', img: 'https://api.dicebear.com/7.x/icons/svg?seed=alarm', rating: 4.5 },
    { id: 3, name: 'Portable GPS Tracker', price: '$29.99', dist: '2.0km', img: 'https://api.dicebear.com/7.x/icons/svg?seed=gps', rating: 4.9 },
    { id: 4, name: 'Senior Care Band', price: '$89.00', dist: '3.5km', img: 'https://api.dicebear.com/7.x/icons/svg?seed=band', rating: 4.7 },
  ];

  return (
    <MobileLayout>
      <Header title={t('shop.title')} />
      
      <div className="px-5 pb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {products.map(p => (
          <GlassCard key={p.id} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 120, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={48} color="#94a3b8" />
            </div>
            <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>
                    <MapPin size={12} /> {p.dist}
                    <div style={{ width: 1, height: 10, background: '#cbd5e1', margin: '0 4px' }} />
                    <Star size={12} fill="#fbbf24" color="#fbbf24" /> {p.rating}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, color: '#3b82f6' }}>{p.price}</div>
                    <button style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600 }}>
                        Buy
                    </button>
                </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </MobileLayout>
  );
};

export default Shop;