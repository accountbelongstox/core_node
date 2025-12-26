import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import BentoCard from '../BentoCard';
<<<<<<< HEAD
import { MOCK_FILE_TREE } from '../../constants';
import { FileNode } from '../../types';
import { smartSortFiles, processFileEntries } from '../../utils/mediaUtils';
import { 
    Folder, FolderOpen, FileVideo, File, ChevronRight, ChevronDown, 
    Play, SkipForward, Maximize2, RefreshCw, Film, UploadCloud, 
    FolderPlus, Music, Image as ImageIcon, Code2, AlertCircle, X,
    FileText, Loader2
} from "lucide-react";

// --- Recursive File Tree Item Component ---
const FileTreeItem: React.FC<{ 
    node: FileNode; 
    level: number; 
    activeId: string | null; 
=======
import { FileNode, Language } from '../../types';
import { api } from '../../core/api';
import { TRANSLATIONS } from '../../constants';
import { smartSortFiles, processFileEntries } from '../../utils/mediaUtils';
import {
    Folder, FolderOpen, FileVideo, File, ChevronRight, ChevronDown,
    Play, SkipForward, SkipBack, Maximize2, RefreshCw, Film, UploadCloud,
    FolderPlus, Music, Image as ImageIcon, Code2, AlertCircle, X,
    FileText, Loader2, Settings, FastForward
} from "lucide-react";

const FileTreeItem: React.FC<{
    node: FileNode;
    level: number;
    activeId: string | null;
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    onSelect: (node: FileNode) => void;
    onToggle: (node: FileNode) => void;
}> = ({ node, level, activeId, onSelect, onToggle }) => {
  const isActive = activeId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
        onToggle(node);
<<<<<<< HEAD
        onSelect(node); // Also select folders to update current path
=======
        onSelect(node);
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    } else {
        onSelect(node);
    }
  };

  return (
    <div className="select-none">
<<<<<<< HEAD
      <div 
        className={`
            flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors border-l-2 
=======
      <div
        className={`
            flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors border-l-2
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
            ${isActive ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        <span className="opacity-50 text-xs">
            {node.type === 'folder' ? (
                node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : <span className="w-3.5 inline-block" />}
        </span>
<<<<<<< HEAD
        
=======

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        {node.type === 'folder' ? (
            node.isOpen ? <FolderOpen size={16} className="text-yellow-500" /> : <Folder size={16} className="text-yellow-500/80" />
        ) : node.fileType === 'video' ? (
            <FileVideo size={16} className="text-pink-400" />
        ) : node.fileType === 'audio' ? (
            <Music size={16} className="text-cyan-400" />
        ) : node.fileType === 'image' ? (
            <ImageIcon size={16} className="text-emerald-400" />
        ) : node.fileType === 'code' ? (
            <Code2 size={16} className="text-amber-400" />
        ) : (
            <File size={16} className="text-slate-500" />
        )}
<<<<<<< HEAD
        
=======

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        <span className="truncate text-sm font-mono tracking-tight">{node.name}</span>
      </div>
      {node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
<<<<<<< HEAD
            <FileTreeItem 
                key={child.id} 
                node={child} 
                level={level + 1} 
                activeId={activeId} 
                onSelect={onSelect} 
=======
            <FileTreeItem
                key={child.id}
                node={child}
                level={level + 1}
                activeId={activeId}
                onSelect={onSelect}
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
                onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

<<<<<<< HEAD
// --- Upload Modal ---
=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
const UploadModal: React.FC<{ isOpen: boolean; onClose: () => void; onUpload: (files: FileList) => void }> = ({ isOpen, onClose, onUpload }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <UploadCloud className="text-indigo-400" /> Upload Resources
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X size={20} className="text-slate-400" /></button>
                </div>

<<<<<<< HEAD
                <div 
=======
                <div
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
                    className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => inputRef.current?.click()}
                >
                    <FolderPlus size={48} className="text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
                    <p className="text-slate-300 font-medium">Click to select a Folder</p>
                    <p className="text-xs text-slate-500 mt-2">Supports recursive directory upload</p>
<<<<<<< HEAD
                    {/* @ts-ignore - webkitdirectory is standard in modern browsers but missing in React types sometimes */}
                    <input ref={inputRef} type="file" className="hidden" webkitdirectory="" directory="" onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                            onUpload(e.target.files);
                            onClose();
                        }
                    }} />
=======
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        multiple
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                onUpload(e.target.files);
                                onClose();
                            }
                        }}
                    />
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
                </div>
            </div>
        </div>,
        document.body
    );
};

