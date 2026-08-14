import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import BentoCard from '@/shared/ui/BentoCard';
import { FileNode, Language } from '@/apps/laravel-manager/uiTypes';
import { useUnifiedApp } from '@/apps/laravel-manager/context/useUnifiedApp';
import { isDebugAuthBypass } from '@/apps/laravel-manager/config/auth';
import { smartSortFiles } from '@/apps/laravel-manager/utils/mediaUtils';
import { UploadItem, classifyUploadType } from './uploadProgress';
import { ResourceSource } from './resourceSources';
import UploadProgressCard from './UploadProgressCard';
import {
    Folder, FolderOpen, FileVideo, File, ChevronRight, ChevronDown,
    RefreshCw, Film, UploadCloud, FolderPlus, Music,
    Image as ImageIcon, Code2, AlertCircle, X, FileText, Loader2,
    Pencil, Trash2, Download, FileType, BookOpen, Lock
} from "lucide-react";

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

// Walk the tree to find a node by id. Returns null when absent (e.g. after delete).
const findNodeById = (nodes: FileNode[], targetId: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === targetId) return node;
      if (node.children) {
        const found = findNodeById(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
};

const findParentOf = (nodes: FileNode[], targetId: string): FileNode | null => {
    for (const node of nodes) {
        if (node.children?.some(c => c.id === targetId)) return node;
        if (node.children) {
            const res = findParentOf(node.children, targetId);
            if (res) return res;
        }
    }
    return null;
};

// Filter the tree by a case-insensitive name match. A folder is kept when its own
// name matches OR it has any surviving descendant. NO || or ?? — explicit branching.
const filterTree = (nodes: FileNode[], term: string): FileNode[] => {
    const lower = term.trim().toLowerCase();
    if (lower.length === 0) return nodes;
    const out: FileNode[] = [];
    for (const node of nodes) {
        const selfMatch = node.name.toLowerCase().includes(lower);
        if (node.type === 'folder') {
            const kids = node.children ? filterTree(node.children, term) : [];
            if (selfMatch) {
                out.push(node);
            } else if (kids.length > 0) {
                out.push({ ...node, children: kids, isOpen: true });
            }
        } else if (selfMatch) {
            out.push(node);
        }
    }
    return out;
};

// Collect the ids of every open folder so the open/closed shape survives a
// backend refetch (which otherwise rebuilds the tree fully collapsed).
const collectOpenIds = (nodes: FileNode[], acc: Set<string>): void => {
    for (const n of nodes) {
        if (n.type === 'folder' && n.isOpen === true) {
            acc.add(n.id);
        }
        if (n.children) {
            collectOpenIds(n.children, acc);
        }
    }
};

// Re-apply a captured open-folder set onto a freshly built tree.
const applyOpenState = (nodes: FileNode[], openIds: Set<string>): FileNode[] => {
    return nodes.map((n) => {
        const kids = n.children ? applyOpenState(n.children, openIds) : n.children;
        if (n.type === 'folder') {
            return { ...n, isOpen: openIds.has(n.id), children: kids };
        }
        return { ...n, children: kids };
    });
};

// Force a set of folder ids open (used to reveal an upload target chain).
const openByIds = (nodes: FileNode[], ids: Set<string>): FileNode[] => {
    return nodes.map((n) => {
        const kids = n.children ? openByIds(n.children, ids) : n.children;
        if (n.type === 'folder' && ids.has(n.id)) {
            return { ...n, isOpen: true, children: kids };
        }
        return { ...n, children: kids };
    });
};

// Every ancestor path id of a target relative path ("a/b/c" -> a, a/b, a/b/c).
const buildAncestorSet = (targetPath: string): Set<string> => {
    const set = new Set<string>();
    if (targetPath.length === 0) {
        return set;
    }
    const segs = targetPath.split('/');
    let cur = '';
    for (const s of segs) {
        cur = cur.length > 0 ? `${cur}/${s}` : s;
        set.add(cur);
    }
    return set;
};

interface FileTreePanelProps {
  search: string;
  activeFileId: string | null;
  onSelectFile: (n: FileNode) => void;
  onPlaylist: (p: FileNode[]) => void;
  lang?: Language;
  reloadSignal: number;
  /** Backend adapter for this tree (static files vs project code). */
  source: ResourceSource;
  /** Opens the global login modal when a mutation is attempted unauthenticated. */
  onRequireLogin?: () => void;
}

const FileTreePanel: React.FC<FileTreePanelProps> = ({ search, activeFileId, onSelectFile, onPlaylist, lang = 'en', reloadSignal, source, onRequireLogin }) => {
  // Viewing media is open; mutations (upload / new folder / rename / delete)
  // require login. Some sources (code) also require login just to BROWSE. The
  // loopback debug bypass counts as authenticated locally, matching the backend
  // dashboard.auth gate.
  const { isLoggedIn } = useUnifiedApp();
  const authed = isLoggedIn === true ? true : isDebugAuthBypass();

  // Browsing this source is blocked when the source needs login and we are not
  // authenticated (e.g. code source for a logged-out remote user).
  const browseBlocked = source.requiresLogin === true ? authed !== true : false;

  // Returns true when a mutation may proceed; otherwise opens the login modal.
  const ensureAuthed = (): boolean => {
    if (authed === true) {
      return true;
    }
    if (onRequireLogin) {
      onRequireLogin();
    }
    return false;
  };

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [basePath, setBasePath] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [deletePreview, setDeletePreview] = useState<{ files: number; directories: number; total_items: number } | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [batchPct, setBatchPct] = useState(0);

  // Returns the freshly built tree (or null on error) so callers can reveal a
  // specific path after a mutation. Open folders are preserved across the
  // refetch (the backend now returns nested children for the whole tree).
  const loadFileTree = async (): Promise<FileNode[] | null> => {
    // Login-gated source while logged out: do not call the API; the render shows
    // an auth prompt (browseBlocked) instead.
    if (browseBlocked) {
      setFileTree([]);
      setError(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);

    // NO try-catch allowed - the adapter normalizes errors into the response.
    // The adapter already shapes items into FileNode[] (id/type/fileType/sourceId)
    // and, for recursive sources, the full nested tree; lazy sources return one level.
    const response = await source.listTree();

    if (response.success && response.data) {
      const nodesWithId = response.data.items;

      setCurrentPath(response.data.realPath);
      setBasePath(response.data.basePath);

      if (source.lazyTree === true) {
        // Lazy sources (code): children load on expand, so a full reload starts
        // collapsed (re-applying open ids would mark folders open with no children).
        setFileTree(nodesWithId);
      } else {
        // Preserve previously open folders so a refresh / post-mutation reload
        // does not collapse the tree the user was browsing.
        setFileTree((prev) => {
          const openIds = new Set<string>();
          collectOpenIds(prev, openIds);
          return applyOpenState(nodesWithId, openIds);
        });
      }

      // Auto-select the first file when there is no valid active selection.
      const activeStillPresent = activeFileId ? findNodeById(nodesWithId, activeFileId) !== null : false;
      if (nodesWithId.length > 0 && !activeStillPresent) {
        const firstFile = findFirstFile(nodesWithId);
        if (firstFile) {
          onSelectFile(firstFile);
        }
      }

      setLoading(false);
      return nodesWithId;
    }

    setError(response.error);
    setLoading(false);
    return null;
  };

  // Friendly label for the current upload/new-folder target.
  const targetDirLabel = selectedDir ? selectedDir : '(root)';

  // Switching source (files <-> code) clears the upload/new-folder target.
  useEffect(() => {
    setSelectedDir('');
  }, [source]);

  // Initial load + reload on: parent Refresh, source switch, or auth change
  // (logging in unblocks a login-gated source like code).
  useEffect(() => {
    loadFileTree();
  }, [reloadSignal, source, authed]);

  // Compute the media-sibling playlist (video/audio) for the active file and emit it.
  useEffect(() => {
    if (!activeFileId) {
      onPlaylist([]);
      return;
    }
    const parent = findParentOf(fileTree, activeFileId);
    if (parent && parent.children) {
        const sortedSiblings = smartSortFiles(parent.children);
        // NO || allowed - backend MUST set fileType
        const mediaSiblings = sortedSiblings.filter(n => {
          if (n.fileType) {
            return ['video', 'audio'].includes(n.fileType);
          }
          return false;
        });
        onPlaylist(mediaSiblings);
    } else {
        onPlaylist([]);
    }
  }, [activeFileId, fileTree]);

  // Selecting a node: a folder becomes the upload/new-folder target; a file becomes
  // the active preview file (lifted to the parent). NO || or ?? — explicit branching.
  const handleSelectNode = (node: FileNode) => {
    if (node.type === 'folder') {
      setSelectedDir(node.id);
    } else {
      onSelectFile(node);
    }
  };

  // For a lazy source, fetch and attach a folder's children the first time it is
  // opened, then mark it open. NO try-catch (adapter normalizes errors).
  const loadAndOpenChildren = async (targetNode: FileNode) => {
    const response = await source.listTree(targetNode.id);
    if (response.success && response.data) {
      const kids = response.data.items;
      const attach = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === targetNode.id) {
            return { ...node, children: kids, isOpen: true };
          }
          if (node.children) {
            return { ...node, children: attach(node.children) };
          }
          return node;
        });
      };
      setFileTree(prev => attach(prev));
    } else {
      setError(response.error);
    }
  };

  const toggleFolder = (targetNode: FileNode) => {
    const willOpen = targetNode.isOpen === true ? false : true;
    // Lazy source + opening a not-yet-loaded folder -> fetch its children first.
    if (source.lazyTree === true && willOpen === true && targetNode.children === undefined) {
      loadAndOpenChildren(targetNode);
      return;
    }
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
  // Wires per-file upload progress into an UploadProgressCard.
  const handleUpload = async (files: FileList) => {
     if (!ensureAuthed()) return;
     const doUpload = source.upload;
     if (!doUpload) return;
     const fileArr = Array.from(files);
     if (fileArr.length === 0) return;
     const targetPath = selectedDir ? selectedDir : '';
     const relativePaths = fileArr.map(f => {
       const rel = (f as any).webkitRelativePath;
       return rel ? rel : f.name;
     });

     // Build queued UploadItems for the progress card.
     const items: UploadItem[] = fileArr.map((f, i) => ({
       id: `${Date.now()}-${i}-${f.name}`,
       name: relativePaths[i],
       type: classifyUploadType(f.name),
       status: 'queued',
       pct: 0
     }));
     setUploadItems(items);
     setBatchPct(0);

     // SEQUENTIAL QUEUE — send one file per request so a large folder uploads
     // ONE BY ONE: each row goes queued -> uploading(%) -> encoding -> done/failed
     // in turn (real per-file progress), and the batch bar tracks overall queue
     // position. A single failed file is recorded and the queue keeps going.
     const total = fileArr.length;
     let failures = 0;

     for (let i = 0; i < total; i++) {
       const itemId = items[i].id;
       setUploadItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'uploading', pct: 0 } : it));

       const response = await doUpload([fileArr[i]], targetPath, [relativePaths[i]], (pct: number) => {
         const nextStatus = pct >= 100 ? 'encoding' : 'uploading';
         setUploadItems(prev => prev.map(it => it.id === itemId ? { ...it, status: nextStatus, pct } : it));
         // Overall queue progress = completed files + the current file's fraction.
         setBatchPct(Math.round(((i + pct / 100) / total) * 100));
       });

       // A 2xx response can still save nothing (skipped/invalid file), so a row
       // only counts as done when the backend reports a saved file.
       let savedCount = 0;
       if (response.data && typeof response.data.uploaded_count === 'number') {
         savedCount = response.data.uploaded_count;
       }
       const saved = response.success === true ? savedCount >= 1 : false;
       if (saved) {
         setUploadItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'done', pct: 100 } : it));
       } else {
         failures = failures + 1;
         const failMsg = response.success === true ? 'No file was saved by the server.' : response.error;
         setUploadItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'failed', error: failMsg } : it));
       }
       setBatchPct(Math.round(((i + 1) / total) * 100));
     }

     // Reload, then reveal the uploaded files: expand the target directory chain
     // and select the first file under it so the new upload is visible at once.
     const tree = await loadFileTree();
     if (tree && targetPath.length > 0) {
       const ancestors = buildAncestorSet(targetPath);
       setFileTree(prev => openByIds(prev, ancestors));
       const targetNode = findNodeById(tree, targetPath);
       if (targetNode && targetNode.children) {
         const firstFile = findFirstFile(targetNode.children);
         if (firstFile) {
           onSelectFile(firstFile);
         }
       }
     }
     if (failures > 0) {
       setError(`${failures} of ${total} file(s) failed to upload.`);
     }
  };

  // NO try-catch allowed.
  const handleCreateFolder = async (name: string) => {
     if (!ensureAuthed()) return;
     const doMkdir = source.mkdir;
     if (!doMkdir) return;
     const parentPath = selectedDir ? selectedDir : '';
     const response = await doMkdir(parentPath, name);
     if (response.success) {
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  // NO try-catch allowed.
  const handleRename = async (node: FileNode, newName: string) => {
     if (!ensureAuthed()) return;
     const doRename = source.rename;
     if (!doRename) return;
     const response = await doRename(node, newName);
     if (response.success) {
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  const handleDownload = (node: FileNode) => {
     const url = source.downloadUrl(node);
     window.open(url, '_blank');
  };

  // Opening the delete modal also fetches an impact preview. NO try-catch.
  const openDeleteModal = async (node: FileNode) => {
     if (!ensureAuthed()) return;
     if (!source.delete) return;
     setDeleteTarget(node);
     setDeletePreview(null);
     const doPreview = source.deletePreview;
     if (!doPreview) {
       setDeletePreviewLoading(false);
       return;
     }
     setDeletePreviewLoading(true);
     const response = await doPreview(node);
     if (response.success && response.data) {
       setDeletePreview({
         files: response.data.files,
         directories: response.data.directories,
         total_items: response.data.total_items
       });
     }
     setDeletePreviewLoading(false);
  };

  // NO try-catch allowed. After delete + reload, loadFileTree auto-selects a live
  // first file when the active id is gone — clearing the stale selection upward.
  const handleConfirmDelete = async () => {
     if (!ensureAuthed()) return;
     if (!deleteTarget) return;
     const doDelete = source.delete;
     if (!doDelete) return;
     const target = deleteTarget;
     const response = await doDelete(target);
     setDeleteTarget(null);
     setDeletePreview(null);
     if (response.success) {
       if (selectedDir === target.id) setSelectedDir('');
       await loadFileTree();
     } else {
       setError(response.error);
     }
  };

  const dismissUpload = () => {
    setUploadItems([]);
    setBatchPct(0);
  };

  const visibleTree = filterTree(fileTree, search);

  // Capability-derived UI flags (explicit branching — no ||/?? in this file).
  const showTargetTools = source.canUpload === true ? true : source.canMkdir === true;
  const headerIcon = source.id === 'code' ? Code2 : Film;

  return (
    <BentoCard title={source.label} className="flex-1 flex flex-col min-h-0" icon={headerIcon} glowing>
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
          {showTargetTools && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 max-w-[200px]"
              title={`Target: ${targetDirLabel}`}
            >
              <Folder size={13} className="text-yellow-500/80 flex-shrink-0" />
              <span className="font-mono truncate">{targetDirLabel}</span>
            </span>
          )}
          {source.canUpload && (
            <button
              onClick={() => { if (!ensureAuthed()) return; setIsUploadOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 text-sm rounded-lg transition-colors border border-white/10"
              title={authed ? 'Upload files or a folder' : 'Login required to upload'}
            >
              {authed ? <UploadCloud size={16} /> : <Lock size={16} />}
              {authed ? 'Upload' : 'Login to upload'}
            </button>
          )}
          {source.canMkdir && (
            <button
              onClick={() => { if (!ensureAuthed()) return; setIsNewFolderOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
              title={authed ? 'Create folder in target' : 'Login required'}
            >
              {authed ? <FolderPlus size={16} /> : <Lock size={16} />}
              New Folder
            </button>
          )}
        </div>
      </div>

      {uploadItems.length > 0 && (
        <div className="mb-4">
          <UploadProgressCard items={uploadItems} batchPct={batchPct} onDismiss={dismissUpload} />
        </div>
      )}

      {browseBlocked ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
          <Lock size={32} className="text-amber-400" />
          <p className="text-sm">Login required to browse {source.label}.</p>
          <button
            onClick={() => { if (onRequireLogin) onRequireLogin(); }}
            className="mt-1 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            <Lock size={14} /> Login
          </button>
        </div>
      ) : loading ? (
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
          {visibleTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Folder size={48} className="mb-4 opacity-50" />
              <p>No files found</p>
            </div>
          ) : (
            visibleTree.map(node => (
              <FileTreeItem
                key={node.id}
                node={node}
                level={0}
                activeId={activeFileId}
                selectedDir={selectedDir}
                canRename={source.canRename}
                canDelete={source.canDelete}
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
    </BentoCard>
  );
};

export default FileTreePanel;
