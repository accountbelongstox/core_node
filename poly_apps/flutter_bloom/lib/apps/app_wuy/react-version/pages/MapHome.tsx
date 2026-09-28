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

    // Fix Leaflet Icons (Standard fix for webpack/bundlers, applied here just in case)
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
    <MobileLayout className="relative h-screen pb-0">
      {/* Full Screen Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ height: '100%', width: '100%' }} />

      {/* Floating Header Controls */}
      <div className="absolute top-12 right-5 z-20 flex gap-3">
        <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-red-500 animate-pulse">
           <ShieldAlert size={20} />
        </button>
        <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-blue-500">
           <Bell size={20} />
        </button>
      </div>

      {/* Bottom Card - Positioned above nav */}
      <div className="absolute bottom-24 left-4 right-4 z-20">
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            <div className="relative">
              <img src={activeFriend.avatar} alt={activeFriend.name} className="w-14 h-14 rounded-full border-2 border-white shadow-md" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{activeFriend.name}</h3>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{activeFriend.relation}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Heart size={12} className="text-pink-500 fill-pink-500" />
                {t('home.days')}: {activeFriend.daysConnected}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Battery</div>
              <div className="font-mono font-bold text-green-600">85%</div>
            </div>
          </div>
          
          <div className="bg-white/30 p-3 grid grid-cols-2 gap-px border-t border-white/40">
            <button className="flex items-center justify-center gap-2 py-1 text-red-500 font-bold text-sm border-r border-white/40">
              <ShieldAlert size={16} /> {t('home.sos')}
            </button>
             <button className="flex items-center justify-center gap-2 py-1 text-blue-600 font-bold text-sm">
              <Activity size={16} /> {t('home.fence')}
            </button>
          </div>
        </GlassCard>
      </div>
    </MobileLayout>
  );
};

export default MapHome;