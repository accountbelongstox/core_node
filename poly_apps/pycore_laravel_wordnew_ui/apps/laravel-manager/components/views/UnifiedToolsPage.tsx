import React, { useState, useMemo } from 'react';
import { ALL_TOOLS, getAllCategories } from '@/apps/laravel-manager/config/tools.config';
import { ToolDefinition } from '@/apps/laravel-manager/types';
import { api } from '@/apps/laravel-manager/api';
import { useToast } from '../admin';
import {
  Search, Star, Clock, Play, Loader, Copy, Check, X, ChevronRight, ChevronLeft,
  Sparkles, Wrench, Hash, Code, Calculator, Globe, Image, FileCode, Lock,
  Database, Network, Type, Layers, Info, BookOpen, Boxes,
  Lightbulb, History, StarOff, Menu, FileText, FileJson, ArrowLeft, Ban
} from 'lucide-react';
import { downloadAsFile, toJsonString, copyToClipboard, buildExportFilename } from '@/apps/laravel-manager/utils/exportResult';
import MCPManager from './MCPManager';
import AITools from './AITools';

// Sentinel "category" that swaps the tool grid for the embedded MCP Server
// utilities (screenshots + placeholder images), relocated here when the
// standalone #/mcp tab was removed.
const MCP_TOOLS_CATEGORY = '__mcp_server__';
const AI_TOOLS_CATEGORY = '__ai_tools__';

/**
 * Unified Tools Page — theme-aware, responsive redesign.
 *
 * Layout:
 * - Top bar: title, Tools/Favorites/Recent tabs, search.
 * - Left: category nav (collapsible drawer on mobile, fixed rail on desktop).
 * - Main: responsive card grid to browse tools; clicking a card opens the
 *   tool detail + execute panel. Backend-missing tools are shown muted with a
 *   disabled Execute button.
 */

interface ToolHistory {
  toolId: string;
  toolName: string;
  timestamp: number;
  input: any;
  output: any;
}

type ViewTab = 'all' | 'favorites' | 'recent';

// Category metadata: icon + a single accent colour reused for text/border/bg.
// Theme-aware tints are applied at render time via Tailwind `dark:` variants.
const categoryConfig: Record<string, { icon: any; accent: string }> = {
  'Crypto & Security': { icon: Lock, accent: 'emerald' },
  'Converters': { icon: Code, accent: 'blue' },
  'Web Development': { icon: Globe, accent: 'cyan' },
  'Text Processing': { icon: Type, accent: 'purple' },
  'Math & Calculators': { icon: Calculator, accent: 'orange' },
  'Network Tools': { icon: Network, accent: 'pink' },
  'Image Tools': { icon: Image, accent: 'amber' },
  'PDF Tools': { icon: FileCode, accent: 'indigo' },
  'AI Tools': { icon: Sparkles, accent: 'fuchsia' },
  'Server Manager': { icon: Wrench, accent: 'teal' },
  'Media Tools': { icon: Database, accent: 'lime' },
  'Vocabulary': { icon: BookOpen, accent: 'rose' },
};

const FALLBACK_CATEGORY = { icon: Hash, accent: 'slate' };

const getCategoryMeta = (category: string) => categoryConfig[category] || FALLBACK_CATEGORY;

