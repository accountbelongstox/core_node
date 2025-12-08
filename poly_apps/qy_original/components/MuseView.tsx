import React, { useState, useRef, useEffect, useContext } from 'react';
import { Icons } from './Icons';
import { Message, LoadingState } from '../types';
import { generateCreativeText } from '../services/geminiService';
import { AppContext } from '../contexts/AppContext';

export const MuseView: React.FC = () => {
  const { navigate } = useContext(AppContext);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: "I am Lumina. I exist to spark your imagination. Tell me a fragment of a dream, a color, or a feeling, and I will weave it into something new.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState<LoadingState>({ isLoading: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading.isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading({ isLoading: true });

    try {
      const context = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
      const fullPrompt = `${context}\nuser: ${userMsg.content}\nmodel:`;
      
      const responseText = await generateCreativeText(fullPrompt);

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "The connection to the creative ether is temporarily unclear. Please whisper your thought again.",
        timestamp: Date.now()
      }]);
    } finally {
      setLoading({ isLoading: false });
    }
  };

  return (
    <div className="flex flex-col h-full relative muse-text-container">
       {/* Floating Header for Muse */}
       <div className="island-header-container">
            <div className="island-header">
                <button onClick={() => navigate('home')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary">
                    <Icons.Back />
                </button>
                <span className="font-serif font-bold text-lg text-primary">Muse Mode</span>
            </div>
       </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-5 pt-24 pb-48 space-y-8 scroll-smooth no-scrollbar">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-slide-up`}
            style={{ animationDelay: `${index === messages.length - 1 ? '0s' : '0s'}` }}
          >
            {/* Role Label */}
            <span className={`text-[10px] uppercase tracking-widest mb-2 opacity-50 font-bold text-slate-400 ${msg.role === 'user' ? 'mr-4' : 'ml-4'}`}>
              {msg.role === 'user' ? 'You' : 'Lumina'}
            </span>

            {/* Message Bubble - Book Style */}
            <div
              className={`max-w-[85%] rounded-[2rem] p-6 relative transition-all duration-500 hover:shadow-xl ${
                msg.role === 'user'
                  ? 'bg-white/10 border border-white/20 backdrop-blur-md text-primary rounded-tr-sm shadow-lg'
                  : 'bg-transparent text-primary muse-bubble border-l-2 border-blue-400/30 pl-6'
              }`}
            >
              <div className="whitespace-pre-wrap leading-loose">{msg.content}</div>
            </div>
          </div>
        ))}
        
        {loading.isLoading && (
          <div className="flex flex-col items-start animate-fade-in pl-4">
             <span className="text-[10px] uppercase tracking-widest mb-2 opacity-40 font-semibold ml-2 text-slate-400">Thinking</span>
             <div className="flex items-center space-x-2 p-4 pl-0">
               <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
               <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
               <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area - Fixed relative to bottom */}
      <div className="fixed bottom-32 left-0 right-0 z-30 px-6 pointer-events-none">
        <div className="max-w-md mx-auto relative group pointer-events-auto">
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-700"></div>
          
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for a story, poem, or idea..."
              className="glass-input !rounded-full !py-4 !pl-6 !pr-16"
              disabled={loading.isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading.isLoading}
              className="absolute right-2 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/30"
            >
              <Icons.Send className="w-5 h-5 translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};