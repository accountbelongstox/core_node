/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
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
    <div className="w-full md:w-64 ds-glass border-r border-[var(--border-highlight)] flex flex-col h-full shrink-0 transition-all">
      <div className="p-6 border-b border-[var(--border-highlight)]">
        <div className="flex items-center gap-3">
          {/* Brand chip — hero surface uses the Iris gradient */}
          <div
            className="p-2.5 rounded-[var(--radius-button)]"
            style={{ background: 'var(--klein-gradient)', color: 'var(--klein-on)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">Nexus</h1>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate">Powered by Gemini</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 ds-stack-tight flex flex-col">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentMode === item.mode;

          return (
            <button
              key={item.mode}
              onClick={() => onModeChange(item.mode)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-[var(--radius-button)] transition-all duration-200 group text-left border ds-touch-target ${
                isActive
                  ? 'text-[var(--klein-on)] border-transparent'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--klein-blue-soft)] hover:text-[var(--color-text-primary)] border-transparent'
              }`}
              style={isActive ? { background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' } : undefined}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? 'text-[var(--klein-on)]' : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)]'
                }`}
              />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{item.label}</div>
                <div className={`text-[10px] leading-tight truncate ${isActive ? 'opacity-80' : 'opacity-70'}`}>{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border-highlight)]">
        <div className="p-3 rounded-[var(--radius-button)] ds-card">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center">
            Gemini 2.5 Flash &amp; Pro Models
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
