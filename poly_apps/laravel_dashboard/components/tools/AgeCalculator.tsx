
import React, { useState } from 'react';
import BentoCard from '../BentoCard';
import { Calendar, RefreshCw, Calculator, AlertTriangle, Cloud, Zap } from "lucide-react";
import { ToolConfig } from '../../types';
import { apiClient } from '../../services/api';

interface AgeCalculatorProps {
  config: ToolConfig;
}

const AgeCalculator: React.FC<AgeCalculatorProps> = ({ config }) => {
  const [birthDate, setBirthDate] = useState('');
  const [result, setResult] = useState<{ years: number, months: number, days: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'mock' | undefined>(undefined);

  const calculateAge = async () => {
    setError(null);
    setResult(null);
    setIsProcessing(true);
    setDataSource(undefined);

    const response = await apiClient.executeToolAction('calc1', 'calc', { birthDate }, config);

    setIsProcessing(false);
    if (response.success && response.data && !response.data.error) {
        setResult(response.data);
        setDataSource(response.dataSource);
    } else {
        setError(response.error || response.data?.error || "Calculation failed");
        setDataSource(response.dataSource);
    }
  };

  return (
    <BentoCard title="Age Calculator Engine" className="h-full">
      <div className="p-8 flex flex-col md:flex-row gap-8 h-full">
        
        {/* Input Section */}
        <div className="flex-1 space-y-6">
            <div className="space-y-2">
                <label className="text-sm text-slate-400 font-bold uppercase tracking-wider">Date of Birth</label>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input 
                        type="date" 
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
            </div>

            <button 
                onClick={calculateAge}
                disabled={!birthDate || isProcessing}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? <RefreshCw className="animate-spin" /> : <Calculator />}
                {isProcessing ? 'Processing...' : 'Calculate Age'}
            </button>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                    <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
                    <div className="text-sm text-red-200">
                        <p className="font-bold text-red-400 mb-1">Execution Failed</p>
                        {error}
                    </div>
                </div>
            )}
        </div>

        {/* Result Section */}
        <div className="flex-1 bg-black/20 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Data Source Badge */}
            {dataSource && (
                <div className={`absolute top-4 right-4 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border ${dataSource === 'cloud' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {dataSource === 'cloud' ? <Cloud size={10} /> : <Zap size={10} />}
                    {dataSource === 'cloud' ? 'API Cloud' : 'Mock Data'}
                </div>
            )}

            {result ? (
                <div className="text-center space-y-4 relative z-10 animate-in zoom-in duration-300">
                    <div className="text-slate-400 text-sm font-mono uppercase tracking-widest">Calculated Age</div>
                    <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500">
                        {result.years}
                    </div>
                    <div className="text-xl text-slate-400">Years Old</div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-xs">
                        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                            <div className="text-2xl font-bold text-indigo-400">{result.months}</div>
                            <div className="text-xs text-slate-500 uppercase">Months</div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                            <div className="text-2xl font-bold text-purple-400">{result.days}</div>
                            <div className="text-xs text-slate-500 uppercase">Days</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-slate-600">
                    <RefreshCw size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Enter a date to begin calculation</p>
                </div>
            )}
        </div>

      </div>
    </BentoCard>
  );
};

export default AgeCalculator;
