import React from 'react';
import { MessageSquare, Image as ImageIcon, Eye, LayoutGrid } from 'lucide-react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, onModeChange }) => {
  const navItems = [
    { mode: AppMode.CHAT, label: 'Chat', icon: MessageSquare, description: 'Interactive AI Conversation' },
    { mode: AppMode.IMAGE, label: 'Imagine', icon: ImageIcon, description: 'Generate Images from Text' },
    { mode: AppMode.VISION, label: 'Vision', icon: Eye, description: 'Analyze & Understand Images' },
  ];

  return (
    <div className="w-full md:w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full shrink-0 transition-all">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nexus</h1>
            <p className="text-xs text-slate-400">Powered by Gemini</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentMode === item.mode;
          
          return (
            <button
              key={item.mode}
              onClick={() => onModeChange(item.mode)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group text-left
                ${isActive 
                  ? 'bg-indigo-600/10 border border-indigo-500/50 text-indigo-400' 
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 border border-transparent'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <div>
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-[10px] opacity-70 leading-tight">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="p-3 bg-slate-900 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            Gemini 2.5 Flash & Pro Models
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;