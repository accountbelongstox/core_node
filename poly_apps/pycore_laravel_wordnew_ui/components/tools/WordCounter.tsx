
import React, { useState, useEffect } from 'react';
import BentoCard from '../BentoCard';
import { AlignLeft, Type, Clock, FileText, Cloud, Zap } from "lucide-react";
import { ToolConnectionConfig } from '../../types';
import { apiClient } from '../../services/api';

interface WordCounterProps {
  config: ToolConnectionConfig;
}

const StatCard = ({ label, value, icon: Icon }: { label: string, value: number | string, icon: any }) => (
    <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors">
        <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Icon size={20} />
        </div>
        <div>
            <div className="text-2xl font-bold text-slate-200">{value}</div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">{label}</div>
        </div>
    </div>
);

const WordCounter: React.FC<WordCounterProps> = ({ config }) => {
  const [text, setText] = useState('');
  const [stats, setStats] = useState({ words: 0, chars: 0, charsNoSpace: 0, sentences: 0, paragraphs: 0, readTime: '0 min' });
  const [dataSource, setDataSource] = useState<'cloud' | 'mock' | null>(null);

  useEffect(() => {
    const analyze = async () => {
        const res = await apiClient.executeToolAction('ta4', 'analyze', { text }, config);
        if (res.success && res.data) {
            setStats(res.data);
            setDataSource(res.dataSource || 'mock');
        }
    };

    const timer = setTimeout(analyze, 600); // Debounce to prevent spamming API
    return () => clearTimeout(timer);
  }, [text, config]);

  return (
    <BentoCard title="Text Metrics Analyzer" className="h-full">
      <div className="p-6 h-full flex flex-col gap-6 relative">
        
        {/* Source Indicator */}
        <div className="absolute top-6 right-6">
             {dataSource && (
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 border ${dataSource === 'cloud' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {dataSource === 'cloud' ? <Cloud size={10} /> : <Zap size={10} />}
                    {dataSource === 'cloud' ? 'API' : 'Mock'}
                </div>
            )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <StatCard label="Words" value={stats.words} icon={Type} />
            <StatCard label="Characters" value={stats.chars} icon={AlignLeft} />
            <StatCard label="Sentences" value={stats.sentences} icon={FileText} />
            <StatCard label="Read Time" value={stats.readTime} icon={Clock} />
        </div>

        {/* Text Input Area */}
        <div className="flex-1 min-h-0 flex flex-col">
            <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste or type your content here to analyze..."
                className="flex-1 w-full bg-black/20 border border-white/10 rounded-xl p-6 text-slate-300 font-mono text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all placeholder-slate-600"
            ></textarea>
            
            <div className="mt-2 flex justify-between text-xs text-slate-500 px-2 font-mono">
                <span>Chars (no spaces): {stats.charsNoSpace}</span>
                <span>Paragraphs: {stats.paragraphs}</span>
            </div>
        </div>

      </div>
    </BentoCard>
  );
};

export default WordCounter;

