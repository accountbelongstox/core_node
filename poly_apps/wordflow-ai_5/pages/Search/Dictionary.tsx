
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { MOCK_WORDS_EN } from '../../services/mockData';

const DictionaryPage = () => {
  const { navigate } = useContext(AppContext);
  const [query, setQuery] = useState('');

  const results = query 
    ? MOCK_WORDS_EN.filter(w => w.text.toLowerCase().includes(query.toLowerCase()) || w.translation.includes(query))
    : [];

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
       <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('courses')} className="p-1"><Icons.Back /></button>
          <h1 className="text-2xl font-bold dark:text-white">Dictionary</h1>
       </div>

       <div className="relative mb-6">
          <input 
            type="text" 
            placeholder="Type a word..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-4 pl-12 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 shadow-sm outline-none focus:ring-2 ring-blue-400 dark:text-white"
            autoFocus
          />
          <div className="absolute left-4 top-4 text-slate-400">🔍</div>
       </div>

       <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
          {query === '' && (
            <div className="text-center mt-20 text-slate-400">
               <div className="text-4xl mb-4">📖</div>
               <p>Search specifically or paste text to analyze.</p>
            </div>
          )}

          {results.map(word => (
            <Card key={word.id} className="animate-fade-in">
               <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold dark:text-white">{word.text}</h3>
                  <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300">{word.tags[0]}</span>
               </div>
               <div className="text-blue-500 font-mono text-sm mb-2">{word.phonetic}</div>
               <p className="text-slate-700 dark:text-slate-300 font-medium mb-2">{word.translation}</p>
               <p className="text-slate-500 text-sm italic">"{word.example}"</p>
            </Card>
          ))}
          
          {query && results.length === 0 && (
             <div className="text-center mt-10 text-slate-500">No results found.</div>
          )}
       </div>
    </div>
  );
};

export default DictionaryPage;
