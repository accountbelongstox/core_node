
import React, { useState, useEffect } from 'react';
import { useI18n } from '../services/i18n';
import { FileSystemEntry, PackageInfo } from '../types';
import { wsService } from '../services/websocket';
import { useNotifications } from './Notification';
import { useConfirmDialog } from './ConfirmDialog';

interface FileManagerProps {
  targetDeviceSerial: string | null;
  targetDeviceId?: string | null; // Optional deviceId for API calls
  onClose: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ targetDeviceSerial, targetDeviceId, onClose }) => {
  const { t } = useI18n();
  const { showNotification } = useNotifications();
  const { showConfirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<'storage' | 'packages'>('storage');
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [files, setFiles] = useState<FileSystemEntry[]>([]);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Get deviceId - use provided targetDeviceId or try to find from serial
  const deviceId = targetDeviceId || null;

  // Load files when storage tab is active and path changes
  useEffect(() => {
    if (activeTab === 'storage' && deviceId) {
      loadFiles();
    }
  }, [activeTab, currentPath, deviceId]);

  // Load packages when packages tab is active
  useEffect(() => {
    if (activeTab === 'packages' && deviceId) {
      loadPackages();
    }
  }, [activeTab, deviceId]);

  const loadFiles = async () => {
    if (!deviceId) {
      setFiles([]);
      return;
    }

    try {
      setLoading(true);
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }
      const result = await wsService.callRpcV2('file.list', {
        deviceId,
        path: currentPath
      });

      if (result && result.files) {
        const fileEntries: FileSystemEntry[] = result.files.map((f: any) => ({
          name: f.name,
          path: f.isDirectory ? `${currentPath}${f.name}/` : `${currentPath}${f.name}`,
          type: f.isDirectory ? 'directory' : 'file',
          size: f.size || 0,
          modified: new Date().toLocaleString() // API doesn't provide modified time yet
        }));
        setFiles(fileEntries);
      }
    } catch (error) {
      console.error('[FileManager] Failed to load files:', error);
      showNotification('error', `Failed to load files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    if (!deviceId) {
      setPackages([]);
      return;
    }

    try {
      setLoading(true);
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }
      const result = await wsService.callRpcV2('file.packages', {
        deviceId
      });

      if (result && result.packages) {
        const packageEntries: PackageInfo[] = result.packages.map((pkgName: string) => ({
          packageName: pkgName,
          versionName: 'Unknown',
          versionCode: 0,
          isSystem: false, // API doesn't provide this info yet
          icon: 'ph-cube'
        }));
        setPackages(packageEntries);
      }
    } catch (error) {
      console.error('[FileManager] Failed to load packages:', error);
      showNotification('error', `Failed to load packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (file: FileSystemEntry) => {
    const newSet = new Set(selectedItems);
    const key = file.path;
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedItems(newSet);
  };

  const handleFileClick = (file: FileSystemEntry) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path);
      setSelectedItems(new Set());
    }
  };

  const handleDelete = async () => {
    if (selectedItems.size === 0 || !deviceId) return;

    const confirmed = await showConfirmDialog({
      title: 'Delete Files',
      message: `Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }

      const deletePromises = Array.from(selectedItems).map(itemPath => {
        return wsService.callRpcV2('file.delete', {
          deviceId,
          path: itemPath
        });
      });

      await Promise.all(deletePromises);
      showNotification('success', `Deleted ${selectedItems.size} item(s)`);
      setSelectedItems(new Set());
      await loadFiles();
    } catch (error) {
      showNotification('error', `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    if (selectedItems.size === 0 || !deviceId) return;

    const confirmed = await showConfirmDialog({
      title: 'Uninstall Packages',
      message: `Are you sure you want to uninstall ${selectedItems.size} package(s)? This action cannot be undone.`,
      confirmText: 'Uninstall',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }

      const uninstallPromises = Array.from(selectedItems).map(packageName => {
        return wsService.callRpcV2('file.apk_uninstall', {
          deviceId,
          packageName
        });
      });

      await Promise.all(uninstallPromises);
      showNotification('success', `Uninstalled ${selectedItems.size} package(s)`);
      setSelectedItems(new Set());
      await loadPackages();
    } catch (error) {
      showNotification('error', `Failed to uninstall: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async (file: FileSystemEntry) => {
    if (!deviceId || file.type === 'directory') return;

    try {
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }
      showNotification('info', 'Downloading file...', 2000);
      const result = await wsService.callRpcV2('file.pull', {
        deviceId,
        remotePath: file.path
      });

      if (result && result.success) {
        showNotification('success', `File downloaded: ${result.localPath || 'Success'}`);
      }
    } catch (error) {
      showNotification('error', `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
          <ActionButton 
            icon="ph-trash" 
            label={t('files.delete')} 
            danger 
            disabled={selectedItems.size === 0 || loading || !deviceId}
            onClick={activeTab === 'storage' ? handleDelete : handleUninstall}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {loading && (files.length === 0 && packages.length === 0) ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#bd00ff] animate-spin"></div>
              </div>
              <span className="text-xs text-slate-400">Loading...</span>
            </div>
          </div>
        ) : !deviceId ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <i className="ph ph-devices text-4xl"></i>
              <span className="font-mono text-sm">No device selected</span>
            </div>
          </div>
        ) : activeTab === 'storage' ? (
           <FileGrid 
             files={files} 
             selected={selectedItems} 
             onSelect={handleSelect}
             onFileClick={handleFileClick}
             onPull={handlePull}
             currentPath={currentPath}
             onPathChange={setCurrentPath}
           />
        ) : (
           <PackageList 
             packages={packages} 
             selected={selectedItems} 
             onSelect={(pkg) => {
               const newSet = new Set(selectedItems);
               if (newSet.has(pkg.packageName)) newSet.delete(pkg.packageName);
               else newSet.add(pkg.packageName);
               setSelectedItems(newSet);
             }} 
           />
        )}
      </div>

      {/* Footer Status */}
      <div className="h-8 border-t border-white/10 bg-[#0a0c10] flex items-center justify-between px-4 text-[10px] text-slate-500 font-mono">
        <span>{selectedItems.size} {t('files.items_selected')}</span>
        <span>{activeTab === 'storage' ? `${files.length} ${t('files.items')}` : `${packages.length} ${t('files.apps_installed')}`}</span>
      </div>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  );
};

const FileGrid: React.FC<{ 
  files: FileSystemEntry[], 
  selected: Set<string>, 
  onSelect: (file: FileSystemEntry) => void,
  onFileClick: (file: FileSystemEntry) => void,
  onPull: (file: FileSystemEntry) => void,
  currentPath: string,
  onPathChange: (path: string) => void
}> = ({ files, selected, onSelect, onFileClick, onPull, currentPath, onPathChange }) => {
  const { t } = useI18n();

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  
  return (
    <div>
      {/* Breadcrumb */}
      {currentPath !== '/sdcard/' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <button
            onClick={() => {
              if (currentPath === '/sdcard/') return;
              const parentPath = currentPath.split('/').slice(0, -2).join('/') + '/';
              onPathChange(parentPath || '/sdcard/');
            }}
            className="hover:text-white transition-colors"
          >
            <i className="ph ph-arrow-left"></i> Up
          </button>
          <span>/</span>
          <span className="text-white font-mono">{currentPath}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {files.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">
            <i className="ph ph-folder-open text-4xl mb-2 block"></i>
            <span className="text-sm">No files found</span>
          </div>
        ) : (
          files.map((file, i) => (
            <div 
              key={i} 
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  onSelect(file);
                } else {
                  onFileClick(file);
                }
              }}
              className={`
                group flex flex-col items-center p-4 rounded-xl border transition-all cursor-pointer relative
                ${selected.has(file.path)
                  ? 'bg-[#00f2ff]/10 border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2)]' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}
              `}
            >
              <div className="mb-3 text-4xl text-slate-400 group-hover:scale-110 transition-transform duration-300">
                 <i className={`ph-fill ${file.type === 'directory' ? 'ph-folder text-[#ffcc00]' : 'ph-file-text text-slate-500'}`}></i>
              </div>
              <span className="text-xs text-center text-slate-300 truncate w-full group-hover:text-white">
                {file.name}
              </span>
              <span className="text-[9px] text-slate-600 mt-1 font-mono">
                {file.type === 'file' ? formatSize(file.size || 0) : t('files.folder')}
              </span>
              
              {file.type === 'file' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPull(file);
                  }}
                  className="mt-2 px-2 py-1 text-[9px] bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/30 text-[#00f2ff] rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Download"
                >
                  <i className="ph ph-download"></i>
                </button>
              )}
              
              {selected.has(file.path) && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded bg-[#00f2ff] flex items-center justify-center">
                  <i className="ph-bold ph-check text-black text-[10px]"></i>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const PackageList: React.FC<{ packages: PackageInfo[], selected: Set<string>, onSelect: (pkg: PackageInfo) => void }> = ({ packages, selected, onSelect }) => {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {packages.length === 0 ? (
        <div className="col-span-full text-center py-8 text-slate-500">
          <i className="ph ph-package text-4xl mb-2 block"></i>
          <span className="text-sm">No packages found</span>
        </div>
      ) : (
        packages.map((pkg, i) => (
          <div 
            key={i} 
            onClick={() => onSelect(pkg)}
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
        ))
      )}
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

const ActionButton = ({ icon, label, primary, danger, disabled, onClick }: any) => (
  <button 
    disabled={disabled}
    onClick={onClick}
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
