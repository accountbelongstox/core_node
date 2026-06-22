

import React, { useState } from 'react';
import { ScriptDef, AppPlatform } from '../types';
import { useI18n } from '../services/i18n';
import { ScriptFlowVisualizer } from './ScriptFlowVisualizer';

// --- Mock Data for Scripts ---
const MOCK_SCRIPTS: ScriptDef[] = [
  {
    id: 'tk-001',
    name: 'Douyin/TikTok Warm-up',
    description: 'Simulates normal user behavior to increase account weight. Randomly scrolls, likes videos, and stays on "For You" page.',
    platform: 'tiktok',
    tags: ['Maintenance', 'Daily', 'Douyin'],
    estimatedTime: '5-10m',
    steps: [
      { id: '1', type: 'open_app', label: 'Launch Douyin', description: 'Open app and wait for splash screen' },
      { id: '2', type: 'delay', label: 'Random Wait', duration: 3, description: 'Simulate hesitation' },
      { id: '3', type: 'swipe', label: 'Scroll Feed', description: 'Swipe up to next video' },
      { id: '4', type: 'check', label: 'Interest Check', description: 'Analyze video content tags' },
      { id: '5', type: 'click', label: 'Double Tap', description: 'Like the video (30% chance)' },
      { id: '6', type: 'loop', label: 'Repeat 5x', description: 'Continue browsing session' }
    ]
  },
  {
    id: 'momo-001',
    name: 'Momo Nearby Greeting',
    description: 'Scans nearby users and sends predefined greeting messages to new active profiles.',
    platform: 'momo',
    tags: ['Social', 'Growth', 'Momo'],
    estimatedTime: '12m',
    steps: [
      { id: '1', type: 'open_app', label: 'Launch Momo', description: 'Ensure location services active' },
      { id: '2', type: 'click', label: 'Nearby Tab', description: 'Switch to nearby view' },
      { id: '3', type: 'swipe', label: 'Refresh List', description: 'Pull down to refresh' },
      { id: '4', type: 'check', label: 'Find New Users', description: 'Identify active badges' },
      { id: '5', type: 'click', label: 'Profile View', description: 'Enter user profile' },
      { id: '6', type: 'input', label: 'Send Hello', description: 'Type greeting script' }
    ]
  },
  {
    id: 'ins-002',
    name: 'Insta Story View',
    description: 'Automatically views stories of followed accounts to maintain engagement presence.',
    platform: 'instagram',
    tags: ['Engagement', 'Passive'],
    estimatedTime: '3m',
    steps: [
      { id: '1', type: 'open_app', label: 'Open Instagram', description: 'Ensure logged in' },
      { id: '2', type: 'click', label: 'Tap Stories', description: 'Click first available story' },
      { id: '3', type: 'delay', label: 'Watch', duration: 5, description: 'View full duration' },
      { id: '4', type: 'click', label: 'Next Story', description: 'Tap right side of screen' }
    ]
  },
  {
    id: 'wc-003',
    name: 'WeChat Moments',
    description: 'Scrolls moments timeline and randomly likes posts from friends.',
    platform: 'wechat',
    tags: ['Social', 'Interaction'],
    estimatedTime: '8m',
    steps: [
      { id: '1', type: 'open_app', label: 'Open WeChat', description: 'Cold start' },
      { id: '2', type: 'click', label: 'Discover', description: 'Go to Discover tab' },
      { id: '3', type: 'click', label: 'Moments', description: 'Enter timeline' },
      { id: '4', type: 'swipe', label: 'Scroll Down', description: 'Load more posts' },
      { id: '5', type: 'click', label: 'Like Post', description: 'Tap like on visible post' }
    ]
  },
  {
    id: 'fb-004',
    name: 'FB Group Joiner',
    description: 'Searches for target keywords and joins relevant open groups.',
    platform: 'facebook',
    tags: ['Growth', 'Search'],
    estimatedTime: '15m',
    steps: [
        { id: '1', type: 'open_app', label: 'Launch Facebook', description: '' },
        { id: '2', type: 'input', label: 'Search Query', description: 'Input keywords' },
        { id: '3', type: 'click', label: 'Filter Groups', description: 'Select Groups tab' }
    ]
  }
];

