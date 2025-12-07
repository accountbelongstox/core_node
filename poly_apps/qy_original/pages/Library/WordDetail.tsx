import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button, Card } from '../../components/UI';
import { api } from '../../services/api';
import { Word } from '../../types';

const WordDetailPage = () => {
  const { navigate, currentParams } = useContext(AppContext);
  const [word, setWord] = useState<Word | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    // In real app, use currentParams.wordId
    api.getWordDetail('w1').then(data => {
        setWord(data);
        setNote("My custom note for this word...");
    });
  }, []);

  if (!word) return <div className="p-10 text-center animate-pulse text-primary">Loading Neural Data...</div>;

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up relative bg-slate-50/50 dark:bg-slate-900/50">
        {/* Header Image Area */}
        <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-b from-blue-500/20 to-transparent -z-10 pointer-events-none"></div>
        
        <div className="px-5 py-4 flex justify-between items-center">
            <button onClick={() => navigate('dictionary')} className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"><Icons.Back /></button>
            <button className="text-xs font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full uppercase tracking-wider">Edit</button>
        </div>

        <div className="px-6 mt-4 flex-1 overflow-y-auto no-scrollbar pb-32">
            {/* Main Word */}
            <div className="text-center mb-10 mt-4">
                <h1 className="text-6xl font-black text-primary mb-3 tracking-tight">{word.text}</h1>
                <div className="inline-flex items-center gap-3 text-blue-500 font-mono text-lg bg-blue-500/10 border border-blue-500/10 px-5 py-2 rounded-2xl">
                    <span>{word.phonetic}</span>
                    <span className="cursor-pointer hover:scale-110 transition-transform">🔊</span>
                </div>
            </div>

            {/* Definition */}
            <div className="app-card mb-6">
                <div className="text-xs font-bold text-tertiary uppercase tracking-widest mb-3">Definition</div>
                <p className="text-2xl font-bold text-primary mb-4 leading-tight">{word.translation}</p>
                <p className="text-secondary leading-relaxed text-lg">{word.definition}</p>
            </div>

            {/* Example */}
            <div className="app-card mb-6 !bg-purple-500/5 !border-purple-500/10">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">Context</div>
                <p className="text-xl italic text-primary/80 font-serif leading-relaxed">"{word.example}"</p>
            </div>

            {/* User Notes */}
            <div className="mb-6">
                <div className="text-xs font-bold text-tertiary uppercase tracking-widest mb-3 pl-2">My Notes</div>
                <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="glass-textarea h-40"
                    placeholder="Add your memory hook here..."
                />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-8">
                {word.tags.map(t => (
                    <span key={t} className="tag-chip">#{t}</span>
                ))}
                <button className="tag-chip !bg-transparent border-dashed !text-tertiary hover:text-primary transition-colors">+ Add Tag</button>
            </div>
        </div>

        {/* Floating Action */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 pb-safe z-20">
            <Button className="shadow-2xl shadow-blue-500/30 py-4 text-lg">Mark as Mastered</Button>
        </div>
    </div>
  );
};

export default WordDetailPage;