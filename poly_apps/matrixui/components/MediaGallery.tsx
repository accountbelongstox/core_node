
import React, { useState } from 'react';
import { useI18n } from '../services/i18n';
import { MediaItem } from '../types';

// Mock Media Data
const MOCK_MEDIA: MediaItem[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `m-${i}`,
  type: i % 4 === 0 ? 'video' : 'image',
  url: '', // In real app, this would be a real URL
  timestamp: `2025-05-12 14:${10 + i}:00`,
  deviceSerial: `D-2025-${1000 + (i % 5)}`,
  size: i % 4 === 0 ? '12.5 MB' : '2.1 MB',
  duration: i % 4 === 0 ? '00:45' : undefined
}));

interface MediaGalleryProps {
  onClose: () => void;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredMedia = MOCK_MEDIA.filter(item => filter === 'all' || item.type === filter);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050608] relative overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0c10]">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded bg-[#ff2a6d]/20 text-[#ff2a6d] border border-[#ff2a6d]/50">
            <i className="ph-fill ph-film-strip text-xl"></i>
          </div>
          <div>
            <h2 className="text-white font-bold tracking-wider">{t('gallery.title')}</h2>
            <div className="text-[10px] font-mono text-slate-500">
               /var/matrix/media_store
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={onClose} className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white transition-colors">
              <i className="ph-bold ph-x"></i>
           </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-white/[0.02]">
        <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
          <FilterBtn active={filter === 'all'} label={t('gallery.filter_all')} onClick={() => setFilter('all')} />
          <FilterBtn active={filter === 'image'} label={t('gallery.screenshots')} icon="ph-image" onClick={() => setFilter('image')} />
          <FilterBtn active={filter === 'video'} label={t('gallery.recordings')} icon="ph-video" onClick={() => setFilter('video')} />
        </div>

        <div className="flex gap-2">
           <button 
             className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             disabled={selectedItems.size === 0}
           >
             <i className="ph-bold ph-download-simple"></i> {t('gallery.download')}
           </button>
           <button 
             className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#ff2a6d]/10 text-[#ff2a6d] border border-[#ff2a6d]/30 hover:bg-[#ff2a6d]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             disabled={selectedItems.size === 0}
           >
             <i className="ph-bold ph-trash"></i> {t('gallery.delete')}
           </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredMedia.map((item, i) => (
              <div 
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`
                  group relative aspect-square rounded-xl overflow-hidden border cursor-pointer transition-all
                  ${selectedItems.has(item.id) ? 'border-[#00f2ff] ring-1 ring-[#00f2ff]' : 'border-white/10 hover:border-white/30'}
                `}
              >
                 {/* Preview Placeholder */}
                 <div className="absolute inset-0 bg-[#0a0c10] flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                    <i className={`ph-fill ${item.type === 'video' ? 'ph-film-slate' : 'ph-image'} text-4xl text-slate-700 group-hover:text-slate-500`}></i>
                    
                    {/* Fake Grid Pattern for image */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                 </div>

                 {/* Type Badge */}
                 <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur border border-white/10 text-[9px] font-bold text-white uppercase flex items-center gap-1">
                    <i className={`ph-fill ${item.type === 'video' ? 'ph-video' : 'ph-camera'}`}></i>
                    {item.type}
                 </div>

                 {/* Duration Badge (Video only) */}
                 {item.type === 'video' && item.duration && (
                   <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur border border-white/10 text-[9px] font-mono text-white">
                      {item.duration}
                   </div>
                 )}

                 {/* Selection Check */}
                 {selectedItems.has(item.id) && (
                   <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00f2ff] flex items-center justify-center shadow-lg">
                      <i className="ph-bold ph-check text-black text-xs"></i>
                   </div>
                 )}

                 {/* Overlay Info on Hover */}
                 <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <div className="text-[10px] text-white font-mono truncate">{item.deviceSerial}</div>
                    <div className="text-[9px] text-slate-400">{item.timestamp}</div>
                    <div className="text-[9px] text-slate-500">{item.size}</div>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const FilterBtn = ({ active, label, icon, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
      ${active ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}
    `}
  >
    {icon && <i className={`ph-bold ${icon}`}></i>}
    {label}
  </button>
);
