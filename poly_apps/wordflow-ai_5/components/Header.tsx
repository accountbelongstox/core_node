import React, { useState, useEffect, useContext } from 'react';
import { Icons, Card } from './UI';
import { AppContext } from '../contexts/AppContext';
import { MOCK_ANNOUNCEMENTS, SUPPORTED_LANGUAGES } from '../services/mockData';

export const Header = ({ title }: { title?: string }) => {
  const { user, navigate, t } = useContext(AppContext);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['en']);
  const [isOnlineTranslate, setIsOnlineTranslate] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Handle Scroll Effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = () => {
     if(!searchQuery.trim()) return;
     setIsSearching(true);
     setSearchResult(null);
     
     // Simulate API Call
     setTimeout(() => {
         setSearchResult({
             text: searchQuery,
             translation: isOnlineTranslate ? "Online Translation Result" : "Local Dictionary Result",
             phonetic: "/.../",
             definition: "A detailed definition retrieved from the selected source.",
             tags: selectedLangs
         });
         setIsSearching(false);
     }, 800);
  };

  const toggleLang = (code: string) => {
      if (selectedLangs.includes(code)) {
          setSelectedLangs(prev => prev.filter(c => c !== code));
      } else {
          setSelectedLangs(prev => [...prev, code]);
      }
  };

  return (
    <>
        {/* Floating Header Island */}
        <div className="fixed top-4 left-4 right-4 z-40 flex justify-center">
            <div className={`
                w-full max-w-md mx-auto rounded-full px-2 py-2 flex items-center gap-3 transition-all duration-500
                ${isScrolled 
                   ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg border border-white/40 dark:border-white/10' 
                   : 'bg-transparent border border-transparent'}
            `}>
                <div className="flex-1 flex items-center justify-between gap-3 pl-2">
                    {/* User Avatar */}
                    <div onClick={() => navigate(user ? 'profile' : 'login')} className="cursor-pointer shrink-0 group relative">
                        {user ? (
                            <img src={user.avatar} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform" alt="Profile" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-white/50 text-slate-500">
                                <Icons.User />
                            </div>
                        )}
                        {/* Status Dot */}
                         <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                    </div>

                    {/* Search Capsule */}
                    <div 
                        onClick={() => setIsSearchOpen(true)}
                        className={`
                          flex-1 h-10 rounded-full flex items-center px-4 gap-2 cursor-pointer transition-all duration-300 group
                          ${isScrolled ? 'bg-slate-100 dark:bg-slate-800/50' : 'bg-white/70 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/5 shadow-sm'}
                        `}
                    >
                        <span className="text-slate-400 group-hover:text-blue-500 transition-colors"><Icons.Search /></span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
                            {title || 'Search dictionary...'}
                        </span>
                    </div>

                    {/* Settings Button */}
                    <button 
                        onClick={() => navigate('settings')}
                        className={`
                          w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300
                          ${isScrolled ? 'bg-transparent text-slate-500' : 'bg-white/70 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/5 shadow-sm text-slate-600 dark:text-slate-300'}
                          hover:bg-white dark:hover:bg-slate-700
                        `}
                    >
                        <Icons.Settings />
                    </button>
                </div>
            </div>
        </div>

        {/* Announcement Ticker (Below Floating Header) */}
        <div className="pt-20 px-6 pb-2 max-w-md mx-auto">
             <div className="flex items-center gap-2 overflow-hidden py-1 opacity-80 hover:opacity-100 transition-opacity">
                 <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded shadow-sm shadow-blue-500/30">NEW</span>
                 <div className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-400 truncate animate-slide-up">
                     {MOCK_ANNOUNCEMENTS[0].message}
                 </div>
             </div>
        </div>

        {/* Full Screen Search Overlay */}
        {isSearchOpen && (
            <div className="fixed inset-0 z-50 flex flex-col animate-fade-in">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-slate-900/30 dark:bg-black/60 backdrop-blur-md" onClick={() => setIsSearchOpen(false)}></div>
                
                {/* Search Panel */}
                <div className="relative bg-white dark:bg-slate-900 w-full rounded-b-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-b border-white/10">
                    <div className="p-6 pt-safe space-y-6">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-white">Smart Search</h2>
                            <button onClick={() => setIsSearchOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <Icons.Close />
                            </button>
                        </div>

                        {/* Language Multi-Select */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Target Languages</label>
                            <div className="flex gap-2 flex-wrap">
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => toggleLang(lang.code)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                                            selectedLangs.includes(lang.code)
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {lang.flag} {lang.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Input Area */}
                        <div className="relative group">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Type a word or sentence..."
                                autoFocus
                                className="w-full p-5 pr-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none text-lg shadow-inner dark:text-white font-serif transition-all"
                            />
                            <button 
                                onClick={handleSearch}
                                className="absolute right-3 top-3 p-2 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform"
                            >
                                <Icons.Search />
                            </button>
                        </div>

                        {/* Options Toggle */}
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isOnlineTranslate ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <Icons.Cloud />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">Online Translate</span>
                                    <span className="text-[10px] text-slate-400">Use Cloud AI Engine</span>
                                </div>
                            </div>
                            <div 
                                onClick={() => setIsOnlineTranslate(!isOnlineTranslate)}
                                className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${isOnlineTranslate ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isOnlineTranslate ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto min-h-[200px]">
                        {isSearching ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-pulse">
                                <Icons.Cloud />
                                <span className="mt-2 text-sm font-bold">Searching Cloud...</span>
                            </div>
                        ) : searchResult ? (
                            <div className="animate-slide-up">
                                <Card className="bg-white dark:bg-slate-800 border-none shadow-lg">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-4xl font-serif font-bold text-slate-800 dark:text-white">{searchResult.text}</h3>
                                            <div className="text-blue-500 font-mono text-sm mt-1">{searchResult.phonetic}</div>
                                        </div>
                                        <button className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:scale-105 transition-transform">
                                            <Icons.Sound />
                                        </button>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Meaning</div>
                                        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{searchResult.translation}</p>
                                    </div>
                                    
                                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 border-l-4 border-l-blue-400">
                                        <p className="text-lg font-serif text-slate-600 dark:text-slate-400 italic leading-relaxed">"{searchResult.definition}"</p>
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        {searchResult.tags.map((t: string) => (
                                            <span key={t} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs font-bold text-slate-500 uppercase">{t}</span>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 mt-8">
                                <p>Enter a word to see results.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
  );
};