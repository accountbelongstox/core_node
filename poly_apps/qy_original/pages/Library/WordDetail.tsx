
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

  if (!word) return <div className="p-10">Loading...</div>;

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up relative bg-white/30 dark:bg-slate-900/30">
        {/* Header Image Area */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-100 to-transparent -z-10 dark:from-blue-900/20"></div>
        
        <div className="px-5 py-4 flex justify-between items-center">
            <button onClick={() => navigate('dictionary')} className="p-2 rounded-full bg-white/50 backdrop-blur-md"><Icons.Back /></button>
            <button className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Edit</button>
        </div>

        <div className="px-6 mt-4 pb-24 overflow-y-auto no-scrollbar">
            {/* Main Word */}
            <div className="text-center mb-8">
                <h1 className="text-5xl font-black text-slate-800 dark:text-white mb-2">{word.text}</h1>
                <div className="inline-flex items-center gap-2 text-blue-500 font-mono text-lg bg-blue-50 dark:bg-blue-900/30 px-4 py-1 rounded-xl">
                    <span>{word.phonetic}</span>
                    <span>🔊</span>
                </div>
            </div>

            {/* Definition */}
            <Card className="mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Definition</div>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{word.translation}</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{word.definition}</p>
            </Card>

            {/* Example */}
            <Card className="mb-4 bg-purple-50/50 dark:bg-purple-900/10 border-purple-100">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Context</div>
                <p className="text-lg italic text-slate-700 dark:text-slate-300 mb-2">"{word.example}"</p>
            </Card>

            {/* User Notes */}
            <div className="mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pl-2">My Notes</div>
                <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full h-32 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/40 focus:ring-2 ring-blue-400 outline-none resize-none shadow-sm dark:text-white"
                    placeholder="Add your memory hook here..."
                />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
                {word.tags.map(t => (
                    <span key={t} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300">#{t}</span>
                ))}
                <button className="px-3 py-1 border-2 border-dashed border-slate-300 rounded-lg text-sm font-bold text-slate-400">+ Add Tag</button>
            </div>
        </div>

        {/* Floating Action */}
        <div className="absolute bottom-6 left-6 right-6">
            <Button className="shadow-2xl">Mark as Mastered</Button>
        </div>
    </div>
  );
};

export default WordDetailPage;