<<<<<<< HEAD

const MediaBrowser: React.FC = () => {
  const [fileTree, setFileTree] = useState<FileNode[]>(MOCK_FILE_TREE);
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/wwwroot');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [playlist, setPlaylist] = useState<FileNode[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);

  // Initial selection
  useEffect(() => {
     // Drill down to a default file
     const defFile = fileTree[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0];
     if (defFile) setActiveFile(defFile);
  }, []);

  // Update Path and Playlist when Active File Changes
  useEffect(() => {
    if (!activeFile) return;

    // 1. Calculate Path
=======
interface MediaBrowserProps {
  lang?: Language;
}

const MediaBrowser: React.FC<MediaBrowserProps> = ({ lang = 'en' }) => {
  const t = TRANSLATIONS[lang].media_browser;
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<FileNode | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [basePath, setBasePath] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [playlist, setPlaylist] = useState<FileNode[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipIntro, setSkipIntro] = useState<{ enabled: boolean; start: number; end: number }>({
    enabled: false,
    start: 0,
    end: 90
  });
  const [showFloatingControls, setShowFloatingControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadFileTree = async (path?: string) => {
    setLoading(true);
    setError(null);

    // NO try-catch allowed - backend must handle errors properly
    const response = await api.mcpV1.getStaticResourcesTree();

    if (response.success && response.data) {
      // Backend MUST return consistent structure: { items, path, realPath }
      const items = response.data.items;
      const responsePath = response.data.path;
      const realPath = response.data.realPath;

      setCurrentPath(realPath);
      setBasePath(responsePath);

      const addIdToNodes = (nodes: any[]): FileNode[] => {
        return nodes.map((node: any) => ({
          ...node,
          id: node.path,
          type: node.type === 'directory' ? 'folder' : 'file',
          fileType: node.type === 'directory' ? undefined : detectFileType(node.name),
          children: node.children ? addIdToNodes(node.children) : undefined
        }));
      };

      const nodesWithId = addIdToNodes(items);
      setFileTree(nodesWithId);

      if (nodesWithId.length > 0 && !activeFile) {
        const firstFile = findFirstFile(nodesWithId);
        if (firstFile) {
          setActiveFile(firstFile);
        }
      }
    } else {
      setError(response.error);
    }

    setLoading(false);
  };

  // NO || or ?? allowed
  const detectFileType = (fileName: string): 'video' | 'audio' | 'image' | 'code' | 'text' => {
    const parts = fileName.split('.');
    const ext = parts[parts.length - 1].toLowerCase();
    if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'm3u8'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'php', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) return 'code';
    return 'text';
  };

  const findFirstFile = (nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.type === 'file') return node;
      if (node.children) {
        const found = findFirstFile(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  useEffect(() => {
    loadFileTree();
  }, []);

  useEffect(() => {
    if (!activeFile) {
      // Reset to base path when no file is selected
      const pathParts = currentPath.split('/').slice(0, -1);
      const newPath = pathParts.length > 0 ? pathParts.join('/') : basePath;
      setCurrentPath(newPath);
      return;
    }

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    const path: string[] = [];
    const findPath = (nodes: FileNode[], targetId: string, currentStack: string[]): boolean => {
        for (const node of nodes) {
            currentStack.push(node.name);
            if (node.id === targetId) return true;
            if (node.children) {
                if (findPath(node.children, targetId, currentStack)) return true;
            }
            currentStack.pop();
        }
        return false;
    };
    const stack: string[] = [];
    findPath(fileTree, activeFile.id, stack);
<<<<<<< HEAD
    setCurrentPath('/' + stack.join('/'));

    // 2. Generate Sorted Playlist if it's a media file
    // Find parent directory to get siblings
=======
    // Keep the base path and append the file path
    const fullPath = basePath + '/' + stack.join('/');
    setCurrentPath(fullPath);

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    const findParent = (nodes: FileNode[], targetId: string): FileNode | null => {
        for (const node of nodes) {
            if (node.children?.some(c => c.id === targetId)) return node;
            if (node.children) {
                const res = findParent(node.children, targetId);
                if (res) return res;
            }
        }
        return null;
    };

    const parent = findParent(fileTree, activeFile.id);
    if (parent && parent.children) {
<<<<<<< HEAD
        // Smart Sort Siblings
        const sortedSiblings = smartSortFiles(parent.children);
        // Filter valid playable types if needed, or just keep all for browsing context
        // For auto-play logic, usually we only want media
        const mediaSiblings = sortedSiblings.filter(n => ['video', 'audio'].includes(n.fileType || ''));
=======
        const sortedSiblings = smartSortFiles(parent.children);
        // NO || allowed - backend MUST set fileType
        const mediaSiblings = sortedSiblings.filter(n => {
          if (n.fileType) {
            return ['video', 'audio'].includes(n.fileType);
          }
          return false;
        });
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        setPlaylist(mediaSiblings);
    }

  }, [activeFile, fileTree]);

<<<<<<< HEAD
  // Toggle Folder State Helper
=======
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
  const toggleFolder = (targetNode: FileNode) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
            if (node.id === targetNode.id) {
                return { ...node, isOpen: !node.isOpen };
            }
            if (node.children) {
                return { ...node, children: updateNodes(node.children) };
            }
            return node;
        });
    };
    setFileTree(prev => updateNodes(prev));
  };

<<<<<<< HEAD
  // Upload Logic
  const handleUpload = async (files: FileList) => {
     const newNodes = await processFileEntries(files);
     
     // Find the currently selected folder to inject into, or root if file selected
     // Simplified: Inject into Root -> laravel_db -> static for this demo context
     // OR: Smart inject based on current path logic if I had a robust "Current Dir" pointer.
     // For demo: Append to the first open folder or root.
     
     const injectIntoTree = (nodes: FileNode[]): FileNode[] => {
        // Just appending to the deep active folder for UX "feel"
        if (activeFile) {
             // Find parent of active file and append there
             return nodes.map(node => {
                 if (node.children?.some(c => c.id === activeFile.id)) {
                     return { ...node, children: [...(node.children || []), ...newNodes] };
                 }
                 if (node.children) {
                     return { ...node, children: injectIntoTree(node.children) };
                 }
                 return node;
             });
        }
        return [...nodes, ...newNodes];
     };

     setFileTree(prev => injectIntoTree(prev));
  };

  // Playback Ended Logic (Auto-Next)
  const handleMediaEnded = () => {
      if (!autoPlay || !activeFile) return;
      const idx = playlist.findIndex(n => n.id === activeFile.id);
      if (idx !== -1 && idx < playlist.length - 1) {
          setActiveFile(playlist[idx + 1]);
      } else {
          // Loop or Stop? Let's Loop
          setActiveFile(playlist[0]);
      }
  };

  // --- Render Preview Content ---
  const renderPreview = () => {
    if (!activeFile) return null;

    switch (activeFile.fileType) {
        case 'video':
            return (
                <div className="w-full h-full bg-black flex flex-col relative group">
                    <video 
                        key={activeFile.id}
                        src="https://www.w3schools.com/html/mov_bbb.mp4" // Mock URL
                        controls 
                        autoPlay={autoPlay}
                        className="w-full h-full object-contain"
                        onEnded={handleMediaEnded}
                    />
                </div>
            );
        case 'audio':
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 relative p-10">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)] animate-[spin_10s_linear_infinite]">
                        <Music size={64} className="text-white" />
                    </div>
                    <div className="mt-8 text-xl font-bold text-white tracking-wide">{activeFile.name}</div>
                    <audio 
                        key={activeFile.id}
                        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" // Mock URL
                        controls 
                        autoPlay={autoPlay}
                        className="mt-8 w-full max-w-md"
                        onEnded={handleMediaEnded}
                    />
                </div>
            );
        case 'image':
            return (
                <div className="w-full h-full bg-black/50 flex items-center justify-center p-4">
                    <img 
                        src={`https://picsum.photos/seed/${activeFile.id}/800/600`} 
                        alt={activeFile.name} 
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                    />
                </div>
            );
        case 'code':
        case 'text':
            return (
                <div className="w-full h-full bg-[#1e1e1e] p-6 overflow-auto font-mono text-sm text-slate-300">
                    <pre>
{`// Preview of ${activeFile.name}

export default function Resource() {
  const meta = {
    created: "${activeFile.date}",
    size: "${activeFile.size}"
  };

  return (
    <div className="resource-viewer">
       <h1>Content Loading...</h1>
    </div>
  );
}`}
                    </pre>
                </div>
            );
        default:
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                    <File size={48} className="opacity-20" />
                    <p>No preview available for this file type</p>
                </div>
            );
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden relative">
        <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleUpload} />

        {/* Left: File Tree */}
        <BentoCard 
            title="File System" 
            className="w-full md:w-1/3 lg:w-1/4 h-1/2 md:h-full flex flex-col"
            headerControls={
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsUploadOpen(true)} title="Upload Folder" className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><UploadCloud size={16} /></button>
                    <button title="Refresh" className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><RefreshCw size={16} /></button>
                </div>
            }
        >
            <div className="p-2 flex-1 overflow-y-auto">
                {/* Status Bar for Path */}
                <div className="px-2 py-2 mb-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-mono text-indigo-300 break-all flex items-start gap-2">
                    <FolderOpen size={12} className="mt-0.5 flex-shrink-0" />
                    {currentPath}
                </div>

                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 px-2">Local Resources</div>
                {fileTree.map(node => (
                    <FileTreeItem 
                        key={node.id} 
                        node={node} 
                        level={0} 
                        activeId={activeFile?.id || null} 
                        onSelect={(n) => {
                             if (n.type === 'file') setActiveFile(n); 
                             else {
                                 // Just update path visual if folder clicked
                                 // Logic handled in recursion calc
                             }
                        }} 
                        onToggle={toggleFolder}
                    />
                ))}
            </div>
        </BentoCard>

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col gap-4 h-1/2 md:h-full">
            {/* Metadata Bar */}
            <BentoCard className="flex-shrink-0">
                 <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2 truncate">
                             {activeFile?.fileType === 'video' ? <FileVideo className="text-pink-500" size={20} /> :
                              activeFile?.fileType === 'audio' ? <Music className="text-cyan-500" size={20} /> :
                              activeFile?.fileType === 'image' ? <ImageIcon className="text-emerald-500" size={20} /> :
                              <File className="text-slate-500" size={20} />}
                            <span className="truncate">{activeFile?.name || "No file selected"}</span>
                        </h2>
                        <div className="flex gap-4 text-xs text-slate-400 font-mono">
                            <span>SIZE: {activeFile?.size || "--"}</span>
                            <span>MODIFIED: {activeFile?.date || "--"}</span>
                            <span className="text-emerald-400 hidden sm:inline">● READY_FOR_PLAYBACK</span>
                        </div>
                    </div>
                    
                    {['video', 'audio'].includes(activeFile?.fileType || '') && (
                        <div className="flex gap-2">
                            <label className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded border border-white/10 text-xs text-slate-300 cursor-pointer select-none hover:bg-white/5 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={autoPlay} 
                                    onChange={(e) => setAutoPlay(e.target.checked)} 
                                    className="accent-indigo-500" 
                                /> 
                                Auto-play
                            </label>
                        </div>
                    )}
                 </div>
            </BentoCard>

            {/* Main Viewer */}
            <BentoCard className="flex-1 min-h-0 bg-black/60 relative group flex flex-col overflow-hidden" glowing>
                {renderPreview()}
                
                {/* Overlay Controls for Video only (Example) */}
                {activeFile?.fileType === 'video' && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/90 to-transparent flex items-end pb-4 px-6 gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                         <div className="pointer-events-auto flex items-center gap-4 w-full">
                            <Play size={20} fill="currentColor" className="text-white cursor-pointer hover:text-indigo-400" />
                            <SkipForward size={20} className="text-slate-300 cursor-pointer hover:text-white" onClick={handleMediaEnded} />
                            <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative cursor-pointer group/timeline">
                                <div className="absolute top-0 left-0 h-full w-1/3 bg-indigo-500 shadow-[0_0_10px_indigo]"></div>
                            </div>
                            <span className="text-xs font-mono text-white">04:20 / 12:45</span>
                            <Maximize2 size={18} className="text-slate-300 cursor-pointer hover:text-white" />
                         </div>
                    </div>
                )}
            </BentoCard>
        </div>
