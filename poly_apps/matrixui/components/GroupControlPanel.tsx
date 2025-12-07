
import React, { useState } from 'react';
import { BatchActionType } from '../types';
import { useI18n } from '../services/i18n';

interface GroupControlPanelProps {
  selectedCount: number;
  isSyncMode: boolean;
  toggleSyncMode: () => void;
  onAction: (action: BatchActionType, payload?: any) => void;
  onClose: () => void;
}

export const GroupControlPanel: React.FC<GroupControlPanelProps> = ({
  selectedCount,
  isSyncMode,
  toggleSyncMode,
  onAction,
  onClose
}) => {
  const { t } = useI18n();
  const [inputText, setInputText] = useState('');

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onAction('input_text', inputText);
      setInputText('');
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0c10]/95 backdrop-blur-xl border-t border-[#00f2ff]/20 z-40 transform transition-transform duration-300 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {/* Header / Status Bar */}
      <div className="h-10 bg-white/5 flex items-center justify-between px-6 border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{t('group_control.target_devices')}</span>
            <span className="px-2 py-0.5 bg-[#00f2ff]/20 text-[#00f2ff] rounded text-xs font-bold font-mono">{selectedCount}</span>
          </div>
          
          <div className="h-4 w-px bg-white/10"></div>
          
          <button 
            onClick={toggleSyncMode}
            className={`flex items-center gap-2 text-[10px] font-bold tracking-wider transition-all ${isSyncMode ? 'text-[#05ffa1]' : 'text-slate-400 hover:text-white'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isSyncMode ? 'bg-[#05ffa1] shadow-[0_0_10px_#05ffa1] animate-pulse' : 'bg-slate-600'}`}></div>
            {isSyncMode ? t('group_control.sync_active') : t('group_control.sync_off')}
          </button>
        </div>

        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <i className="ph ph-caret-down"></i>
        </button>
      </div>

      {/* Control Deck */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Navigation & Power (Col 1-3) */}
        <div className="md:col-span-3 flex flex-col gap-2">
          <div className="text-[9px] text-[#00f2ff] font-bold tracking-widest mb-1">{t('group_control.navigation')}</div>
          <div className="grid grid-cols-3 gap-2">
            <ControlBtn icon="ph-arrow-u-up-left" label={t('group_control.back')} onClick={() => onAction('back')} />
            <ControlBtn icon="ph-house" label={t('group_control.home')} onClick={() => onAction('home')} />
            <ControlBtn icon="ph-squares-four" label={t('group_control.recent')} onClick={() => onAction('recent')} />
            <ControlBtn icon="ph-power" label={t('group_control.power')} onClick={() => onAction('power')} color="text-[#ff2a6d]" />
            <ControlBtn icon="ph-lock-key-open" label={t('group_control.unlock')} onClick={() => onAction('home')} />
            <ControlBtn icon="ph-camera" label={t('group_control.snap')} onClick={() => onAction('screenshot')} />
          </div>
        </div>

        {/* Gestures (Col 4-5) */}
        <div className="md:col-span-2 flex flex-col gap-2">
          <div className="text-[9px] text-[#00f2ff] font-bold tracking-widest mb-1">{t('group_control.gestures')}</div>
          <div className="grid grid-cols-2 gap-2 h-full">
            <button 
              onClick={() => onAction('swipe_up')}
              className="bg-white/5 border border-white/10 rounded hover:bg-white/10 active:bg-[#00f2ff]/20 flex flex-col items-center justify-center gap-2 transition-all group"
            >
              <i className="ph ph-arrow-up text-xl group-hover:-translate-y-1 transition-transform"></i>
              <span className="text-[9px] font-mono">{t('group_control.swipe_up')}</span>
            </button>
            <button 
              onClick={() => onAction('swipe_down')}
              className="bg-white/5 border border-white/10 rounded hover:bg-white/10 active:bg-[#00f2ff]/20 flex flex-col items-center justify-center gap-2 transition-all group"
            >
              <i className="ph ph-arrow-down text-xl group-hover:translate-y-1 transition-transform"></i>
              <span className="text-[9px] font-mono">{t('group_control.swipe_down')}</span>
            </button>
          </div>
        </div>

        {/* Text Input (Col 6-9) */}
        <div className="md:col-span-4 flex flex-col gap-2">
          <div className="text-[9px] text-[#00f2ff] font-bold tracking-widest mb-1">{t('group_control.broadcast_input')}</div>
          <form onSubmit={handleSendText} className="flex gap-2 h-full">
            <div className="flex-1 bg-black/40 border border-white/10 rounded flex flex-col p-2 focus-within:border-[#00f2ff]/50 transition-colors">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('group_control.broadcast_placeholder')}
                className="bg-transparent border-none text-white text-xs resize-none focus:ring-0 w-full h-full placeholder-slate-600 outline-none font-mono"
              />
            </div>
            <button type="submit" className="w-12 bg-[#00f2ff]/10 border border-[#00f2ff]/30 text-[#00f2ff] rounded hover:bg-[#00f2ff]/20 flex items-center justify-center transition-all active:scale-95">
              <i className="ph-bold ph-paper-plane-right text-lg"></i>
            </button>
          </form>
        </div>

        {/* App Launch (Col 10-12) */}
        <div className="md:col-span-3 flex flex-col gap-2">
          <div className="text-[9px] text-[#00f2ff] font-bold tracking-widest mb-1">{t('group_control.quick_launch')}</div>
          <div className="grid grid-cols-3 gap-2">
             <AppBtn icon="ph-tiktok-logo" label={t('toolbar.apps.tiktok')} color="text-white bg-black" onClick={() => onAction('launch_tiktok')} />
             <AppBtn icon="ph-instagram-logo" label={t('toolbar.apps.insta')} color="text-white bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500" onClick={() => onAction('launch_insta')} />
             <AppBtn icon="ph-chat-circle-dots" label={t('toolbar.apps.wechat')} color="text-white bg-[#05ffa1]/80" onClick={() => onAction('launch_wechat')} />
             <AppBtn icon="ph-youtube-logo" label={t('toolbar.apps.youtube')} color="text-white bg-red-600" onClick={() => {}} />
             <AppBtn icon="ph-facebook-logo" label={t('toolbar.apps.facebook')} color="text-white bg-blue-600" onClick={() => {}} />
             <AppBtn icon="ph-whatsapp-logo" label={t('toolbar.apps.whatsapp')} color="text-white bg-green-500" onClick={() => {}} />
          </div>
        </div>

      </div>
    </div>
  );
};

const ControlBtn = ({ icon, label, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className={`h-9 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded hover:bg-white/10 active:scale-95 transition-all ${color || 'text-slate-300'}`}
    title={label}
  >
    <i className={`ph-bold ${icon}`}></i>
  </button>
);

const AppBtn = ({ icon, label, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className="h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all active:scale-95 group relative overflow-hidden"
  >
    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color} shadow-lg`}>
      <i className={`ph-fill ${icon} text-sm`}></i>
    </div>
  </button>
);
