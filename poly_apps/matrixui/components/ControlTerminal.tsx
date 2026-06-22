import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Terminal } from 'lucide-react';
import { useI18n } from '../services/i18n';

interface ControlTerminalProps {
  onCommand: (cmd: string) => Promise<void>;
  isProcessing: boolean;
  lastAnalysis?: string;
}

export const ControlTerminal: React.FC<ControlTerminalProps> = ({ onCommand, isProcessing, lastAnalysis }) => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onCommand(input);
      setInput('');
    }
  };

  useEffect(() => {
    if (!isProcessing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isProcessing]);

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-nexus-900/90 backdrop-blur-md border-t border-nexus-700 z-50">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        
        {/* AI Feedback Area */}
        {lastAnalysis && (
          <div className="flex items-start gap-2 text-sm text-nexus-accent font-mono bg-nexus-800/50 p-2 rounded border-l-2 border-nexus-accent animate-in fade-in slide-in-from-bottom-2">
             <Sparkles size={16} className="mt-0.5 shrink-0" />
             <span>{t('terminal.ai_core')}: {lastAnalysis}</span>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="relative flex items-center group">
          <div className="absolute left-4 text-slate-500">
            <Terminal size={20} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder={t('terminal.placeholder')}
            className="w-full bg-nexus-800 text-slate-200 pl-12 pr-12 py-4 rounded-lg border border-nexus-700 focus:outline-none focus:border-nexus-accent focus:ring-1 focus:ring-nexus-accent transition-all font-mono shadow-lg disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-3 p-2 text-nexus-accent hover:bg-nexus-700/50 rounded-md transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};
