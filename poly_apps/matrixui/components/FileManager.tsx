
import React, { useState } from 'react';
import { useI18n } from '../services/i18n';
import { FileSystemEntry, PackageInfo } from '../types';

// Mock Data
const MOCK_FILES: FileSystemEntry[] = [
  { name: 'DCIM', path: '/sdcard/DCIM', type: 'directory', modified: '2025-05-10 14:20' },
  { name: 'Download', path: '/sdcard/Download', type: 'directory', modified: '2025-05-11 09:15' },
  { name: 'Pictures', path: '/sdcard/Pictures', type: 'directory', modified: '2025-05-09 18:30' },
  { name: 'config_backup.json', path: '/sdcard/config_backup.json', type: 'file', size: 1024, modified: '2025-05-12 10:00' },
  { name: 'debug_log.txt', path: '/sdcard/debug_log.txt', type: 'file', size: 4096, modified: '2025-05-12 11:30' },
];

const MOCK_PACKAGES: PackageInfo[] = [
  { packageName: 'com.ss.android.ugc.aweme', versionName: '28.5.0', versionCode: 280500, isSystem: false, icon: 'ph-tiktok-logo' },
  { packageName: 'com.tencent.mm', versionName: '8.0.45', versionCode: 8004500, isSystem: false, icon: 'ph-chat-circle-dots' },
  { packageName: 'com.instagram.android', versionName: '315.0.0', versionCode: 315000, isSystem: false, icon: 'ph-instagram-logo' },
  { packageName: 'com.android.settings', versionName: '13', versionCode: 33, isSystem: true, icon: 'ph-gear' },
  { packageName: 'com.google.android.youtube', versionName: '19.05.34', versionCode: 190534, isSystem: false, icon: 'ph-youtube-logo' },
];

interface FileManagerProps {
  targetDeviceSerial: string | null;
  onClose: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ targetDeviceSerial, onClose }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'storage' | 'packages'>('storage');
  const [currentPath, setCurrentPath] = useState('/sdcard');
  
  // Selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050608] relative overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0c10]">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded bg-[#bd00ff]/20 text-[#bd00ff] border border-[#bd00ff]/50`}>
            <i className="ph-fill ph-folder-open text-xl"></i>
          </div>
          <div>
            <h2 className="text-white font-bold tracking-wider">{t('files.title')}</h2>
            <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
              <span className="text-[#00f2ff]">{targetDeviceSerial || t('files.all_devices')}</span>
              <span>//</span>
              <span>{activeTab === 'storage' ? currentPath : t('files.installed_packages')}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={onClose} className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white transition-colors">
              <i className="ph-bold ph-x"></i>
           </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-white/[0.02]">
        <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
          <TabButton active={activeTab === 'storage'} label={t('files.storage')} icon="ph-hard-drives" onClick={() => setActiveTab('storage')} />
          <TabButton active={activeTab === 'packages'} label={t('files.packages')} icon="ph-package" onClick={() => setActiveTab('packages')} />
        </div>

        <div className="flex gap-2">
          {activeTab === 'storage' ? (
             <ActionButton icon="ph-upload-simple" label={t('files.upload')} primary />
          ) : (
             <ActionButton icon="ph-download" label={t('files.install_apk')} primary />
          )}
          <ActionButton icon="ph-trash" label={t('files.delete')} danger disabled={selectedItems.size === 0} />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {activeTab === 'storage' ? (
           <FileGrid files={MOCK_FILES} selected={selectedItems} onSelect={handleSelect} />
        ) : (
           <PackageList packages={MOCK_PACKAGES} selected={selectedItems} onSelect={handleSelect} />
        )}
      </div>

      {/* Footer Status */}
      <div className="h-8 border-t border-white/10 bg-[#0a0c10] flex items-center justify-between px-4 text-[10px] text-slate-500 font-mono">
        <span>{selectedItems.size} {t('files.items_selected')}</span>
        <span>{activeTab === 'storage' ? `24.5 ${t('files.gb_free')}` : `${MOCK_PACKAGES.length} ${t('files.apps_installed')}`}</span>
      </div>
    </div>
  );
};

const FileGrid: React.FC<{ files: FileSystemEntry[], selected: Set<string>, onSelect: (id: string) => void }> = ({ files, selected, onSelect }) => {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
      {files.map((file, i) => (
        <div 
          key={i} 
          onClick={() => onSelect(file.name)}
          className={`
            group flex flex-col items-center p-4 rounded-xl border transition-all cursor-pointer relative
            ${selected.has(file.name) 
              ? 'bg-[#00f2ff]/10 border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}
          `}
        >
          <div className="mb-3 text-4xl text-slate-400 group-hover:scale-110 transition-transform duration-300">
             <i className={`ph-fill ${file.type === 'directory' ? 'ph-folder text-[#ffcc00]' : 'ph-file-text text-slate-500'}`}></i>
          </div>
          <span className="text-xs text-center text-slate-300 truncate w-full group-hover:text-white">{file.name}</span>
          <span className="text-[9px] text-slate-600 mt-1 font-mono">{file.type === 'file' ? `2.4 ${t('files.file_size_mb')}` : t('files.folder')}</span>
          
          {selected.has(file.name) && (
            <div className="absolute top-2 right-2 w-4 h-4 rounded bg-[#00f2ff] flex items-center justify-center">
              <i className="ph-bold ph-check text-black text-[10px]"></i>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const PackageList: React.FC<{ packages: PackageInfo[], selected: Set<string>, onSelect: (id: string) => void }> = ({ packages, selected, onSelect }) => {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {packages.map((pkg, i) => (
        <div 
          key={i} 
          onClick={() => onSelect(pkg.packageName)}
          className={`
            group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative
            ${selected.has(pkg.packageName) 
              ? 'bg-[#bd00ff]/10 border-[#bd00ff] shadow-[0_0_15px_rgba(189,0,255,0.2)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}
          `}
        >
           <div className={`w-12 h-12 rounded-lg bg-black/50 flex items-center justify-center text-2xl ${pkg.isSystem ? 'text-slate-500' : 'text-white'}`}>
              <i className={`ph-fill ${pkg.icon || 'ph-cube'}`}></i>
           </div>
           <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-200 truncate">{pkg.packageName}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">v{pkg.versionName} ({pkg.versionCode})</div>
              {pkg.isSystem && <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-white/10 text-[8px] text-slate-400 uppercase">{t('files.system')}</span>}
           </div>

           {selected.has(pkg.packageName) && (
            <div className="absolute top-2 right-2 w-4 h-4 rounded bg-[#bd00ff] flex items-center justify-center">
              <i className="ph-bold ph-check text-white text-[10px]"></i>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const TabButton = ({ active, label, icon, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
      ${active ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}
    `}
  >
    <i className={`ph-bold ${icon}`}></i>
    {label}
  </button>
);

const ActionButton = ({ icon, label, primary, danger, disabled }: any) => (
  <button 
    disabled={disabled}
    className={`
      flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed
      ${primary 
        ? 'bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80 shadow-[0_0_10px_rgba(0,242,255,0.3)]' 
        : danger 
          ? 'bg-[#ff2a6d]/10 text-[#ff2a6d] border border-[#ff2a6d]/30 hover:bg-[#ff2a6d]/20'
          : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'}
    `}
  >
    <i className={`ph-bold ${icon}`}></i>
    {label}
  </button>
);
