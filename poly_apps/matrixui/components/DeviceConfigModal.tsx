
import React, { useState } from 'react';
import { Device, StreamConfig } from '../types';
import { useI18n } from '../services/i18n';

interface DeviceConfigModalProps {
  device: Device;
  onClose: () => void;
  onSave: (serial: string, config: Partial<StreamConfig>) => void;
}

export const DeviceConfigModal: React.FC<DeviceConfigModalProps> = ({ device, onClose, onSave }) => {
  const { t } = useI18n();
  const [config, setConfig] = useState<StreamConfig>({
    max_size: 720,
    bit_rate: 4000000,
    max_fps: 60,
    codec: 'h264',
    locked_video_orientation: -1
  });

  const handleSave = () => {
    onSave(device.serial, config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0a0c10] border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <i className="ph-fill ph-sliders text-[#00f2ff] text-xl"></i>
             <div>
                <h3 className="text-sm font-bold text-white tracking-wide">{t('device_config.title')}</h3>
                <div className="text-[10px] font-mono text-slate-500">{device.serial}</div>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <i className="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
           
           {/* Resolution */}
           <div className="space-y-2">
              <label className="flex justify-between text-xs text-slate-400">
                 <span>{t('settings.resolution')}</span>
                 <span className="text-white font-mono">{config.max_size}p</span>
              </label>
              <input 
                type="range" min="360" max="1080" step="120"
                value={config.max_size}
                onChange={(e) => setConfig({...config, max_size: parseInt(e.target.value)})}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
              />
              <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                <span>{t('device_config.resolution_360')}</span><span>{t('device_config.resolution_720')}</span><span>{t('device_config.resolution_1080')}</span>
              </div>
           </div>

           {/* Bitrate */}
           <div className="space-y-2">
              <label className="flex justify-between text-xs text-slate-400">
                 <span>{t('settings.bitrate')}</span>
                 <span className="text-white font-mono">{config.bit_rate / 1000000} Mbps</span>
              </label>
              <input 
                type="range" min="500000" max="8000000" step="500000"
                value={config.bit_rate}
                onChange={(e) => setConfig({...config, bit_rate: parseInt(e.target.value)})}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
              />
           </div>

           {/* FPS & Codec Row */}
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <label className="text-xs text-slate-400 block">{t('settings.fps')}</label>
                 <select 
                    value={config.max_fps}
                    onChange={(e) => setConfig({...config, max_fps: parseInt(e.target.value)})}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-[#00f2ff] outline-none"
                 >
                    <option value="30">{t('device_config.fps_30')}</option>
                    <option value="60">{t('device_config.fps_60')}</option>
                    <option value="90">{t('device_config.fps_90')}</option>
                    <option value="120">{t('device_config.fps_120')}</option>
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-xs text-slate-400 block">{t('settings.codec')}</label>
                 <select 
                    value={config.codec}
                    onChange={(e) => setConfig({...config, codec: e.target.value as any})}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-[#00f2ff] outline-none"
                 >
                    <option value="h264">{t('device_config.codec_h264')}</option>
                    <option value="h265">{t('device_config.codec_h265')}</option>
                    <option value="av1">{t('device_config.codec_av1')}</option>
                 </select>
              </div>
           </div>

           {/* Orientation */}
           <div className="space-y-2">
              <label className="text-xs text-slate-400 block">{t('device_config.orientation')}</label>
              <div className="grid grid-cols-3 gap-2">
                 <OrientationBtn 
                   label={t('device_config.auto')} 
                   active={config.locked_video_orientation === -1} 
                   onClick={() => setConfig({...config, locked_video_orientation: -1})} 
                 />
                 <OrientationBtn 
                   label={t('device_config.portrait')} 
                   active={config.locked_video_orientation === 0} 
                   onClick={() => setConfig({...config, locked_video_orientation: 0})} 
                 />
                 <OrientationBtn 
                   label={t('device_config.landscape')} 
                   active={config.locked_video_orientation === 1} 
                   onClick={() => setConfig({...config, locked_video_orientation: 1})} 
                 />
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#050608] border-t border-white/10 flex gap-3">
           <button 
             onClick={onClose}
             className="flex-1 py-2 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white border border-transparent hover:border-white/10 transition-all"
           >
             {t('device_config.cancel')}
           </button>
           <button 
             onClick={handleSave}
             className="flex-1 py-2 rounded-lg text-xs font-bold uppercase bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80 shadow-[0_0_15px_rgba(0,242,255,0.3)] transition-all"
           >
             {t('device_config.save')}
           </button>
        </div>

      </div>
    </div>
  );
};

const OrientationBtn = ({ label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`py-1.5 rounded border text-[10px] font-bold uppercase transition-all
      ${active 
        ? 'bg-white/10 border-white text-white' 
        : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/30'}
    `}
  >
    {label}
  </button>
);
