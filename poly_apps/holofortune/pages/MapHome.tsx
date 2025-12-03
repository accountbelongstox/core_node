import React, { useState, useEffect, useRef } from 'react';
import { MobileLayout, GlassCard } from '../components/Shared';
import L from 'leaflet';
import { useStore } from '../store';
import { Bell, ShieldAlert, Heart, Activity } from 'lucide-react';

const MapHome: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const { friends, t } = useStore();
  const activeFriend = friends[0]; // Select first friend for demo

  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // If map already exists, just update view
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([activeFriend.location.lat, activeFriend.location.lng], 15);
      return;
    }

    // Fix Leaflet Icons
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
    }).setView([activeFriend.location.lat, activeFriend.location.lng], 15);

    // Add Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Add Marker
    const marker = L.marker([activeFriend.location.lat, activeFriend.location.lng])
      .addTo(map)
      .bindPopup(activeFriend.name)
      .openPopup();

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, [activeFriend.location.lat, activeFriend.location.lng, activeFriend.name]);

  return (
    <MobileLayout style={{ overflow: 'hidden', height: '100vh', paddingBottom: 0 }}>
      {/* Full Screen Map Container */}
      <div ref={mapContainerRef} className="map-full-container" />

      {/* Floating Header Controls */}
      <div className="map-controls">
        <button className="control-btn alert">
           <ShieldAlert size={20} />
        </button>
        <button className="control-btn normal">
           <Bell size={20} />
        </button>
      </div>

      {/* Bottom Card */}
      <div className="map-card-container">
        <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex-row items-center gap-4 p-4">
            <div style={{ position: 'relative' }}>
              <img src={activeFriend.avatar} alt={activeFriend.name} style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid white' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, background: '#22c55e', borderRadius: '50%', border: '1px solid white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="flex-row items-center gap-2">
                <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>{activeFriend.name}</h3>
                <span style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>{activeFriend.relation}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Heart size={12} fill="#ec4899" color="#ec4899" />
                {t('home.days')}: {activeFriend.daysConnected}
              </p>
            </div>
            <div className="text-center">
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Battery</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#16a34a' }}>85%</div>
            </div>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.3)', padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderTop: '1px solid rgba(255,255,255,0.4)' }}>
            <button className="flex-center gap-2" style={{ color: 'var(--danger-color)', fontWeight: 700, fontSize: '0.875rem', borderRight: '1px solid rgba(255,255,255,0.4)' }}>
              <ShieldAlert size={16} /> {t('home.sos')}
            </button>
             <button className="flex-center gap-2" style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.875rem' }}>
              <Activity size={16} /> {t('home.fence')}
            </button>
          </div>
        </GlassCard>
      </div>
    </MobileLayout>
  );
};

export default MapHome;