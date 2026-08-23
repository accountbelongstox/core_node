import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { FileNode } from '@/apps/laravel-manager/uiTypes';
import {
  AlertCircle, BookOpen, ChevronDown, ChevronRight, Code2, Download, File,
  FileText, FileType, FileVideo, Folder, FolderOpen, FolderPlus,
  Image as ImageIcon, Music, Pencil, Trash2, UploadCloud, X,
} from 'lucide-react';

const FileTreeItem: React.FC<{
    node: FileNode;
    level: number;
    activeId: string | null;
    selectedDir: string;
    canRename: boolean;
    canDelete: boolean;
    onSelect: (node: FileNode) => void;
    onToggle: (node: FileNode) => void;
    onRename: (node: FileNode, newName: string) => void;
    onDelete: (node: FileNode) => void;
    onDownload: (node: FileNode) => void;
}> = ({ node, level, activeId, selectedDir, canRename, canDelete, onSelect, onToggle, onRename, onDelete, onDownload }) => {
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
        ) : node.fileType === 'epub' ? (
            <BookOpen size={16} className="text-orange-400" />
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
            {canRename && (
              <button
                onClick={beginRename}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Rename"
              >
                <Pencil size={12} />
              </button>
            )}
            {node.type === 'file' && (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(node); }}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Download"
              >
                <Download size={12} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            )}
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
                canRename={canRename}
                canDelete={canDelete}
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
                        <Loader2 size={14} className="animate-spin" /> Computing impact…
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

export { DeleteConfirmModal, FileTreeItem, NewFolderModal, UploadModal };


