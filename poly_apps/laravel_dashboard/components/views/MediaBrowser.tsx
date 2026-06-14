import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import BentoCard from '../BentoCard';
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
    onSelect: (node: FileNode) => void;
    onToggle: (node: FileNode) => void;
}> = ({ node, level, activeId, onSelect, onToggle }) => {
  const isActive = activeId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
        onToggle(node);
        onSelect(node);
    } else {
        onSelect(node);
    }
  };

  return (
    <div className="select-none">
      <div
        className={`
            flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors border-l-2
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
        <span className="truncate text-sm font-mono tracking-tight">{node.name}</span>
      </div>
      {node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem
                key={child.id}
                node={child}
                level={level + 1}
                activeId={activeId}
                onSelect={onSelect}
                onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const UploadModal: React.FC<{ isOpen: boolean; onClose: () => void; onUpload: (files: FileList) => void }> = ({ isOpen, onClose, onUpload }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <UploadCloud className="text-indigo-400" /> Upload Resources
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X size={20} className="text-slate-400" /></button>
                </div>

                <div
                    className="border-2 border-dashed border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => inputRef.current?.click()}
                >
                    <FolderPlus size={48} className="text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
                    <p className="text-slate-300 font-medium">Click to select a Folder</p>
                    <p className="text-xs text-slate-500 mt-2">Supports recursive directory upload</p>
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
                </div>
            </div>
        </div>,
        document.body
    );
};

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
    // Keep the base path and append the file path
    const fullPath = basePath + '/' + stack.join('/');
    setCurrentPath(fullPath);

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
        const sortedSiblings = smartSortFiles(parent.children);
        // NO || allowed - backend MUST set fileType
        const mediaSiblings = sortedSiblings.filter(n => {
          if (n.fileType) {
            return ['video', 'audio'].includes(n.fileType);
          }
          return false;
        });
        setPlaylist(mediaSiblings);
    }

  }, [activeFile, fileTree]);

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
                    src={api.mcpV1.getStaticFileStreamUrl(activeFile.id)}
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
                  src={api.mcpV1.getStaticFileStreamUrl(activeFile.id)}
                />
              ) : activeFile?.fileType === 'image' ? (
                <img
                  src={api.mcpV1.getStaticFileStreamUrl(activeFile.id)}
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
    </div>
  );
};

export default MediaBrowser;
