import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Language, AsyncState, FileNode as ServerFileNode, FilePreview, TaskCategory, DispatchTask, TaskItem } from '../../types';
import { Folder, FolderOpen, FileCode, FileText, X, Plus, RefreshCw, Trash2, ArrowRight, ChevronRight, ChevronDown, Eye, Save, Loader2, AlertCircle } from "lucide-react";
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';
import FloatingTaskPlayer from '../FloatingTaskPlayer';
import { MOCK_TASKS } from '../../constants';

interface CodeBrowserProps {
  lang?: Language;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
  isOpen?: boolean;
}

const CodeLine = ({ num, content }: { num: number, content: string }) => (
    <div className="flex hover:bg-white/5 group">
        <span className="w-10 text-right pr-4 text-slate-600 select-none text-xs leading-6 font-mono group-hover:text-slate-400">{num}</span>
        <span className="text-slate-300 font-mono text-xs leading-6 whitespace-pre">{content}</span>
    </div>
);

const CodeBrowser: React.FC<CodeBrowserProps> = ({ lang = 'en' }) => {
    const [fileTree, setFileTree] = useState<AsyncState<ServerFileNode[]>>({
        data: [],
        loading: false,
        error: null,
        status: 'idle'
    });
    const [selectedFile, setSelectedFile] = useState<ServerFileNode | null>(null);
    const [fileContent, setFileContent] = useState<AsyncState<FilePreview>>({
        data: null,
        loading: false,
        error: null,
        status: 'idle'
    });
    const [tasks, setTasks] = useState<AsyncState<TaskCategory[]>>({
        data: null,
        loading: false,
        error: null,
        status: 'idle'
    });
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categoryTasks, setCategoryTasks] = useState<AsyncState<DispatchTask[]>>({
        data: null,
        loading: false,
        error: null,
        status: 'idle'
    });

    // State for Floating Task Windows (kept for potential future use)
    const [openTasks, setOpenTasks] = useState<string[]>([]);
    const [zIndices, setZIndices] = useState<Record<string, number>>({});
    const [topZ, setTopZ] = useState(100);

    const [rootPath, setRootPath] = useState<string>('');
    const [authRequired, setAuthRequired] = useState<boolean>(false);

    // NO try-catch allowed - backend must return consistent data
    useEffect(() => {
        const loadPathMapping = async () => {
            const response = await api.systemConfig.getPathMapping('code_browser');

            if (response.success && response.data) {
                setRootPath(response.data.path);
                await loadFileTree(response.data.path);
            } else {
                // Check if authentication required (401/403)
                if (response.status === 401 || response.status === 403) {
                    setAuthRequired(true);
                }
                setFileTree({
                    data: [],
                    loading: false,
                    error: response.error,
                    status: 'error'
                });
            }
        };
        loadPathMapping();
    }, []);

    const loadFileTree = async (path?: string) => {
        setFileTree(prev => ({ ...prev, loading: true, status: 'loading' }));

        // NO try-catch - backend handles errors
        const browsePath = path;
        if (!browsePath) {
            setFileTree({
                data: [],
                loading: false,
                error: 'Path configuration not loaded',
                status: 'error'
            });
            return;
        }

        const response = await api.serverManagerV1.browseFiles(browsePath);

        if (response.success && response.data) {
            setFileTree({
                data: response.data,
                loading: false,
                error: null,
                status: 'success'
            });
        } else {
            // Check if authentication required (401/403)
            if (response.status === 401 || response.status === 403) {
                setAuthRequired(true);
            }
            setFileTree({
                data: [],
                loading: false,
                error: response.error,
                status: 'error'
            });
        }
    };

    const toggleFolder = (node: ServerFileNode) => {
        if (node.type !== 'directory') return;

        setFileTree(prev => ({
            ...prev,
            data: prev.data.map(item =>
                item.path === node.path
                    ? { ...item, isOpen: !item.isOpen }
                    : item
            )
        }));
    };

    const handleOpenTask = (taskId: string) => {
        if (!openTasks.includes(taskId)) {
            setOpenTasks(prev => [...prev, taskId]);
            bringToFront(taskId);
        } else {
            bringToFront(taskId);
        }
    };

    const handleCloseTask = (taskId: string) => {
        setOpenTasks(prev => prev.filter(id => id !== taskId));
    };

    const bringToFront = (taskId: string) => {
        setTopZ(prev => prev + 1);
        setZIndices(prev => ({ ...prev, [taskId]: topZ + 1 }));
    };

    return (
        <div className="h-full flex gap-4 p-4 md:p-6 overflow-hidden">
            {/* Left: Task Queue Sidebar */}
            <BentoCard className="w-72 flex-shrink-0 flex flex-col" headerControls={
                 <div className="flex items-center gap-2">
                     <Plus size={14} className="text-slate-400 cursor-pointer hover:text-white" />
                     <RefreshCw size={14} className="text-slate-400 cursor-pointer hover:text-white" />
                 </div>
            } title="Tasks/Prompts">
                <div className="flex flex-col gap-2 p-2">
                    <select className="bg-black/20 border border-white/10 rounded text-xs text-slate-300 p-1 mb-2 outline-none">
                        <option>Global</option>
                        <option>My Tasks</option>
                    </select>

                    {MOCK_TASKS.map(task => (
                        <div key={task.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-medium text-slate-200 line-clamp-1" title={task.title}>{task.title}</h4>
                                <Trash2 size={12} className="text-slate-600 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-3">
                                <span>{task.size}</span>
                                <span>{task.date.split(' ')[1]}</span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleOpenTask(task.id)}
                                    className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 rounded px-2 py-1 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                                >
                                    <ArrowRight size={10} /> Queue
                                </button>
                                <button className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </BentoCard>

            {/* Main Area: Code Editor + Global Mapping */}
            <div className="flex-1 flex flex-col min-w-0 gap-4">
                
                {/* Upper: Code Browser & Editor */}
                <BentoCard title="Code Browser - Core Node Directory" className="flex-1 min-h-0 flex flex-col" headerControls={
                    <div className="flex items-center gap-2 text-xs text-emerald-500">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                         Mapped Directory: /www/programing/core_node
                    </div>
                }>
                    <div className="flex-1 flex min-h-0">
                        {/* File Tree (Simplified inline for layout match) */}
                        <div className="w-64 border-r border-white/5 p-2 hidden md:block overflow-y-auto">
                            {authRequired ? (
                                <div className="flex flex-col items-center justify-center h-full p-4">
                                    <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                                    <h3 className="text-sm font-semibold text-slate-200 mb-2">Authentication Required</h3>
                                    <p className="text-xs text-slate-400 text-center mb-4">
                                        This feature requires login. Please sign in to access the code browser.
                                    </p>
                                    <button className={`${commonClasses.button} text-xs px-4 py-2`}>
                                        Sign In
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 px-2 py-1 text-slate-400 hover:bg-white/5 rounded cursor-pointer">
                                        <FolderOpen size={14} className="text-yellow-500/80" />
                                        <span className="text-sm font-mono">core_node</span>
                                    </div>
                                    {['.analysis_reports', '.augment', '.cache', '.claude', '.codebuddy', '.compliance', '.cursor', '.install_state', '.opencode'].map(folder => (
                                        <div key={folder} className="flex items-center gap-2 px-2 py-1 ml-4 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded cursor-pointer transition-colors">
                                            <Folder size={14} className="text-slate-600" />
                                            <span className="text-sm font-mono">{folder}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]/50">
                            {/* Empty State / Select File Placeholder */}
                            {/* To match screenshot closely, showing Editor directly or "No file selected" */}
                            <div className="h-8 bg-black/20 flex items-center px-4 border-b border-white/5 text-xs text-slate-400 font-mono">
                                No file selected
                                <div className="ml-auto">
                                    <button className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded border border-red-500/30 flex items-center gap-1">
                                        <X size={10} /> Close
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 p-4 font-mono text-sm text-slate-500">
                                Select a file to edit...
                            </div>
                        </div>
                    </div>
                </BentoCard>

                {/* Lower: Edit Mapping Global */}
                <BentoCard title="Edit Mapping: Global" className="h-1/3 min-h-[250px] flex-shrink-0" headerControls={
                     <div className="flex gap-2">
                         <button className="px-3 py-1 bg-indigo-600 text-white text-xs rounded shadow hover:bg-indigo-500 transition-colors">Save</button>
                         <button className="px-3 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600 transition-colors">Reset</button>
                         <button className="px-3 py-1 bg-emerald-600/80 text-white text-xs rounded hover:bg-emerald-600 transition-colors">Preview</button>
                     </div>
                }>
                    <div className="p-4 space-y-4 overflow-y-auto">
                         <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-400 uppercase">Prefix</label>
                             <textarea className="w-full h-16 bg-black/20 border border-white/10 rounded-lg p-3 text-sm font-mono text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-all"></textarea>
                         </div>
                         
                         <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-400 uppercase">Suffix</label>
                             <textarea className="w-full h-16 bg-black/20 border border-white/10 rounded-lg p-3 text-sm font-mono text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-all"></textarea>
                         </div>

                         <div className="space-y-1">
                             <label className="text-xs font-bold text-slate-400 uppercase">Replace Map</label>
                             <button className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded text-xs font-medium hover:bg-emerald-600/30 transition-colors">
                                 <Plus size={12} /> Add Rule
                             </button>
                         </div>
                    </div>
                </BentoCard>
            </div>

            {/* Render Floating Windows */}
            {openTasks.map(taskId => {
                const task = MOCK_TASKS.find(t => t.id === taskId);
                if (!task) return null;
                return (
                    <FloatingTaskPlayer 
                        key={taskId}
                        task={task}
                        zIndex={zIndices[taskId] || 100}
                        onClose={() => handleCloseTask(taskId)}
                        onFocus={() => bringToFront(taskId)}
                        initialPos={{ x: 300 + Math.random() * 50, y: 150 + Math.random() * 50 }}
                    />
                );
            })}
        </div>
    );
};

export default CodeBrowser;