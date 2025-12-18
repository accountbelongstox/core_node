import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import { ChatMessage, ProcessingState } from '../types';
import { generateChatResponse } from '../services/geminiService';

const ChatMode: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, error: null });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || processing.isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setProcessing({ isProcessing: true, error: null });

    try {
      // Prepare history for API
      // We map our ChatMessage format to what our service expects
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await generateChatResponse(userMsg.text, history);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setProcessing(prev => ({ ...prev, error: err.message }));
    } finally {
      setProcessing(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    setMessages([]);
    setShowClearConfirm(false);
  };

  const cancelClear = () => {
    setShowClearConfirm(false);
  };

  return (
    <>
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-white">Gemini Chat</h2>
          <p className="text-sm text-slate-400">Model: gemini-2.5-flash</p>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
          title="Clear Chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
            <Bot className="w-16 h-16 mb-4" />
            <p className="text-lg">Start a conversation with Gemini</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
              ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}
            `}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>
            
            <div className={`
              max-w-[80%] rounded-2xl p-4 leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user' 
                ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-50 rounded-tr-none' 
                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'}
            `}>
              {msg.text}
            </div>
          </div>
        ))}

        {processing.isProcessing && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
               <Bot className="w-5 h-5 text-white" />
             </div>
             <div className="flex items-center gap-2 text-slate-400 bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700">
               <Loader2 className="w-4 h-4 animate-spin" />
               <span className="text-sm">Thinking...</span>
             </div>
          </div>
        )}
        
        {processing.error && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-lg text-sm text-center">
            Error: {processing.error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full bg-slate-800 text-white border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-4 pr-12 resize-none h-14 md:h-16"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || processing.isProcessing}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">
          Gemini may display inaccurate info, including about people, so double-check its responses.
        </p>
      </div>
    </div>

    {/* Confirmation Dialog */}
    {showClearConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl">
          <h3 className="text-lg font-semibold text-white mb-2">Clear Conversation?</h3>
          <p className="text-slate-400 text-sm mb-6">
            Are you sure you want to clear the conversation? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={cancelClear}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmClear}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default ChatMode;