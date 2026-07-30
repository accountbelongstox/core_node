
import React, { useState, useEffect } from 'react';
import BentoCard from '../BentoCard';
import { Palette, Copy, Check, ArrowRight, Hash, Zap, Cloud } from "lucide-react";
import { ToolConnectionConfig } from '../../types';
import { apiClient } from '../../services/api';
import { NOISE_TEXTURE_BG_CLASS } from '../../utils/noiseTexture';

interface HexToRgbProps {
  config: ToolConnectionConfig;
}

const HexToRgb: React.FC<HexToRgbProps> = ({ config }) => {
  const [hex, setHex] = useState('#6366f1');
  const [rgb, setRgb] = useState('...');
  const [copied, setCopied] = useState(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'mock' | null>(null);

  // Real-time API binding with debounce? 
  // For simplicity in this demo, we call API on every valid-ish change or via effect
  useEffect(() => {
      const convert = async () => {
          if (hex.length < 4) return;
          const res = await apiClient.executeToolAction('col1', 'convert', { hex }, config);
          if (res.success && res.data) {
              setRgb(res.data.rgb);
              setDataSource(res.dataSource || 'mock');
          }
      };
      
      const timer = setTimeout(convert, 500); // Debounce
      return () => clearTimeout(timer);
  }, [hex, config]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rgb);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <BentoCard title="Color Vector Processor" className="h-full">
      <div className="p-8 h-full flex flex-col justify-center relative">
        
        {/* Data Source Indicator */}
        <div className="absolute top-0 right-0 p-4">
             {dataSource && (
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border ${dataSource === 'cloud' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {dataSource === 'cloud' ? <Cloud size={10} /> : <Zap size={10} />}
                    {dataSource === 'cloud' ? 'API' : 'Mock'}
                </div>
            )}
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            
            {/* Hex Input */}
            <div className="flex-1 w-full space-y-3">
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Hash size={14} /> Hex Value
                </label>
                <div className="relative group">
                    <div 
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-white/20 shadow-inner"
                        style={{ backgroundColor: hex.startsWith('#') && hex.length >= 4 ? hex : 'transparent' }}
                    ></div>
                    <input 
                        type="text" 
                        value={hex}
                        onChange={(e) => setHex(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-mono text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all uppercase"
                        maxLength={7}
                    />
                </div>
            </div>

            {/* Arrow */}
            <div className="text-slate-600">
                <ArrowRight size={32} />
            </div>

            {/* RGB Output */}
            <div className="flex-1 w-full space-y-3">
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Palette size={14} /> RGB Output
                </label>
                <div className="relative group">
                    <input 
                        type="text" 
                        value={rgb}
                        readOnly
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-12 text-indigo-300 font-mono text-lg outline-none cursor-default"
                    />
                    <button 
                        onClick={copyToClipboard}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Copy RGB"
                    >
                        {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                </div>
            </div>

        </div>

        {/* Visualizer */}
        <div className={`mt-12 p-8 rounded-2xl border border-white/10 ${NOISE_TEXTURE_BG_CLASS} relative overflow-hidden transition-colors duration-500`} style={{ backgroundColor: rgb.startsWith('rgb') ? rgb : '#1e293b' }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm">
                <span className="text-white font-bold drop-shadow-md">Preview</span>
            </div>
        </div>

      </div>
    </BentoCard>
  );
};

export default HexToRgb;