interface ScriptLibraryProps {
  selectedCount: number;
  onExecute: (scriptId: string) => void;
}

export const ScriptLibrary: React.FC<ScriptLibraryProps> = ({ selectedCount, onExecute }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<AppPlatform | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedScript, setSelectedScript] = useState<ScriptDef | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const filtered = MOCK_SCRIPTS.filter(s => {
    const matchesTab = activeTab === 'all' || s.platform === activeTab;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getPlatformIcon = (p: AppPlatform) => {
    switch (p) {
      case 'tiktok': return 'ph-tiktok-logo';
      case 'instagram': return 'ph-instagram-logo';
      case 'wechat': return 'ph-chat-circle-dots';
      case 'facebook': return 'ph-facebook-logo';
      case 'youtube': return 'ph-youtube-logo';
      case 'whatsapp': return 'ph-whatsapp-logo';
      case 'momo': return 'ph-paw-print';
      default: return 'ph-robot';
    }
  };

  const getPlatformColor = (p: AppPlatform) => {
    switch (p) {
      case 'tiktok': return 'text-white bg-black border-white/20';
      case 'instagram': return 'text-white bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500 border-white/20';
      case 'wechat': return 'text-white bg-[#05ffa1]/80 border-transparent';
      case 'facebook': return 'text-white bg-[#1877f2] border-transparent';
      case 'momo': return 'text-white bg-blue-500 border-transparent';
      default: return 'text-slate-400 bg-white/5 border-white/10';
    }
  };

  const handleRun = () => {
    if (!selectedScript) return;
    setIsRunning(true);
    setTimeout(() => {
        onExecute(selectedScript.id);
        setIsRunning(false);
    }, 2000);
  };

  return (
    <div className="flex h-full flex-col md:flex-row overflow-hidden relative">
      
      {/* Left: Library List */}
      <div className={`flex-1 flex flex-col min-w-[280px] border-r border-white/10 transition-all ${selectedScript ? 'hidden md:flex md:w-1/2' : 'w-full'}`}>
        
        {/* Search & Filter */}
        <div className="p-4 border-b border-white/10 space-y-4">
           <div className="relative">
             <i className="ph ph-magnifying-glass absolute left-3 top-2.5 text-slate-500"></i>
             <input 
               type="text" 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder={t('settings.global_search')}
               className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
             />
           </div>
           
           <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
             {['all', 'tiktok', 'momo', 'instagram', 'wechat', 'facebook'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`
                    px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap border transition-all
                    ${activeTab === tab 
                      ? 'bg-[#00f2ff]/20 border-[#00f2ff] text-[#00f2ff]' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'}
                  `}
                >
                  {tab === 'all' ? t('scripts.filter_all') : tab === 'tiktok' ? 'Douyin/TikTok' : tab}
                </button>
             ))}
           </div>
        </div>

        {/* Script List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
           {filtered.map(script => (
             <div 
               key={script.id}
               onClick={() => setSelectedScript(script)}
               className={`
                 group p-3 rounded-xl border cursor-pointer transition-all hover:translate-x-1 relative overflow-hidden
                 ${selectedScript?.id === script.id 
                    ? 'bg-[#00f2ff]/10 border-[#00f2ff] shadow-[0_0_20px_rgba(0,242,255,0.1)]' 
                    : 'bg-[#0a0c10] border-white/10 hover:border-white/30'}
               `}
             >
                <div className="flex items-start gap-3 relative z-10">
                   {/* Icon */}
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${getPlatformColor(script.platform)}`}>
                      <i className={`ph-fill ${getPlatformIcon(script.platform)} text-xl`}></i>
                   </div>
                   
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                         <h3 className="text-sm font-bold text-slate-200 group-hover:text-[#00f2ff] transition-colors truncate">{script.name}</h3>
                         <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{script.estimatedTime}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{script.description}</p>
                      
                      <div className="flex gap-2 mt-2">
                        {script.tags.map(tag => (
                          <span key={tag} className="text-[9px] text-slate-400 border border-white/10 px-1.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                   </div>
                </div>

                {/* Selection Glow */}
                {selectedScript?.id === script.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00f2ff]/5 to-transparent pointer-events-none"></div>
                )}
             </div>
           ))}
        </div>
      </div>

      {/* Right: Details & Flowchart */}
      <div className={`flex-1 flex-col bg-[#050608] relative ${selectedScript ? 'flex' : 'hidden md:flex'}`}>
         {selectedScript ? (
            <>
               {/* Detail Header */}
               <div className="p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent relative overflow-hidden">
                  <div className="relative z-10">
                     <button 
                       onClick={() => setSelectedScript(null)} 
                       className="md:hidden absolute -top-2 -left-2 p-2 text-slate-400"
                     >
                       <i className="ph-bold ph-arrow-left"></i>
                     </button>
                     <div className="flex items-center gap-3 mb-2">
                        <i className={`ph-fill ${getPlatformIcon(selectedScript.platform)} text-2xl text-[#00f2ff]`}></i>
                        <h2 className="text-xl font-bold tracking-wide">{selectedScript.name}</h2>
                     </div>
                     <p className="text-xs text-slate-400 leading-relaxed max-w-md">{selectedScript.description}</p>
                     
                     <div className="flex gap-6 mt-4">
                        <div className="flex flex-col">
                           <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t('scripts.est_time')}</span>
                           <span className="text-sm font-mono text-white">{selectedScript.estimatedTime}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t('scripts.steps')}</span>
                           <span className="text-sm font-mono text-white">{selectedScript.steps.length} {t('scripts.actions')}</span>
                        </div>
                     </div>
                  </div>
                  
                  {/* Decorative Background Icon */}
                  <i className={`ph-fill ${getPlatformIcon(selectedScript.platform)} absolute -right-6 -bottom-6 text-9xl text-white/[0.02]`}></i>
               </div>

               {/* Flow Visualization Area */}
               <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00f2ff]/5 to-transparent">
                  <div className="sticky top-0 z-20 px-4 py-2 bg-[#050608]/90 backdrop-blur border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="ph-bold ph-tree-structure"></i> {t('scripts.flow')}
                  </div>
                  <ScriptFlowVisualizer script={selectedScript} />
               </div>

               {/* Action Footer */}
               <div className="p-4 border-t border-white/10 bg-[#0a0c10] z-30">
                  <div className="flex items-center justify-between mb-3 text-xs">
                     <span className="text-slate-400">{t('scripts.selected_target')}:</span>
                     <span className={`font-mono font-bold ${selectedCount > 0 ? 'text-[#05ffa1]' : 'text-[#ff2a6d]'}`}>
                       {selectedCount} {t('scripts.devices')}
                     </span>
                  </div>
                  <button 
                    onClick={handleRun}
                    disabled={selectedCount === 0 || isRunning}
                    className={`
                      w-full py-3 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2
                      ${selectedCount > 0 
                        ? 'bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-black shadow-[0_0_20px_rgba(0,242,255,0.4)] hover:shadow-[0_0_30px_rgba(0,242,255,0.6)]' 
                        : 'bg-white/10 text-slate-500 cursor-not-allowed'}
                    `}
                  >
                    {isRunning ? (
                      <>
                        <i className="ph-bold ph-spinner animate-spin"></i> {t('scripts.running')}
                      </>
                    ) : (
                      <>
                        <i className="ph-bold ph-play"></i> {t('scripts.execute')}
                      </>
                    )}
                  </button>
               </div>
            </>
         ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50">
               <i className="ph ph-flow-arrow text-4xl mb-4"></i>
               <p className="text-xs font-mono uppercase tracking-widest">{t('scripts.select_script')}</p>
            </div>
         )}
      </div>

    </div>
  );
};
