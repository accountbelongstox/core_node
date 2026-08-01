import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BentoCard from '../BentoCard';
import { FileNode, Language, StaticFileContent } from '../../apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import { TRANSLATIONS } from '../../constants';
import { smartSortFiles, processFileEntries } from '../../utils/mediaUtils';
import { InlineSpinner, LoadingBlock, EmptyState, AlertBox } from '../common';
import {
    Folder, FolderOpen, FileVideo, File, ChevronRight, ChevronDown,
    Play, SkipForward, SkipBack, Maximize2, RefreshCw, Film, UploadCloud,
    FolderPlus, Music, Image as ImageIcon, Code2, X,
    FileText, Settings, FastForward, Pencil, Trash2, Download,
    Save, RotateCcw, FileType
} from "lucide-react";

// Max size (~1.5MB) for which inline editing is allowed.
const MAX_EDITABLE_SIZE = 1.5 * 1024 * 1024;

const FileTreeItem: React.FC<{
    node: FileNode;
    level: number;
    activeId: string | null;
    selectedDir: string;
    onSelect: (node: FileNode) => void;
    onToggle: (node: FileNode) => void;
    onRename: (node: FileNode, newName: string) => void;
    onDelete: (node: FileNode) => void;
    onDownload: (node: FileNode) => void;
}> = ({ node, level, activeId, selectedDir, onSelect, onToggle, onRename, onDelete, onDownload }) => {
  const isActive = activeId === node.id;
  const isSelectedDir = node.type === 'folder' && selectedDir === node.id;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
        onToggle(node);
        onSelect(node);
    } else {
        onSelect(node);
    }
  };

  const beginRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(node.name);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed.length > 0 && trimmed !== node.name) {
      onRename(node, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setRenameValue(node.name);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  };

  return (
    <div className="select-none">
      <div
        className={`
            group flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors border-l-2
            ${isActive ? 'bg-indigo-500/20 border-indigo-500 text-white' : isSelectedDir ? 'bg-indigo-500/10 border-indigo-400/60 text-slate-200' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}
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
        ) : node.fileType === 'markdown' ? (
            <FileText size={16} className="text-sky-400" />
        ) : node.fileType === 'pdf' ? (
            <FileText size={16} className="text-red-400" />
        ) : node.fileType === 'doc' ? (
            <FileType size={16} className="text-blue-400" />
        ) : (
            <File size={16} className="text-slate-500" />
        )}

        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-black/40 border border-indigo-500/50 rounded px-1.5 py-0.5 text-sm font-mono text-white outline-none"
          />
        ) : (
          <span className="truncate text-sm font-mono tracking-tight flex-1 min-w-0">{node.name}</span>
        )}

        {!isRenaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={beginRename}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            {node.type === 'file' && (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(node); }}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Download"
              >
                <Download size={12} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(node); }}
              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      {node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem
                key={child.id}
                node={child}
                level={level + 1}
                activeId={activeId}
                selectedDir={selectedDir}
                onSelect={onSelect}
                onToggle={onToggle}
                onRename={onRename}
                onDelete={onDelete}
                onDownload={onDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const UploadModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onUpload: (files: FileList) => void;
    targetLabel: string;
}> = ({ isOpen, onClose, onUpload, targetLabel }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // webkitdirectory/directory are non-standard attrs that the React types omit; set
    // them imperatively on the hidden folder input so it picks whole directory trees.
    useEffect(() => {
      if (folderInputRef.current) {
        folderInputRef.current.setAttribute('webkitdirectory', '');
        folderInputRef.current.setAttribute('directory', '');
      }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onUpload(e.dataTransfer.files);
        onClose();
      }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <UploadCloud className="text-indigo-400" /> Upload Resources
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X size={20} className="text-slate-400" /></button>
                </div>
                <p className="text-xs text-slate-500 mb-6 font-mono truncate">Target: {targetLabel}</p>

                <div
                    className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5'}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={handleDrop}
                >
                    <UploadCloud size={48} className="text-slate-500 group-hover:text-indigo-400 transition-colors mb-4" />
                    <p className="text-slate-300 font-medium">Drag &amp; drop files here, or click to browse</p>
                    <p className="text-xs text-slate-500 mt-2">Files upload into the selected target directory</p>
                </div>

                <div className="flex items-center gap-3 mt-4">
                    <button
                        onClick={() => inputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                    >
                        <UploadCloud size={16} /> Select Files
                    </button>
                    <button
                        onClick={() => folderInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-sm rounded-lg transition-colors border border-white/10"
                    >
                        <FolderPlus size={16} /> Select Folder
                    </button>
                </div>

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
                <input
                    ref={folderInputRef}
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
        </div>,
        document.body
    );
};

const NewFolderModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
    targetLabel: string;
}> = ({ isOpen, onClose, onCreate, targetLabel }) => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isOpen) {
        setName('');
        if (inputRef.current) inputRef.current.focus();
      }
    }, [isOpen]);

    if (!isOpen) return null;

    const submit = () => {
      const trimmed = name.trim();
      if (trimmed.length > 0) {
        onCreate(trimmed);
        onClose();
      }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FolderPlus className="text-indigo-400" size={18} /> New Folder
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X size={18} className="text-slate-400" /></button>
                </div>
                <p className="text-xs text-slate-500 mb-4 font-mono truncate">In: {targetLabel}</p>
                <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); submit(); }
                      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
                    }}
                    placeholder="folder name"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-indigo-500/60"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
                    <button onClick={submit} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors">Create</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const DeleteConfirmModal: React.FC<{
    node: FileNode | null;
    preview: { files: number; directories: number; total_items: number } | null;
    loading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ node, preview, loading, onClose, onConfirm }) => {
    if (!node) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-full bg-red-500/15">
                        <Trash2 className="text-red-400" size={18} />
                    </div>
                    <h3 className="text-base font-bold text-white">Delete {node.type === 'folder' ? 'Folder' : 'File'}</h3>
                </div>
                <p className="text-sm text-slate-300 mb-1">
                    Delete <span className="font-mono text-white">{node.name}</span>?
                </p>
                {loading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-3">
                        <InlineSpinner size={14} /> Computing impact…
                    </div>
                ) : preview ? (
                    <p className="text-xs text-slate-500 mt-3">
                        This will remove <span className="text-red-400 font-medium">{preview.files}</span> file(s) and{' '}
                        <span className="text-red-400 font-medium">{preview.directories}</span> director(ies){' '}
                        (<span className="text-red-400 font-medium">{preview.total_items}</span> total). This cannot be undone.
                    </p>
                ) : (
                    <p className="text-xs text-slate-500 mt-3">This cannot be undone.</p>
                )}
                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">Delete</button>
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
  const [selectedDir, setSelectedDir] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [basePath, setBasePath] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [deletePreview, setDeletePreview] = useState<{ files: number; directories: number; total_items: number } | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
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

  // Universal viewer / editor state.
  const [fileContent, setFileContent] = useState<StaticFileContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
  const detectFileType = (fileName: string): 'video' | 'audio' | 'image' | 'code' | 'text' | 'pdf' | 'markdown' | 'doc' => {
    const parts = fileName.split('.');
    const ext = parts[parts.length - 1].toLowerCase();
    if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'm3u8'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'doc';
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

  // Selecting a node: a folder becomes the upload/new-folder target; a file becomes
  // the active preview file. NO || or ?? — explicit branching only.
  const handleSelectNode = (node: FileNode) => {
    if (node.type === 'folder') {
      setSelectedDir(node.id);
    } else {
      setActiveFile(node);
    }
  };

  // Friendly label for the current upload/new-folder target.
  const targetDirLabel = selectedDir ? selectedDir : '(root)';

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

  // Fetch content for textual file types (text / code / markdown) when the active
  // file changes. NO try-catch — McpV1 already normalizes errors into the response.
  useEffect(() => {
    setIsEditing(false);
    setEditValue('');
    setFileContent(null);
    setContentError(null);

    if (!activeFile) return;

    const ft = activeFile.fileType;
    const wantsContent = ft === 'text' ? true : ft === 'code' ? true : ft === 'markdown' ? true : false;
    if (!wantsContent) return;

    let cancelled = false;
    const fetchContent = async () => {
      setContentLoading(true);
      const response = await api.mcpV1.getStaticFileContent(activeFile.id);
      if (cancelled) return;
      if (response.success && response.data) {
        setFileContent(response.data as StaticFileContent);
        setEditValue(response.data.content ? response.data.content : '');
      } else {
        setContentError(response.error);
      }
      setContentLoading(false);
    };
    fetchContent();

    return () => { cancelled = true; };
  }, [activeFile]);

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

  // NO try-catch allowed. Upload into the selected directory (fall back to root),
  // preserving folder structure via File.webkitRelativePath -> relativePaths.
  const handleUpload = async (files: FileList) => {
     const fileArr = Array.from(files);
     const targetPath = selectedDir ? selectedDir : '';
     const relativePaths = fileArr.map(f => {
       const rel = (f as any).webkitRelativePath;
       return rel ? rel : f.name;
     });
     const response = await api.mcpV1.uploadStaticResources(fileArr, targetPath, relativePaths);
     if (response.success) {
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  // NO try-catch allowed.
  const handleCreateFolder = async (name: string) => {
     const parentPath = selectedDir ? selectedDir : '';
     const response = await api.mcpV1.createStaticResourceDir(parentPath, name);
     if (response.success) {
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  // NO try-catch allowed.
  const handleRename = async (node: FileNode, newName: string) => {
     const response = await api.mcpV1.renameStaticResource(node.id, newName);
     if (response.success) {
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  const handleDownload = (node: FileNode) => {
     const url = api.mcpV1.getStaticFileDownloadUrl(node.id);
     window.open(url, '_blank');
  };

  // Opening the delete modal also fetches an impact preview. NO try-catch.
  const openDeleteModal = async (node: FileNode) => {
     setDeleteTarget(node);
     setDeletePreview(null);
     setDeletePreviewLoading(true);
     const response = await api.mcpV1.deleteStaticResourcePreview(node.id);
     if (response.success && response.data) {
       setDeletePreview({
         files: response.data.files,
         directories: response.data.directories,
         total_items: response.data.total_items
       });
     }
     setDeletePreviewLoading(false);
  };

  // NO try-catch allowed.
  const handleConfirmDelete = async () => {
     if (!deleteTarget) return;
     const target = deleteTarget;
     const response = await api.mcpV1.deleteStaticResource(target.id);
     setDeleteTarget(null);
     setDeletePreview(null);
     if (response.success) {
       if (activeFile && activeFile.id === target.id) setActiveFile(null);
       if (selectedDir === target.id) setSelectedDir('');
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  // NO try-catch allowed. Save edits, then reload content from disk.
  const handleSaveContent = async () => {
     if (!activeFile) return;
     setIsSaving(true);
     const response = await api.mcpV1.saveStaticFileContent(activeFile.id, editValue);
     if (response.success) {
       const reload = await api.mcpV1.getStaticFileContent(activeFile.id);
       if (reload.success && reload.data) {
         setFileContent(reload.data as StaticFileContent);
         setEditValue(reload.data.content ? reload.data.content : '');
       }
       setIsEditing(false);
     } else {
       setContentError(response.error);
     }
     setIsSaving(false);
  };

  const handleCancelEdit = () => {
     setEditValue(fileContent && fileContent.content ? fileContent.content : '');
     setIsEditing(false);
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

  // Whether the current active file's content is editable inline.
  const isDirty = fileContent ? editValue !== fileContent.content : false;
  const canEdit = activeFile && fileContent && fileContent.isText && fileContent.size < MAX_EDITABLE_SIZE ? true : false;

  // Render the "Reading"/content body for a textual file (markdown / code / text).
  const renderTextualBody = () => {
    if (contentLoading) {
      return <LoadingBlock full label="" />;
    }
    if (contentError) {
      return (
        <div className="h-full flex items-center justify-center p-6">
          <AlertBox variant="error">{contentError}</AlertBox>
        </div>
      );
    }
    if (!fileContent) {
      return <EmptyState message="No content" />;
    }

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          spellCheck={false}
          className="w-full h-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-200 outline-none resize-none focus:border-indigo-500/50"
        />
      );
    }

    if (activeFile && activeFile.fileType === 'markdown') {
      return (
        <div className="h-full overflow-auto bg-black/20 border border-white/5 rounded-lg p-4 prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-a:text-indigo-400 prose-code:text-amber-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent.content}
          </ReactMarkdown>
        </div>
      );
    }

    // text / code -> mono pre/code
    return (
      <pre className="h-full overflow-auto bg-black/40 border border-white/5 rounded-lg p-3 text-xs">
        <code className="font-mono text-slate-200 whitespace-pre">{fileContent.content}</code>
      </pre>
    );
  };

  // Decide which universal viewer to render in the preview panel for the active file.
  const renderViewer = () => {
    if (!activeFile) {
      return (
        <div className="text-slate-600 text-center p-8">
          <File size={48} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No file selected</p>
        </div>
      );
    }

    const ft = activeFile.fileType;

    if (ft === 'video') {
      return (
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
      );
    }

    if (ft === 'audio') {
      return (
        <audio
          key={activeFile.id}
          controls
          autoPlay
          onEnded={handleVideoEnd}
          className="w-full"
          src={api.mcpV1.getStaticFileStreamUrl(activeFile.id)}
        />
      );
    }

    if (ft === 'image') {
      return (
        <img
          src={api.mcpV1.getStaticFileStreamUrl(activeFile.id)}
          alt={activeFile.name}
          className="max-w-full max-h-full object-contain"
        />
      );
    }

    if (ft === 'pdf') {
      return (
        <iframe
          key={activeFile.id}
          src={api.mcpV1.getStaticFileStreamUrl(activeFile.id)}
          className="w-full h-full bg-white"
          title={activeFile.name}
        />
      );
    }

    if (ft ? ['markdown', 'text', 'code'].includes(ft) : false) {
      return <div className="w-full h-full p-2">{renderTextualBody()}</div>;
    }

    // doc / unknown / binary -> no inline preview, offer download.
    return (
      <div className="text-slate-500 text-center p-8 flex flex-col items-center gap-3">
        <FileType size={48} className="opacity-50" />
        <p className="text-sm">No inline preview available</p>
        <p className="text-xs font-mono text-slate-600">{activeFile.name}</p>
        <button
          onClick={() => handleDownload(activeFile)}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
        >
          <Download size={16} /> Download
        </button>
      </div>
    );
  };

  // Textual viewer types use a tall panel; media types keep the aspect-video frame.
  const isReadingType = activeFile && activeFile.fileType ? ['markdown', 'text', 'code', 'pdf'].includes(activeFile.fileType) : false;

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <BentoCard title="Static Resources" className="flex-1 flex flex-col min-h-0" icon={Film} glowing>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => loadFileTree()}
                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <span className="text-xs text-slate-500 font-mono truncate">{currentPath}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 max-w-[200px]"
                title={`Target: ${targetDirLabel}`}
              >
                <Folder size={13} className="text-yellow-500/80 flex-shrink-0" />
                <span className="font-mono truncate">{targetDirLabel}</span>
              </span>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 text-sm rounded-lg transition-colors border border-white/10"
                title="Upload files or a folder"
              >
                <UploadCloud size={16} />
                Upload
              </button>
              <button
                onClick={() => setIsNewFolderOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                title="Create folder in target"
              >
                <FolderPlus size={16} />
                New Folder
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingBlock full label="" className="flex-1" />
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <AlertBox variant="error">{error}</AlertBox>
              <button
                onClick={() => loadFileTree()}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div
              className="flex-1 bg-black/20 border border-white/5 rounded-lg p-3 overflow-y-auto"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleUpload(e.dataTransfer.files);
                }
              }}
            >
              {fileTree.length === 0 ? (
                <EmptyState icon={Folder} message="No files found" className="h-full" />
              ) : (
                fileTree.map(node => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    level={0}
                    activeId={activeFile ? activeFile.id : null}
                    selectedDir={selectedDir}
                    onSelect={handleSelectNode}
                    onToggle={toggleFolder}
                    onRename={handleRename}
                    onDelete={openDeleteModal}
                    onDownload={handleDownload}
                  />
                ))
              )}
            </div>
          )}
        </BentoCard>
      </div>

      <div className="w-full md:w-[400px] flex flex-col gap-6 min-h-0">
        <BentoCard title="Preview" icon={Play} glowing className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Viewer toolbar: edit / save / cancel for editable textual files. */}
            {canEdit && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
                  {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />}
                  <span className="font-mono truncate">{activeFile ? activeFile.name : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveContent}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                        title="Save"
                      >
                        {isSaving ? <InlineSpinner size={13} /> : <Save size={13} />}
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg transition-colors border border-white/10"
                        title="Cancel"
                      >
                        <RotateCcw size={13} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg transition-colors border border-white/10"
                      title="Edit"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            )}

            {isReadingType ? (
              <div className="flex-1 min-h-0 bg-black/60 border border-white/10 rounded-lg overflow-hidden relative group">
                {renderViewer()}
              </div>
            ) : (
              <div className="aspect-video bg-black/60 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative group">
                {renderViewer()}
              </div>
            )}

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

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
        targetLabel={targetDirLabel}
      />
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreate={handleCreateFolder}
        targetLabel={targetDirLabel}
      />
      <DeleteConfirmModal
        node={deleteTarget}
        preview={deletePreview}
        loading={deletePreviewLoading}
        onClose={() => { setDeleteTarget(null); setDeletePreview(null); }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default MediaBrowser;
