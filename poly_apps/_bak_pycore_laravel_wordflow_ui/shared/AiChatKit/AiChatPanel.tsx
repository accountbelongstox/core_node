/**
 * Global AiChatKit slide-over, mounted once in ShellLayout. Opens from the shell
 * top bar (or any end via useShell().openChat), lets the user pick which end's
 * AI to talk to, and renders the shared AiChatKit with that end's adapter.
 */
import React from 'react';
import { X, Bot } from 'lucide-react';
import { useShell } from '../../shell/ShellContext';
import { CHAT_ADAPTERS, getChatAdapter } from './adapters';
import { AiChatKit } from './AiChatKit';

export const AiChatPanel: React.FC = () => {
  const { chatOpen, closeChat, activeChatAdapterId, openChat } = useShell();
  const adapter = getChatAdapter(activeChatAdapterId);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-[70] transition-opacity ${chatOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeChat}
      />
      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md z-[71] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col transition-transform duration-300 ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!chatOpen}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Bot className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">AI Chat</span>
          <select
            value={activeChatAdapterId}
            onChange={(e) => openChat(e.target.value)}
            className="ml-2 text-xs bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-200"
          >
            {CHAT_ADAPTERS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <button onClick={closeChat} className="ml-auto p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          {/* Re-mount per adapter so history/providers reset cleanly */}
          {chatOpen && <AiChatKit key={adapter.id} adapter={adapter} />}
        </div>
      </aside>
    </>
  );
};

export default AiChatPanel;
