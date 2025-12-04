import React, { useState, useRef } from 'react';
import BentoCard from '../BentoCard';
import { TOOL_CATEGORIES, TOOL_UI_SCHEMAS } from '../../constants';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckCircle, Construction, Grid, Zap, Columns, Rows, UploadCloud, File as FileIcon, X, Trash2, Paperclip, Download } from "lucide-react";
import ToolWorkspace from '../tools/ToolWorkspace';
import AgeCalculator from '../tools/AgeCalculator';
import HexToRgb from '../tools/HexToRgb';
import PasswordGenerator from '../tools/PasswordGenerator';
import WordCounter from '../tools/WordCounter';
import UniversalTool from '../tools/UniversalTool';
import { LayoutMode } from '../../types';

interface UploadedFile {
    name: string;
    size: string;
    type: string;
}

const ToolsDashboard: React.FC = () => {
    // Persistent State for Clipboard Collapse
    const [isClipboardCollapsed, setIsClipboardCollapsed] = useState<boolean>(() => {
        const saved = localStorage.getItem('tool_clipboard_collapsed');
        return saved === 'true';
    });

    const [layoutMode, setLayoutMode] = useState<LayoutMode>('vertical');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeToolId, setActiveToolId] = useState<string | null>(null);
    
    // Clipboard File State
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([
        { name: 'desktop.ini', size: '520 Bytes', type: 'config' }
    ]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleClipboard = () => {
        const newState = !isClipboardCollapsed;
        setIsClipboardCollapsed(newState);
        localStorage.setItem('tool_clipboard_collapsed', String(newState));
    };

    const toggleLayout = () => {
        setLayoutMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
    };

    // File Upload Handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                name: file.name,
                size: formatSize(file.size),
                type: file.name.split('.').pop() || 'file'
            }));
            setUploadedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Filter tools logic
    const filteredTools = TOOL_CATEGORIES.flatMap(cat => 
        cat.tools.map(tool => ({ ...tool, categoryName: cat.name, categoryIcon: cat.icon }))
    ).filter(tool => {
        const matchesCategory = activeCategory === 'all' || 
            TOOL_CATEGORIES.find(c => c.id === activeCategory)?.tools.some(t => t.id === tool.id);
        const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Render Active Tool Logic
    const renderActiveTool = () => {
        if (!activeToolId) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-white/5 rounded-2xl bg-white/5 backdrop-blur-sm">
                    <Zap size={48} className="mb-4 opacity-20 text-indigo-400" />
                    <h3 className="text-lg font-bold text-slate-400">Ready for Input</h3>
                    <p className="text-sm opacity-60">Select a utility from the menu to begin.</p>
                </div>
            );
        }

        const tool = filteredTools.find(t => t.id === activeToolId);
        if (!tool) return null;

        const CommonWrapper = (Component: React.FC<any>) => (
            <ToolWorkspace tool={tool} onBack={() => setActiveToolId(null)}>
                {(config, setConfig) => <Component config={config} setConfig={setConfig} />}
            </ToolWorkspace>
        );

        switch (tool.id) {
            case 'calc1': return CommonWrapper(AgeCalculator);
            case 'col1': return CommonWrapper(HexToRgb);
            case 'ut4': return CommonWrapper(PasswordGenerator);
            case 'ta4': return CommonWrapper(WordCounter);
        }

        const schema = TOOL_UI_SCHEMAS[tool.id];
        if (schema) {
             return (
                <ToolWorkspace tool={tool} onBack={() => setActiveToolId(null)}>
                    {(config) => <UniversalTool config={config} schema={schema} />}
                </ToolWorkspace>
            );
        }

        return (
            <ToolWorkspace tool={tool} onBack={() => setActiveToolId(null)}>
                {(config) => (
                    <BentoCard title="Under Construction" className="h-full flex items-center justify-center">
                        <div className="text-center text-slate-500">
                            <Construction size={48} className="mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-bold text-slate-300">Tool Module Initializing</h3>
                            <p className="max-w-xs mx-auto mt-2 text-sm">
                                This interface is currently being compiled.
                            </p>
                        </div>
                    </BentoCard>
                )}
            </ToolWorkspace>
        );
    };

    // Dynamic Classes for Layout
    const isVert = layoutMode === 'vertical';

    return (
        <div className="h-full flex overflow-hidden p-4 gap-4">
            
            {/* Main Content Area (Clipboard + Active Tool) */}
            <div className={`flex-1 flex gap-4 min-w-0 ${isVert ? 'flex-col' : 'flex-row'}`}>
                
                {/* Clipboard Section */}
                <div className={`
                    flex-shrink-0 transition-all duration-500 ease-in-out
                    ${isVert 
                        ? (isClipboardCollapsed ? 'h-14 w-full' : 'h-[45%] w-full') 
                        : (isClipboardCollapsed ? 'w-14 h-full' : 'w-[40%] h-full')
                    }
                `}>
                    <BentoCard 
                        title={isClipboardCollapsed && !isVert ? undefined : "Online Clipboard"} 
                        className="h-full"
                        glowing={!isClipboardCollapsed}
                        headerControls={
                            <div className={`flex items-center gap-2 ${isVert ? '' : 'flex-col'}`}>
                                <button 
                                    onClick={toggleLayout} 
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                                    title="Toggle Layout"
                                >
                                    {isVert ? <Columns size={16} /> : <Rows size={16} />}
                                </button>
                                <button 
                                    onClick={toggleClipboard}
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                                >
                                    {isVert 
                                        ? (isClipboardCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />)
                                        : (isClipboardCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />)
                                    }
                                </button>
                            </div>
                        }
                    >
                        <div className={`p-4 h-full flex flex-col gap-4 transition-opacity duration-300 ${isClipboardCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            {/* Namespace Input */}
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-slate-500 font-bold uppercase">Namespace:</span>
                                <input type="text" value="1" className="bg-black/20 border border-white/10 rounded px-3 py-1 text-white w-24 text-center text-xs font-mono font-bold" readOnly />
                                <div className="ml-auto flex gap-2">
                                    <button className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded text-xs">Load / Enter</button>
                                    <button className="px-3 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-white/10 rounded text-xs">Generate New</button>
                                </div>
                            </div>

                            {/* Text Area */}
                            <div className="relative flex-1 min-h-[100px]">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Text Content (auto-saves on change):</label>
                                <textarea 
                                    className="w-full h-[calc(100%-20px)] bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-lg p-3 font-mono text-xs text-slate-600 dark:text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                    defaultValue={`API key not found. Check that<meta-data android:name="com.google.android.geo.API_KEY" ...`}
                                ></textarea>
                            </div>

                            {/* File Upload Area */}
                            <div className="flex-shrink-0">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Upload Files:</label>
                                <div 
                                    className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-black/5 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        multiple 
                                        className="hidden" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                    />
                                    <UploadCloud size={24} className="text-slate-400" />
                                    <p className="text-xs text-slate-500">Drop files here or click to upload</p>
                                    <p className="text-[10px] text-slate-600">Any file type allowed</p>
                                </div>
                            </div>

                            {/* File List */}
                            {uploadedFiles.length > 0 && (
                                <div className="flex-shrink-0 flex flex-col gap-2 max-h-32 overflow-y-auto pr-2">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Uploaded Files:</label>
                                    {uploadedFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-md group">
                                            <FileIcon size={14} className="text-indigo-500" />
                                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{file.name}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">{file.size}</span>
                                            <button className="text-indigo-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Download size={12} />
                                            </button>
                                            <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Action Bar */}
                            <div className="flex justify-start gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                                <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1">
                                    <Paperclip size={12} /> New Clipboard
                                </button>
                                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium flex items-center gap-1">
                                    <FileIcon size={12} /> Copy All Text
                                </button>
                                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium flex items-center gap-1">
                                    <Trash2 size={12} /> Clear Text
                                </button>
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* Active Tool Area */}
                <div className="flex-1 min-h-0 relative">
                    {renderActiveTool()}
                </div>

            </div>

            {/* Right Sidebar - Tool Menu */}
            <div className="w-16 hover:w-72 transition-all duration-300 ease-in-out flex-shrink-0 z-20 group relative">
                <BentoCard className="h-full flex flex-col absolute inset-0 bg-slate-900/90 backdrop-blur-xl border-l border-white/10 z-20">
                    {/* Header / Search */}
                    <div className="p-3 border-b border-white/10 flex items-center justify-center h-14 overflow-hidden">
                        <div className="w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                             <Search className="text-slate-500 flex-shrink-0" size={16} />
                             <input 
                                type="text" 
                                placeholder="Search tools..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent text-sm text-white placeholder-slate-600 outline-none"
                             />
                        </div>
                        <Grid size={20} className="text-slate-400 absolute group-hover:hidden transition-opacity" />
                    </div>

                    <div className="flex-1 flex min-h-0">
                         {/* Icon Strip */}
                         <div className="w-16 flex-shrink-0 flex flex-col items-center py-2 gap-2 border-r border-white/5 bg-black/20 overflow-y-auto scrollbar-none">
                            <button 
                                onClick={() => setActiveCategory('all')} 
                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${activeCategory === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-400 hover:bg-white/5'}`}
                                title="All Tools"
                            >
                                <Grid size={18} />
                            </button>
                            {TOOL_CATEGORIES.map(cat => (
                                <button 
                                    key={cat.id} 
                                    onClick={() => setActiveCategory(cat.id)} 
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${activeCategory === cat.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-400 hover:bg-white/5'}`}
                                    title={cat.name}
                                >
                                    <cat.icon size={18} />
                                </button>
                            ))}
                         </div>

                         {/* Expanded List */}
                         <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/50">
                             <div className="mb-2 px-2 pt-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {activeCategory === 'all' ? 'All Utilities' : TOOL_CATEGORIES.find(c => c.id === activeCategory)?.name}
                                </h3>
                             </div>
                             
                             <div className="space-y-1">
                                {filteredTools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => { setActiveToolId(tool.id); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${activeToolId === tool.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeToolId === tool.id ? 'bg-indigo-500' : 'bg-slate-600'}`} />
                                        <span className="truncate">{tool.name}</span>
                                    </button>
                                ))}
                                {filteredTools.length === 0 && (
                                    <div className="p-4 text-center text-slate-500 text-xs">
                                        No tools found.
                                    </div>
                                )}
                             </div>
                         </div>
                    </div>
                    
                    {/* Footer Info */}
                    <div className="p-3 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-600 text-center">
                        {filteredTools.length} Tools Available
                    </div>
                </BentoCard>
            </div>

        </div>
    );
};

export default ToolsDashboard;