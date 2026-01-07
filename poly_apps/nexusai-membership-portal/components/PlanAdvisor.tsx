import React, { useState } from 'react';
import { getPlanRecommendation } from '../services/geminiService';
import { useAppContext } from '../App';

const PlanAdvisor: React.FC = () => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { t } = useAppContext();

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    const result = await getPlanRecommendation(input);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="glass p-12 rounded-[3rem] border-blue-500/20 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <svg className="w-32 h-32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center animate-pulse shadow-2xl shadow-blue-500/40">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-3xl font-black tracking-tighter italic">{t.nexusAdvisor}</h3>
      </div>
      
      <p className="dark:text-slate-400 text-slate-500 mb-10 text-sm leading-relaxed font-medium">{t.advisorDesc}</p>

      <form onSubmit={handleAsk} className="space-y-8">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.advisorPlaceholder}
          className="w-full dark:bg-black/40 bg-slate-100/50 border dark:border-white/10 border-slate-200 rounded-[2rem] p-6 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all h-36 resize-none placeholder:text-slate-600 font-medium"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl transition-all glow-button flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs shadow-xl shadow-blue-500/20"
        >
          {loading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          ) : t.getAiRec}
        </button>
      </form>

      {response && (
        <div className="mt-12 p-10 bg-blue-600/5 border border-blue-600/20 rounded-[2.5rem] animate-in zoom-in duration-500">
          <div className="text-[10px] font-black text-blue-500 mb-4 uppercase tracking-[0.3em]">{t.strategyInsight}</div>
          <p className="dark:text-slate-200 text-slate-700 text-sm leading-relaxed italic font-medium">"{response}"</p>
        </div>
      )}
    </div>
  );
};

export default PlanAdvisor;

