

import React, { useState, useEffect, useRef } from 'react';
import { BatchActionType, DeviceLog } from '../types';
import { useI18n } from '../services/i18n';

interface BottomToolbarProps {
  selectedCount: number;
  isSyncMode: boolean;
  toggleSyncMode: () => void;
  onAction: (action: BatchActionType, payload?: any) => void;
  logs?: DeviceLog[]; // Added logs prop
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  selectedCount,
  isSyncMode,
  toggleSyncMode,
  onAction,
  logs = []
}) => {
  const { t } = useI18n();
  const [inputText, setInputText] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onAction('input_text', inputText);
      setInputText('');
    }
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[98%] max-w-[1400px] z-50 flex gap-4 items-end">
      
      {/* Main Toolbar */}
      <div className="flex-1 glass-panel border border-[#00f2ff]/30 rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden flex flex-col md:flex-row items-stretch md:items-center p-2 gap-4 transition-all duration-300">
        
        {/* Section 1: Sync & Status */}
        <div className="flex items-center gap-4 px-4 border-b md:border-b-0 md:border-r border-white/10 pb-2 md:pb-0 md:pr-4 shrink-0 justify-between md:justify-start">
           <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{t('toolbar.selected')}</span>
              <span className="text-lg font-mono text-white leading-none">{selectedCount}</span>
           </div>
           
           <button 
            onClick={toggleSyncMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isSyncMode ? 'bg-[#05ffa1]/20 border-[#05ffa1] text-[#05ffa1]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isSyncMode ? 'bg-[#05ffa1] shadow-[0_0_10px_#05ffa1] animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="text-[10px] font-bold tracking-wider">{isSyncMode ? t('toolbar.sync_on') : t('toolbar.sync_off')}</span>
          </button>
        </div>

        {/* Section 2: Quick Launch (Social) */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 px-2 shrink-0">
           <AppIcon icon="ph-tiktok-logo" label={t('toolbar.apps.tiktok')} color="text-white bg-black border-white/20" onClick={() => onAction('launch_tiktok')} />
           <AppIcon icon="ph-instagram-logo" label={t('toolbar.apps.insta')} color="text-white bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500 border-white/10" onClick={() => onAction('launch_insta')} />
           <AppIcon icon="ph-paw-print" label={t('toolbar.apps.momo')} color="text-white bg-blue-500 border-transparent" onClick={() => onAction('launch_momo')} />
           <AppIcon icon="ph-chat-circle-dots" label={t('toolbar.apps.wechat')} color="text-white bg-[#05ffa1]/80 border-transparent" onClick={() => onAction('launch_wechat')} />
           <AppIcon icon="ph-youtube-logo" label={t('toolbar.apps.youtube')} color="text-white bg-[#ff0000] border-transparent" onClick={() => onAction('launch_youtube')} />
           <AppIcon icon="ph-facebook-logo" label={t('toolbar.apps.facebook')} color="text-white bg-[#1877f2] border-transparent" onClick={() => onAction('launch_facebook')} />
           <AppIcon icon="ph-whatsapp-logo" label={t('toolbar.apps.whatsapp')} color="text-white bg-[#25d366] border-transparent" onClick={() => onAction('launch_whatsapp')} />
        </div>

        <div className="w-px h-8 bg-white/10 hidden md:block"></div>

        {/* Section 3: Navigation & Tools */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 shrink-0">
           <ToolBtn icon="ph-house" label={t('toolbar.tools.home')} onClick={() => onAction('home')} />
           <ToolBtn icon="ph-arrow-u-up-left" label={t('toolbar.tools.back')} onClick={() => onAction('back')} />
           <ToolBtn icon="ph-squares-four" label={t('toolbar.tools.recent')} onClick={() => onAction('recent')} />
           
           <div className="w-px h-6 bg-white/10 mx-1"></div>
           
           <ToolBtn icon="ph-camera" label={t('toolbar.tools.snap')} onClick={() => onAction('screenshot')} />
           <ToolBtn icon="ph-video" label={t('toolbar.tools.rec')} color="text-[#ff2a6d]" onClick={() => onAction('recording')} />
           
           <div className="w-px h-6 bg-white/10 mx-1"></div>
           
           <ToolBtn icon="ph-sun" label={t('toolbar.tools.bright')} onClick={() => onAction('set_brightness')} />
           <ToolBtn icon="ph-arrows-clockwise" label={t('toolbar.tools.rotate')} onClick={() => onAction('set_rotation')} />
           <ToolBtn icon="ph-clipboard-text" label={t('toolbar.tools.paste')} onClick={() => onAction('set_clipboard')} />
        </div>

        <div className="w-px h-8 bg-white/10 hidden md:block"></div>

        {/* Section 4: Input */}
        <form onSubmit={handleSendText} className="flex-1 min-w-[150px] flex gap-2 relative group">
           <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
             <i className="ph-bold ph-keyboard"></i>
           </div>
           <input 
             type="text" 
             value={inputText}
             onChange={(e) => setInputText(e.target.value)}
             placeholder={t('toolbar.broadcast_placeholder')} 
             className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-10 py-2 text-xs text-white focus:border-[#00f2ff] focus:ring-1 focus:ring-[#00f2ff] outline-none transition-all font-mono"
           />
           <button 
             type="submit" 
             className="absolute right-1 top-1 bottom-1 w-8 bg-[#00f2ff]/10 text-[#00f2ff] rounded hover:bg-[#00f2ff]/20 flex items-center justify-center transition-all disabled:opacity-50"
             disabled={!inputText.trim()}
           >
             <i className="ph-bold ph-paper-plane-right"></i>
           </button>
        </form>

        {/* Power */}
        <div className="pl-2 border-l border-white/10 hidden md:block">
           <button 
             onClick={() => onAction('power')}
             className="w-10 h-10 rounded-lg bg-[#ff2a6d]/10 border border-[#ff2a6d]/30 text-[#ff2a6d] flex items-center justify-center hover:bg-[#ff2a6d]/20 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,42,109,0.1)]"
             title={t('toolbar.power_toggle')}
           >
             <i className="ph-bold ph-power"></i>
           </button>
        </div>
      </div>

      {/* Log Ticker Panel */}
      <div className="hidden xl:flex w-[300px] h-[72px] glass-panel border border-white/10 rounded-2xl flex-col overflow-hidden bg-black/50">
        <div className="h-6 bg-white/5 border-b border-white/5 flex items-center justify-between px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
           <span className="flex items-center gap-1"><i className="ph-fill ph-terminal-window text-[#00f2ff]"></i> {t('toolbar.sys_log')}</span>
           <div className="w-1.5 h-1.5 rounded-full bg-[#05ffa1] animate-pulse"></div>
        </div>
        <div ref={logContainerRef} className="flex-1 overflow-y-auto p-2 font-mono text-[9px] text-slate-400 space-y-1 custom-scrollbar">
           {logs.slice(-20).map((log, i) => (
             <div key={i} className="truncate">
               <span className="text-slate-600 mr-2">{log.time}</span>
               <span className={log.type === 'error' ? 'text-[#ff2a6d]' : log.type === 'success' ? 'text-[#05ffa1]' : 'text-slate-300'}>
                 {log.msg}
               </span>
             </div>
           ))}
        </div>
      </div>

    </div>
  );
};

const AppIcon = ({ icon, label, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg transition-all hover:scale-105 active:scale-95 group relative ${color}`}
    title={label}
  >
    <i className={`ph-fill ${icon} text-xl`}></i>
  </button>
);

const ToolBtn = ({ icon, label, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 active:bg-white/20 transition-all gap-0.5 ${color || 'text-slate-300 hover:text-white'}`}
    title={label}
  >
    <i className={`ph-bold ${icon} text-lg`}></i>
    <span className="text-[8px] font-bold uppercase opacity-60 tracking-wider">{label}</span>
  </button>
);