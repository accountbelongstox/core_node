// TopBar Component - Top menu bar
import React from 'react';
import { useTranslation } from '../services/i18n';
import { useAppStore } from '../store';
import { wsClient } from '../services/websocket/client';

interface TopBarProps {
  onScriptsClick: () => void;
  onSettingsClick: () => void;
  onManagementClick: () => void;
  onStatsClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onScriptsClick,
  onSettingsClick,
  onManagementClick,
  onStatsClick,
}) => {
  const { t } = useTranslation();
  const { state, connectWebSocket, disconnectWebSocket } = useAppStore();

  const handleReconnect = () => {
    disconnectWebSocket();
    setTimeout(() => {
      connectWebSocket();
    }, 500);
  };

  return (
    <header className="h-[60px] glass-panel border-b border-white/10 flex items-center justify-between px-6 shrink-0 relative z-30">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div
          className="w-8 h-8 bg-gradient-to-br from-[#00f2ff] to-[#bd00ff] flex items-center justify-center relative shadow-[0_0_15px_rgba(0,242,255,0.3)]"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
        >
          <div
            className="absolute inset-[2px] bg-black"
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          ></div>
          <div className="w-2 h-2 bg-[#00f2ff] rounded-full z-10 animate-pulse"></div>
        </div>
        <div>
          <div className="text-white font-bold tracking-[2px] text-sm">·星灿传媒科技·</div>
          <div className="text-[9px] text-[#00f2ff] tracking-widest opacity-80">云矩阵 V3.0</div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              state.wsStatus === 'connected'
                ? 'bg-[#05ffa1]'
                : state.wsStatus === 'connecting'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          ></div>
          <span className="text-xs text-slate-400">
            {state.wsStatus === 'connected'
              ? t('websocket.connected')
              : state.wsStatus === 'connecting'
              ? t('websocket.connecting')
              : t('websocket.disconnected')}
          </span>
          {state.wsStatus !== 'connected' && (
            <button
              onClick={handleReconnect}
              className="text-xs text-[#00f2ff] hover:text-[#00f2ff]/80"
            >
              {t('websocket.reconnecting')}
            </button>
          )}
        </div>

        {/* Top Menu Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onScriptsClick}
            className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#bd00ff]/20 hover:border-[#bd00ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
          >
            <i className="ph ph-scroll"></i> {t('menu.topbar.scripts')}
          </button>
          <button
            onClick={onSettingsClick}
            className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
          >
            <i className="ph ph-gear"></i> {t('menu.topbar.settings')}
          </button>
          <button
            onClick={onManagementClick}
            className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#a855f7]/20 hover:border-[#a855f7]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
          >
            <i className="ph ph-sliders"></i> {t('menu.topbar.management')}
          </button>
          <button
            onClick={onStatsClick}
            className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#05ffa1]/20 hover:border-[#05ffa1]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
          >
            <i className="ph ph-chart-bar"></i> {t('menu.topbar.stats')}
          </button>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-white">Admin</div>
            <div className="text-[9px] text-slate-500">Level 9 Access</div>
          </div>
          <div className="w-8 h-8 bg-[#bd00ff] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_#bd00ff]">
            A
          </div>
        </div>
      </div>
    </header>
  );
};