=======
  // NO try-catch allowed
  const handleUpload = async (files: FileList) => {
     const response = await api.mcpV1.uploadStaticResources(Array.from(files));
     if (response.success) {
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  // NO || allowed
  const playNextInPlaylist = () => {
    if (playlist.length === 0) return;
    if (!activeFile) return;
    const currentIdx = playlist.findIndex(n => n.id === activeFile.id);
    if (currentIdx < playlist.length - 1) {
        setActiveFile(playlist[currentIdx + 1]);
    }
  };

  const playPreviousInPlaylist = () => {
    if (playlist.length === 0) return;
    if (!activeFile) return;
    const currentIdx = playlist.findIndex(n => n.id === activeFile.id);
    if (currentIdx > 0) {
        setActiveFile(playlist[currentIdx - 1]);
    }
  };

  const handleVideoEnd = () => {
    if (autoPlay) playNextInPlaylist();
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    if (!skipIntro.enabled) return;
    const currentTime = videoRef.current.currentTime;
    if (currentTime >= skipIntro.start && currentTime < skipIntro.end && currentTime < skipIntro.start + 2) {
      videoRef.current.currentTime = skipIntro.end;
    }
  };

  const currentPlaylistIndex = activeFile ? playlist.findIndex(n => n.id === activeFile.id) : -1;
  const hasNext = playlist.length > 0 && currentPlaylistIndex < playlist.length - 1;
  const hasPrevious = playlist.length > 0 && currentPlaylistIndex > 0;

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <BentoCard title="Static Resources" className="flex-1 flex flex-col min-h-0" icon={Film} glowing>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadFileTree()}
                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <span className="text-xs text-slate-500 font-mono">{currentPath}</span>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
            >
              <UploadCloud size={16} />
              Upload
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-2">
              <AlertCircle size={32} />
              <p className="text-sm">{error}</p>
              <button
                onClick={() => loadFileTree()}
                className="mt-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-black/20 border border-white/5 rounded-lg p-3 overflow-y-auto">
              {fileTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Folder size={48} className="mb-4 opacity-50" />
                  <p>No files found</p>
                </div>
              ) : (
                fileTree.map(node => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    level={0}
                    activeId={activeFile ? activeFile.id : null}
                    onSelect={setActiveFile}
                    onToggle={toggleFolder}
                  />
                ))
              )}
            </div>
          )}
        </BentoCard>
      </div>

      <div className="w-full md:w-[400px] flex flex-col gap-6">
        <BentoCard title="Preview" icon={Play} glowing className="flex-shrink-0">
          <div className="space-y-4">
            <div className="aspect-video bg-black/60 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative group">
              {activeFile?.fileType === 'video' ? (
                <>
                  <video
                    ref={videoRef}
                    key={activeFile.id}
                    controls
                    autoPlay
                    onEnded={handleVideoEnd}
                    onTimeUpdate={handleVideoTimeUpdate}
                    className="w-full h-full"
                    src={api.mcpV1.getStaticFileStreamUrl(currentPath)}
                  />
                  {/* Floating Episode Controls - NO || allowed */}
                  {showFloatingControls && (hasPrevious ? true : hasNext ? true : false) && (
                    <div className="absolute bottom-20 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {hasPrevious && (
                        <button
                          onClick={playPreviousInPlaylist}
                          className="p-3 bg-black/80 hover:bg-black/90 text-white rounded-full shadow-lg transition-all hover:scale-110"
                          title="Previous Episode"
                        >
                          <SkipBack size={20} />
                        </button>
                      )}
                      {hasNext && (
                        <button
                          onClick={playNextInPlaylist}
                          className="p-3 bg-black/80 hover:bg-black/90 text-white rounded-full shadow-lg transition-all hover:scale-110"
                          title="Next Episode"
                        >
                          <SkipForward size={20} />
                        </button>
                      )}
                    </div>
                  )}
                  {/* Skip Intro Button */}
                  {skipIntro.enabled && videoRef.current && videoRef.current.currentTime >= skipIntro.start && videoRef.current.currentTime < skipIntro.end && (
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = skipIntro.end;
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white text-sm rounded-lg shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                      >
                        <FastForward size={16} />
                        Skip Intro
                      </button>
                    </div>
                  )}
                </>
              ) : activeFile?.fileType === 'audio' ? (
                <audio
                  key={activeFile.id}
                  controls
                  autoPlay
                  onEnded={handleVideoEnd}
                  className="w-full"
                  src={api.mcpV1.getStaticFileStreamUrl(currentPath)}
                />
              ) : activeFile?.fileType === 'image' ? (
                <img
                  src={api.mcpV1.getStaticFileStreamUrl(currentPath)}
                  alt={activeFile.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-slate-600 text-center p-8">
                  <File size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No preview available</p>
                  {activeFile && <p className="text-xs mt-2 font-mono">{activeFile.name}</p>}
                </div>
              )}
            </div>

            {activeFile && (
              <div className="text-xs space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-mono text-slate-300">{activeFile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-mono text-slate-300">{activeFile.size ? activeFile.size : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-mono text-slate-300">{activeFile.fileType ? activeFile.fileType : 'unknown'}</span>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  className="rounded"
                />
                <label className="text-slate-400">Auto-play next ({playlist.length} in queue)</label>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={showFloatingControls}
                  onChange={(e) => setShowFloatingControls(e.target.checked)}
                  className="rounded"
                />
                <label className="text-slate-400">Show floating episode controls</label>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={skipIntro.enabled}
                  onChange={(e) => setSkipIntro(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded"
                />
                <label className="text-slate-400">Auto-skip intro</label>
              </div>

              {skipIntro.enabled && (
                <div className="ml-5 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-500 w-12">Start:</label>
                    <input
                      type="number"
                      min="0"
                      value={skipIntro.start}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSkipIntro(prev => ({ ...prev, start: isNaN(val) ? 0 : val }));
                      }}
                      className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-slate-300"
                    />
                    <span className="text-slate-500">sec</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-slate-500 w-12">End:</label>
                    <input
                      type="number"
                      min="0"
                      value={skipIntro.end}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSkipIntro(prev => ({ ...prev, end: isNaN(val) ? 0 : val }));
                      }}
                      className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-slate-300"
                    />
                    <span className="text-slate-500">sec</span>
                  </div>
                  <p className="text-[10px] text-slate-600">Skip intro from {skipIntro.start}s to {skipIntro.end}s</p>
                </div>
              )}
            </div>
          </div>
        </BentoCard>
      </div>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleUpload} />
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    </div>
  );
};

export default MediaBrowser;
