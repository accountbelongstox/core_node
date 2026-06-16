
import React, { useState } from 'react';
import BentoCard from '../BentoCard';
import { RefreshCw, Copy, Check, Cloud, Zap } from "lucide-react";
import { ToolConfig } from '../../types';
import { apiClient } from '../../services/api';

interface PasswordGeneratorProps {
  config: ToolConfig;
}

const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ config }) => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'mock' | null>(null);

  const generatePassword = async () => {
    setIsProcessing(true);
    const res = await apiClient.executeToolAction('ut4', 'gen', {
        length, upper: includeUpper, lower: includeLower, numbers: includeNumbers, symbols: includeSymbols
    }, config);
    setIsProcessing(false);

    if (res.success && res.data) {
        setPassword(res.data.password);
        setDataSource(res.dataSource || 'mock');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate on first load if empty
  React.useEffect(() => {
    if (!password) generatePassword();
  }, []);

  return (
    <BentoCard title="Secure Credential Synthesizer" className="h-full">
      <div className="p-6 h-full flex flex-col gap-6 relative">
        
        {/* Source Indicator */}
        <div className="absolute top-6 right-6 z-10">
             {dataSource && (
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border ${dataSource === 'cloud' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {dataSource === 'cloud' ? <Cloud size={10} /> : <Zap size={10} />}
                    {dataSource === 'cloud' ? 'API' : 'Mock'}
                </div>
            )}
        </div>

        {/* Result Area */}
        <div className="relative group mt-8">
            <div className="w-full bg-black/30 border border-white/10 rounded-2xl p-6 text-center break-all font-mono text-2xl md:text-3xl text-emerald-400 tracking-wider shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] min-h-[5rem] flex items-center justify-center">
                {isProcessing ? <span className="opacity-50 text-sm animate-pulse">Generating...</span> : password}
            </div>
            <button 
                onClick={copyToClipboard}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white transition-colors backdrop-blur-sm"
                title="Copy Password"
            >
                {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
            </button>
        </div>

        {/* Controls */}
        <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
            
            {/* Length Slider */}
            <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-bold text-slate-400 uppercase tracking-wider">
                    <span>Password Length</span>
                    <span className="text-indigo-400 text-lg">{length}</span>
                </div>
                <input 
                    type="range" 
                    min="6" 
                    max="64" 
                    value={length} 
                    onChange={(e) => setLength(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { label: "Uppercase (A-Z)", state: includeUpper, setter: setIncludeUpper },
                    { label: "Lowercase (a-z)", state: includeLower, setter: setIncludeLower },
                    { label: "Numbers (0-9)", state: includeNumbers, setter: setIncludeNumbers },
                    { label: "Symbols (!@#)", state: includeSymbols, setter: setIncludeSymbols },
                ].map((opt, idx) => (
                    <label key={idx} className="flex items-center justify-between p-4 bg-black/20 rounded-xl cursor-pointer hover:bg-black/30 transition-colors border border-transparent hover:border-white/10 group">
                        <span className="text-slate-300 font-medium group-hover:text-white transition-colors">{opt.label}</span>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors relative ${opt.state ? 'bg-indigo-600' : 'bg-slate-700'}`} onClick={(e) => { e.preventDefault(); opt.setter(!opt.state); }}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${opt.state ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </label>
                ))}
            </div>

            <div className="mt-auto">
                <button 
                    onClick={generatePassword}
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    <RefreshCw size={20} className={isProcessing ? "animate-spin" : ""} /> 
                    {isProcessing ? "Synthesizing..." : "Generate New Password"}
                </button>
            </div>
        </div>
      </div>
    </BentoCard>
  );
};

export default PasswordGenerator;