// Map an accent name to a set of theme-aware utility classes. Keeping the
// strings literal (no dynamic interpolation) so Tailwind's JIT can see them.
const accentClasses: Record<string, { chip: string; iconBg: string; ring: string }> = {
  emerald: { chip: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/40' },
  blue: { chip: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10', iconBg: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/40' },
  cyan: { chip: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10', iconBg: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-500/40' },
  purple: { chip: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10', iconBg: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400', ring: 'ring-purple-500/40' },
  orange: { chip: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10', iconBg: 'bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400', ring: 'ring-orange-500/40' },
  pink: { chip: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10', iconBg: 'bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/40' },
  amber: { chip: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10', iconBg: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/40' },
  indigo: { chip: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10', iconBg: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-500/40' },
  fuchsia: { chip: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/10', iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-500/40' },
  teal: { chip: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10', iconBg: 'bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400', ring: 'ring-teal-500/40' },
  lime: { chip: 'text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-500/10', iconBg: 'bg-lime-100 dark:bg-lime-500/15 text-lime-600 dark:text-lime-400', ring: 'ring-lime-500/40' },
  rose: { chip: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10', iconBg: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400', ring: 'ring-rose-500/40' },
  slate: { chip: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10', iconBg: 'bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400', ring: 'ring-slate-500/40' },
};

const getAccent = (accent: string) => accentClasses[accent] || accentClasses.slate;

// Shared theme-aware control classes (mirrors styles/theme.ts commonClasses).
const inputCls =
  'w-full px-3 py-2 rounded-lg text-sm transition-all border border-slate-300 dark:border-slate-600 ' +
  'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500';

export function UnifiedToolsPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Tool execution state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Favorites and history (localStorage-backed — keys preserved)
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('unified_tool_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<ToolHistory[]>(() => {
    const saved = localStorage.getItem('unified_tool_history');
    return saved ? JSON.parse(saved) : [];
  });

  const toast = useToast();
  const categories = getAllCategories();

  // Recent tools (last 10 distinct)
  const recentTools = history
    .slice(0, 10)
    .map(h => ALL_TOOLS[h.toolId])
    .filter((t): t is ToolDefinition => Boolean(t));

  // Per-category counts for the nav (respects the active tab, ignores search).
  const tabScopedTools = useMemo<ToolDefinition[]>(() => {
    if (activeTab === 'favorites') return Object.values(ALL_TOOLS).filter(t => favorites.includes(t.id));
    if (activeTab === 'recent') return recentTools;
    return Object.values(ALL_TOOLS);
  }, [activeTab, favorites, history]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tabScopedTools.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, [tabScopedTools]);

  // Tools shown in the grid: tab + category + search filters.
  const gridTools = useMemo<ToolDefinition[]>(() => {
    let tools = tabScopedTools;
    if (selectedCategory !== 'all') tools = tools.filter(t => t.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return tools;
  }, [tabScopedTools, selectedCategory, searchQuery]);

  // Toggle favorite
  const toggleFavorite = (toolId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId];
      localStorage.setItem('unified_tool_favorites', JSON.stringify(next));
      return next;
    });
  };

  // Add to history
  const addToHistory = (tool: ToolDefinition, input: any, output: any) => {
    setHistory(prev => {
      const next = [
        { toolId: tool.id, toolName: tool.name, timestamp: Date.now(), input, output },
        ...prev.filter(h => h.toolId !== tool.id)
      ].slice(0, 50);
      localStorage.setItem('unified_tool_history', JSON.stringify(next));
      return next;
    });
  };

  // Open a tool's detail panel
  const handleToolSelect = (tool: ToolDefinition) => {
    setSelectedTool(tool);
    setFormData({});
    setResult(null);
    setError(null);
    setMobileNavOpen(false);
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Execute tool (contract preserved: const [m,fn]=apiMethod.split('.'); api[m][fn](formData))
  const executeTool = async () => {
    if (!selectedTool || selectedTool.unavailable) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const [moduleName, methodName] = selectedTool.apiMethod.split('.');
      const apiModule = (api as any)[moduleName];

      if (!apiModule || typeof apiModule[methodName] !== 'function') {
        throw new Error(`API method ${selectedTool.apiMethod} not found`);
      }

      const response = await apiModule[methodName](formData);

      if (response.success) {
        setResult(response.data);
        addToHistory(selectedTool, formData, response.data);
        toast.success(`${selectedTool.name} executed successfully`);
      } else {
        setError(response.message || 'Operation failed');
        toast.error(response.message || 'Operation failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'An error occurred';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const getResultAsText = (): string =>
    typeof result === 'string' ? result : toJsonString(result);

  const copyResult = async () => {
    if (!result) return;
    const ok = await copyToClipboard(getResultAsText());
    if (ok) {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const exportResultAsJson = () => {
    if (!result) return;
    const toolId = selectedTool?.id || 'result';
    downloadAsFile(toJsonString(result), buildExportFilename(toolId, 'json'), 'application/json');
    toast.success('Exported as JSON');
  };

  const exportResultAsTxt = () => {
    if (!result) return;
    const toolId = selectedTool?.id || 'result';
    downloadAsFile(getResultAsText(), buildExportFilename(toolId, 'txt'), 'text/plain');
    toast.success('Exported as TXT');
  };

  // Render a dynamic form field (enum→select, number→number, boolean→checkbox,
  // file→file, else textarea). Contract preserved.
  const renderFormField = (fieldName: string, fieldSchema: any) => {
    const value = formData[fieldName] ?? '';
    const isRequired = selectedTool?.inputSchema.required?.includes(fieldName);
    const label = (fieldSchema.title as string) ||
      fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

    return (
      <div key={fieldName} className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
          {isRequired && <span className="text-rose-500 ml-1">*</span>}
        </label>

        {fieldSchema.enum ? (
          <select
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value)}
            className={inputCls}
          >
            <option value="">Select...</option>
            {fieldSchema.enum.map((option: any) => (
              <option key={String(option)} value={option}>{String(option)}</option>
            ))}
          </select>
        ) : fieldSchema.type === 'number' ? (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value === '' ? '' : parseFloat(e.target.value))}
            className={inputCls}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        ) : fieldSchema.type === 'boolean' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleInputChange(fieldName, e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">Enable</span>
          </label>
        ) : fieldSchema.type === 'file' ? (
          <input
            type="file"
            accept={fieldSchema.accept}
            onChange={(e) => handleInputChange(fieldName, e.target.files?.[0])}
            className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(fieldName, e.target.value)}
            rows={3}
            className={inputCls + ' resize-none'}
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
        )}
      </div>
    );
  };

  // ---- Category nav (shared between desktop rail + mobile drawer) ----
  // A render function (not a nested component) so the nav is NOT remounted on
  // every keystroke/state change.
  const renderCategoryNav = () => (
    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
      <button
        onClick={() => { setSelectedCategory(AI_TOOLS_CATEGORY); setSelectedTool(null); setMobileNavOpen(false); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          selectedCategory === AI_TOOLS_CATEGORY
            ? 'bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/30'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">AI Tools</span>
      </button>

      <button
        onClick={() => { setSelectedCategory('all'); setMobileNavOpen(false); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          selectedCategory === 'all'
            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Layers className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">All Tools</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
          {tabScopedTools.length}
        </span>
      </button>

      {categories
        .filter(cat => (categoryCounts[cat] || 0) > 0)
        .sort((a, b) => a.localeCompare(b))
        .map(category => {
          const meta = getCategoryMeta(category);
          const accent = getAccent(meta.accent);
          const Icon = meta.icon;
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => { setSelectedCategory(category); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? `${accent.chip} ring-1 ${accent.ring}`
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{category}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                {categoryCounts[category]}
              </span>
            </button>
          );
        })}

      {/* MCP Server utilities (screenshots + placeholder), embedded from the
          former #/mcp tab. */}
      <button
        onClick={() => { setSelectedCategory(MCP_TOOLS_CATEGORY); setSelectedTool(null); setMobileNavOpen(false); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          selectedCategory === MCP_TOOLS_CATEGORY
            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Boxes className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">MCP Server</span>
      </button>
    </nav>
  );

  // ---- Tool card (grid browse view) ----
  // Render function (not a nested component) so cards aren't remounted on every
  // keystroke. The card is a focusable <div> (role=button) so the favorite
  // <button> can nest inside it without invalid nested-interactive markup.
  const renderToolCard = (tool: ToolDefinition) => {
    const meta = getCategoryMeta(tool.category);
    const accent = getAccent(meta.accent);
    const Icon = meta.icon;
    const isFav = favorites.includes(tool.id);
    return (
      <div
        key={tool.id}
        role="button"
        tabIndex={0}
        onClick={() => handleToolSelect(tool)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToolSelect(tool); } }}
        className={`group relative cursor-pointer text-left flex flex-col gap-3 p-4 rounded-xl border transition-all
          bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60
          hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/50
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
          ${tool.unavailable ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg ${accent.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={(e) => toggleFavorite(tool.id, e)}
            className="p-1.5 -m-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`} />
          </button>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{tool.name}</h3>
            {tool.unavailable && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                <Ban className="w-2.5 h-2.5" /> Soon
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{tool.description}</p>
        </div>
        <span className={`mt-auto inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${accent.chip}`}>
          {tool.category}
        </span>
      </div>
    );
  };

  const tabBtn = (tab: ViewTab, label: string, Icon: any, count: number, activeCls: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === tab
          ? activeCls
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
      }`}
    >
      <Icon className={`w-4 h-4 ${tab === 'favorites' && activeTab === tab ? 'fill-current' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
      <span className="px-1.5 py-0.5 bg-black/10 dark:bg-white/15 rounded-full text-xs">{count}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3">
          {/* Mobile nav toggle */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Categories"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="relative">
              <Wrench className="w-7 h-7 text-indigo-500" />
              <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">Tools</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{Object.keys(ALL_TOOLS).length} tools</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:flex-none order-2 sm:order-none min-w-[160px] sm:min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className={inputCls + ' pl-9 sm:w-60'}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex justify-center border-t border-slate-200/80 dark:border-slate-800/80 px-4 py-2">
          <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-1">
            {tabBtn('all', 'Tools', Layers, Object.keys(ALL_TOOLS).length, 'bg-indigo-600 text-white shadow-sm')}
            {tabBtn('favorites', 'Favorites', Star, favorites.length, 'bg-amber-500 text-white shadow-sm')}
            {tabBtn('recent', 'Recent', Clock, history.length, 'bg-purple-600 text-white shadow-sm')}
          </div>
        </nav>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop category rail */}
        <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-sm">Categories</h2>
          </div>
          {renderCategoryNav()}
        </aside>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
            <aside className="relative w-72 max-w-[80%] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <h2 className="font-semibold text-sm">Categories</h2>
                </div>
                <button onClick={() => setMobileNavOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderCategoryNav()}
            </aside>
          </div>
        )}

        {/* Main area: MCP server panel OR grid browse OR tool detail */}
        <main className="flex-1 flex overflow-hidden">
          {selectedCategory === AI_TOOLS_CATEGORY ? (
            <section className="flex-1 overflow-hidden">
              <AITools />
            </section>
          ) : selectedCategory === MCP_TOOLS_CATEGORY ? (
            <section className="flex-1 overflow-auto p-4 sm:p-6">
              <MCPManager allowedTabs={['screenshots', 'placeholder']} />
            </section>
          ) : selectedTool ? (
            <>
              {/* Detail + execute panel */}
              <section className="flex-1 flex flex-col overflow-hidden">
                {/* Detail header */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setSelectedTool(null)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-2"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to tools
                      </button>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{selectedTool.name}</h2>
                        <button
                          onClick={(e) => toggleFavorite(selectedTool.id, e)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Star className={`w-5 h-5 ${favorites.includes(selectedTool.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                        </button>
                        {selectedTool.unavailable && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                            <Ban className="w-3 h-3" /> Unavailable / coming soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{selectedTool.description}</p>
                      {(() => {
                        const meta = getCategoryMeta(selectedTool.category);
                        const accent = getAccent(meta.accent);
                        const Icon = meta.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${accent.chip}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {selectedTool.category}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowInfoPanel(!showInfoPanel)}
                        className={`hidden xl:inline-flex p-2 rounded-lg transition-all ${
                          showInfoPanel ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title="Toggle info panel"
                      >
                        <Info className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSelectedTool(null)}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form + result */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="max-w-3xl mx-auto space-y-5">
                    {selectedTool.unavailable && (
                      <div className="rounded-xl p-4 border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10">
                        <div className="flex items-start gap-3">
                          <Ban className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            This tool's backend isn't available yet. The form is shown for preview, but execution is disabled.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Input */}
                    <div className="rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40">
                      <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <Code className="w-4 h-4 text-indigo-500" />
                        Input
                      </h3>
                      <div className="space-y-4">
                        {Object.keys(selectedTool.inputSchema.properties || {}).length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400">This tool takes no parameters. Just run it.</p>
                        ) : (
                          Object.entries(selectedTool.inputSchema.properties || {}).map(([fieldName, fieldSchema]) =>
                            renderFormField(fieldName, fieldSchema)
                          )
                        )}
                      </div>
                    </div>

                    {/* Execute */}
                    <button
                      onClick={executeTool}
                      disabled={isLoading || selectedTool.unavailable}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white transition-all shadow-sm
                        bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {selectedTool.unavailable ? (
                        <>
                          <Ban className="w-5 h-5" />
                          Unavailable
                        </>
                      ) : isLoading ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Execute
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Error */}
                    {error && (
                      <div className="rounded-xl p-4 border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20">
                            <X className="w-5 h-5 text-rose-500" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-rose-600 dark:text-rose-400 mb-1">Error</h4>
                            <p className="text-rose-600/90 dark:text-rose-300 text-sm">{error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Result */}
                    {result && (
                      <div className="rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                          <h3 className="text-base font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <Check className="w-5 h-5" />
                            Result
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={copyResult}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                              {copied ? (
                                <><Check className="w-4 h-4 text-emerald-500" /><span className="text-emerald-500">Copied!</span></>
                              ) : (
                                <><Copy className="w-4 h-4" />Copy</>
                              )}
                            </button>
                            <button
                              onClick={exportResultAsJson}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                              title="Download result as a JSON file"
                            >
                              <FileJson className="w-4 h-4" />JSON
                            </button>
                            <button
                              onClick={exportResultAsTxt}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                              title="Download result as a plain text file"
                            >
                              <FileText className="w-4 h-4" />TXT
                            </button>
                          </div>
                        </div>
                        <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-950/50">
                          <pre className="text-sm text-slate-800 dark:text-emerald-400 overflow-x-auto font-mono whitespace-pre-wrap break-words">
                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Info panel (desktop xl+) */}
              {showInfoPanel && (
                <aside className="hidden xl:flex w-80 flex-col border-l border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <BookOpen className="w-4 h-4 text-purple-500" />
                      Information
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-1">About</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{selectedTool.description}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10">
                      <Lightbulb className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-purple-600 dark:text-purple-400 text-sm mb-1">Tips</h4>
                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 leading-relaxed">
                          <li>• Fill in all required fields marked with *</li>
                          <li>• Results can be copied or exported</li>
                          <li>• Star a tool for quick access</li>
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-1">API Method</div>
                      <code className="text-xs text-cyan-600 dark:text-cyan-400 font-mono break-all">{selectedTool.apiMethod}</code>
                    </div>

                    {history.filter(h => h.toolId === selectedTool.id).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <History className="w-4 h-4 text-slate-400" />
                          Recent Usage
                        </h4>
                        <div className="space-y-1">
                          {history.filter(h => h.toolId === selectedTool.id).slice(0, 3).map((h, i) => (
                            <div key={i} className="text-xs text-slate-500 p-2 rounded bg-slate-100 dark:bg-slate-800/40">
                              {new Date(h.timestamp).toLocaleString()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
              )}
            </>
          ) : (
            /* Grid browse view */
            <section className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedCategory === 'all' ? 'All Tools' : selectedCategory}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {gridTools.length} {gridTools.length === 1 ? 'tool' : 'tools'}
                    {searchQuery && <> matching “{searchQuery}”</>}
                  </p>
                </div>
              </div>

              {gridTools.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {gridTools.map((tool: ToolDefinition) => renderToolCard(tool))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto">
                  <div className="p-5 rounded-full bg-slate-100 dark:bg-slate-800/60 mb-4">
                    {activeTab === 'favorites' ? (
                      <StarOff className="w-12 h-12 text-slate-400" />
                    ) : activeTab === 'recent' ? (
                      <Clock className="w-12 h-12 text-slate-400" />
                    ) : (
                      <Search className="w-12 h-12 text-slate-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {activeTab === 'favorites'
                      ? 'No favorites yet'
                      : activeTab === 'recent'
                      ? 'No recent tools'
                      : 'No tools found'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {activeTab === 'favorites'
                      ? 'Star a tool to pin it here for quick access.'
                      : activeTab === 'recent'
                      ? 'Tools you run will appear here.'
                      : searchQuery
                      ? 'Try a different search term or category.'
                      : 'No tools in this category.'}
                  </p>
                  {(searchQuery || selectedCategory !== 'all') && (
                    <button
                      onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" /> Clear filters
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
